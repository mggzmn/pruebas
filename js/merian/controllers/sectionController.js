import { SectionStateManager } from "../managers/sectionStateManager.js";
import { SectionProgressManager } from "../managers/SectionProgressManager.js";
import { SectionObserver } from "../observers/SectionObserver.js";
import { SectionAudioHandler } from "../handlers/SectionAudioHandler.js";
import { SectionVisibilityManager } from "../managers/SectionVisibilityManager.js";
import { SectionResizeObserver } from "../observers/SectionResizeObserver.js";
import { AnimationUtils } from "../utils/animationUtils.js";
import { SectionEventHandler } from "../handlers/SectionEventHandler.js";
import { SectionFinder } from "../handlers/SectionFinder.js";
import { SectionNavigationHandler } from "../handlers/SectionNavigationHandler.js";
import { SectionCleanupHandler } from "../handlers/SectionCleanupHandler.js";

/**
 * Controlador principal para la gestión de secciones dentro de una página del curso.
 */
export class SectionController {
  /**
   * Constructor del controlador de secciones.
   * @param {Object} courseController - Referencia al controlador principal del curso.
   */
  constructor(courseController, audioHandler) {
    this.courseController = courseController;
    this.audioHandler = audioHandler;
    this.sectionStateManager = new SectionStateManager(); // fuente de verdad centralizada
    this._initializeProperties();
    this._initializeComponents();
  }

  /**
   * Inicializa las propiedades internas.
   * Incluye SectionStateManager como única fuente de verdad de sección activa.
   * @private
   */
  _initializeProperties() {
    this.sections = [];
    this.currentSectionIndex = -1;
    this.mainActiveSectionIndex = -1;
    this.currentPageId = null;
    this.sectionCompletionListeners = [];
  }

  /**
   * Inicializa los componentes necesarios para el controlador de secciones.
   * @private
   */
  _initializeComponents() {
    this.progressManager = new SectionProgressManager(this.courseController);
    this.observer = new SectionObserver(this, this.sectionStateManager);
    this.audioHandler = new SectionAudioHandler(this.courseController);
    this.visibilityManager = new SectionVisibilityManager();
    this.resizeObserver = new SectionResizeObserver(this);

    this.eventHandler = new SectionEventHandler(this.courseController, this.audioHandler);
    this.sectionFinder = new SectionFinder(this.currentPageId);
    this.navigationHandler = new SectionNavigationHandler(this);
    this.cleanupHandler = new SectionCleanupHandler(this);

    // Suscribe el SectionController a los eventos de sección completada del SectionStateManager
    this.sectionStateManager.addCompletionListener((sectionId, pageId) => {
      this.notifySectionCompletionListeners(sectionId, pageId);
    });
  }

  /**
   * Inicializa el controlador de secciones.
   * @param {string} containerSelector - Selector CSS para identificar los contenedores de sección.
   */
  initialize(containerSelector = ".slide-section") {
    this.currentPageId = this.getCurrentPageId();
    this.resetState(false);
    this.setupSections(containerSelector);

    if (this.sections.length === 0) return;

    this.sectionFinder.setCurrentPageId(this.currentPageId);
    this.progressManager.restoreSavedSectionProgress(this.currentPageId);

    // Solo sincroniza la sección activa si NO hay navegación pendiente
    if (
      this.sections.length > 0 &&
      !this.sectionStateManager.getCurrentSection(this.currentPageId) &&
      !this.sectionStateManager.getPendingSectionId() &&
      !this.sectionStateManager.getIsNavigatingToSectionFromTOC() &&
      !this.sectionStateManager.getIsForcedNavigation()
    ) {
      this.sectionStateManager.setCurrentSection(this.sections[0].id, this.currentPageId);
    }

    if (this.observer) {
      this.observer.setupObservers(this.sections);
    }

    if (this.sectionStateManager.getPendingSectionId() || this.sectionStateManager.getIsNavigatingToSectionFromTOC() || this.sectionStateManager.getIsForcedNavigation()) {
      // Deja que el TOC maneje la visibilidad y función tras el scroll
      return;
    }

    const startingIndex = this.determineStartingSectionIndex();
    this.setupInitialVisibility(startingIndex);
    this.resizeObserver.observeSections(this.sections);

    this.handleInitialNavigation();
  }

