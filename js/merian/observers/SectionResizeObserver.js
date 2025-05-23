import { SectionIdUtils } from "../utils/SectionIdUtils.js";
import { SectionStateManager } from "../managers/sectionStateManager.js";

/**
 * Clase que observa el tamaño y visibilidad de las secciones,
 * reportando la sección más visible y delegando el estado global
 * de sección activa a SectionStateManager.
 */
export class SectionResizeObserver {
  /**
   * Constructor.
   * @param {SectionController} sectionController - Referencia al SectionController.
   */
  constructor(sectionController) {
    this.sectionController = sectionController;
    this.observer = null;
    this.sectionStateManager = sectionController.sectionStateManager || new SectionStateManager();
    this.ignoreResize = false;
    this.isInCompletedPage = false;
    this.completedPageId = null;
  }

  /**
   * Inicializa el observer sobre las secciones.
   * @param {Element[]} sections - Lista de elementos de secciones.
   */
  setup(sections) {
    this.disconnect();
    if (!sections || sections.length === 0) return;
    this.observer = new window.ResizeObserver(() => {
      this._onResize(sections);
    });
    sections.forEach((section) => this.observer.observe(section));
    this._onResize(sections); // Llamada inicial
  }

  /**
   * Desconecta y limpia el observer.
   */
  disconnect() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  /**
   * Maneja el evento de cambio de tamaño,
   * determina la sección más visible y actualiza el estado global.
   * @param {Element[]} sections - Lista de elementos de secciones.
   * @private
   */
  _onResize(sections) {
    if (this.ignoreResize || this.sectionController.isNavigatingToSectionFromTOC ) {
      // console.log("[ResizeObserver] Ignorando procesamiento de sección visible debido a navegación TOC.");
      return;
    }
    // Determinar la sección más visible
    let maxRatio = -1;
    let mostVisibleSection = null;
    for (const section of sections) {
      const rect = section.getBoundingClientRect();
      const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
      const ratio = visibleHeight / rect.height;
      if (ratio > maxRatio) {
        maxRatio = ratio;
        mostVisibleSection = section;
      }
    }
    if (mostVisibleSection && maxRatio > 0.5) {
      const sectionIdAttr = mostVisibleSection.getAttribute("data-original-id") || mostVisibleSection.id;
      const currentPageId = this.sectionController.currentPageId;
      const normalizedSectionId = SectionIdUtils.normalizeId(sectionIdAttr, currentPageId);

    
    }
  }

  /**
   * Marca si la página es una página completada, útil para forzar la visibilidad especial.
   * @param {boolean} isCompleted
   * @param {string|null} pageId
   */
  setCompletedPage(isCompleted, pageId) {
    this.isInCompletedPage = isCompleted;
    this.completedPageId = pageId;
  }

  /**
   * Limpia todos los recursos utilizados.
   */
  destroy() {
    this.disconnect();
  }
  /**
   * Observa los cambios de tamaño en las secciones.
   * @param {Array<Element>} sections - Array de elementos sección.
   */
  observeSections(sections) {
    // Aquí va la lógica de observer, por ejemplo:
    if (!sections || !sections.length) return;
    // Si tienes un ResizeObserver nativo:
    if (!this.observer) {
      this.observer = new ResizeObserver((entries) => {
        // Aquí tu lógica de resize, por ejemplo actualizar algo en sectionController
      });
    }
    sections.forEach((section) => {
      this.observer.observe(section);
    });
  }
  /**
   * Inicia la observación de cambios de tamaño en todas las secciones indicadas.
   * Al detectar un cambio, mantiene el foco visual en la sección activa.
   * @param {Element[]} sections - Array de elementos DOM de las secciones.
   */
  observeSections(sections) {
    if (!Array.isArray(sections) || sections.length === 0) return;

    // Si ya existe un observer, primero lo desconectamos para evitar duplicados.
    if (this.observer) {
      this.observer.disconnect();
    }

    /**
     * Callback de ResizeObserver: mantiene el foco en la sección activa.
     * @param {ResizeObserverEntry[]} entries
     */
const handleResize = (entries) => {
    this.sectionStateManager.setIsResizing(true);

    // Centra la sección activa, pero NO actualices sección ni dispares intersección
    const activeSectionId = this.sectionStateManager.getCurrentSection(this.sectionController.currentPageId);
    if (!activeSectionId) {
        this.sectionStateManager.setIsResizing(false);
        return;
    }
    const sections = this.sectionController.sections;
    const activeSection = sections.find(
        (section) => section.id === activeSectionId || section.getAttribute("data-original-id") === activeSectionId
    );
    if (activeSection && typeof activeSection.scrollIntoView === "function") {
        activeSection.scrollIntoView({ behavior: "auto", block: "center" });
    }
    this.sectionStateManager.setIsResizing(false);
};


    // Crear nuevo ResizeObserver.
    this.observer = new ResizeObserver(handleResize);

    // Observar todas las secciones.
    sections.forEach((section) => {
      this.observer.observe(section);
    });
  }

  /**
   * Detiene la observación de resize y libera recursos.
   */
  disconnect() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}
