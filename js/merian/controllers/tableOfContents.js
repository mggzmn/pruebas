import { SectionIdUtils } from "../utils/SectionIdUtils.js";
import { modules } from "../../courseSettings.js";
import { AnimationUtils } from "../utils/animationUtils.js";
import { SectionStateManager } from "../managers/sectionStateManager.js";
const SCROLL_TIMEOUT = 800;
const MAX_SCROLL_ATTEMPTS = 30;
const SCROLL_ATTEMPT_DELAY = 80;
/**
 * Controlador de la Tabla de Contenidos.
 * Gestiona la navegación entre páginas y secciones a través del TOC.
 */
export class TableOfContentsController {
  /**
   * Constructor
   * @param {Object} courseController - Controlador principal del curso
   */
  constructor(courseController) {
    this.courseController = courseController;
    this.model = null;
    this.view = null;
    this.initialized = false;
    this.pendingSectionNavigation = null;
    this.boundToggleTOC = this.toggleTOC.bind(this);
    this.sectionStateManager = new SectionStateManager();

    // Para operaciones asíncronas personalizadas
    this.events = new EventTarget();
  }

  /**
   * Inicializa el controlador de la tabla de contenidos.
   * @param {Object} model - Modelo de datos del TOC.
   * @param {Object} view - Vista del TOC.
   * @param {string} containerId - ID del contenedor HTML para el TOC.
   */
  initialize(model, view, containerId = "table-of-contents") {
    this.model = model;
    this.view = view;
    this.model.initializeFromPages(this.courseController.stateManager.pages, modules);
    this.view.initialize(containerId);

    this.view.setToggleButtonListener(this.toggleTOC.bind(this));
    this.view.setOutsideClickListener(() => this.hideTOC());
    this.view.setPageSelectedCallback((pageIndex) => this.navigateToPage(pageIndex));
    this.view.setSectionSelectedCallback((pageIndex, sectionId) => this.navigateToSection(pageIndex, sectionId));

    this.courseController.sectionController.addSectionCompletionListener((sectionId, pageId) => {
      this.handleSectionCompleted(sectionId, pageId);
    });

    this.initializeAllPageSections();

    this.updateTOC();
    this.initialized = true;
    this._setupCustomEventListeners();
  }

  /**
   * Configura los event listeners personalizados.
   * @private
   */
  _setupCustomEventListeners() {
    this.events.addEventListener("page-changed", (e) => {
      const pending = this._retrievePendingSectionNavigation();
      if (pending) {
        this._handlePendingSectionNavigation(pending);
      }
    });
  }

  /**
   * Carga todas las secciones de todas las páginas en la inicialización.
   */
  initializeAllPageSections() {
    const pages = this.courseController.stateManager.pages;
    pages.forEach((page, index) => {
      if (page.sections === true) {
        this.loadPageSections(index);
      }
    });
  }

  /**
   * Carga las secciones de una página específica.
   * @param {number} pageIndex - Índice de la página.
   */
  loadPageSections(pageIndex) {
    const page = this.courseController.stateManager.pages[pageIndex];
    if (!page || !page.sections) return;

    if (this.courseController.stateManager.getCurrentPage() === pageIndex) {
      const sections = this._extractSectionsFromPage(pageIndex);
      if (sections.length > 0) {
        this.model.setSections(pageIndex, sections);
      }
      return;
    }
    this._loadPageHtmlAndExtractSections(page.url, pageIndex);
  }

  /**
   * Sincroniza el TOC con el estado de páginas completadas.
   */
  synchronizeTOCWithCompletedPages() {
    const pages = this.courseController.stateManager.pages;
    pages.forEach((page, index) => {
      if (page.completed) {
        this.model.updatePageStatus(index, true);
        this.view.updatePageStatus(index, true);
        this.markAllPageSectionsAsCompleted(index);
      }
    });
  }