  /**
   * Restablece el estado del controlador.
   * @param {boolean} resetComponents - Si es true, elimina y recrea todos los componentes.
   */
  resetState(resetComponents = false) {
    if (resetComponents) {
      this.cleanup();
      this._initializeComponents();
      return;
    }

    if (this.resizeObserver) {
      this.resizeObserver.destroy();
      this.resizeObserver = new SectionResizeObserver(this);
    }

    this.sections = [];
    this.currentSectionIndex = -1;
    this.mainActiveSectionIndex = -1;
    this.isForcedNavigation = false;

    if (this.observer) {
      this.observer.resetObservers();
    }
    if (this.sectionStateManager) {
      this.sectionStateManager.clearCurrentSection();
    }
  }

  /**
   * Configura las secciones para la página actual.
   * @param {string} containerSelector - Selector de contenedor de secciones.
   */
  setupSections(containerSelector) {
    this.sections = Array.from(document.querySelectorAll(containerSelector));
    if (this.currentPageId) {
      this.sections.forEach((section) => {
        const originalId = section.id;
        const normalizedId = `${this.currentPageId}_${originalId}`;

        section.setAttribute("data-original-id", originalId);
        section.setAttribute("data-section-id", normalizedId);
        section.id = normalizedId;
      });
    }
  }

  /**
   * Obtiene el ID de la página actual desde el StateManager.
   * @returns {string} - ID de la página actual o undefined si no existe.
   */
  getCurrentPageId() {
    const pageIndex = this.courseController.stateManager.getCurrentPage();
    return this.courseController.stateManager.pages[pageIndex]?.id;
  }

  /**
   * Busca una sección por su ID utilizando SectionFinder.
   * @param {string} sectionId - ID de la sección a buscar.
   * @param {string} [pageId=this.currentPageId] - ID de la página donde buscar.
   * @returns {Element|null} - Elemento DOM de la sección o null si no se encuentra.
   */
  getSectionById(sectionId, pageId = this.currentPageId) {
    return this.sectionFinder.getSectionById(sectionId, pageId);
  }

  /**
   * Verifica si hay una sección pendiente para navegar y la maneja.
   * @returns {boolean} - Si se manejó una sección pendiente.
   */
  handlePendingSectionNavigation() {
    // Centraliza obtención de sección pendiente
    const pendingSectionId = this.sectionStateManager.getPendingSectionId();
    if (pendingSectionId && this.tryNavigateToPendingSection(pendingSectionId)) {
      return true;
    }
    return false;
  }

  /**
   * Intenta navegar a una sección pendiente.
   * @param {string} pendingSectionId - ID de la sección pendiente.
   * @returns {boolean} - Verdadero si la navegación fue exitosa.
   */
  tryNavigateToPendingSection(pendingSectionId) {
    const section = this.getSectionById(pendingSectionId);
    if (!section) return false;

    const pendingSectionIndex = this.sections.indexOf(section);
    if (pendingSectionIndex < 0) return false;

    const canNavigate = this.canProceedToSection(pendingSectionIndex) || this.progressManager.isSectionCompleted(section.id, this.currentPageId);

    if (canNavigate) {
      this._executeAfterRender(() => {
        this.navigateToSection(section);
      });
      return true;
    }
    return false;
  }

  /**
   * Determina el índice de la sección inicial basándose en el progreso guardado.
   * @returns {number} - Índice de la sección donde debe comenzar la navegación.
   */
  determineStartingSectionIndex() {
    const completedCount = this.progressManager.getCompletedSectionsCount();
    console.log("[SectionController] Completed sections count:", completedCount);

    if (completedCount === 0) {
      console.log("[SectionController] Retornando 0 porque no hay secciones completadas");
      return 0;
    }
    for (let i = 0; i < this.sections.length; i++) {
      const completed = this.progressManager.isSectionCompleted(this.sections[i].id, this.currentPageId);
      console.log(`[SectionController] Sección ${this.sections[i].id} completada:`, completed);
      if (!completed) {
        console.log(`[SectionController] Retornando índice de primera no completada: ${i}`);
        return i;
      }
    }
    console.log("[SectionController] Todas completadas, retornando último índice:", this.sections.length - 1);
    return this.sections.length - 1;
  }

  /**
   * Configura la visibilidad inicial de las secciones y establece los índices.
   * @param {number} startingSectionIndex - Índice de la sección inicial.
   */
  setupInitialVisibility(startingSectionIndex) {
    this.visibilityManager.setupInitialSectionVisibility(this.sections, startingSectionIndex);
    this.currentSectionIndex = startingSectionIndex;
    this.mainActiveSectionIndex = startingSectionIndex;
    this.sectionStateManager.setCurrentSection(this.sections[startingSectionIndex]?.id, this.currentPageId);
    this.executeInitialFunctions(startingSectionIndex);
  }

