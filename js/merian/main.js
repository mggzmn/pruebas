import { SlideRenderer } from "./renderers/slideRenderer.js";
import { AudioController } from "./controllers/audioController.js";
import { NavigationManager } from "./managers/navigationManager.js";
import { SCORMManager } from "./managers/scormManager.js";
import { SlideAudioManager } from "./managers/slideAudioManager.js";
import { StateManager } from "./managers/stateManager.js";
import { TableOfContentsController } from "./controllers/tableOfContents.js";
import { SectionController } from "./controllers/sectionController.js";
import { TableOfContentsModel } from "./models/tableOfContents.js";
import { TableOfContentsView } from "./views/tableOfContentsview.js";
import { ModalManager } from "./managers/ModalManager.js";
import { AnimationUtils } from "./utils/animationUtils.js";
import { pages, hasExam, scormVersion, modules } from "../courseSettings.js";
let instance = null;
const lastViewedPage = scormVersion === "2004" ? "cmi.location" : "cmi.core.lesson_location";

export class CourseController {
  /**
   * Constructor del controlador principal del curso.
   * Implementa el patrón Singleton para garantizar una única instancia.
   */
  constructor() {
    if (instance) return instance;
    this._initializeComponents();
    instance = this;
    return instance;
  }

  /**
   * Inicializa todos los componentes necesarios para el funcionamiento del curso.
   * Establece el orden correcto de inicialización respetando las dependencias.
   * @private
   */
  _initializeComponents() {
    // Inicializar primero los componentes base
    this.slideRenderer = new SlideRenderer();
    this.stateManager = new StateManager(this, pages);
    this.scormManager = new SCORMManager(scormVersion, lastViewedPage);
    this.audioController = new AudioController();
    this.slideAudioManager = new SlideAudioManager(this, this.audioController);
    this.tocModel = new TableOfContentsModel();
    this.tocView = new TableOfContentsView();

    // Esperar a tener los componentes base antes de inicializar los dependientes
    this.sectionController = new SectionController(this);

    // Modalmanager debe inicializarse antes que navigationManager
    this.modalManager = new ModalManager(this);

    // NavigationManager debe ser el último en inicializarse
    this.navigationManager = new NavigationManager(this);
    this.tableOfContentsController = new TableOfContentsController(this);

    // Inyectar navigationView después de que navigationManager está inicializado
    if (this.navigationManager.view) {
      this.audioController.setNavigationView(this.navigationManager.view);
    }

    this.hasExam = hasExam;
    this.isInLMS = false;
    this.moduleData = modules;
  }

  /**
   * Obtiene la instancia única del controlador del curso.
   * Implementa el patrón Singleton para asegurar una sola instancia en toda la aplicación.
   * @returns {CourseController} - La instancia única del controlador
   */
  static getInstance() {
    if (!instance) {
      instance = new CourseController();
    }
    return instance;
  }

  /**
   * Inicializa el controlador del curso y todos sus componentes.
   * Configura la conexión con el LMS y prepara la navegación inicial.
   */
  init() {
    this.isInLMS = this.scormManager.initialize();

    // Asegurar que los componentes críticos se inicialicen primero
    this.audioController.setupGlobalEvents();

    // Luego inicializar el navigationManager y otros componentes
    this.navigationManager.initialize();
    this.tableOfContentsController.initialize(this.tocModel, this.tocView);

    this._setupEventListeners();
    this._restorePreviousState();

    // Navegar a la primera página DESPUÉS de inicializar todo
    AnimationUtils.executeAfterFrames(() => {
      this.navigationManager.navigateTo(0);
    }, 1);
  }

  /**
   * Configura los event listeners necesarios para la aplicación.
   * @private
   */
  _setupEventListeners() {
    this.navigationManager.addNavigationListener(this.onPageChanged.bind(this));
    this._setupCompletionListeners();
  }

  /**
   * Configura los listeners para eventos de completación de páginas.
   * Estos listeners actualizan el estado de la tabla de contenidos.
   * @private
   */
  _setupCompletionListeners() {
    this.stateManager.addPageCompletionListener((pageIndex, completed) => {
      if (completed === false) {
        this.tableOfContentsController.markPageIncompleteWithSections(pageIndex);
      } else {
        this.tableOfContentsController.handlePageCompleted(pageIndex);
      }
    });
  }

  /**
   * Restaura el estado previo del curso desde el LMS si existe.
   * @private
   */
  _restorePreviousState() {
    if (this.isInLMS) {
      const savedPage = this.scormManager.getLastViewedPage();
      if (savedPage > 0) {
        this.stateManager.restoreSavedProgress(savedPage);
      }
    }
  }

