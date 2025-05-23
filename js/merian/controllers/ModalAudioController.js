import { AnimationUtils } from "../utils/animationUtils.js";
import { ModalAudioConfig } from "../configs/modalAudioConfig.js";

/**
 * Controlador especializado para gestionar el audio de los modales
 * Sigue el principio de responsabilidad única y NO interfiere con el audio de secciones
 */
export class ModalAudioController {
  /**
   * Constructor
   * @param {Object} courseController - Controlador principal del curso
   */
  constructor(courseController) {
    // Referencia al controlador principal del curso (tiene acceso al audioController)
    this.courseController = courseController;
    
    // Obtener referencia al controlador de audio principal
    this.audioController = courseController.audioController;

    // Estado del modal actual
    this.currentModalId = null;
    this.previousAudioSource = null;
    this.currentTriggerIndex = 0;
    this.triggers = [];
    this.onEndActions = [];
    this.actionCallback = null;
    this.viewedModals = new Set();
    this.eventTimers = [];
    
    // Flag para saber si el controlador ha tomado control del audio
    this.hasControlOfAudio = false;

    // Bind methods
    this._onTimeUpdate = this._onTimeUpdate.bind(this);
    this._onMediaEnded = this._onMediaEnded.bind(this);

    console.log("ModalAudioController: Initialized with main audio system integration");
  }

  /**
   * Inicializa el audio para un modal específico
   * @param {string} modalId - ID del modal
   * @param {Function} actionCallback - Callback para ejecutar acciones
   */
  initModalAudio(modalId, actionCallback) {
    console.log(`ModalAudioController: Initializing audio for modal ${modalId}`);

    // Limpiar cualquier configuración de audio modal anterior
    this.cleanupModalAudio();

    // Obtener configuración para este modal
    const config = ModalAudioConfig[modalId];

    if (!config || !config.audioSource) {
      console.warn(`ModalAudioController: No valid audio config found for modal ${modalId}`);
      return;
    }

    // Guardar referencias
    this.currentModalId = modalId;
    this.triggers = config.events || [];
    this.onEndActions = config.onEndActions || [];
    this.actionCallback = actionCallback;
    this.currentTriggerIndex = 0;

    // Si no hay fuente de audio, salir
    if (!config.audioSource) {
      console.warn(`ModalAudioController: No audio source for modal ${modalId}`);
      return;
    }

    try {
      // Tomar el control del audio principal
      this._takeControlOfMainAudio();
      
      // Guardar la fuente de audio actual antes de cambiarla
      if (this.audioController.mainMedia) {
        this.previousAudioSource = this.audioController.mainMedia.src;
      }
      
      // Configurar event listeners en el audio principal
      this._setupMainAudioListeners();
      
      // Configurar la fuente de audio en el audio principal
      this.audioController.setAudioSource(config.audioSource);
      
      // Reproducir audio después de un breve retraso
      AnimationUtils.executeAfterFrames(() => {
        // Verificar si todavía tenemos el control
        if (this.hasControlOfAudio && this.audioController.mainMedia) {
          const playPromise = this.audioController.mainMedia.play();

          if (playPromise !== undefined) {
            playPromise.catch((error) => {
              console.error(`ModalAudioController: Error playing audio for ${modalId}:`, error);
            });
          }

          console.log(`ModalAudioController: Started audio playback for ${modalId}`);
        }
      }, 2);
    } catch (error) {
      console.error(`ModalAudioController: Error setting up audio:`, error);
      // Liberar control en caso de error
      this._releaseControlOfMainAudio();
    }
  }

  /**
   * Toma el control del audio principal
   * @private
   */
  _takeControlOfMainAudio() {
    // Marcar que tenemos control del audio
    this.hasControlOfAudio = true;
    console.log("ModalAudioController: Taking control of main audio");
  }

  /**
   * Libera el control del audio principal
   * @private
   */
  _releaseControlOfMainAudio() {
    if (!this.hasControlOfAudio) return;
    
    this.hasControlOfAudio = false;
    console.log("ModalAudioController: Releasing control of main audio");
  }

  /**
   * Configura los event listeners en el audio principal
   * @private
   */
  _setupMainAudioListeners() {
    // Limpiar listeners anteriores primero
    this._cleanupAudioListeners();
    
    if (this.audioController.mainMedia) {
      // Añadir nuevos listeners
      this.audioController.mainMedia.addEventListener("timeupdate", this._onTimeUpdate);
      this.audioController.mainMedia.addEventListener("ended", this._onMediaEnded);
      console.log("ModalAudioController: Main audio listeners set up");
    } else {
      console.warn("ModalAudioController: Main audio element not available");
    }
  }

  /**
   * Limpia los event listeners del audio principal
   * @private
   */
  _cleanupAudioListeners() {
    if (this.audioController.mainMedia) {
      // Quitar listeners existentes
      this.audioController.mainMedia.removeEventListener("timeupdate", this._onTimeUpdate);
      this.audioController.mainMedia.removeEventListener("ended", this._onMediaEnded);
      console.log("ModalAudioController: Main audio listeners cleaned up");
    }
  }