  /**
   * Adjunta el listener de eventos al botón TOC.
   * @param {string} buttonId - ID del botón TOC.
   */
  attachTOCButtonListener(buttonId = "btn-TOC") {
    const tocButton = document.getElementById(buttonId);
    if (tocButton) {
      tocButton.removeEventListener("click", this.boundToggleTOC);
      tocButton.addEventListener("click", this.boundToggleTOC);
      console.log("TOC button listener attached.");
    } else {
      console.warn(`TOC button with ID "${buttonId}" not found.`);
    }
  }

  /**
   * Marca todas las secciones de una página como completadas en el TOC.
   * @param {number} pageIndex - Índice de la página.
   */
  markAllPageSectionsAsCompleted(pageIndex) {
    const sections = this.model.getSections(pageIndex);
    if (!sections || sections.length === 0) return;

    console.log(`Marking all ${sections.length} sections as completed for page ${pageIndex}`);
    sections.forEach((section) => {
      this.model.updateSectionStatus(pageIndex, section.id, true);
      this.view.updateSectionStatus(pageIndex, section.id, true);
      // Marca la sección como completada en el SectionStateManager
      this.sectionStateManager.setSectionCompleted(section.id, this.courseController.stateManager.pages[pageIndex].id);
    });
  }

  /**
   * Maneja la completación de una página y marca todas sus secciones como completadas.
   * @param {number} pageIndex - Índice de la página completada.
   */
  handlePageCompleted(pageIndex) {
    if (!this.initialized) return;
    this.model.updatePageStatus(pageIndex, true);
    this.view.updatePageStatus(pageIndex, true);
    this.markAllPageSectionsAsCompleted(pageIndex);
  }

  /**
   * Marca una página y sus secciones como incompletas.
   * @param {number} pageIndex - Índice de la página.
   */
  markPageIncompleteWithSections(pageIndex) {
    if (!this.initialized) return;
    this.model.updatePageStatus(pageIndex, false);
    this.view.updatePageStatus(pageIndex, false);

    const sections = this.model.getSections(pageIndex);
    if (sections && sections.length > 0) {
      sections.forEach((section) => {
        this.model.updateSectionStatus(pageIndex, section.id, false);
        this.view.updateSectionStatus(pageIndex, section.id, false);
        this.sectionStateManager.setSectionIncomplete(section.id, this.courseController.stateManager.pages[pageIndex].id);
      });
    }
  }

  /**
   * Carga el HTML de una página y extrae sus secciones.
   * @param {string} pageUrl - URL de la página.
   * @param {number} pageIndex - Índice de la página.
   * @private
   */
  _loadPageHtmlAndExtractSections(pageUrl, pageIndex) {
    const tempContainer = document.createElement("div");
    tempContainer.style.display = "none";
    document.body.appendChild(tempContainer);

    fetch(pageUrl)
      .then((response) => response.text())
      .then((html) => {
        tempContainer.innerHTML = html;
        const sections = this._extractSectionsFromTempContainer(tempContainer);
        if (sections.length > 0) {
          this.model.setSections(pageIndex, sections);
          if (this.view.isVisible()) {
            this.view.render(this.model.pages, this.model.sections, modules);
          }
        }
        document.body.removeChild(tempContainer);
      })
      .catch((error) => {
        console.error(`Error loading page ${pageUrl}:`, error);
        document.body.removeChild(tempContainer);
      });
  }

  /**
   * Extrae secciones de un contenedor temporal.
   * @param {HTMLElement} container - Contenedor HTML.
   * @returns {Array} - Array de objetos sección.
   * @private
   */
  _extractSectionsFromTempContainer(container) {
    const sections = [];
    const sectionElements = container.querySelectorAll(".slide-section");
    sectionElements.forEach((section, index) => {
      if (!section.id) return;
      let title = "Section";
      const heading = section.querySelector("h1, h2");
      if (heading) title = heading.textContent.trim();
      sections.push({
        id: section.id,
        title: title,
        completed: false,
      });
    });
    return sections;
  }

