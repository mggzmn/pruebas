import { SectionStateManager } from "../managers/sectionStateManager.js";

/**
 * Manejador para el audio de las secciones.
 */
export class SectionAudioHandler {
  /**
   * Constructor del manejador de audio para secciones.
   * @param {Object} courseController - Controlador principal del curso.
   */
  constructor(courseController) {
    this.courseController = courseController;
    this.sectionStateManager = new SectionStateManager();

    this.currentAudio = null;
    this.isAudioPlaying = false;
    this.audioDebounceTimeout = null;
  }

  /**
   * Prepara la sincronización del audio antes de ejecutar funciones de sección.
   * @param {Function} callback - Función a ejecutar después de preparar el audio.
   */
  prepareAudioSync(callback) {
    if (typeof callback === "function") {
      if (this.isAudioPlaying) {
        this.stopCurrentAudio();
      }
      callback();
    }
  }

  /**
   * Ejecuta el audio para una sección, si corresponde.
   * @param {Element} section - Elemento de la sección.
   * @param {boolean} [force=false] - Si debe forzarse la reproducción.
   * @param {boolean} [fromCompletedPage=false] - Si proviene de una página completada.
   */
  playAudioForSection(section, force = false, fromCompletedPage = false) {
    const audioElement = section.querySelector("audio, video");
    if (!audioElement) return;

    // Si se requiere forzar o la sección no se ha completado, reproduce
    const sectionId = section.id;
    const pageId = this.courseController.stateManager.pages[this.courseController.stateManager.getCurrentPage()]?.id;

    if (
      force ||
      !this.sectionStateManager.isSectionCompleted(sectionId, pageId) ||
      fromCompletedPage
    ) {
      this._playMediaElement(audioElement);
      this.isAudioPlaying = true;
      this.currentAudio = audioElement;
    }
  }

  /**
   * Ejecuta el audio o lógica visual de la sección, pero sin reproducción real de audio.
   * @param {Element} section - Elemento de la sección.
   */
  executeAudioForSectionWithoutReproduction(section) {
    // Por compatibilidad, ejecuta solo lógica visual si se requiere.
    const audioElement = section.querySelector("audio, video");
    if (audioElement) {
      audioElement.currentTime = audioElement.duration || 0;
      this.isAudioPlaying = false;
    }
  }

  /**
   * Detiene cualquier audio en reproducción actual.
   * @param {boolean} [reset=false] - Si se debe reiniciar el audio.
   */
  stopCurrentAudio(reset = false) {
    if (this.currentAudio) {
      this.currentAudio.pause();
      if (reset) {
        this.currentAudio.currentTime = 0;
      }
      this.isAudioPlaying = false;
      this.currentAudio = null;
    }
    this.resetDebounceTime();
  }

  /**
   * Reinicia el temporizador de debounce para el audio.
   */
  resetDebounceTime() {
    if (this.audioDebounceTimeout) {
      clearTimeout(this.audioDebounceTimeout);
      this.audioDebounceTimeout = null;
    }
  }

  /**
   * Reproduce un elemento de audio o video.
   * @param {HTMLMediaElement} mediaElement - Elemento de audio o video.
   * @private
   */
  _playMediaElement(mediaElement) {
    try {
      mediaElement.currentTime = 0;
      mediaElement.play();
    } catch (e) {
      // Silenciosamente ignora errores de reproducción
    }
  }

  /**
   * Función utilitaria para configurar audio y eventos para una sección.
   * @param {string} audioSrc - Ruta del archivo de audio.
   * @param {Array} events - Eventos a ejecutar durante la reproducción.
   * @param {Array} onEndActions - Acciones a ejecutar cuando termina el audio.
   */
  setupAudioWithEvents(audioSrc, events, onEndActions) {
    if (audioSrc) {
      this.courseController.audioController.setAudioSource(audioSrc);
      const slideAudioData = {
        events: events || [],
        onEndActions: onEndActions || [],
      };
      this.courseController.slideAudioManager.init(slideAudioData);
    }
  }

  /**
   * Función utilitaria para configurar video y eventos para una sección.
   * @param {string} videoSrc - Ruta del archivo de video.
   * @param {HTMLElement} section - Elemento de la sección.
   */
  setupVideo(videoSrc, section) {
    if (!videoSrc) {
      console.error("setupVideoWithEvents: ¡La fuente de video está vacía!");
      return;
    }
    // Solo orquesta: delega la manipulación al audioController
    this.courseController.audioController.setAudioSource(videoSrc, section);
  }
}
