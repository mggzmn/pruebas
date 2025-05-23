import { ActionExecutor } from "../utils/ActionExecutor.js";
import { ModalAudioController } from "../controllers/ModalAudioController.js";
import { ModalAudioConfig } from "../configs/modalAudioConfig.js";
import { SectionIdUtils } from "../utils/SectionIdUtils.js";
import { ModalComponent } from "../components/ModalComponent.js";

/**
 * Gestiona la creación, apertura y cierre de modales
 */
export class ModalManager {
  /**
   * Constructor
   * @param {Object} courseController - Controlador principal del curso
   */
  constructor(courseController) {
    this.courseController = courseController;
    this.modals = new Map(); // Mapa de componentes modales
    this.activeModalId = null;
    this.overlayElement = null;

    // Control de modales por sección
    this.sectionModals = new Map(); // Mapeo de sección -> array de IDs de modales
    this.modalSection = new Map(); // Mapeo inverso: modal ID -> sección ID
    this.sectionActions = new Map(); // Acciones a ejecutar cuando todos los modales de una sección están vistos
    this.sectionCompletionStatus = new Map(); // Estado de completado de secciones

    // Inicializar el controlador de audio para modales
    this.modalAudioController = new ModalAudioController(courseController);

    // Usar directamente la configuración importada
    this.audioConfig = ModalAudioConfig;

    this._init();
  }

  /**
   * Inicializa el gestor de modales
   * @private
   */
  _init() {
    // Buscar o crear el overlay
    this._setupOverlay();

    // Registrar todos los modales existentes
    this._registerExistingModals();

    // Asignar este ModalManager al courseController para que los componentes puedan acceder a él
    this.courseController.modalManager = this;

    console.log("ModalManager: Inicializado");
    console.log("ModalManager: Audio config keys:", Object.keys(this.audioConfig || {}));
  }

  /**
   * Configura el elemento overlay
   * @private
   */
  _setupOverlay() {
    // Buscar overlay existente
    this.overlayElement = document.querySelector(".modal-overlay");

    // Si no existe, crear uno nuevo
    if (!this.overlayElement) {
      this.overlayElement = document.createElement("div");
      this.overlayElement.className = "modal-overlay";
      document.body.appendChild(this.overlayElement);
      console.log("ModalManager: Created new overlay");
    }

    // Configurar manejador de clics
    this.overlayElement.addEventListener("click", (e) => {
      if (e.target === this.overlayElement) {
        this.closeActiveModal();
      }
    });
  }

  /**
   * Registra todos los modales existentes en el DOM
   * @private
   */
  _registerExistingModals() {
    const modalElements = document.querySelectorAll(".modal-content[id], .modal[id] > .modal-content");
    let count = 0;

    modalElements.forEach((el) => {
      const id = el.id || el.closest(".modal")?.id;
      if (id && !this.modals.has(id)) {
        try {
          // Asegurarse de usar el elemento .modal-content
          const modalContent = el.classList.contains("modal-content") ? el : el.querySelector(".modal-content");
          if (modalContent) {
            // Usar el import directo, no require
            if (modalContent.parentElement !== this.overlayElement) {
              this.overlayElement.appendChild(modalContent);
            }
            const modalComponent = new ModalComponent(modalContent, this.courseController);
            this.modals.set(id, modalComponent);
            count++;
          }
        } catch (error) {
          console.error(`ModalManager: Error al inicializar el modal #${id}:`, error);
        }
      }
    });

    if (count > 0) {
      console.log(`ModalManager: Registrados ${count} nuevos modales. Total: ${this.modals.size}`);
    }
  }

  /**
   * Abre un modal por su ID
   * @param {string} modalId - ID del modal a abrir
   */
  openModal(modalId) {
    console.log(`ModalManager: Solicitud para abrir el modal ${modalId}`);
    if (modalId.startsWith("#")) {
      modalId = modalId.substring(1);
    }
    this._registerExistingModals();
    console.log("Modales registrados actualmente:", Array.from(this.modals.keys()));

    // Manejar modal ya abierto
    if (this.activeModalId) {
      console.log(`ModalManager: Cerrando el modal activo actualmente ${this.activeModalId}`);
      this.closeModal(this.activeModalId);
    }

    // Encontrar el modal solicitado
    const modalComponent = this.modals.get(modalId);
    if (!modalComponent) {
      console.error(`ModalManager: Modal ${modalId} no encontrado`);
      // Salida de depuración para ayudar a encontrar el problema
      console.log("Modales disponibles:", Array.from(this.modals.keys()));
      return;
    }

    // Mostrar el overlay
    this.showOverlay();

    // Establecer como modal activo
    this.activeModalId = modalId;

    // Abrir el modal
    modalComponent.open();
    console.log(`ModalManager: Modal ${modalId} abierto exitosamente`);
  }

