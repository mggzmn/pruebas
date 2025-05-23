export class NavigationView {
  constructor(config = {}) {
    this.elements = {
      prevButton: document.getElementById(config.prevButtonId || "btn-previous"),
      nextButton: document.getElementById(config.nextButtonId || "btn-next"),
      tocButton: document.getElementById(config.tocButtonId || "btn-TOC"),
      tocElement: document.getElementById(config.tocElementId || "table-of-contents"),
      navBar: document.getElementById("navigation-bar") || document.querySelector(".nav-controls") || document.querySelector("nav"),
      playPauseButton: document.getElementById(config.playPauseButtonId || "btn-play-pause"),
    };

    this.listeners = {};
  }

  initialize() {
    if (!this.elements.navBar) {
      console.warn("[NavigationView] Navigation bar element not found. Navigation visibility won't be controlled.");
    }

    this._setupEventListeners();
  }

  _setupEventListeners() {
    if (this.elements.prevButton) {
      this.elements.prevButton.addEventListener("click", () => {
        if (this.listeners.onPrevious) this.listeners.onPrevious();
      });
    }

    if (this.elements.nextButton) {
      this.elements.nextButton.addEventListener("click", () => {
        if (this.listeners.onNext) this.listeners.onNext();
      });
    }

    if (this.elements.tocButton) {
      this.elements.tocButton.addEventListener("click", () => {
        if (this.listeners.onToggleTOC) this.listeners.onToggleTOC();
      });
    }

    if (this.elements.playPauseButton) {
      this.elements.playPauseButton.addEventListener("click", () => {
        if (this.listeners.onPlayPause) this.listeners.onPlayPause();
      });
    }
  }

  setNavigationListener(event, callback) {
    this.listeners[event] = callback;
  }

  updateButtonState(prevEnabled, nextEnabled, tocEnabled) {
    if (this.elements.prevButton) {
      this.elements.prevButton.disabled = !prevEnabled;
    }

    if (this.elements.nextButton) {
      this.elements.nextButton.disabled = !nextEnabled;
    }

    if (this.elements.tocButton) {
      this.elements.tocButton.disabled = !tocEnabled;
    }
  }

  setNavigationVisibility(visible) {
    if (!this.elements.navBar) return;
    this.elements.navBar.style.display = visible ? "flex" : "none";
  }
  isTOCVisible() {
    return this.elements.tocElement && this.elements.tocElement.classList.contains("toc__visible");
  }

  setTOCVisibility(visible) {
    if (!this.elements.tocElement) {
      this.elements.tocElement = document.getElementById("table-of-contents");
      if (!this.elements.tocElement) return;
    }
    
    // Si ya está en el estado deseado, no hacer nada
    const isCurrentlyVisible = this.elements.tocElement.classList.contains("toc__visible");
    if (visible === isCurrentlyVisible) return;
    
    // Aplicar el cambio con transición adecuada
    if (visible) {
      // Asegurar que el elemento esté disponible para animación
      if (this.elements.tocElement.style.display === "none") {
        this.elements.tocElement.style.display = "";
      }
      
      // Forzar un reflow antes de añadir la clase
      void this.elements.tocElement.offsetHeight;
      this.elements.tocElement.classList.add("toc__visible");
    } else {
      this.elements.tocElement.classList.remove("toc__visible");
    }
  }

  /**
   * Cambia el icono y el title del botón play/pause según el estado.
   * @param {boolean} isPlaying - true si está reproduciendo, false si está en pausa
   */
  setPlayPauseState(isPlaying) {
    if (!this.elements.playPauseButton) return;
    if (isPlaying) {
      this.elements.playPauseButton.classList.remove("paused");
      this.elements.playPauseButton.title = "Pausar";
    } else {
      this.elements.playPauseButton.classList.add("paused");
      this.elements.playPauseButton.title = "Reproducir";
    }
  }
}
