import { AnimationUtils } from "../utils/animationUtils.js";
import { SCORMManager } from "./scormManager.js";

export class StateManager {
  constructor(courseController, pages) {
    this.pages = pages;
    this.courseController = courseController;
    this.currentPageIndex = 0;
    this.furthestPageReached = 0;
    this.pageCompletionListeners = [];
  }
  /**
   * Retorna los datos de una página por su ID.
   * @param {string} pageId - El ID de la página a buscar.
   * @returns {object|null} - Datos de la página o null si no existe.
   */
  getPageData(pageId) {
    if (!pageId) return null;
    return this.pages.find((page) => page.id === pageId) || null;
  }

  setCurrentPage(pageIndex) {
    this.currentPageIndex = pageIndex;
    if (pageIndex > this.furthestPageReached) {
      this.furthestPageReached = pageIndex;
    }
  }
  addPageCompletionListener(callback) {
    this.pageCompletionListeners.push(callback);
  }

  addPageIncompletionListener(callback) {
    this.pageCompletionListeners.push(callback);
  }
  getFurthestPage() {
    return this.furthestPageReached;
  }

  isLastPage() {
    return this.currentPageIndex === this.pages.length - 1;
  }

  hasCompletedMultiplePages() {
    return this.pages.filter((page) => page.completed).length > 1;
  }

  canNavigateToNext(currentIndex) {
    return currentIndex < this.pages.length - 1 && this.pages[currentIndex].completed;
  }

  canNavigateToPrevious(currentIndex) {
    return currentIndex > 1;
  }

  getCurrentPage() {
    return this.currentPageIndex;
  }

  markPageAsCompleted(pageIndex) {
    const page = this.pages[pageIndex];
    if (!page) return;

    page.completed = true;

    this.pageCompletionListeners.forEach((listener) => {
      listener(pageIndex);
    });

    if (page.sections === true) {
      const sections = this.courseController.sectionController.sections || [];

      if (sections.length > 0) {
        const allVisited = this.courseController.sectionController.progressManager.allSectionsCompleted(sections, page.id);

        if (!allVisited) {
          sections.forEach((section) => {
            this.courseController.sectionController.markSectionAsCompleted(section.id, page.id);
          });
        }
      } else if (pageIndex !== 0) {
        this.courseController.sectionController.progressManager.clearSavedSectionProgress(page.id);
      }
    } else if (page.sections !== false && pageIndex !== 0) {
      // Caso excepcional si viene algo inesperado en page.sections
      console.warn(`StateManager: page.sections no es true/false esperados en index ${pageIndex}`, page.sections);
    }
  }

  markPageAsIncomplete(pageIndex) {
    if (this.pages[pageIndex]) {
      this.pages[pageIndex].completed = false;
      // Notificar al TOC y otros componentes
      this.pageCompletionListeners.forEach((listener) => {
        if (typeof listener === "function") {
          if (listener.length > 1) {
            listener(pageIndex, false); // pageIndex, completed=false
          } else {
            listener(pageIndex);
          }
        }
      });
    }
  }

  resetCompletedStatus(preserveExam = false) {
    this.pages.forEach((page, index) => {
      if (!preserveExam || index !== this.pages.length - 1) {
        page.completed = false;
      }
    });
  }

  resumeProgress(courseController) {
    const lastViewedPageIndex = courseController.scormManager.getLastViewedPage();
    const isLastPage = this.isLastPage();
    const isCourseCompleted = courseController.scormManager.isCourseIncompleteOrNotPassed() === false;

    courseController.tocModel.initializeFromPages(this.pages, courseController.moduleData);

    if (lastViewedPageIndex > 0) {
      this._markPreviousPagesAsCompleted(lastViewedPageIndex, courseController);

      if (!isLastPage && !isCourseCompleted) {
        this.markPageAsIncomplete(lastViewedPageIndex);
      }

      // Navegación a la página guardada
      const success = courseController.navigationManager.navigateTo(lastViewedPageIndex);

      if (success) {
        courseController.navigationManager.updateNavigationState();

        // Clave: Verificar si hay secciones parcialmente completadas en esta página
        const currentPage = this.pages[lastViewedPageIndex];
        if (currentPage?.sections) {
          // Usar AnimationUtils en lugar de setTimeout anidados
          AnimationUtils.executeAfterFrames(() => {
            this._restoreSectionProgressAndNavigate(courseController, currentPage.id);
          }, 2);
        }
      }

      // Actualizar TOC y vista
      courseController.tableOfContentsController.synchronizeTOCWithCompletedPages();
      courseController.tableOfContentsController.updateTOC();
      courseController.tableOfContentsController.attachTOCButtonListener();

      return true;
    }
    return false;
  }

  _markPreviousPagesAsCompleted(lastViewedPageIndex, courseController) {
    for (let i = 1; i < lastViewedPageIndex; i++) {
      const page = this.pages[i];
      if (page) {
        page.completed = true;
        this.markPageAsCompleted(i);
        const sections = courseController.tocModel.getSections(i) || [];
        sections.forEach((section) => {
          courseController.sectionController.markSectionAsCompleted(section.id, page.id);
          courseController.tocModel.updateSectionStatus(i, section.id, true);
        });
      }
    }
  }