  /**
   * Cierra un modal específico
   * @param {string} modalId - ID del modal a cerrar
   */
  closeModal(modalId) {
    console.log(`ModalManager: Cerrando modal ${modalId}`);

    // Si el ID comienza con #, quitarlo
    if (modalId.startsWith("#")) {
      modalId = modalId.substring(1);
    }

    // Verificar si es el modal activo
    if (this.activeModalId === modalId) {
      // Detener el audio del modal primero
      if (this.modalAudioController) {
        this.modalAudioController.stopModalAudio();
      }

      // Cerrar el modal
      const modalComponent = this.modals.get(modalId);
      if (modalComponent) {
        modalComponent.close();
      }

      // Ocultar el overlay
      this._forceHideOverlay();

      // Limpiar referencia al modal activo
      this.activeModalId = null;
    } else {
      console.warn(`ModalManager: Intento de cerrar un modal que no está activo: ${modalId}`);
    }
  }

  /**
   * Cierra el modal activo
   */
  closeActiveModal() {
    if (this.activeModalId) {
      this.closeModal(this.activeModalId);
    }
  }

  /**
   * Muestra el overlay
   */
  showOverlay() {
    if (this.overlayElement) {
      this.overlayElement.classList.add("active");
    }
  }

  /**
   * Oculta forzadamente el overlay
   * @private
   */
  _forceHideOverlay() {
    if (this.overlayElement) {
      this.overlayElement.classList.remove("active");
      console.log("ModalManager: Ocultando forzadamente el overlay");
    }
  }



  /**
   * Registra modales asociados a una sección específica
   * @param {string} sectionId - ID de la sección
   * @param {Array<string>} modalIds - Array de IDs de modales asociados a la sección
   * @param {Array<Object>} completionActions - Acciones a ejecutar cuando todos los modales sean vistos
   */
  registerSectionModals(sectionId, modalIds, completionActions = []) {
    if (!sectionId || !modalIds || !Array.isArray(modalIds)) {
      console.error("ModalManager: Parámetros inválidos para registerSectionModals");
      return;
    }

    // Usar siempre el ID compuesto
    const pageId = this.courseController.stateManager.pages[this.courseController.stateManager.getCurrentPage()]?.id;
    const compoundSectionId = SectionIdUtils.normalizeId(sectionId, pageId);

    // Verificar si esta sección ya tiene modales registrados
    const existingStatus = this.sectionCompletionStatus.get(compoundSectionId);

    if (existingStatus) {
      console.log(`ModalManager: La sección ${compoundSectionId} ya tiene ${existingStatus.totalModals} modales registrados con ${existingStatus.viewedModals.size} vistos. Conservando el estado.`);

      // Si ya existe un registro, actualizamos las acciones de completado sin resetear el progreso
      if (completionActions && completionActions.length > 0) {
        this.sectionActions.set(compoundSectionId, [...completionActions]);
        console.log(`ModalManager: Actualizadas acciones de completado para sección ${compoundSectionId}`);
      }

      // Verificamos si todos los modales ya fueron vistos
      if (existingStatus.viewedModals.size >= existingStatus.totalModals && !existingStatus.completed) {
        console.log(`ModalManager: Al registrar, se detectaron todos los modales vistos para sección ${compoundSectionId}`);
        existingStatus.completed = true;
        this._executeCompletionActions(compoundSectionId);
      }

      return;
    }

    console.log(`ModalManager: Registrando ${modalIds.length} modales para la sección ${compoundSectionId}`);

    // Almacenar la asociación sección -> modales
    this.sectionModals.set(compoundSectionId, [...modalIds]);

    // Almacenar la asociación inversa modal -> sección
    modalIds.forEach((modalId) => {
      this.modalSection.set(modalId, compoundSectionId);
    });

    // Almacenar las acciones de completado
    if (completionActions && completionActions.length > 0) {
      this.sectionActions.set(compoundSectionId, [...completionActions]);
    }

    // Inicializar el estado de completado
    this.sectionCompletionStatus.set(compoundSectionId, {
      totalModals: modalIds.length,
      viewedModals: new Set(),
      completed: false,
    });

    // Verificar si necesitamos registrar nuevos modales en el DOM
    this._registerExistingModals();

    // Verificar modales ya vistos por el controlador de audio
    if (this.modalAudioController) {
      modalIds.forEach((modalId) => {
        if (this.modalAudioController.isModalViewed(modalId)) {
          console.log(`ModalManager: Modal ${modalId} ya estaba marcado como visto en el controlador de audio. Actualizando estado.`);
          this.onModalViewed(modalId);
        }
      });
    }
  }

