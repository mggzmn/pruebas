import { ActionExecutor } from "../utils/ActionExecutor.js";

/**
 * Representa una ventana modal en la interfaz de usuario.
 */
export class ModalComponent {
  /**
   * Constructor
   * @param {HTMLElement} modalElement - Elemento DOM del modal
   * @param {Object} courseController - Controlador principal del curso
   */
  constructor(modalElement, courseController) {
    if (!modalElement) throw new Error("Modal element is required.");

    this.element = modalElement;
    this.modalId = modalElement.id;
    this.courseController = courseController;
    this.audioController = courseController.audioController;
    this.isActive = false;
    this.hasBeenViewed = false;

    if (courseController.modalManager) {
      const audioConfig = courseController.modalManager.getModalAudioConfig(this.modalId);
      if (audioConfig && audioConfig.audioSource) {
        this.audioSource = audioConfig.audioSource;
        console.log(`ModalComponent: Establecida fuente de audio desde configuración para ${this.modalId}: ${this.audioSource}`);
      }
    }

    // Elementos del modal
    this.closeButton = modalElement.querySelector(".modal-close-btn");

    // Eventos de tiempo para sincronización
    this.mediaElement = null;
    this.currentTriggerIndex = 0;

    // Bind de métodos
    this._onTimeUpdate = this._onTimeUpdate.bind(this);
    this._onMediaEnded = this._onMediaEnded.bind(this);
    this._onCloseClick = this._onCloseClick.bind(this);

    // Inicializar
    this._setupEventListeners();

    console.log(`ModalComponent: Initialized modal ${this.modalId} with audio source ${this.audioSource || "none"}`);
  }

  /**
   * Configura los event listeners
   * @private
   */
  _setupEventListeners() {
    if (this.closeButton) {
      // Eliminar cualquier listener existente para evitar duplicados
      this.closeButton.removeEventListener("click", this._onCloseClick);

      // Añadir el listener con captura para asegurar que se ejecute
      this.closeButton.addEventListener("click", this._onCloseClick, true);

      console.log(`ModalComponent: Close button event listener set up for ${this.modalId}`);
    } else {
      console.warn(`ModalComponent: No close button found for modal ${this.modalId}`);
    }
  }

  /**
   * Abre el modal
   */
  open() {
    if (this.isActive) return;

    console.log(`ModalComponent: Opening modal ${this.modalId}`);

    // Activar el modal
    this.isActive = true;

    // Mostrar el modal con clase active
    this.element.classList.add("active");

    // Configurar y reproducir audio si está disponible
    this._setupModalAudio();
  }

  /**
   * Configura el audio del modal
   * @private
   */
  _setupModalAudio() {
    console.log(`ModalComponent: Setting up audio for ${this.modalId}: ${this.audioSource}`);

    // Verificar disponibilidad del ModalAudioController
    if (!this.courseController.modalManager || !this.courseController.modalManager.modalAudioController) {
      console.error(`ModalComponent: ModalAudioController no disponible para ${this.modalId}`);
      return;
    }

    try {
      // Inicializar el audio del modal a través del ModalAudioController
      this.courseController.modalManager.modalAudioController.initModalAudio(this.modalId, (actions) => {
        // Ejecutar acciones utilizando el ActionExecutor
        ActionExecutor.execute(actions, {
          audioController: this.audioController,
          component: this,
        });
      });
    } catch (error) {
      console.error(`ModalComponent: Error al inicializar audio para modal ${this.modalId}:`, error);
    }
  }

  /**
   * Maneja el evento timeupdate para sincronizar acciones
   * @private
   */
  _onTimeUpdate() {
    // Implementar si es necesario
  }

  /**
   * Maneja el evento ended del audio
   * @private
   */
  _onMediaEnded() {
    console.log(`ModalComponent: Audio ended for ${this.modalId}`);

    // Marcar este modal como visto
    this.hasBeenViewed = true;

    // Notificar al ModalManager
    if (this.courseController.modalManager) {
      this.courseController.modalManager.onModalViewed(this.modalId);
    }
  }

  /**
   * Maneja el clic en el botón de cerrar
   * @param {Event} event - El evento de clic
   * @private
   */
  _onCloseClick(event) {
    // Prevenir comportamiento por defecto y propagación
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    console.log(`ModalComponent: Close button clicked for ${this.modalId}`);

    // Notificar al ModalManager para cerrar este modal
    if (this.courseController && this.courseController.modalManager) {
      this.courseController.modalManager.closeModal(this.modalId);
    } else {
      // Si no hay ModalManager, cerrar directamente
      this.close();
    }
  }

  /**
   * Cierra el modal
   */
  close() {
    if (!this.isActive) return;

    console.log(`ModalComponent: Cerrando modal ${this.modalId}`);

    // Marcar como inactivo
    this.isActive = false;

    // Detener el audio si está reproduciéndose
    if (this.courseController.modalManager && this.courseController.modalManager.modalAudioController) {
      this.courseController.modalManager.modalAudioController.stopModalAudio();
    }

    // Limpiar recursos de audio
    this._cleanupAudio();

    // Quitar clase activa del modal
    this.element.classList.remove("active");

    // Notificar al ModalManager
    if (this.courseController.modalManager) {
      this.courseController.modalManager.onModalClosed(this.modalId);
    }
  }

  /**
   * Limpia los recursos de audio
   * @private
   */
  _cleanupAudio() {
    try {
      if (this.mediaElement) {
        // Detener reproducción
        if (!this.mediaElement.paused) {
          this.mediaElement.pause();
        }

        // Eliminar event listeners
        this.mediaElement.removeEventListener("timeupdate", this._onTimeUpdate);
        this.mediaElement.removeEventListener("ended", this._onMediaEnded);

        this.mediaElement = null;
      }
    } catch (error) {
      console.error(`ModalComponent: Error cleaning up audio: ${error.message}`);
    }
  }

  /**
   * Destruye el componente y libera recursos
   */
  destroy() {
    this._cleanupAudio();

    // Eliminar event listeners
    if (this.closeButton) {
      this.closeButton.removeEventListener("click", this._onCloseClick);
    }

    // Limpiar referencias
    this.element = null;
    this.closeButton = null;
    this.courseController = null;
    this.audioController = null;
  }
}