  /**
   * Ejecuta las funciones iniciales para las secciones hasta el índice especificado.
   * @param {number} startingSectionIndex - Índice hasta donde ejecutar funciones.
   */
  executeInitialFunctions(startingSectionIndex) {
    AnimationUtils.executeAfterFrames(() => {
      for (let i = 0; i <= startingSectionIndex; i++) {
        const section = this.sections[i];
        // Solo ejecutar si la sección está visible
        if (section && (section.classList.contains("visible") || section.getAttribute("aria-hidden") === "false")) {
          this.eventHandler.executeSectionFunction(section, section.id, this.currentPageId);
        }
      }
    });
  }

  /**
   * Ejecuta la función asociada a una sección, con opción de omitir reproducción de audio.
   * @param {Element} section - Elemento DOM de la sección.
   * @param {boolean} skipAudio - Si debe omitirse la reproducción de audio.
   * @private
   */
  _executeSectionFunction(section, skipAudio = false) {
    if (!section || !section.dataset.function) {
      return;
    }
    const functionName = section.dataset.function;
    if (typeof window[functionName] !== "function") {
      return;
    }
    try {
      this.eventHandler.executeSectionFunction(section, section.id, this.currentPageId);
      this.sectionStateManager.setCurrentSection(section.id, this.currentPageId);
    } catch (error) {
      console.error(`Error al ejecutar función para sección ${section.id}:`, error);
    }
  }

  /**
   * Método adaptador para mantener compatibilidad.
   * @param {Element} section - Elemento de sección.
   * @param {boolean} skipAudio - Si debe omitirse el audio.
   */
  executeFunction(section, skipAudio = false) {
    this._executeSectionFunction(section, skipAudio);
  }

  /**
   * Verifica si se puede proceder a una sección específica basado en el estado de completado.
   * @param {number} index - Índice de la sección destino.
   * @returns {boolean} - Si es posible navegar a esa sección.
   */
  canProceedToSection(index) {
    console.log(`[SectionController] Verificando si se puede navegar a sección ${index}`, index <= this.currentSectionIndex);
    if (index <= this.currentSectionIndex) return true;
    if (index === this.currentSectionIndex + 1) {
      const currentSection = this.sections[this.currentSectionIndex];
      if (!currentSection) return false;
      return this.sectionStateManager.isSectionCompleted(currentSection.id, this.currentPageId);
    }
    return false;
  }

  /**
   * Maneja la navegación inicial.
   * @returns {boolean} - Si la navegación fue exitosa.
   */
  handleInitialNavigation() {
    const currentPageIndex = this.courseController.stateManager.getCurrentPage();
    const furthestPageReached = this.courseController.stateManager.getFurthestPage();
    const isPagePreviouslyCompleted = furthestPageReached > currentPageIndex;
    const isCurrentPageFurthest = currentPageIndex === furthestPageReached;

    if (isPagePreviouslyCompleted) {
      this.sections.forEach((section) => {
        if (this.progressManager.isSectionCompleted(section.id, this.currentPageId) || this.courseController.stateManager.pages[currentPageIndex]?.completed) {
          this.visibilityManager.markSectionAsCompletedVisually(section);
          this.applyAllSectionEvents(section);
        }
      });
      if (this.sectionStateManager.getPendingSectionId()) {
        if (this.sectionStateManager.getIsNavigatingToSectionFromTOC()) {
          return this.handlePreviouslyCompletedPageNavigation(this.sectionStateManager.getPendingSectionId(), true);
        }
        return this.handlePreviouslyCompletedPageNavigation(this.sectionStateManager.getPendingSectionId());
      }
      this.visibilityManager.updateSectionVisibility(this.sections, this.sections.length - 1, false, true);
      return true;
    }

    if (this.handlePendingSectionNavigation()) {
      return true;
    }

    if (isCurrentPageFurthest && this.progressManager.allSectionsCompleted(this.sections, this.currentPageId)) {
      this.visibilityManager.updateSectionVisibility(this.sections, this.sections.length - 1, false, true);
      return true;
    }

    const startingSectionIndex = this.determineStartingSectionIndex();
    this.setupInitialVisibility(startingSectionIndex);
    console.log("Secciones inicializadas:", this.sections, startingSectionIndex);
    if (this.sections.length > 0 && isCurrentPageFurthest) {
      const firstSection = this.sections[startingSectionIndex];

      AnimationUtils.executeAfterTime(() => {
        this._executeSectionFunction(firstSection, false);
      }, 100);
    }

    return true;
  }

  /**
   * Método adaptador para mantener compatibilidad con llamadas antiguas.
   * @param {Function} callback - Callback a ejecutar después del render.
   * @private
   */
  _executeAfterRender(callback) {
    AnimationUtils.executeAfterFrames(callback);
  }

