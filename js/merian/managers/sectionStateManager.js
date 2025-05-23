/**
 * Clase encargada de centralizar y gestionar el estado de la sección activa por página,
 * así como el estado de secciones completadas y funciones ejecutadas por sección.
 * Permite distinguir entre la sección actualmente activa.
 */
export class SectionStateManager {
  /**
   * Constructor del gestor de estado de sección.
   */
  constructor() {
    /**
     * Objeto para almacenar el ID de la sección activa por página.
     * @type {Object.<string, string>}
     */
    this.activeSections = {};

    /**
     * Set para almacenar las secciones completadas en formato `${pageId}_${sectionId}`.
     * @type {Set<string>}
     */
    this.completedSections = new Set();

    // Centralización de banderas de navegación
    this.isForcedNavigation = false;
    this.isNavigatingToSectionFromTOC = false;
    this.pendingSectionId = null;

    /**
     * Listeners para eventos de sección completada.
     * @type {Array<Function>}
     */
    this.completionListeners = [];

    this.isResizing = false;
  }

  /**
   * Establece la sección activa para una página específica.
   * @param {string} sectionId - ID normalizado de la sección.
   * @param {string} pageId - ID único de la página.
   */
  setCurrentSection(sectionId, pageId) {
    if (!sectionId || !pageId) return;
    this.activeSections[pageId] = sectionId;
    console.log(`SectionStateManager: Sección actual establecida en ${sectionId} para la página ${pageId}`);
  }

  /**
   * Obtiene la sección activa de una página.
   * @param {string} pageId - ID único de la página.
   * @returns {string|null} - El ID de la sección activa o null si no existe.
   */
  getCurrentSection(pageId) {
    if (!pageId) return null;
    return this.activeSections[pageId] || null;
  }

  /**
   * Limpia la sección activa de una página específica o de todas si no se indica.
   * @param {string} [pageId] - ID único de la página.
   */
  clearCurrentSection(pageId) {
    if (pageId) {
      delete this.activeSections[pageId];
    } else {
      this.activeSections = {};
    }
    this.isForcedNavigation = false;
    this.isNavigatingToSectionFromTOC = false;
    this.pendingSectionId = null;
  }

  /**
   * Limpia todas las referencias de secciones activas y funciones ejecutadas.
   */
  reset() {
    this.activeSections = {};
    this.completedSections.clear();
    this.isForcedNavigation = false;
    this.isNavigatingToSectionFromTOC = false;
    this.pendingSectionId = null;
  }

  /**
   * Marca una sección como completada.
   * @param {string} sectionId - ID de la sección.
   * @param {string|number} pageId - ID de la página.
   */
  markSectionCompleted(sectionId, pageId) {
    if (!sectionId || !pageId) return;
    const key = `${pageId}_${sectionId}`;
    if (this.completedSections.has(key)) return; // Ya estaba completada, no notifiques de nuevo
    this.completedSections.add(key);
    this._notifyCompletion(sectionId, pageId);
  }

  /**
   * Verifica si una sección está completada.
   * @param {string} sectionId - ID de la sección.
   * @param {string|number} pageId - ID de la página.
   * @returns {boolean} - True si la sección está completada.
   */
  isSectionCompleted(sectionId, pageId) {
    if (!sectionId || !pageId) return false;
    return this.completedSections.has(`${pageId}_${sectionId}`);
  }

  /**
   * Alias para marcar sección como completada.
   * @param {string} sectionId
   * @param {string|number} pageId
   */
  setSectionCompleted(sectionId, pageId) {
    this.markSectionCompleted(sectionId, pageId);
  }

  /**
   * Marca una sección como incompleta (elimina de completadas).
   * @param {string} sectionId
   * @param {string|number} pageId
   */
  setSectionIncomplete(sectionId, pageId) {
    this.completedSections.delete(`${pageId}_${sectionId}`);
  }

  /**
   * Devuelve un array con los IDs de secciones completadas para una página.
   * @param {string} pageId
   * @returns {Array<string>}
   */
  getSectionsForPage(pageId) {
    if (!pageId) return [];
    const prefix = `${pageId}_`;
    return Array.from(this.completedSections)
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.substring(prefix.length));
  }

  /**
   * Establece el ID de la sección pendiente.
   * @param {string} sectionId
   */
  setPendingSectionId(sectionId) {
    this.pendingSectionId = sectionId;
  }

  /**
   * Obtiene el ID de la sección pendiente.
   * @returns {string|null}
   */
  getPendingSectionId() {
    return this.pendingSectionId;
  }

  /**
   * Establece la bandera de navegación desde TOC.
   * @param {boolean} flag
   */
  setIsNavigatingToSectionFromTOC(flag) {
    this.isNavigatingToSectionFromTOC = !!flag;
  }

  /**
   * Obtiene la bandera de navegación desde TOC.
   * @returns {boolean}
   */
  getIsNavigatingToSectionFromTOC() {
    return this.isNavigatingToSectionFromTOC;
  }

  /**
   * Establece la bandera de navegación forzada.
   * @param {boolean} flag
   */
  setIsForcedNavigation(flag) {
    this.isForcedNavigation = !!flag;
  }

  /**
   * Obtiene la bandera de navegación forzada.
   * @returns {boolean}
   */
  getIsForcedNavigation() {
    return this.isForcedNavigation;
  }

  /**
   * Establece la bandera de redimensionamiento.
   * @param {boolean} flag
   */
  setIsResizing(flag) {
    this.isResizing = !!flag;
  }

  /**
   * Obtiene la bandera de redimensionamiento.
   * @returns {boolean}
   */
  getIsResizing() {
    return this.isResizing;
  }

  /**
   * Agrega un listener para el evento de sección completada.
   * @param {Function} listener
   */
  addCompletionListener(listener) {
    if (typeof listener === "function") {
      this.completionListeners.push(listener);
    }
  }

  /**
   * Elimina un listener de sección completada.
   * @param {Function} listener
   */
  removeCompletionListener(listener) {
    this.completionListeners = this.completionListeners.filter((l) => l !== listener);
  }

  /**
   * Notifica a los listeners registrados cuando una sección es completada.
   * @private
   * @param {string} sectionId
   * @param {string|number} pageId
   */
  _notifyCompletion(sectionId, pageId) {
    this.completionListeners.forEach((listener) => {
      try {
        listener(sectionId, pageId);
      } catch (e) {
        console.error("SectionStateManager listener error:", e);
      }
    });
  }

  /**
   * Restaura secciones completadas desde un array de IDs.
   * @param {Array<string>} sectionIds - Array con los IDs de las secciones a restaurar.
   * @param {string} pageId - ID de la página.
   */
  restoreCompletedSections(sectionIds, pageId) {
    if (!Array.isArray(sectionIds) || !pageId) return;
    sectionIds.forEach((sectionId) => {
      const key = `${pageId}_${sectionId}`;
      this.completedSections.add(key);
    });
  }
}
