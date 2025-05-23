import { AnimationUtils } from "../utils/animationUtils.js";

// Controlador principal para audio y video.
export class AudioController {
  constructor(navigationView = null) {
    this.mainMedia = null;
    this.mainVideo = null;
    this.activeVideoElement = null; // Added explicit initialization
    this.isMuted = false;
    this.volumeLevel = 1;
    this.lastAudioPlayTime = 0;
    this.audioDebounceTime = 100;
    this.sectionAudioMap = new Map();
    this.currentMediaType = "audio";
    this.navigationView = navigationView; // Inyección de dependencia (puede ser null)
  }

  setNavigationView(view) {
    this.navigationView = view;
  }

  setupGlobalEvents() {
    this.mainMedia = document.getElementById("main-media");
    this.mainVideo = document.getElementById("main-video");

    document.getElementById("btn-play-pause").addEventListener("click", () => {
      this.togglePlayPause();
      // Notificar a navigationView si está disponible (sin usar window)
      if (this.navigationView && typeof this.navigationView.setPlayPauseState === "function") {
        this.navigationView.setPlayPauseState(!this.isPaused());
      }
    });
    document.getElementById("btn-mute").addEventListener("click", () => {
      this.toggleMute();
    });
    document.getElementById("btn-volume-up").addEventListener("click", () => {
      this.adjustVolume(0.1);
    });
    document.getElementById("btn-volume-down").addEventListener("click", () => {
      this.adjustVolume(-0.1);
    });
    this._ensureVideoElement();
  }

  /**
   * Asegura que el elemento de video exista en el DOM.
   * @private
   */
  _ensureVideoElement() {
    if (!this.mainVideo) {
      const existingVideo = document.getElementById("main-video");
      if (existingVideo) {
        this.mainVideo = existingVideo;
        // Asegurar que los controles nativos estén desactivados
        this.mainVideo.controls = false;
      } else {
        // Create video element if it doesn't exist
        const videoContainer = document.querySelector(".media-container") || document.body;
        const videoElement = document.createElement("video");
        videoElement.id = "main-video";
        videoElement.classList.add("media-element", "media-hidden");
        videoElement.controls = false; // Sin controles nativos
        videoContainer.appendChild(videoElement);
        this.mainVideo = videoElement;
      }
    }
  }

