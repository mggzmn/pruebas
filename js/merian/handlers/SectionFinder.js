import { SectionIdUtils } from "../utils/SectionIdUtils.js";

/**
 * Manejador para encontrar secciones en el DOM.
 * No mantiene estado local. Usa el DOM como fuente de verdad (DOM + ID normalizado).
 */
export class SectionFinder {
  constructor(currentPageId = null) {
    this.currentPageId = currentPageId;
  }

  /**
   * Establece la página actual para búsquedas.
   * @param {string} pageId - ID de la página actual.
   */
  setCurrentPageId(pageId) {
    this.currentPageId = pageId;
  }

  /**
   * Busca una sección en el DOM usando el ID normalizado.
   * @param {string} sectionId - ID lógico de la sección
   * @param {string} pageId - ID de la página actual (opcional)
   * @returns {HTMLElement|null} - Elemento DOM correspondiente
   */
  getSectionById(sectionId, pageId = this.currentPageId) {
    if (!sectionId || !pageId) return null;
    const normalizedId = SectionIdUtils.normalizeId(sectionId, pageId);
    const selector = `[data-section-id="${normalizedId}"]`;
    return document.querySelector(selector);
  }

  /**
   * Devuelve todas las secciones visibles del DOM.
   * @returns {HTMLElement[]} - Lista de elementos con clase .slide-section
   */
  getAllSections() {
    return Array.from(document.querySelectorAll(".slide-section"));
  }

  /**
   * Limpia el estado interno del finder.
   */
  clear() {
    this.currentPageId = null;
  }
}