  /**
   * Navega a la siguiente sección del contenido.
   * Soporta delay si se especifica como argumento (en ms).
   * @param {number} [delay=0] - Milisegundos de retardo antes de la navegación.
   * @returns {boolean} - Si la navegación fue exitosa.
   */
  nextSection(delay = 0) {
    return this.navigationHandler.nextSection(delay);
  }

  /**
   * Método adaptador para mantener compatibilidad con llamadas antiguas.
   * Navega a la sección anterior del contenido.
   * @returns {boolean} - Si la navegación fue exitosa.
   */
  previousSection() {
    return this.navigationHandler.previousSection();
  }

  /**
   * Método adaptador que delega la navegación al handler especializado.
   * @param {string|Element} sectionIdOrElement - ID de sección o elemento DOM.
   * @param {boolean} forceAudio - Si debe forzar la reproducción de audio.
   * @param {boolean} fromTOC - Si la navegación proviene de la tabla de contenidos.
   * @returns {boolean} - Si la navegación fue exitosa.
   */
  navigateToSection(sectionIdOrElement, forceAudio = false, fromTOC = false) {
    let sectionIdentifier = sectionIdOrElement;
    if (fromTOC) {
      sectionIdentifier = typeof sectionIdOrElement === "string" ? sectionIdOrElement : sectionIdOrElement.id;
      this.sectionStateManager.setIsNavigatingToSectionFromTOC(true);
    }

    if (this.cleanupHandler) {
      this.cleanupHandler.cleanup();
    }

    const result = this.navigationHandler.navigateToSection(sectionIdentifier, forceAudio, fromTOC);

    return result;
  }

  /**
   * Aplica todos los eventos visuales a una sección sin reproducir audio.
   * @param {Element} section - Sección a la que aplicar eventos.
   */
  applyAllSectionEvents(section) {
    if (!section || !section.id) return;

    const functionName = section.dataset.function;
    if (!functionName) {
      return;
    }

    try {
      this.audioHandler.executeAudioForSectionWithoutReproduction(section);
      if (!section.classList.contains("visible")) {
        section.classList.add("visible", "completed");
        section.setAttribute("aria-hidden", "false");
      }
      if (this.progressManager.isSectionCompleted(section.id, this.currentPageId) || this.courseController.stateManager.pages[this.courseController.stateManager.getCurrentPage()]?.completed) {
        this.visibilityManager.markSectionAsCompletedVisually(section);
      }
    } catch (error) {
      console.error(`Error al aplicar eventos para sección ${section.id}:`, error);
    }
  }

  /**
   * Marca una sección como completada.
   * @param {string} sectionId - ID de la sección.
   * @returns {boolean} - Si la operación fue exitosa.
   */
  markSectionAsCompleted(sectionId, pageId = this.currentPageId) {
    return this.sectionStateManager.markSectionCompleted(sectionId, pageId);
  }

  /**
   * Marca todas las secciones de una página como completadas.
   * @param {string} pageId - ID de la página.
   * @returns {boolean} - Si la operación fue exitosa.
   */
  markAllSectionsAsCompleted(pageId) {
    if (!this.sections || this.sections.length === 0 || !pageId) {
      return false;
    }
    this.sections.forEach((section) => {
      if (!this.progressManager.isSectionCompleted(section.id, pageId)) {
        this.markSectionAsCompleted(section.id, pageId);
      }
      this.visibilityManager.markSectionAsCompletedVisually(section);
    });
    this.sections.forEach((section) => {
      this.audioHandler.executeAudioForSectionWithoutReproduction(section);
    });
    this.progressManager.saveSectionProgress(pageId);
    if (this.sections.length > 0) {
      const lastSection = this.sections[this.sections.length - 1];
      this.sectionStateManager.setCurrentSection(lastSection?.id ?? null);
    }
    return true;
  }

  /**
   * Limpia y destruye los componentes relacionados con la página o slide actual.
   */
  cleanup() {
    if (this.observer) {
      this.observer.resetObservers();
    }
    if (this.resizeObserver) {
      this.resizeObserver.destroy();
    }
    if (this.audioHandler) {
      this.audioHandler.cleanup();
    }

    if (this.sectionStateManager) {
      this.sectionStateManager.clearCurrentSection();
    }
    if (this.visibilityManager) {
      this.visibilityManager.cleanup();
    }
    if (this.sectionFinder) {
      this.sectionFinder.clear();
    }
    if (this.navigationHandler) {
      this.navigationHandler.cleanup();
    }
    if (this.cleanupHandler) {
      this.cleanupHandler.cleanup();
    }
  }