  /**
   * Extrae las secciones de la página actual del DOM.
   * @param {string|number} pageId - ID de la página o índice.
   * @param {number} position - Posición inicial.
   * @returns {Array} - Array de objetos de sección.
   * @private
   */
  _extractSectionsFromPage(pageId, position = 0) {
    const sections = [];
    const pageSections = document.querySelectorAll(".slide-section");
    const existingSections = this.model.getSections(pageId);
    const existingMap = this._createSectionCompletionMap(existingSections);

    pageSections.forEach((section, index) => {
      let sectionId = section.id;
      if (!sectionId) return;
      sectionId = SectionIdUtils.normalizeId(sectionId, pageId);
      const title = this._extractSectionTitle(section, index);

      // Consulta del estado real
      let completed = existingMap[sectionId] === true;
      if (!completed && this.sectionStateManager.isSectionCompleted(sectionId, pageId)) {
        completed = true;
      }
      sections.push({
        id: sectionId,
        title: title,
        completed: completed,
        position: position + index,
      });
    });
    return sections;
  }

  /**
   * Crea un mapa de estado de completado de secciones.
   * @param {Array} existingSections - Lista de secciones existentes.
   * @returns {Object} - Mapa de IDs de sección a estado de completado.
   * @private
   */
  _createSectionCompletionMap(existingSections) {
    const existingMap = {};
    if (existingSections && existingSections.length > 0) {
      existingSections.forEach((section) => {
        existingMap[section.id] = section.completed;
      });
    }
    return existingMap;
  }

  /**
   * Extrae el título de una sección.
   * @param {Element} section - Elemento de sección.
   * @param {number} index - Índice de la sección.
   * @returns {string} - Título de la sección.
   * @private
   */
  _extractSectionTitle(section, index) {
    let title = section.dataset.title;
    if (!title) {
      const heading = section.querySelector("h1, h2");
      if (heading) {
        title = heading.textContent.trim();
      } else {
        title = `Sección ${index + 1}`;
      }
    }
    return title;
  }

  /**
   * Maneja la completación de una sección.
   * @param {string} sectionId - ID de la sección completada.
   * @param {string} pageId - ID de la página que contiene la sección.
   */
  handleSectionCompleted(sectionId, pageId) {
    if (!this.initialized) return;
    console.log(`TOC: Handling section completion - sectionId: ${sectionId}, pageId: ${pageId}`);
    let pageIndex = this._getPageIndexFromId(pageId);
    this.courseController.sectionController.markSectionAsCompleted(sectionId, pageId);
    const normalizedSectionId = this._normalizeSectionId(sectionId, pageId);
    this.model.updateSectionStatus(pageIndex, normalizedSectionId, true);
    this.view.updateSectionStatus(pageIndex, normalizedSectionId, true);

    // Marca también en SectionStateManager
    this.sectionStateManager.setSectionCompleted(normalizedSectionId, pageId);

    if (this.model.areAllSectionsCompleted(pageIndex)) {
      if (this.pendingSectionNavigation) {
        console.log("Omitiendo 'última sección' porque existe pendiente:", this.pendingSectionNavigation);
        return;
      }
      this.model.updatePageStatus(pageIndex, true);
      this.view.updatePageStatus(pageIndex, true);
      console.log(`All sections completed for page ${pageIndex}, marking page as completed`);
    }
    console.log(`TOC: Manejando completación de sección - sectionId: ${sectionId}, pageId: ${pageId}`);
  }

  /**
   * Obtiene el índice de página a partir de su ID.
   * @param {string} pageId - ID de la página.
   * @returns {number} - Índice de la página.
   * @private
   */
  _getPageIndexFromId(pageId) {
    let pageIndex = -1;
    const pages = this.courseController.stateManager.pages;
    for (let i = 0; i < pages.length; i++) {
      if (pages[i]?.id === pageId) {
        pageIndex = i;
        break;
      }
    }
    if (pageIndex === -1) {
      pageIndex = this.courseController.stateManager.getCurrentPage();
      console.log(`Couldn't find page with ID ${pageId}, using current page: ${pageIndex}`);
    } else {
      console.log(`Found page with ID ${pageId} at index: ${pageIndex}`);
    }
    return pageIndex;
  }