  /**
   * Verifica si todos los modales de una sección han sido vistos
   * @param {string} sectionId - ID de la sección a verificar
   * @returns {boolean} - true si todos los modales han sido vistos
   */
  areSectionModalsCompleted(sectionId) {
    const pageId = this.courseController.stateManager.pages[this.courseController.stateManager.getCurrentPage()]?.id;
    const compoundSectionId = SectionIdUtils.normalizeId(sectionId, pageId);
    const status = this.sectionCompletionStatus.get(compoundSectionId);
    if (!status) return false;
    return status.viewedModals.size >= status.totalModals;
  }

  /**
   * Notificación de que un modal ha sido visto
   * @param {string} modalId - ID del modal visto
   * @param {boolean} fromAudioController - Indica si la llamada viene del controlador de audio
   */
  onModalViewed(modalId, fromAudioController = false) {
    console.log(`ModalManager: Modal ${modalId} visto`);

    // Verificar si deberíamos cerrar el modal automáticamente después de marcarlo como visto
    const modalConfig = this.getModalAudioConfig(modalId);
    const shouldAutoClose = modalConfig && modalConfig.autoClose === true;
    const autoCloseDelay = (modalConfig && modalConfig.autoCloseDelay) || 1500;

    // Notificar al controlador de audio únicamente si la llamada no viene ya de él
    if (!fromAudioController && this.modalAudioController) {
      this.modalAudioController.markModalAsViewed(modalId, true); // true indica que viene del manager
    }
    let foundSectionId = null;
    // Buscar en todas las secciones registradas si este modal pertenece a alguna
    for (const [compoundSectionId, modalList] of this.sectionModals.entries()) {
      if (modalList.includes(modalId)) {
        foundSectionId = compoundSectionId;
        break;
      }
    }
    // Si no se encuentra, usar el mapeo inverso (fallback)
    if (!foundSectionId) {
      foundSectionId = this.modalSection.get(modalId);
    }
   
    if (foundSectionId) {
      const status = this.sectionCompletionStatus.get(foundSectionId);
      if (status) {
        // Verificar si ya fue marcado como visto (para evitar duplicaciones)
        if (!status.viewedModals.has(modalId)) {
          // Añadir este modal a los vistos
          status.viewedModals.add(modalId);

          // Obtener la lista actual de modales vistos
          const viewedModalsArray = Array.from(status.viewedModals);

          console.log(`ModalManager: Modal ${modalId} visto y REGISTRADO. Progreso de sección ${foundSectionId}: ${status.viewedModals.size}/${status.totalModals}. Modales vistos: ${viewedModalsArray.join(", ")}`);

          // Verificar si todos los modales han sido vistos y aún no se ha completado
          if (status.viewedModals.size >= status.totalModals && !status.completed) {
            status.completed = true;
            // Ejecutar acciones de completado
            setTimeout(() => {
              this._executeCompletionActions(foundSectionId);
            }, 100); // Pequeño delay para asegurar cierre de modal
          }
        } else {
          console.log(`ModalManager: Modal ${modalId} ya estaba marcado como visto anteriormente`);
        }
      } else {
        console.warn(`ModalManager: Estado no encontrado para la sección ${foundSectionId}`);
      }
    } else {
      console.warn(`ModalManager: El modal ${modalId} no está asociado a ninguna sección.`);
    }
  }

  /**
   * Notificación de que un modal ha sido cerrado
   * @param {string} modalId - ID del modal cerrado
   */
  onModalClosed(modalId) {
    console.log(`ModalManager: Modal ${modalId} cerrado`);

    // Si era el modal activo, limpiar la referencia
    if (this.activeModalId === modalId) {
      this.activeModalId = null;
    }

    // Ocultar el overlay
    this._forceHideOverlay();

    // Marcar el elemento del carrusel que disparó este modal como "visitado"
    this._markCarouselItemAsVisited(modalId);
  }

  /**
   * Marca como "visitado" el elemento del carrusel que abrió un modal específico
   * @param {string} modalId - ID del modal
   * @private
   */
  _markCarouselItemAsVisited(modalId) {
    if (!modalId) return;

    try {
      // Buscar el botón que abre este modal (usando el selector con o sin #)
      const triggerSelector = `[data-modal-target="#${modalId}"], [data-modal-target="${modalId}"]`;
      const triggerButton = document.querySelector(triggerSelector);

      if (triggerButton) {
        // Buscar el contenedor del carrusel (el ancestro con clase carousel-item)
        const carouselItem = triggerButton.closest(".carousel-item");

        if (carouselItem) {
          // Agregar la clase "visited" para marcar como visitado
          carouselItem.classList.add("visited");
        }
      }
    } catch (error) {
      console.warn(`ModalManager: Error al marcar el elemento del carrusel como visitado: ${error.message}`);
    }
  }