  /**
   * Maneja el evento de cambio de página.
   * Actualiza el contenido y la UI cuando el usuario navega a una nueva página.
   * @param {number} pageIndex - Índice de la página a la que se ha navegado
   */
  onPageChanged(pageIndex) {
    this._handlePageContent(pageIndex);
    this._updateUIForPageChange();
    this.updateScormProgress(pageIndex);
  }

  /**
   * Maneja el contenido de la página actual, incluyendo audio y secciones.
   * @param {number} pageIndex - Índice de la página a la que se ha navegado
   * @private
   */
  _handlePageContent(pageIndex) {
    const currentSlide = this.stateManager.pages[pageIndex];
    this._handlePageAudio(currentSlide);
    this._handlePageSections(currentSlide);
  }

  /**
   * Gestiona la reproducción de audio para la diapositiva actual.
   * @param {Object} currentSlide - Objeto con la información de la diapositiva actual
   * @private
   */
  _handlePageAudio(currentSlide) {
    if (!currentSlide?.audio) {
      this.audioController.cleanAudioSource();
    }
  }

  /**
   * Maneja las secciones de una página, inicializándolas o limpiándolas según corresponda.
   * @param {Object} currentSlide - Objeto con la información de la diapositiva actual
   * @private
   */
  _handlePageSections(currentSlide) {
    if (!currentSlide?.sections && !this.stateManager.isLastPage()) {
      this._cleanupSections();
    } else {
      this._initializeSections();
    }
  }

  /**
   * Limpia las secciones de la página anterior cuando se navega a una nueva página.
   * Solo borra el progreso si la página estaba completada.
   * @private
   */
  _cleanupSections() {
    const currentIndex = this.stateManager.getCurrentPage();
    const currentPage = this.stateManager.pages[currentIndex];
    if (!currentPage) return;

    // Solo borrar el progreso si la página está marcada como completada
    if (!currentPage.completed) {
      console.log(`Skipping clearSavedSectionProgress for unvisited page ${currentPage.id}`);
      return;
    }

    this.sectionController.progressManager.clearSavedSectionProgress(currentPage.id);
    this.sectionController.pendingSectionId = null;
  }

  /**
   * Inicializa las secciones de la página actual
   * @private
   */
  _initializeSections() {
    // Usar una sola llamada a AnimationUtils con menos frames de espera
    AnimationUtils.executeAfterFrames(() => {
      if (document.querySelectorAll(".slide-section").length > 0) {
        this.sectionController.initialize();
        // Verificar navegación pendiente inmediatamente, sin esperas adicionales
        this.tableOfContentsController._checkPendingNavigation();
      }
    }, 2);
  }

  /**
   * Actualiza los elementos de UI después de un cambio de página.
   * Sincroniza la tabla de contenidos con el estado actual del curso.
   * @private
   */
  _updateUIForPageChange() {
    this.tableOfContentsController.synchronizeTOCWithCompletedPages();
    this.tableOfContentsController.updateTOC();
    this.tableOfContentsController.hideTOC();
    this.tableOfContentsController.attachTOCButtonListener();
  }

  /**
   * Marca la página actual como completada y, si es la última y no hay examen, finaliza el curso en el LMS.
   * Si se llama de forma anticipada, asegura visibilidad de todas las secciones, ejecución de la última y muestra del botón de avance.
   * @param {boolean} forced - Indica si la llamada es anticipada (forzada).
   * @param {number} [delay=0] - Milisegundos a esperar antes de ejecutar el scroll y acción final (solo aplica si forced=true).
   */
  markCurrentPageAsCompleted(forced = false, delay = 0) {
    const currentPageIndex = this.stateManager.getCurrentPage();
    const currentPageData = this.stateManager.pages[currentPageIndex];
    if (!currentPageData || currentPageData.completed) return;

    const pageId = currentPageData.id;
    const hasSections = currentPageData.sections === true;
    const sections = hasSections ? this.sectionController.sections : [];

    if (hasSections) {
      for (const section of sections) {
        this.sectionController.sectionStateManager.markSectionCompleted(section.id, pageId);
        this.sectionController.visibilityManager.markSectionAsCompletedVisually(section);
      }
    }

    this.stateManager.markPageAsCompleted(currentPageIndex);
    this.sectionController.progressManager.saveSectionProgress(pageId);

    const isLastPage = this.stateManager.isLastPage();
    const hasExam = this.hasExam;
    if (isLastPage && !hasExam) {
      this.scormManager.markCourseAsCompleted();
      this.scormManager.markCoursePassed();
    }

    const prevEnabled = currentPageIndex > 1;
    const nextEnabled = !isLastPage;
    const tocEnabled = currentPageIndex > 0;
    this.navigationManager.view.updateButtonState(prevEnabled, nextEnabled, tocEnabled);

    if (forced && hasSections && sections.length > 0) {
      const lastSection = sections[sections.length - 1];

      if (typeof this.sectionController.pauseObservers === "function") {
        this.sectionController.pauseObservers();
      }

      if (typeof this.sectionController.sectionStateManager.setIsForcedNavigation === "function") {
        this.sectionController.sectionStateManager.setIsForcedNavigation(true);
      }

      setTimeout(() => {
        const sectionEl = document.getElementById(lastSection.id);

        if (sectionEl) {
          sectionEl.scrollIntoView({ behavior: "smooth", block: "start" });

          AnimationUtils.executeAfterFrames(() => {
            this.sectionController.visibilityManager.markSectionAsCompletedVisually(sectionEl);
            this.sectionController.executeFunction(sectionEl, false);
            this.sectionController.sectionStateManager.setCurrentSection(sectionEl.id, pageId);
            this.sectionController.syncCurrentSectionIndex(sectionEl.id);

            if (typeof this.sectionController.resumeObservers === "function") {
              this.sectionController.resumeObservers();
            }
          }, 2);
        }
      }, delay);
    }
  }