  /**
   * Navega a una sección específica desde el TOC.
   * @param {number} pageIndex - Índice de la página.
   * @param {string} sectionId - ID de la sección.
   */
  navigateToSection(pageIndex, sectionId, forceAudio = false) {
    console.log(`TOC: Navegando a página ${pageIndex}, sección ${sectionId}`);

    // Si la navegación es a la página actual
    if (this.courseController.stateManager.getCurrentPage() === pageIndex) {
      this.courseController.sectionController.navigateToSection(sectionId, forceAudio, true);
    } else {
      // Si es a otra página, guarda la sección pendiente
      this.courseController.sectionController.sectionStateManager.setPendingSectionId(sectionId);
      this.courseController.sectionController.sectionStateManager.setIsNavigatingToSectionFromTOC(true);

      // Ocultar el TOC antes de navegar
      this.hideTOC();

      // Navegar a la página usando el navigationManager
      AnimationUtils.executeAfterFrames(() => {
        const success = this.courseController.navigationManager.navigateTo(pageIndex);
        if (!success) {
          console.error(`TOC: No se pudo navegar a la página ${pageIndex}`);
          // Limpiar estados si falla
          this.courseController.sectionController.sectionStateManager.setPendingSectionId(null);
          this.courseController.sectionController.sectionStateManager.setIsNavigatingToSectionFromTOC(false);
        }
      }, 1);
    }
  }

  /**
   * Intenta hacer scroll a la sección por id, con reintentos.
   * @param {string} sectionId
   * @param {Function} callback
   */
  _scrollToSectionById(sectionId, callback) {
    let attempts = 0;
    const tryScroll = () => {
      const sectionElement = this._findSectionElement(sectionId);
      if (sectionElement) {
        sectionElement.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(callback, SCROLL_TIMEOUT);
      } else if (attempts < MAX_SCROLL_ATTEMPTS) {
        attempts++;
        setTimeout(tryScroll, SCROLL_ATTEMPT_DELAY);
      } else {
        // Si no se encuentra, reactiva observers y limpia flags
        this.courseController.sectionController.resumeObservers();
        const sectionStateManager = this.courseController.sectionController.sectionStateManager;
        sectionStateManager.setIsNavigatingToSectionFromTOC(false);
        sectionStateManager.setIsForcedNavigation(false);
        this._clearPendingSectionNavigation();
        console.warn(`[TOC] No se encontró la sección '${sectionId}' tras ${MAX_SCROLL_ATTEMPTS} intentos.`);
      }
    };
    tryScroll();
  }

  /**
   * Obtiene el elemento DOM de la sección por su id normalizado.
   * @param {string} sectionId - ID de la sección.
   * @param {string} pageId - ID de la página.
   * @returns {HTMLElement|null}
   */
  _getSectionElementById(sectionId, pageId) {
    if (!sectionId || !pageId) return null;
    const normalized = SectionIdUtils.normalizeId(sectionId, pageId);
    const pageContainer = document.querySelector(".page-container.active, .slide-container.active, #slide-container, #main-content, .lesson-container");
    if (!pageContainer) {
      console.warn(`[TOC] Contenedor de página no encontrado para la búsqueda de la sección ${normalized}`);
      return null;
    }
    const selector = `[data-section-id="${normalized}"]`;
    const element = pageContainer.querySelector(selector);
    console.log(`[TOC] _getSectionElementById buscando selector: ${selector} en ${pageContainer.className} - Resultado:`, element);
    return element;
  }

  /**
   * Normaliza un ID de sección.
   * @param {string} sectionId - ID de la sección.
   * @param {string|number} pageIdOrIndex - ID o índice de la página.
   * @returns {string}
   */
  _normalizeSectionId(sectionId, pageIdOrIndex) {
    let pageId = pageIdOrIndex;
    if (typeof pageIdOrIndex === "number") {
      pageId = this.model.pages[pageIdOrIndex]?.id;
      if (!pageId) {
        const currentPageIndex = this.courseController.stateManager.getCurrentPage();
        pageId = this.courseController.stateManager.pages[currentPageIndex]?.id || "unknown";
      }
    }
    return SectionIdUtils.normalizeId(sectionId, pageId);
  }