  /**
   * Ejecuta las acciones definidas cuando todos los modales de una sección son vistos
   * @param {string} sectionId - ID único de la sección
   * @private
   */
  _executeCompletionActions(sectionId) {
    const actions = this.sectionActions.get(sectionId);
    if (!actions || actions.length === 0) {
      console.log(`ModalManager: No hay acciones definidas para la sección ${sectionId}`);
      return;
    }

    console.log(`ModalManager: Ejecutando ${actions.length} acciones de completado para sección ${sectionId}:`, actions.map((a) => a.type).join(", "));

    // Extraer el ID original de la sección desde el ID único
    let originalSectionId = sectionId;
    // Si es un ID compuesto, extraer la parte de la sección
    if (SectionIdUtils.isCompoundId(sectionId)) {
      originalSectionId = SectionIdUtils.extractSectionId(sectionId);
    }

    // Actualizar las acciones para usar el ID original de la sección
    const updatedActions = actions.map((action) => {
      if (action.type === "sectionCompleted" && !action.sectionId) {
        return { ...action, sectionId: originalSectionId };
      }
      return action;
    });

    // Ejecutar las acciones con un pequeño retraso para permitir que el modal actual termine de cerrarse
    setTimeout(() => {
      console.log(`ModalManager: Enviando acciones de completado al ActionExecutor:`, updatedActions);
      ActionExecutor.execute(updatedActions, {
        controller: this.courseController,
        sectionController: this.courseController.sectionController,
        audioController: this.courseController.audioController,
        component: this,
        trackedListeners: [], // Vacío ya que no necesitamos rastrear listeners
      });
    }, 500);
  }

  /**
   * Limpia el seguimiento de completado para una sección específica
   * @param {string} sectionId - ID de la sección a limpiar
   */
  resetSectionCompletion(sectionId) {
    const pageId = this.courseController.stateManager.pages[this.courseController.stateManager.getCurrentPage()]?.id;
    const compoundSectionId = SectionIdUtils.normalizeId(sectionId, pageId);
    const status = this.sectionCompletionStatus.get(compoundSectionId);
    if (status) {
      status.viewedModals.clear();
      status.completed = false;
      console.log(`ModalManager: Restablecido progreso para sección ${compoundSectionId}`);
    }
  }

  /**
   * Limpia el seguimiento de completado para la página actuales
   */
  resetCurrentPageSections() {
    const currentPageIndex = this.courseController.stateManager.getCurrentPage();
    const pagePrefix = `page_${currentPageIndex}_section_`;

    // Buscar y restablecer todas las secciones de esta página
    for (const [sectionId, status] of this.sectionCompletionStatus.entries()) {
      if (sectionId.startsWith(pagePrefix)) {
        status.viewedModals.clear();
        status.completed = false;
      }
    }

    console.log(`ModalManager: Restablecido progreso para todas las secciones de la página ${currentPageIndex}`);
  }

  /**
   * Destruye el gestor de modales
   */
  destroy() {
    this.closeActiveModal();

    // Limpiar todos los componentes modales
    this.modals.forEach((component) => {
      if (typeof component.destroy === "function") {
        component.destroy();
      }
    });
    this.modals.clear();

    // Limpiar mapas de seguimiento
    this.sectionModals.clear();
    this.modalSection.clear();
    this.sectionActions.clear();
    this.sectionCompletionStatus.clear();

    // Destruir el controlador de audio
    if (this.modalAudioController && typeof this.modalAudioController.destroy === "function") {
      this.modalAudioController.destroy();
    }

    // Eliminar overlay
    if (this.overlayElement && this.overlayElement.parentNode) {
      this.overlayElement.parentNode.removeChild(this.overlayElement);
    }

    this.overlayElement = null;
    console.log("ModalManager: Destruido");
  }

  /**
   * Obtiene la configuración de audio para un modal específico
   * @param {string} modalId - ID del modal
   * @returns {Object|null} - Configuración de audio o null si no existe
   */
  getModalAudioConfig(modalId) {
    if (!modalId || !this.audioConfig) return null;

    return this.audioConfig[modalId] || null;
  }

  /**
   * Devuelve el ID compuesto de sección usando SectionIdUtils
   * @param {string} sectionId - ID simple o compuesto
   * @returns {string}
   */
  _getCompoundSectionId(sectionId) {
    const pageId = this.courseController.stateManager.getCurrentPageId?.() || this.courseController.stateManager.getCurrentPage?.();
    return SectionIdUtils.normalizeId(sectionId, pageId);
  }
}
