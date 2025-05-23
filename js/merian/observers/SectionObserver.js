import { AnimationUtils } from "../utils/animationUtils.js";
import { SectionIdUtils } from "../utils/SectionIdUtils.js";
import { SectionStateManager } from "../managers/sectionStateManager.js";

/**
 * Clase responsable de observar la visibilidad de las secciones en el viewport
 * y manejar la navegación a secciones pendientes. Utiliza SectionStateManager
 * como fuente única de la verdad del estado de sección activa por página.
 */
export class SectionObserver {
  /**
   * Constructor
   * @param {SectionController} sectionController - Referencia al controlador de secciones
   * @param {SectionStateManager} sectionStateManager - Instancia única
   */
  constructor(sectionController, sectionStateManager) {
    this.sectionController = sectionController;
    this.observers = [];
    this.config = { observerThreshold: 0.3 };
    this.isObserving = true;
    this.sectionStateManager = sectionStateManager;
  }

  resetObservers() {
    if (this.observers.length > 0) {
      this.observers.forEach((observer) => observer.disconnect());
      this.observers = [];
    }
    this.sectionStateManager.clearCurrentSection(this.sectionController.currentPageId);
  }

  disconnect() {
    this.resetObservers();
    this.cancelPendingAudioEvents();
    this.sectionStateManager.clearCurrentSection(this.sectionController.currentPageId);
  }

  setupObservers(sections) {
    this.resetObservers();
    if (!sections || sections.length === 0) return;
    const options = {
      root: null,
      rootMargin: "0px",
      threshold: this.config.observerThreshold,
    };

    sections.forEach((section, index) => {
      if (!section) return;
      const observer = this._createObserverForSection(section, index, options);
      this.observers.push(observer);
    });
  }

  _createObserverForSection(section, index, options) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        this.handleSectionIntersection(entry, section, index);
      });
    }, options);

    observer.observe(section);
    return observer;
  }

  /**
   * Maneja la intersección de una sección con el viewport.
   * Solo ejecuta la función de la sección si entra por scroll real, next/prev o TOC,
   * nunca por resize u otros triggers automáticos.
   * Actualiza el state solo cuando corresponde.
   * @param {IntersectionObserverEntry} entry - Entrada del observer.
   * @param {Element} section - Sección observada.
   * @param {number} index - Índice de la sección.
   */
  handleSectionIntersection(entry, section, index) {
    // Centraliza flags en sectionStateManager
    const isTOCNavigation = this.sectionStateManager.getIsNavigatingToSectionFromTOC();
    const ignoreFlag = this.sectionStateManager.getIsForcedNavigation() || isTOCNavigation;

    if (!entry.isIntersecting) {
      this._handleSectionExitViewport(section);
      return;
    }
    // Solo ignorar si es TOC o navegación forzada
    if (ignoreFlag) return;
    if (this._shouldIgnoreIntersectionDuringTOCNavigation()) return;
    if (this.sectionStateManager.getIsResizing()) return; // Ignora intersecciones durante resize
    // Siempre verifica si se puede proceder a esta sección antes de ejecutar cualquier función
    if (!this.sectionController.canProceedToSection(index)) {
      // No permitido por la secuencia, no ejecutes nada
      return;
    }
    const sectionIdAttr = section.getAttribute("data-original-id") || section.id;
    const currentPageId = this.sectionController.currentPageId;
    const currentSectionNormalizedId = SectionIdUtils.normalizeId(sectionIdAttr, currentPageId);

    // Procesar SIEMPRE que entra al viewport como resultado de scroll automático de nextSection
    this._processSectionIntersection(section, sectionIdAttr, index, currentSectionNormalizedId);
  }

  _processSectionIntersection(section, sectionIdAttr, index, currentSectionNormalizedId) {
    this.sectionStateManager.setCurrentSection(currentSectionNormalizedId, this.sectionController.currentPageId);
    this.saveCurrentSectionId(sectionIdAttr);

    this._handleNewPageIntersection(section, index, sectionIdAttr);
  }

  _handleSectionExitViewport(section) {
    const sectionIdAttr = section.getAttribute("data-original-id") || section.id;
    const currentPageId = this.sectionController.currentPageId;
    const normalizedSectionId = SectionIdUtils.normalizeId(sectionIdAttr, currentPageId);

    if (this.sectionStateManager.getCurrentSection(currentPageId) === normalizedSectionId) {
      this.sectionStateManager.clearCurrentSection(currentPageId);
    }
  }

  _shouldIgnoreIntersectionDuringTOCNavigation() {
    if (!this.sectionController.isNavigatingToSectionFromTOC) return false;
    const currentPageIndex = this.sectionController.courseController.stateManager.getCurrentPage();
    return !this.sectionController.courseController.stateManager.pages[currentPageIndex]?.completed;
  }

  _isOnPreviouslyCompletedPage() {
    const currentPageIndex = this.sectionController.courseController.stateManager.getCurrentPage();
    const furthestPage = this.sectionController.courseController.stateManager.getFurthestPage();
    return furthestPage > currentPageIndex;
  }