  _updateUIAfterResume(courseController, pageIndex) {
    courseController.tableOfContentsController.synchronizeTOCWithCompletedPages();
    courseController.tableOfContentsController.updateTOC();
    courseController.tableOfContentsController.attachTOCButtonListener();
    if (courseController.navigationManager.navigateTo(pageIndex)) {
      courseController.navigationManager.updateNavigationState();
    }
  }

  /**
   * método para restaurar progreso de secciones y navegar adecuadamente
   * @param {object} courseController - Controlador del curso
   * @param {string} pageId - ID de la página actual
   */
  _restoreSectionProgressAndNavigate(courseController, pageId) {
    if (document.querySelectorAll(".slide-section").length === 0) return;

    // IMPORTANTE: Asegurar que primero se restaure el progreso guardado
    courseController.sectionController.initialize();
    const sections = courseController.sectionController.sections;
    if (!sections.length) return;

    console.log(`Restoring section progress for page ${pageId}, found ${sections.length} sections`);

    // Verificar si esta es la página más avanzada o una ya visitada
    const currentPageIndex = this.getCurrentPage();
    const furthestPageReached = this.getFurthestPage();
    const isCurrentPageFurthest = currentPageIndex === furthestPageReached;

    // Restaurar explícitamente el progreso guardado desde SP
    courseController.sectionController.progressManager.restoreSavedSectionProgress(pageId);

    // MODIFICACIÓN: Aplicar eventos visuales a todas las secciones completadas
    // independientemente de si es la página más avanzada o no
    console.log("Restaurando visualmente secciones completadas");
    sections.forEach((section) => {
      if (courseController.sectionController.progressManager.isSectionCompleted(section.id, pageId)) {
        courseController.sectionController.visibilityManager.markSectionAsCompletedVisually(section);
        // CRÍTICO: Aplicar siempre los eventos visuales sin audio
        courseController.sectionController.applyAllSectionEvents(section);
      }
    });

    // Obtener la sección guardada (usando función unificada)
    const savedSectionId = this._getSavedSectionId(courseController, pageId, sections, isCurrentPageFurthest);

    if (savedSectionId) {
      console.log(`Resuming at section: ${savedSectionId}`);
      // Navegar inmediatamente sin delays adicionales
      AnimationUtils.executeAfterFrames(() => {
        courseController.sectionController.navigateToSection(savedSectionId);
      }, 1);
    } else if (sections.length > 0) {
      // Si no hay sección guardada pero hay secciones, determinar la siguiente a mostrar
      const nextIncompleteSection = this._findFirstIncompleteSection(courseController, sections, pageId);
      if (nextIncompleteSection) {
        console.log(`No saved section, navigating to next incomplete: ${nextIncompleteSection}`);
        AnimationUtils.executeAfterFrames(() => {
          courseController.sectionController.navigateToSection(nextIncompleteSection);
        }, 1);
      }
    }
  }

  /**
   * Obtiene el ID de la sección guardada según varias fuentes
   * @param {object} courseController - Controlador del curso
   * @param {string} pageId - ID de la página actual
   * @param {Array} sections - Elementos de sección disponibles
   * @param {boolean} isCurrentPageFurthest - Si es la página más avanzada
   * @returns {string|null} - ID de la sección guardada o null
   * @private
   */
  _getSavedSectionId(courseController, pageId, sections, isCurrentPageFurthest) {
    let savedSectionId = null;

    // Si es la página más avanzada, intentar recuperar de sp
    if (isCurrentPageFurthest) {
      savedSectionId = this._getSectionFromProgress(courseController, pageId, sections);

      // Si no se encontró en sp, intentar con psn (pendiente)
      if (!savedSectionId) {
        savedSectionId = courseController.scormManager.getCustomData("psn") || sessionStorage.getItem("psn");

        // Limpiar psn después de usarlo
        if (savedSectionId) {
          courseController.scormManager.setCustomData("psn", "");
          sessionStorage.removeItem("psn");
        }
      }
    } else {
      // Si es una página ya visitada, intentar con psn primero
      savedSectionId = courseController.scormManager.getCustomData("psn") || sessionStorage.getItem("psn");

      // Limpiar psn después de usarlo
      if (savedSectionId) {
        courseController.scormManager.setCustomData("psn", "");
        sessionStorage.removeItem("psn");
      }
    }

    // Si no hay sección guardada, buscar la primera no completada
    if (!savedSectionId) {
      savedSectionId = this._findFirstIncompleteSection(courseController, sections, pageId);
    }

    // Si seguimos sin sección, usar la última
    if (!savedSectionId && sections.length > 0) {
      savedSectionId = sections[sections.length - 1].id;
    }

    return savedSectionId;
  }

