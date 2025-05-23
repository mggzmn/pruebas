import { AnimationUtils } from "../utils/animationUtils.js";
import { NavigationView } from "../views/navigationView.js";

export class NavigationManager {
  constructor(courseController) {
    this.controller = courseController;
    this.navigationListeners = [];
    this.view = new NavigationView(); // <-- Instanciar NavigationView
    
    // Verificación de seguridad para la inicialización
    if (!this.controller) {
      console.error("NavigationManager: Se requiere el courseController");
      throw new Error("NavigationManager requiere un courseController válido");
    }
    
    // Vincular métodos para asegurar el contexto correcto de 'this'
    this.navigateTo = this.navigateTo.bind(this);
    this.navigateToNext = this.navigateToNext.bind(this);
    this.navigateToPrevious = this.navigateToPrevious.bind(this);
  }

  initialize() {
    // Inicializar la vista de navegación
    this.view.initialize();
    
    // Añadir listeners de navegación a la vista
    this.view.setNavigationListener('onPrevious', this.navigateToPrevious);
    this.view.setNavigationListener('onNext', this.navigateToNext);
    
    // Añadir listener para el botón TOC
    this.view.setNavigationListener('onToggleTOC', () => {
      if (this.controller && this.controller.tableOfContentsController) {
        console.log("NavigationManager: Botón TOC clickeado - Delegando a TableOfContentsController");
        // Forzar actualización del TOC antes de mostrarlo
        this.controller.tableOfContentsController.updateTOC();
        // Usar AnimationUtils en lugar de setTimeout para mantener consistencia
        AnimationUtils.executeAfterFrames(() => {
          this.controller.tableOfContentsController.toggleTOC();
        }, 1);
      }
    });
    console.log("TOC button listener configured");
        
    // Verificación de seguridad para asegurar que controller y stateManager estén disponibles
    if (!this.controller || !this.controller.stateManager) {
      console.error("NavigationManager: controller o stateManager indefinido en initialize()");
      return;
    }
    
    // Actualizar estado inicial de los botones
    this.updateNavigationState();
  }

  navigateTo(pageIndex) {
    // Validación básica
    if (pageIndex < 0 || !this.controller || !this.controller.stateManager) {
      console.error("NavigationManager: Invalid page index or missing controller/stateManager");
      return false;
    }
    
    if (pageIndex >= this.controller.stateManager.pages.length) {
      console.warn("NavigationManager: Invalid page index:", pageIndex);
      return false;
    }
    
    // Limpieza de audio actual
    if (this.controller.audioController) {
      this.controller.audioController.cleanMediaSources();
    }
    
    // Obtener índices actual y anterior
    const currentPageIndex = this.controller.stateManager.getCurrentPage();
    const previousPageIndex = currentPageIndex;

    // Actualizar estado antes de cargar la página
    this.controller.stateManager.setCurrentPage(pageIndex);
    
    // Cargar página usando el renderer
    const page = this.controller.stateManager.pages[pageIndex];
    this.controller.slideRenderer.loadSlide(page.url)
      .then(() => {
        this.updateNavigationState();
        
        // Notificar a listeners después de la carga
        this._notifyPageChanged(pageIndex, previousPageIndex);
      })
      .catch((error) => {
        console.error("Error loading slide:", error);
      });
    
    return true;
  }

  /**
   * Navega a la página siguiente
   * @returns {boolean} - Si la navegación fue exitosa
   */
  navigateToNext() {
    const currentIndex = this.controller.stateManager.getCurrentPage();
    const nextIndex = currentIndex + 1;
    
    if (nextIndex < this.controller.stateManager.pages.length) {
      // Verificar si la página actual está completada antes de avanzar
      const currentPage = this.controller.stateManager.pages[currentIndex];
      const allSectionsCompleted = this.controller.sectionController?.allSectionsCompleted(currentPage?.id);
      
      if (!currentPage?.completed && !allSectionsCompleted) {
        // La página actual no está completada y las secciones no están completadas
        alert("Completa todas las secciones antes de continuar.");
        return false;
      }
      
      return this.navigateTo(nextIndex);
    } else {
      console.log("Already at the last page");
      return false;
    }
  }