  /**
   * Recupera la navegación pendiente desde sessionStorage o el estado interno.
   * @returns {{pageIndex:number, sectionId:string}|null}
   */
  _retrievePendingSectionNavigation() {
    if (this.pendingSectionNavigation) {
      return this.pendingSectionNavigation;
    }
    let raw = sessionStorage.getItem("psn");
    if (!raw && this.courseController.isInLMS) {
      raw = this.courseController.scormManager.getCustomData("psn");
    }
    if (!raw) return null;
    try {
      const obj = JSON.parse(raw);
      if (typeof obj === "object" && typeof obj.pageIndex === "number" && typeof obj.sectionId === "string") {
        return obj;
      }
    } catch (e) {}
    return null;
  }

  /**
   * Limpia la navegación pendiente de sección.
   */
  _clearPendingSectionNavigation() {
    this.pendingSectionNavigation = null;
    sessionStorage.removeItem("psn");
    if (this.courseController.isInLMS) {
      this.courseController.scormManager.setCustomData("psn", "");
    }
  }

  /**
   * Navega a una página desde el TOC.
   * @param {number} pageIndex - Índice de la página.
   */
  navigateToPage(pageIndex) {
    if (!this.initialized) return;
    console.log("TOC - Navigate to page:", pageIndex);
    const page = this.model.pages.find((p) => p.index === pageIndex);
    if (page && page.completed) {
      this.hideTOC();
      this._executeAfterRender(() => {
        this.courseController.loadPage(pageIndex);
      });
    }
  }

  /**
   * Ejecuta una función después del renderizado.
   * @param {Function} callback - Función a ejecutar.
   * @private
   */
  _executeAfterRender(callback) {
    AnimationUtils.executeAfterFrames(callback, 2);
  }

  /**
   * Actualiza la visualización del TOC.
   */
  updateTOC() {
    if (!this.initialized) return;
    const currentPageIndex = this.courseController.stateManager.getCurrentPage();
    this.model.setCurrentPage(currentPageIndex);
    this._updateTOCData(currentPageIndex);
    this._afterRender(() => {
      this.view.render(this.model.pages, this.model.sections, modules);
    });
  }

  /**
   * Ejecuta una función después del siguiente ciclo de renderizado.
   * @param {Function} callback - Función a ejecutar.
   * @private
   */
  _afterRender(callback) {
    requestAnimationFrame(() => {
      requestAnimationFrame(callback);
    });
  }

  /**
   * Actualiza los datos del TOC para reflejar el estado actual.
   * @param {number} currentPageIndex - Índice de la página actual.
   * @private
   */
  _updateTOCData(currentPageIndex) {
    if (this._pageHasSections(currentPageIndex)) {
      const pageId = this.courseController.stateManager.pages[currentPageIndex]?.id;
      if (pageId) {
        const sections = this._extractSectionsFromPage(pageId, 0);
        if (sections.length > 0) {
          this.model.setSections(currentPageIndex, sections);
        }
      }
    }
    this.courseController.stateManager.pages.forEach((page, index) => {
      const isCompleted = page.completed === true || index <= this.courseController.stateManager.getFurthestPage();
      if (isCompleted) {
        this.model.updatePageStatus(index, true);
      }
    });
    this.model.setCurrentPage(currentPageIndex);
  }

  /**
   * Verifica si una página tiene secciones.
   * @param {number} pageIndex - Índice de la página.
   * @returns {boolean}
   * @private
   */
  _pageHasSections(pageIndex) {
    const page = this.courseController.stateManager.pages[pageIndex];
    if (!page) return false;
    if (page.sections === true) {
      if (this.courseController.stateManager.getCurrentPage() === pageIndex) {
        return document.querySelectorAll(".slide-section").length > 0;
      }
      return true;
    }
    return false;
  }