  /**
   * Maneja el evento timeupdate para sincronizar acciones
   * @private
   */
  _onTimeUpdate() {
    if (!this.hasControlOfAudio || !this.audioController.mainMedia || 
        this.triggers.length === 0 || this.currentTriggerIndex >= this.triggers.length) {
      return;
    }

    const currentTime = this.audioController.mainMedia.currentTime;
    const currentTrigger = this.triggers[this.currentTriggerIndex];

    if (currentTrigger && currentTime >= currentTrigger.time) {
      console.log(`ModalAudioController: Trigger at ${currentTrigger.time}s for ${this.currentModalId}`);

      if (currentTrigger.actions && this.actionCallback) {
        this.actionCallback(currentTrigger.actions);
      }

      this.currentTriggerIndex++;
    }
  }

  /**
   * Maneja el evento ended del audio
   * @private
   */
  _onMediaEnded() {
    if (!this.hasControlOfAudio) return;
    
    // Guardar referencia del ID actual del modal para usar después
    const currentModalIdRef = this.currentModalId;
    
    // Marcar este modal como visto
    if (this.currentModalId) {
      this.markModalAsViewed(this.currentModalId);
    }

    // Ejecutar acciones de finalización
    if (this.onEndActions.length > 0 && this.actionCallback) {
      this.actionCallback(this.onEndActions);
    }
    
    // Cerrar automáticamente el modal después de un breve retraso
    if (currentModalIdRef && this.courseController && this.courseController.modalManager) {
      // Esperar 1.5 segundos antes de cerrar el modal automáticamente
      // Este retraso permite que el usuario vea las animaciones finales
      setTimeout(() => {
        console.log(`ModalAudioController: Auto-closing modal ${currentModalIdRef} after audio ended`);
        this.courseController.modalManager.closeModal(currentModalIdRef);
      }, 1500); // 1.5 segundos de retraso
    }
  }

  /**
   * Marca un modal como visto
   * @param {string} modalId - ID del modal
   * @param {boolean} fromManager - Indica si la llamada viene del ModalManager para evitar recursión
   */
  markModalAsViewed(modalId, fromManager = false) {
    if (!modalId) return;

    // Añadir a nuestro registro local
    this.viewedModals.add(modalId);
    console.log(`ModalAudioController: Marked modal ${modalId} as viewed`);
    
    // Notificar al ModalManager únicamente si la llamada no viene ya del manager
    if (!fromManager && this.courseController && this.courseController.modalManager) {
      this.courseController.modalManager.onModalViewed(modalId, true); // true indica que viene del controlador de audio
    }
  }

  /**
   * Verifica si un modal específico ha sido visto
   * @param {string} modalId - ID del modal a verificar
   * @returns {boolean} - true si el modal ha sido visto, false en caso contrario
   */
  isModalViewed(modalId) {
    return this.viewedModals.has(modalId);
  }

  /**
   * Detiene el audio del modal actual y limpia los listeners
   */
  stopModalAudio() {
    console.log("ModalAudioController: Stopping modal audio");

    if (!this.hasControlOfAudio) {
      console.log("ModalAudioController: Not stopping audio as we don't have control");
      return;
    }

    try {
      // Pausar la reproducción del audio principal
      if (this.audioController.mainMedia) {
        this.audioController.mainMedia.pause();
      }

      // Limpiar listeners
      this._cleanupAudioListeners();

      // Limpiar timers
      this.eventTimers.forEach((timerId) => clearTimeout(timerId));
      this.eventTimers = [];

      // Liberar control del audio
      this._releaseControlOfMainAudio();

      // Limpiar modal actual
      this.currentModalId = null;
      this.currentTriggerIndex = 0;

      console.log("ModalAudioController: Modal audio stopped and resources released");
    } catch (error) {
      console.error("ModalAudioController: Error stopping modal audio:", error);
    }
  }

  /**
   * Limpia todos los recursos de audio del modal
   */
  cleanupModalAudio() {
    try {
      // Detener reproducción si tenemos control
      if (this.hasControlOfAudio && this.audioController.mainMedia) {
        if (!this.audioController.mainMedia.paused) {
          this.audioController.mainMedia.pause();
        }
      }

      // Limpiar listeners
      this._cleanupAudioListeners();

      // Liberar control del audio
      this._releaseControlOfMainAudio();

      // Limpiar estado
      this.currentTriggerIndex = 0;
      this.currentModalId = null;
    } catch (error) {
      console.error(`ModalAudioController: Error cleaning up modal audio: ${error.message}`);
    }
  }

  /**
   * Destruye el controlador y libera recursos
   */
  destroy() {
    this.cleanupModalAudio();
    this.stopModalAudio();
    this.actionCallback = null;
    this.currentModalId = null;
    this.triggers = [];
    this.onEndActions = [];
    this.viewedModals.clear();
    this.eventTimers = [];
    this.audioController = null;
    this.courseController = null;
    console.log("ModalAudioController: Destroyed");
  }
}