/**
 * Administra el estado de visibilidad de las secciones.
 */
export class SectionVisibilityManager {
  /**
   * Constructor del administrador de visibilidad.
   * No requiere estado específico en esta implementación.
   */
  constructor() {
    // No se requiere estado específico por ahora
  }

  /**
   * Configura la visibilidad inicial de las secciones cuando se carga una página.
   * @param {Array<Element>} sections - Todas las secciones en la página.
   * @param {number} startingIndex - El índice de la primera sección que debe hacerse visible.
   */
  setupInitialSectionVisibility(sections, startingIndex) {
    sections.forEach((section, index) => {
      if (index <= startingIndex) {
        section.classList.add("visible");
        section.setAttribute("aria-hidden", "false");
      } else {
        section.classList.remove("visible");
        section.setAttribute("aria-hidden", "true");
      }
    });
  }

  /**
   * Actualiza la visibilidad de las secciones.
   * @param {Array<Element>} sections - Todas las secciones de la página.
   * @param {number} targetIndex - Índice de la sección destino (la última visible).
   * @param {boolean} forceShowAll - Si es true, muestra todas las secciones (para revisión/completadas).
   * @param {boolean} fromTOC - Si es true, la navegación es por TOC.
   */
 updateSectionVisibility(sections, targetIndex, forceShowAll = false, fromTOC = false) {
  sections.forEach((section, idx) => {
    const wasVisible = section.classList.contains("visible");

    if (forceShowAll) {
      section.classList.add("visible");
      section.setAttribute("aria-hidden", "false");
    } else if (fromTOC) {
      if (idx <= targetIndex || wasVisible) {
        section.classList.add("visible");
        section.setAttribute("aria-hidden", "false");
      } else {
        section.classList.remove("visible");
        section.setAttribute("aria-hidden", "true");
      }
    } else {
      if (idx <= targetIndex) {
        section.classList.add("visible");
        section.setAttribute("aria-hidden", "false");
      }
    }
  });
}


  /**
   * Marca visualmente una sección específica como completada.
   * @param {Element} section - El elemento de la sección a marcar.
   */
  markSectionAsCompletedVisually(section) {
    if (section && !section.classList.contains("completed")) {
      section.classList.add("visible", "completed");
      section.setAttribute("aria-hidden", "false");
      console.log(`VisibilityManager: Sección ${section.id} marcada visualmente como completada.`);
    }
  }
}