  /**
   * Agrega un listener para el evento de sección completada.
   * @param {Function} listener - Listener a agregar.
   */
  addSectionCompletionListener(listener) {
    if (typeof listener === "function") {
      this.sectionCompletionListeners.push(listener);
    }
  }

  /**
   * Notifica a los listeners registrados cuando una sección es completada.
   * @param {string} sectionId - ID de la sección.
   * @param {string} pageId - ID de la página.
   */
  notifySectionCompletionListeners(sectionId, pageId) {
    this.sectionCompletionListeners.forEach((listener) => {
      try {
        listener(sectionId, pageId);
      } catch (e) {
        console.error("Error en listener de sección completada:", e);
      }
    });
  }
  /**
   * Verifica si todas las secciones están completadas en la página actual.
   * @returns {boolean}
   */
  allSectionsCompleted() {
    return this.progressManager.allSectionsCompleted(this.sections, this.currentPageId);
  }
  /**
   * Configura los modales asociados a esta sección
   * @param {string} sectionId - ID de la sección
   * @param {Array<string>} modalIds - IDs de los modales a asociar
   * @param {Array<Object>} completionActions - Acciones a ejecutar cuando todos los modales sean vistos
   */
  configureSectionModals(sectionId, modalIds, completionActions = []) {
    // Validar que tenemos el ModalManager
    if (!this.courseController.modalManager) {
      console.error("SectionController: No hay ModalManager disponible para configurar modales de sección");
      return;
    }

    // Validar parámetros
    if (!sectionId || !modalIds || !Array.isArray(modalIds) || modalIds.length === 0) {
      console.error("SectionController: Parámetros inválidos para configureSectionModals");
      return;
    }

    // Registrar en el ModalManager
    this.courseController.modalManager.registerSectionModals(sectionId, modalIds, completionActions);

    console.log(`SectionController: Configurados ${modalIds.length} modales para la sección ${sectionId}`);
  }

  /**
   * Verifica si todos los modales de una sección han sido vistos
   * @param {string} sectionId - ID de la sección a verificar
   * @returns {boolean} - true si todos los modales han sido vistos
   */
  areSectionModalsCompleted(sectionId) {
    if (!this.courseController.modalManager) return false;

    return this.courseController.modalManager.areSectionModalsCompleted(sectionId);
  }

  /**
   * Limpia el estado de completado de modales para una sección
   * @param {string} sectionId - ID de la sección a restablecer
   */
  resetSectionModalsCompletion(sectionId) {
    if (!this.courseController.modalManager) return;

    this.courseController.modalManager.resetSectionCompletion(sectionId);
  }

  pauseObservers() {
    if (this.observer) this.observer.disconnect();
    if (this.resizeObserver) this.resizeObserver.disconnect();
  }

  resumeObservers() {
    if (this.observer && this.sections.length > 0) this.observer.setupObservers(this.sections);
    if (this.resizeObserver && this.sections.length > 0) this.resizeObserver.observeSections(this.sections);
  }

  /**
   * Sincroniza el índice current con la sección activa en SectionStateManager.
   * @param {string} sectionId - ID de la sección activa.
   */
  syncCurrentSectionIndex(sectionId) {
    if (!sectionId) return;
    const idx = this.sections.findIndex((section) => section.id === sectionId || section.getAttribute("data-original-id") === sectionId);
    if (idx !== -1) {
      this.currentSectionIndex = idx;
    }
  }

  /**
   * Fuerza la finalización de todas las secciones de la página actual.
   * Las marca como completadas, visibles y ejecuta la última función asociada.
   * @param {boolean} withDelay - Si se debe aplicar un retardo opcional antes de scroll.
   * @returns {void}
   */
  forceCompleteAllSections(withDelay = false) {
    const sections = this.getCurrentSections();
    if (!sections || sections.length === 0) return;

    const pageId = this.currentPageId;
    const lastIndex = sections.length - 1;

    sections.forEach((section, index) => {
      const sectionId = section.id;

      // Marcar como completada en el estado
      this.sectionStateManager.markSectionAsCompleted(sectionId, pageId);

      // Marcar visualmente como visible y completada
      this.sectionVisibilityManager.markSectionAsCompletedVisually(section);
    });

    const lastSection = sections[lastIndex];
    this.sectionVisibilityManager.updateSectionVisibility(sections, lastIndex, true, false);

    // Ejecutar función de la última sección con scroll
    const run = () => {
      this.sectionObserver.updateCurrentSection(lastSection);
      this.sectionObserver._handleNewPageIntersection(lastSection, lastIndex, lastSection.id);
    };

    if (withDelay) {
      setTimeout(run, 500);
    } else {
      run();
    }
  }
}