  /**
   * Muestra/oculta el TOC
   */
  toggleTOC() {
    if (!this.initialized) {
      console.warn("TableOfContentsController: No inicializado al intentar toggleTOC");
      return;
    }
    if (this.view.isVisible()) {
      this.hideTOC();
    } else {
      this.updateTOC();
      this.view.show();
    }
  }
  /**
   * Oculta el TOC
   */
  hideTOC() {
    if (!this.initialized) return;

    this.view.hide();
  }
  /**
   * Intenta completar la navegación pendiente a una sección desde el TOC.
   */
  _checkPendingNavigation() {
    const pending = this._retrievePendingSectionNavigation();
    if (!pending) return;

    const { pageIndex, sectionId } = pending;
    const currentPageIndex = this.courseController.stateManager.getCurrentPage();

    if (pageIndex !== currentPageIndex) return;

    const pageId = this.courseController.stateManager.pages[pageIndex]?.id;
    const sectionElement = this._getSectionElementById(sectionId, pageId);

    if (sectionElement) {
      this._prepareTOCNavigation();
      sectionElement.scrollIntoView({ behavior: "smooth", block: "center" });

      setTimeout(() => {
        this._resetTOCNavigationFlags();
        this.courseController.sectionController.sectionStateManager.setCurrentSection(sectionElement.id, pageId);
        this.courseController.sectionController.navigateToSection(sectionElement, true, true);
        this._clearPendingSectionNavigation();
      }, 700);
    } else {
      setTimeout(() => this._checkPendingNavigation(), 200);
    }
  }
  /**
   * Busca el elemento de la sección en el DOM según el id y página actual.
   * @param {string} sectionId - ID lógico de la sección
   * @returns {HTMLElement|null}
   */
  _findSectionElement(sectionId) {
    const currentPageIndex = this.courseController.stateManager.getCurrentPage();
    const currentPageId = this.courseController.stateManager.pages[currentPageIndex]?.id;
    const normalizedSectionId = SectionIdUtils.normalizeId(sectionId, currentPageId);
    const selector = `[data-section-id="${normalizedSectionId}"]`;
    return document.querySelector(selector);
  }

  /**
   * Prepara flags de navegación del SectionController para navegación desde TOC.
   */
  _prepareTOCNavigation() {
    if (this.courseController.sectionController) {
      this.courseController.sectionController.isNavigatingToSectionFromTOC = true;
      this.courseController.sectionController.ignoreSectionObservers = true;
    }
  }

  /**
   * Restaura flags tras navegación TOC fallida o exitosa.
   */
  _resetTOCNavigationFlags() {
    if (this.courseController.sectionController) {
      this.courseController.sectionController.isNavigatingToSectionFromTOC = false;
      this.courseController.sectionController.ignoreSectionObservers = false;
    }
  }

  /**
   * Realiza el scroll y callbacks, limpia flags cuando termina.
   * @param {HTMLElement} sectionElement - Elemento de la sección
   * @param {string} sectionId - ID de la sección navegada
   */
  _scrollToSection(sectionElement, sectionId) {
    const rect = sectionElement.getBoundingClientRect();
    const isInView = rect.top >= 0 && rect.bottom <= window.innerHeight;

    if (!isInView) {
      sectionElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    // Espacio para que el observer reaccione correctamente
    setTimeout(
      () => {
        requestAnimationFrame(() => {
          this._resetTOCNavigationFlags();

          // Navegación debe ejecutarse SIEMPRE, ya que el observer puede no detectar scroll si ya estaba visible
          if (this.courseController.sectionController) {
            this.courseController.sectionController.navigateToSection(sectionElement, true, true);
          }

          this._clearPendingSectionNavigation();
          console.log(`[TOC] Navegación a sección completada: ${sectionId}`);
        });
      },
      isInView ? 300 : 800
    ); // menos espera si ya está visible
  }
}