  /**
   * Obtiene la sección desde el progreso guardado
   * @param {object} courseController - Controlador del curso
   * @param {string} pageId - ID de la página
   * @param {Array} sections - Secciones disponibles
   * @returns {string|null} - ID de la sección o null
   * @private
   */
  _getSectionFromProgress(courseController, pageId, sections) {
    try {
      const savedData = courseController.scormManager.getCustomData("sp") || sessionStorage.getItem("sp");
      if (savedData) {
        const progressData = JSON.parse(savedData);
        // Encontrar la siguiente sección no completada
        if (progressData[pageId] && progressData[pageId].length > 0) {
          const completedIds = new Set(progressData[pageId]);
          // Buscar la primera sección que no esté en completedIds
          for (let i = 0; i < sections.length; i++) {
            const cleanId = sections[i].id.split("_").pop();
            if (!completedIds.has(cleanId)) {
              return sections[i].id;
            }
          }
        }
      }
    } catch (error) {
      console.error("Error restoring from sp:", error);
    }
    return null;
  }

  /**
   * Encuentra la primera sección no completada
   * @param {object} courseController - Controlador del curso
   * @param {Array} sections - Secciones disponibles
   * @param {string} pageId - ID de la página
   * @returns {string|null} - ID de la primera sección no completada o null
   * @private
   */
  _findFirstIncompleteSection(courseController, sections, pageId) {
    for (let i = 0; i < sections.length; i++) {
      if (!courseController.sectionController.isSectionCompleted(sections[i].id, pageId)) {
        return sections[i].id;
      }
    }
    return null;
  }

  /**
   * Restaura el progreso guardado a partir del índice de página
   * @param {number} savedPageIndex - Índice de la última página vista
   */
  restoreSavedProgress(savedPageIndex) {
    if (savedPageIndex <= 0) return;
    this.furthestPageReached = savedPageIndex;
    // Marcar páginas anteriores como visitadas
    for (let i = 1; i < savedPageIndex; i++) {
      if (this.pages[i]) {
        this.pages[i].completed = true;
      }
    }
  }

  /**
   * Determina si se debe mostrar el botón "Retomar"
   * @param {boolean} isInLMS - Si el curso está en un LMS
   * @param {SCORMManager} scormManager - Referencia al gestor SCORM
   * @param {boolean} hasExam - Si el curso tiene examen
   * @returns {boolean} - Si se debe mostrar el botón "Retomar"
   */
  shouldShowResumeButton(isInLMS, scormManager, hasExam) {
    if (!isInLMS) return false;

    const savedPage = scormManager.getLastViewedPage();

    // Si no hay página guardada, no mostrar "Retomar"
    if (savedPage <= 0) return false;

    // Caso 1: Si ya visitó más de la primera página
    if (savedPage > 1) return true;

    // Caso 2: Si tiene examen y está en la última página
    const isLastPage = savedPage === this.pages.length - 1;
    if (hasExam && isLastPage) return true;

    // Caso 3: Si está en la página 1 y tiene secciones, verificar progreso
    if (savedPage === 1) {
      const currentPageId = this.pages[savedPage]?.id;
      if (!currentPageId) return false;

      // Verificar si hay progreso parcial guardado
      const hasSectionsProgress = this._hasSectionProgress(currentPageId, scormManager);
      return hasSectionsProgress;
    }

    return false;
  }

  // Método auxiliar para verificar progreso de secciones
  _hasSectionProgress(pageId, scormManager) {
    // Verificar progreso en formato optimizado
    try {
      const savedSpData = scormManager.getCustomData("sp");
      if (savedSpData) {
        const progressData = JSON.parse(savedSpData);
        if (progressData[pageId] && progressData[pageId].length > 0) {
          // Verificar si hay secciones sin completar (progreso parcial)
          const sectionsInPage = document.querySelectorAll(".slide-section").length;
          const completedSections = progressData[pageId].length;

          return completedSections > 0 && completedSections < sectionsInPage;
        }
      }
    } catch (error) {
      console.error("Error checking section progress:", error);
    }

    return false;
  }

  shouldEnableTOC(currentIndex) {
    if (currentIndex === 0) return false;
    const currentPageData = this.pages[currentIndex];
    if (this.courseController.scormManager && !this.courseController.scormManager.isCourseIncompleteOrNotPassed() && currentPageData.isFurthestPage) {
      return false;
    }
    return true;
  }

  updateProgress(pageIndex) {
    if (!this.courseController.isInLMS || pageIndex <= 0) return;
    if (pageIndex >= this.getFurthestPage()) {
      this.courseController.scormManager.saveCurrentPage(pageIndex);
    }
    const isLastPage = this.isLastPage();
    const lastPageCompleted = this.pages[pageIndex]?.completed;
    if (isLastPage && lastPageCompleted && !this.hasExam) {
      this.courseController.scormManager.setLessonStatus("completed");
      this.setCoursePassed(true, 100);
    } else {
      this.courseController.scormManager.setLessonStatus("incomplete");
    }
  }
}