  togglePlayPause() {
    const mediaElement = this._getCurrentMediaElement();
    if (mediaElement) {
      if (mediaElement.paused) {
        mediaElement.play();
      } else {
        mediaElement.pause();
      }
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    
    // Apply to current media element (could be section video or main elements)
    const currentMedia = this._getCurrentMediaElement();
    if (currentMedia) {
      currentMedia.muted = this.isMuted;
    }
    
    // Also apply to main elements to keep state consistent
    if (this.mainMedia) {
      this.mainMedia.muted = this.isMuted;
    }
    
    if (this.mainVideo) {
      this.mainVideo.muted = this.isMuted;
    }
    
    // Apply to the active video if it's not the current media
    if (this.activeVideoElement && this.activeVideoElement !== currentMedia) {
      this.activeVideoElement.muted = this.isMuted;
    }
  }

  adjustVolume(delta) {
    this.volumeLevel = Math.min(1, Math.max(0, this.volumeLevel + delta));
    
    // Apply to current media element (could be section video or main elements)
    const currentMedia = this._getCurrentMediaElement();
    if (currentMedia) {
      currentMedia.volume = this.volumeLevel;
    }
    
    // Also apply to main elements to keep state consistent
    if (this.mainMedia) {
      this.mainMedia.volume = this.volumeLevel;
    }
    
    if (this.mainVideo) {
      this.mainVideo.volume = this.volumeLevel;
    }
    
    // Apply to the active video if it's not the current media
    if (this.activeVideoElement && this.activeVideoElement !== currentMedia) {
      this.activeVideoElement.volume = this.volumeLevel;
    }
  }

  /**
   * Detecta si una fuente es video basada en su extensión o URL
   * @param {string} source - URL de la fuente
   * @returns {boolean} - true si es video, false si es audio
   */
  _isVideoSource(source) {
    if (!source) return false;

    // Comprobar por extensiones comunes de video
    const videoExtensions = [".mp4", ".webm", ".ogg", ".mov", ".avi"];
    const sourceLC = source.toLowerCase();

    // Check for video extensions
    for (const ext of videoExtensions) {
      if (sourceLC.endsWith(ext)) return true;
    }

    // Check for video hosting domains
    return sourceLC.includes("youtube.com") || sourceLC.includes("vimeo.com") || sourceLC.includes("tclcdn.com");
  }

  /**
   * Configura una fuente de audio/video
   * @param {string} newSource - URL del audio/video
   * @param {Element} [sectionElement] - Elemento de sección que contiene el video (opcional)
   */
  setAudioSource(newSource, sectionElement = null) {
    if (!newSource) return;

    // Determine if this is a video or audio source
    const isVideo = this._isVideoSource(newSource);
    this.currentMediaType = isVideo ? "video" : "audio";

    // Clean both audio and video sources
    this.cleanMediaSources();

    if (isVideo) {
      this._setVideoSource(newSource, sectionElement);
    } else {
      this._setAudioSource(newSource);
    }
  }

  /**
   * Configura una fuente de audio
   * @param {string} newSource - URL del audio
   * @private
   */
  _setAudioSource(newSource) {
    if (!this.mainMedia) return;

    // Mostrar elemento de audio y ocultar el de video
    if (this.mainVideo) {
      this.mainVideo.classList.add('media-hidden');
      this.mainVideo.classList.remove('media-visible');
    }
    
    if (this.mainMedia) {
      this.mainMedia.classList.add('media-visible');
      this.mainMedia.classList.remove('media-hidden');
    }

    this.mainMedia.src = newSource;
    // Asegurar volumen global
    this.mainMedia.volume = this.volumeLevel;

    const onCanPlayThrough = () => {
      this.mainMedia.removeEventListener("canplaythrough", onCanPlayThrough);
      this.mainMedia.play();
    };
    this.mainMedia.addEventListener("canplaythrough", onCanPlayThrough);
    this.mainMedia.load();
  }

  /**
   * Configura una fuente de video
   * @param {string} newSource - URL del video
   * @param {Element} [sectionElement] - Elemento de sección que contiene el video (opcional)
   * @private
   */
  _setVideoSource(newSource, sectionElement = null) {
    let videoElement = null;
    
    // Primero buscar video en la sección específica si se proporciona
    if (sectionElement) {
      videoElement = sectionElement.querySelector('video');
    }
    
    // Si no se encuentra en la sección o no se proporcionó sección, usar el video global
    if (!videoElement) {
      if (this.mainVideo) {
        videoElement = this.mainVideo;
      } else {
        this._ensureVideoElement();
        videoElement = this.mainVideo;
      }
    }
    
    // Guardar tipo de medio ANTES de configurar el video
    this.currentMediaType = "video";
    
    // Establecer propiedades comunes del video
    if (videoElement) {
      // Establecer como elemento activo antes de cualquier otra operación
      this.activeVideoElement = videoElement;
      
      // Limpiar source elements existentes
      const sources = videoElement.querySelectorAll('source');
      sources.forEach(source => {
        source.removeAttribute('src');
        source.removeAttribute('type');
      });
      
      // Crear nuevo source si es necesario
      const sourceElement = videoElement.querySelector('source') || document.createElement('source');
      // Primero configurar el tipo, luego la fuente
      sourceElement.type = 'video/mp4';
      sourceElement.src = newSource;
      
      if (!sourceElement.parentNode) {
        videoElement.appendChild(sourceElement);
      }

      // Configurar video para autoplay
      videoElement.classList.add('video-active', 'media-visible');
      videoElement.classList.remove('video-inactive', 'media-hidden');
      videoElement.muted = true; // Inicialmente silenciado para autoplay
      videoElement.controls = false; // Sin controles nativos
      

      // Manejar evento de reproducción para aplicar volumen global
      videoElement.oncanplay = () => {
        console.log("Video can play, applying volume settings");
        videoElement.volume = this.volumeLevel;
        
        // Quitar muted después de un momento para permitir autoplay
        AnimationUtils.executeAfterFrames(() => {
          if (!this.isMuted) {
            videoElement.muted = false;
          }
        }, 5);
      };
      
      // Cargar y preparar el video
      console.log("Loading video source:", newSource);
      videoElement.load();
      
      // Reproducir video después de cargarlo completamente
      videoElement.onloadedmetadata = () => {
        console.log("Video metadata loaded, attempting playback");
        // Usar Promise para manejar errores
        videoElement.play()
          .then(() => console.log("Video playback started successfully"))
          .catch(error => {
            console.warn("Auto-play prevented. Requiring user interaction:", error);
            // Mostrar mensaje o UI para que el usuario haga clic para reproducir
          });
      };
    }

    // Ocultar elemento de audio
    if (this.mainMedia) {
      this.mainMedia.classList.add('media-hidden');
      this.mainMedia.classList.remove('media-visible');
    }
  }

  /**
   * method to clean audio source - called by CourseController
   */
  cleanAudioSource() {
    this.cleanMediaSources();
  }

  /**
   * Limpia las fuentes de audio y video
   */
  cleanMediaSources() {
    // Guardar el tipo actual para restaurarlo después de la limpieza
    const currentType = this.currentMediaType;
    console.log("Cleaning media sources:", currentType);
    if (this.mainMedia) {
      this.mainMedia.pause();
      this.mainMedia.src = "";
      this.mainMedia.load();
    }
    
    // Limpiar el video activo
    if (this.activeVideoElement) {
      this.activeVideoElement.pause();
      
      // Limpiar source elements
      const sources = this.activeVideoElement.querySelectorAll('source');
      sources.forEach(source => {
        source.removeAttribute('src');
        source.removeAttribute('type');
      });
    }
    
    if (this.mainVideo && this.mainVideo !== this.activeVideoElement) {
      this.mainVideo.pause();
      this.mainVideo.src = "";
      this.mainVideo.classList.add('media-hidden');
      this.mainVideo.classList.remove('media-visible');
      
      if (this.mainVideo.hasAttribute("poster")) {
        this.mainVideo.removeAttribute("poster");
      }
    }

    // Solo restaurar a audio si realmente estamos limpiando todo
    if (currentType === "video" && this.activeVideoElement) {
      // Mantener el tipo de medio como video si estamos con un video
      this.currentMediaType = "video";
    } else {
      this.currentMediaType = "audio";
    }
  }

  isPlaying() {
    const mediaElement = this._getCurrentMediaElement();
    return mediaElement ? !mediaElement.paused : false;
  }

  isPaused() {
    const mediaElement = this._getCurrentMediaElement();
    return mediaElement ? mediaElement.paused : true;
  }

  getCurrentSource() {
    const mediaElement = this._getCurrentMediaElement();
    return mediaElement ? mediaElement.src : null;
  }

  /**
   * Obtiene el elemento multimedia activo actualmente (audio o video)
   * @returns {HTMLElement|null} - Elemento multimedia activo
   * @private
   */
  _getCurrentMediaElement() {
    if (this.currentMediaType === "video") {
      // Priorizar el elemento de video activo guardado si existe
      if (this.activeVideoElement) {
        return this.activeVideoElement;
      }
      
      // Buscar en las secciones visibles
      const activeSection = document.querySelector('.slide-section.visible');
      if (activeSection) {
        const sectionVideo = activeSection.querySelector('video');
        if (sectionVideo) return sectionVideo;
      }
      
      // Último recurso: cualquier video visible en la página
      return document.querySelector('video.video-active') || 
             document.querySelector('video') || 
             this.mainVideo;
    }
    
    return this.mainMedia;
  }

  /**
   * Pausa el elemento multimedia actual
   */
  pauseAudio() {
    const mediaElement = this._getCurrentMediaElement();
    if (mediaElement && !mediaElement.paused) {
      mediaElement.pause();
    }
  }
  
}
