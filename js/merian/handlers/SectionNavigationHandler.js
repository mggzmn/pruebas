/**
 * Clase encargada de gestionar la navegación entre secciones de una página,
 * asegurando la transición correcta y el registro del estado de la navegación.
 */
export class SectionNavigationHandler {
  /**
   * Constructor del manejador de navegación de secciones.
   * @param {SectionController} sectionController - Instancia del controlador de secciones.
   */
  constructor(sectionController) {
    this.sectionController = sectionController;
    this.sectionStateManager = sectionController.sectionStateManager;
  }

  /**
   * Navega a la sección siguiente, si es posible.
   * @param {number} delay - Milisegundos de retardo antes de navegar.
   * @returns {boolean} - Verdadero si la navegación fue exitosa.
   */
  nextSection(delay = 0) {
    const sections = this.sectionController.sections;
    if (!Array.isArray(sections) || sections.length === 0) {
      console.warn("SectionNavigationHandler: No hay secciones definidas.");
      return false;
    }

    let currentSectionId = this.sectionStateManager.getCurrentSection(this.sectionController.currentPageId);

    // Normaliza el currentSectionId para compararlo exactamente con data-original-id e id
    let currentIndex = sections.findIndex((section) => {
      const sectionIdAttr = section.getAttribute("data-original-id") || section.id;
      return sectionIdAttr === currentSectionId || section.id === currentSectionId;
    });

    if (currentIndex >= 0 && currentIndex < sections.length - 1) {
      const nextSection = sections[currentIndex + 1];
      if (!nextSection) return false;

      // Actualizar el estado ANTES del scroll
      this.sectionStateManager.setCurrentSection(nextSection.id, this.sectionController.currentPageId);

      // Visibilidad de la nueva sección
      this.sectionController.visibilityManager.updateSectionVisibility(sections, currentIndex + 1, false, false);

      // Hacer scroll automático a la nueva sección para disparar el observer
      if (typeof delay === "number" && delay > 0) {
        setTimeout(() => {
          nextSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }, delay);
      } else {
        nextSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return true;
    }
    return false;
  }

  /**
   * Navega a la sección anterior, si existe.
   * @returns {boolean} - Verdadero si la navegación fue exitosa.
   */
  previousSection() {
    const sections = this.sectionController.sections;
    const currentSectionId = this.sectionStateManager.getCurrentSection(this.sectionController.currentPageId);
    const currentIndex = sections.findIndex((section) => section.id === currentSectionId);

    if (currentIndex > 0) {
      const prevSection = sections[currentIndex - 1];
      if (!prevSection) return false;

      this.navigateToSection(prevSection, true);
      return true;
    }
    return false;
  }

  /**
   * Navega a una sección específica del contenido.
   * Cambia la visibilidad, el estado y el scroll, delegando la ejecución de función/audio/video al observer y eventHandler.
   * Solo usa métodos reales de SectionStateManager y respeta la fuente de la verdad.
   * @param {string|Element} sectionIdentifier - ID normalizado o elemento de la sección a mostrar.
   * @param {boolean} forceAudio - Si debe forzar la reproducción de audio/video (el observer decidirá si lo usa).
   * @param {boolean} fromTOC - Si la navegación proviene del TOC.
   * @returns {boolean} - Verdadero si la navegación fue exitosa.
   */
  navigateToSection(sectionIdentifier, forceAudio = false, fromTOC = false) {
    const sectionId = typeof sectionIdentifier === "string" ? sectionIdentifier : sectionIdentifier.id;
    const pageId = this.sectionController.currentPageId;

    if (fromTOC) {
      this.sectionController.sectionStateManager.setIsNavigatingToSectionFromTOC(true);
      this.sectionController.sectionStateManager.setPendingSectionId(sectionId);
    }

    const sectionElement = this.sectionController.sectionFinder.getSectionById(sectionId, pageId);
    if (!sectionElement) {
      if (fromTOC) {
        this.sectionController.sectionStateManager.setIsNavigatingToSectionFromTOC(false);
        this.sectionController.sectionStateManager.setPendingSectionId(null);
      }
      return false;
    }

    // Determinar el índice de la sección destino
    const sections = this.sectionController.sections;
    const sectionIndex = sections.indexOf(sectionElement);

    if (sectionIndex === -1) {
      if (fromTOC) {
        this.sectionController.sectionStateManager.setIsNavigatingToSectionFromTOC(false);
        this.sectionController.sectionStateManager.setPendingSectionId();
      }
      return false;
    }

    // Cambiar visibilidad de la sección objetivo
    if (fromTOC) {
      this.sectionController.visibilityManager.updateSectionVisibility(sections, sectionIndex, false, true);
    } else {
      this.sectionController.visibilityManager.updateSectionVisibility(sections, sectionIndex, false, false);
    }

    // Actualizar estado actual en SectionStateManager
    this.sectionController.sectionStateManager.setCurrentSection(sectionId, pageId);

    // ACTUALIZAR el índice actual de sección en SectionController
    this.sectionController.currentSectionIndex = sectionIndex;

    if (fromTOC) {
      this.sectionController.sectionStateManager.setIsNavigatingToSectionFromTOC(false);
      this.sectionController.sectionStateManager.setPendingSectionId();
    }

    // Hacer scroll a la sección (esto puede disparar el observer)
    sectionElement.scrollIntoView({ behavior: "smooth", block: "center" });

    // El observer debe ejecutar la función asociada a la sección si corresponde

    return true;
  }

  /**
   * Limpia el estado del manejador de navegación de secciones.
   */
  cleanup() {
    // Si necesitas limpiar banderas, hazlo aquí
    if (this.sectionStateManager) {
      this.sectionStateManager.setIsForcedNavigation(false);
      this.sectionStateManager.setIsNavigatingToSectionFromTOC(false);
      this.sectionStateManager.setPendingSectionId();
    }
  }
}