/**
 * Maneja la intersección y ejecución de la función para la sección correspondiente.
 * @param {Element} section - Elemento de la sección.
 * @param {number} index - Índice de la sección.
 * @param {string} sectionId - ID de la sección.
 */
_handleNewPageIntersection(section, index, sectionId) {
  const normalizedId = SectionIdUtils.normalizeId(sectionId, this.sectionController.currentPageId);
  const activeSectionId = this.sectionController.sectionStateManager.getCurrentSection(this.sectionController.currentPageId);

  // Si estamos navegando por TOC, solo ejecuta la función para la sección destino
  if (this.sectionController.sectionStateManager.getIsNavigatingToSectionFromTOC()) {
    if (normalizedId !== activeSectionId) {
      return;
    }
    // Limpia audio y listeners ANTES de ejecutar la función de la nueva sección
    if (this.sectionController.audioController && typeof this.sectionController.audioController.cleanMediaSources === "function") {
      this.sectionController.audioController.cleanMediaSources();
    }
    if (this.sectionController.slideAudioManager && typeof this.sectionController.slideAudioManager._removeEventListeners === "function") {
      this.sectionController.slideAudioManager._removeEventListeners();
    }
  } else {
    // Si no es navegación por TOC, sigue la lógica normal
    if (normalizedId !== activeSectionId) {
      return;
    }
  }

  this.sectionController.syncCurrentSectionIndex(section.id);

  if (index <= this.sectionController.currentSectionIndex + 1) {
    requestAnimationFrame(() => {
      this.sectionController.audioHandler.prepareAudioSync(() => {
        this.sectionController.executeFunction(section);
        setTimeout(() => {
          this.sectionController.audioHandler.playAudioForSection(section, true, false);
        }, 100);
      });
    });
  }
}


  saveCurrentSectionId(sectionId) {
    if (!sectionId) return;
    const currentPageId = this.sectionController.currentPageId;
    const normalizedSectionId = sectionId.includes(currentPageId) ? sectionId : `${currentPageId}_${sectionId}`;
    this.sectionController.progressManager.updateCurrentSectionId(normalizedSectionId);
  }

  retrievePendingSectionId() {
    return this.sectionStateManager.getPendingSectionId();
  }

  cancelPendingAudioEvents() {
    // No-op, extensible.
  }

  destroy() {
    this.disconnect();
  }
  /**
   * Actualiza la sección actual en el observador.
   * @param {Element} section - Elemento de la sección actual.
   */
  updateCurrentSection(section) {
    if (!section) return;

    const sectionIdAttr = section.getAttribute("data-original-id") || section.id;
    const currentPageId = this.sectionController.currentPageId;
    const normalizedSectionId = SectionIdUtils.normalizeId(sectionIdAttr, currentPageId);

    this.sectionStateManager.setCurrentSection(normalizedSectionId, currentPageId);
    this.saveCurrentSectionId(sectionIdAttr);
  }

  
}