  /**
   * Actualiza el progreso en el LMS para la página especificada.
   * @param {number} pageIndex - Índice de la página para la que se actualiza el progreso
   */
  updateScormProgress(pageIndex) {
    this.stateManager.updateProgress(pageIndex);
  }

  /**
   * Carga una página específica del curso.
   * Cierra cualquier modal activo antes de la navegación.
   * @param {number} pageIndex - Índice de la página a cargar
   * @returns {boolean} - Si la navegación fue exitosa
   */
  loadPage(pageIndex) {
    // Cierra cualquier modal activo al cambiar de página
    if (this.modalManager) {
      this.modalManager.closeActiveModal();
    }
    return this.navigationManager.navigateTo(pageIndex);
  }

  /**
   * Navega a la siguiente página del curso.
   * @returns {boolean} - Si la navegación fue exitosa
   */
  nextPage() {
    return this.navigationManager.navigateToNext();
  }

  /**
   * Navega a la página anterior del curso.
   * @returns {boolean} - Si la navegación fue exitosa
   */
  previousPage() {
    return this.navigationManager.navigateToPrevious();
  }

  /**
   * Reanuda el progreso desde la última página visitada.
   * @returns {boolean} - Si la operación fue exitosa
   */
  resumeProgress() {
    return this.stateManager.resumeProgress(this);
  }

  /**
   * Reinicia los datos SCORM, con la opción de preservar datos del examen.
   * Solo funciona si el curso está conectado a un LMS.
   */
  resetScormData() {
    if (!this.isInLMS) return;
    const preserveExamData = this.hasExam && this.stateManager.isLastPage();
    this.stateManager.resetCompletedStatus(preserveExamData);
    this.scormManager.resetData();
  }

  /**
   * Verifica si la página currentSlide es la última del curso.
   * @returns {boolean} - Verdadero si es la última página
   */
  isLastSlide() {
    return this.stateManager.isLastPage();
  }

  /**
   * Verifica si el usuario ha visto y completado más de una página.
   * @returns {boolean} - Verdadero si ha completado múltiples páginas
   */
  hasViewedMultiplePages() {
    return this.stateManager.hasCompletedMultiplePages();
  }

  /**
   * Determina si se debe mostrar el botón "Retomar" en la interfaz.
   * @returns {boolean} - Verdadero si se debe mostrar el botón
   */
  shouldShowResumeButton() {
    return this.stateManager.shouldShowResumeButton(this.isInLMS, this.scormManager, this.hasExam);
  }

  /**
   * Obtiene el índice de la última página visitada según el LMS.
   * @returns {number} - Índice de la última página visitada
   */
  getLastViewedPage() {
    return this.scormManager.getLastViewedPage();
  }

  /**
   * Establece el estado de aprobación del curso en el LMS.
   * @param {boolean} isPassed - Si el curso está aprobado o no
   * @param {number|null} score - Puntuación obtenida (opcional)
   */
  setCoursePassed(isPassed, score = null) {
    if (!this.isInLMS) return;
    this.scormManager.setLessonStatus(isPassed ? "passed" : "failed", score);
  }

  /**
   * Marca el curso como completado en el LMS.
   * Establece el estado como "passed" y marca la página actual como completada.
   * @param {number} score - Puntuación final del curso (por defecto 100)
   */
  completeCourse(score = 100) {
    if (!this.isInLMS) return;
    this.scormManager.setLessonStatus("completed", score);
    this.setCoursePassed(true, score);
    const currentIndex = this.stateManager.getCurrentPage();
    this.stateManager.markPageAsCompleted(currentIndex);
  }
}
