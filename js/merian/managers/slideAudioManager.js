import { ActionExecutor } from "../utils/ActionExecutor.js";

// Administra el audio de diapositivas y maneja eventos durante la reproducción.
export class SlideAudioManager {
  constructor(controller, audioController) {
    this.controller = controller;
    this.audioController = audioController;
    this.mediaElement = null;
    this.trackedListeners = []; // Mantener este array aquí

    // Enlazar métodos para preservar el contexto
    this._onTimeUpdate = this._onTimeUpdate.bind(this);
    this._onMediaEnded = this._onMediaEnded.bind(this);

    // Delegación de evento ended a nivel global
    document.addEventListener("ended", this._onMediaEnded);
  }

  init(slideMediaData) {
    // Obtener elementos media
    this.audioElement = document.getElementById("main-media");

    // Encontrar el video activo en la sección visible actual
    const activeSection = document.querySelector('.slide-section.visible.active') || 
                          document.querySelector('.slide-section.visible');

    // Primero intentar usar el video activo del audioController
    this.videoElement = this.audioController.activeVideoElement;

    // Si no hay video activo en el controlador, buscar en la sección
    if (!this.videoElement && this.audioController.currentMediaType === "video") {
      if (activeSection) {
        this.videoElement = activeSection.querySelector('video');
      }

      // Si no se encuentra en la sección activa, buscar cualquier video visible
      if (!this.videoElement) {
        this.videoElement = document.querySelector('.slide-section.visible video') || 
                            document.querySelector('video.video-active') ||
                            document.getElementById("main-video");
      }
    }

    this.triggers = slideMediaData?.events || [];
    this.onEndActions = slideMediaData?.onEndActions || [];
    this.currentTriggerIndex = 0;

    // Determinar qué elemento media usar
    this.mediaElement = this.audioController.currentMediaType === "video" ? this.videoElement : this.audioElement;

    // Remover listeners existentes (incluyendo los que añadimos dinámicamente)
    this._removeEventListeners(); // Esto ya elimina los trackedListeners

    // Configurar listeners en el elemento media actual
    if (this.mediaElement) {
      this.mediaElement.addEventListener("timeupdate", this._onTimeUpdate);
      this.mediaElement.addEventListener("ended", this._onMediaEnded);
      console.log(`SlideAudioManager: Inicializado para ${this.audioController.currentMediaType}, con ${this.onEndActions?.length || 0} onEndActions`);
    }
  }

  /**
   * Remueve listeners de evento de todos los elementos de medios y los añadidos dinámicamente
   * @private
   */
  _removeEventListeners() {
    // Remover listeners de medios
    if (this.audioElement) {
      this.audioElement.removeEventListener("timeupdate", this._onTimeUpdate);
      this.audioElement.removeEventListener("ended", this._onMediaEnded);
    }

    if (this.videoElement) {
      this.videoElement.removeEventListener("timeupdate", this._onTimeUpdate);
      this.videoElement.removeEventListener("ended", this._onMediaEnded);
    }

    // Limpia los listeners añadidos dinámicamente (la lógica permanece aquí, gestionada por este componente)
    this.trackedListeners.forEach(({ element, eventType, handler }) => {
      if (element) {
        element.removeEventListener(eventType, handler);
      }
    });
    this.trackedListeners = [];
    console.log("SlideAudioManager: Se removieron todos los listeners registrados.");
  }

  /**
   * Controlador del evento timeupdate.
   * @private
   */
  _onTimeUpdate() {
    this.checkTriggers();
  }

  /**
   * Controlador del evento ended de medio.
   * @private
   */
  _onMediaEnded() {
    console.log(`SlideAudioManager: Evento ended capturado para ${this.audioController.currentMediaType}, ejecutando ${this.onEndActions?.length || 0} acciones`);
    if (this.onEndActions?.length > 0) {
      this.executeActions(this.onEndActions);
    }
  }

  /**
   * Verifica los disparadores
   */
  checkTriggers() {
    if (!this.triggers.length || !this.mediaElement) return;

    const currentTime = Math.floor(this.mediaElement.currentTime);
    while (this.currentTriggerIndex < this.triggers.length && currentTime >= this.triggers[this.currentTriggerIndex].time) {
      const eventData = this.triggers[this.currentTriggerIndex];
      this.executeActions(eventData.actions);
      this.currentTriggerIndex++;
    }
  }

  /**
   * Delegar la ejecución al ActionExecutor
   */
  executeActions(actions = []) {
    // Delegar la ejecución a ActionExecutor
    ActionExecutor.execute(actions, {
      controller: this.controller,
      sectionController: this.controller?.sectionController, // <-- Asegura que siempre esté presente
      audioController: this.audioController,
      component: this,
      trackedListeners: this.trackedListeners
    });
  }

  /**
   * Método de limpieza para remover listeners de evento
   */
  destroy() {
    this._removeEventListeners(); // Esto ahora también elimina los trackedListeners
    document.removeEventListener("ended", this._onMediaEnded);
    this.mediaElement = null;
  }
}