  /**
   * Navega a la página anterior
   * @returns {boolean} - Si la navegación fue exitosa
   */
  navigateToPrevious() {
    const currentIndex = this.controller.stateManager.getCurrentPage();
    
    // Si estamos en la primera página, no hacemos nada
    if (currentIndex <= 0) {
      console.log("Already at the first page");
      return false;
    }

    return this.navigateTo(currentIndex - 1);
  }

  /**
   * Actualiza el estado de los botones de navegación basado en la página current
   */
  updateNavigationState() {
    if (!this.controller || !this.controller.stateManager) {
      console.error("NavigationManager: No se puede actualizar el estado de navegación - controller o stateManager indefinido");
      return;
    }
    
    const currentPage = this.controller.stateManager.getCurrentPage();
    const totalPages = this.controller.stateManager.pages.length;
    const currentPageData = this.controller.stateManager.pages[currentPage];
  
    // Log de debugging
    console.log(`updateNavigationState - Página actual: ${currentPage}, Completada: ${currentPageData?.completed}`);
    
    // Ocultar toda la barra de navegación en la primera página (cover)
    if (currentPage === 0) {
      this.view.setNavigationVisibility(false);
      console.log("NavigationManager: Ocultando barra de navegación en cover page");
    } else {
      this.view.setNavigationVisibility(true);
    }
    
    // Determinar estados de los botones
    const prevEnabled = currentPage > 1; // Enabled from 3rd page onwards
    
    // CAMBIO IMPORTANTE: El botón Next solo debe habilitarse si la página actual está completada
    // y no es la última página
    const nextEnabled = currentPageData?.completed === true && currentPage < totalPages - 1;
    
    const tocEnabled = this.shouldShowTOC();
    
    // Actualizar estados de los botones en la vista
    this.view.updateButtonState(prevEnabled, nextEnabled, tocEnabled);
  }
  /**
   * Notifica a los listeners de navegación sobre un cambio de página
   * @param {number} pageIndex - Índice de la página actual
   * @param {number} previousPageIndex - Índice de la página anterior
   */
  _notifyPageChanged(pageIndex, previousPageIndex) {
    for (const callback of this.navigationListeners) {
      try {
        callback(pageIndex, previousPageIndex);
      } catch (error) {
        console.error("Error en el listener de navegación:", error);
      }
    }
  }

  /**
   * Determina si se debe mostrar el botón TOC
   * @returns {boolean}
   */
  shouldShowTOC() {
    // Implementación básica - mostrar TOC siempre excepto en la primera página
    return this.controller.stateManager.getCurrentPage() > 0;
  }

  // Método para verificar si debería mostrarse el botón de reanudar
  shouldShowResumeButton() {
    if (!this.controller.isInLMS) return false;

    const savedPage = this.controller.scormManager.getLastViewedPage();

    // Si no hay página guardada, no mostrar "Retomar"
    if (savedPage <= 0) return false;

    // Caso 1: Si ya visitó más de la primera página
    if (savedPage > 1) return true;

    // Caso 2: Si tiene examen y está en la última página
    const isLastPage = savedPage === this.controller.stateManager.pages.length - 1;
    if (this.controller.hasExam && isLastPage) return true;

    // Caso 3: Verificar progreso parcial de secciones
    if (savedPage === 1) {
      const currentPage = this.controller.stateManager.pages[savedPage];
      if (!currentPage || !currentPage.sections) return false;

      // Usar la lógica de SectionController para verificar progreso parcial
      if (this.controller.sectionController) {
        return this.controller.sectionController.hasPartialProgress(currentPage.id);
      }

      // Implementación de respaldo con el formato optimizado
      try {
        // Intentar leer desde formato optimizado primero
        const savedData = this.controller.scormManager.getCustomData("sp");
        if (!savedData) return false;
        
        const allProgress = JSON.parse(savedData);
        
        // Verificar si hay secciones completadas para esta página
        return Array.isArray(allProgress?.[currentPage.id]) && allProgress[currentPage.id].length > 0;
      } catch (error) {
        console.error("Error checking section progress:", error);
        return false;
      }
    }

    return false;
  }

  /**
   * Añade un listener para eventos de navegación
   * @param {Function} callback - Función que se llamará cuando cambie la página
   */
  addNavigationListener(callback) {
    if (typeof callback === 'function') {
      this.navigationListeners.push(callback);
    }
  }
}