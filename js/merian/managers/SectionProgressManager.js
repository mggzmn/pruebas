
import { SectionIdUtils } from "../utils/SectionIdUtils.js";

export class SectionProgressManager {
  constructor(courseController) {
    this.courseController = courseController;
    this.sections = [];
  }

  /**
   * Marca una sección como completada, actualiza el índice y el progreso.
   * @param {string} sectionId - ID de la sección completada.
   * @param {string} pageId - ID de la página.
   * @returns {boolean} - Si la operación fue exitosa.
   */
  markSectionCompleted(sectionId, pageId) {
    if (!sectionId || !pageId) return false;
    this.courseController.sectionController.sectionStateManager.markSectionCompleted(sectionId, pageId);
    this.saveSectionProgress(pageId);
    return true;
  }

  /**
   * Método original para compatibilidad
   * @param {string} sectionId - ID de la sección
   * @param {string} pageId - ID de la página
   */
  markSectionAsCompleted(sectionId, pageId) {
    console.log(`SectionProgressManager: Marcando sección ${sectionId} como completada en página ${pageId}`);
    return this.markSectionCompleted(sectionId, pageId);
  }

  /**
   * Método para actualizar la sección actual
   * @param {string} sectionId - El ID de la sección actual
   */
  updateCurrentSectionId(sectionId) {
    if (!sectionId) return;
    this.saveSectionProgress(this.courseController.stateManager.pages[this.courseController.stateManager.getCurrentPage()]?.id);
  }

  /**
   * Verifica si una sección está completada
   * @param {string} sectionId - ID de la sección
   * @param {string} pageId - ID de la página
   * @returns {boolean} - Si la sección está completada
   */
  isSectionCompleted(sectionId, pageId) {
    return this.courseController.sectionController.sectionStateManager.isSectionCompleted(sectionId, pageId);
  }

  /**
   * Obtiene las secciones completadas para una página específica
   * @param {string} pageId - ID de la página
   * @returns {Array} - Array de IDs de secciones completadas (sin prefijo)
   */
  getSectionsForPage(pageId) {
    if (!pageId) return [];
    // Delegar al SectionStateManager
    return this.courseController.sectionController.sectionStateManager.getSectionsForPage(pageId);
  }

  /**
   * Verifica si todas las secciones en una página están completadas
   * @param {Array} sections - Las secciones a verificar
   * @param {string} pageId - El ID de la página
   * @returns {boolean} - Si todas las secciones están completadas
   */
  allSectionsCompleted(sections, pageId) {
    if (!Array.isArray(sections) || sections.length === 0 || !pageId) {
      return false;
    }
    // Usar SectionStateManager para verificar cada sección
    return sections.every((section) => {
      return this.isSectionCompleted(section.id, pageId);
    });
  }

  /**
   * Método optimizado para guardar progreso solo cuando es necesario
   * @param {string} pageId - El ID de la página actual
   */
  saveSectionProgress(pageId) {
    if (!pageId) return;

    const currentPageIndex = this.courseController.stateManager.getCurrentPage();
    const furthestPageReached = this.courseController.stateManager.getFurthestPage();

    if (currentPageIndex !== furthestPageReached) {
      console.log(`Skipping section progress save - not in furthest page (current: ${currentPageIndex}, furthest: ${furthestPageReached})`);
      return;
    }

    let allProgress = this._getExistingProgress();

    // Obtener los IDs de secciones completadas para esta página desde SectionStateManager
    const sectionIds = this.getSectionsForPage(pageId);

    console.log(`Found ${sectionIds.length} completed sections for ${pageId}`);

    if (sectionIds.length === 0) {
      delete allProgress[pageId];
    } else {
      allProgress[pageId] = sectionIds;
    }

    allProgress["currentPage"] = pageId;

    this._saveProgressToStorage(allProgress);

    console.log(`Saved section progress for page ${pageId}: ${sectionIds.join(", ")}`);
  }

  /**
   * Recupera el progreso existente desde almacenamiento
   * @returns {Object} - Objeto de progreso o objeto vacío si no hay datos
   * @private
   */
  _getExistingProgress() {
    try {
      let savedData = null;
      if (this.courseController.isInLMS) {
        savedData = this.courseController.scormManager.getCustomData("sp");
      }
      if (!savedData) {
        savedData = sessionStorage.getItem("sp");
      }
      if (savedData) {
        return JSON.parse(savedData);
      }
    } catch (error) {
      console.error("Error retrieving existing progress:", error);
    }
    return {};
  }

  /**
   * Guarda el progreso en almacenamiento
   * @param {Object} progressData - Datos de progreso a guardar
   * @private
   */
  _saveProgressToStorage(progressData) {
    const dataString = JSON.stringify(progressData);
    console.log(`Saving progress state:`, dataString);
    sessionStorage.setItem("sp", dataString);
    if (this.courseController.isInLMS) {
      this.courseController.scormManager.setCustomData("sp", dataString);
    }
  }

  /**
   * Restaura el progreso guardado de secciones para la página actual
   * @param {string} currentPageId - ID de la página actual
   * @returns {void}
   *
   * Verifica si la página actual no está marcada como completada y omite la restauración si es así.
   * Recupera los datos guardados de progreso y restaura las secciones completadas para la página actual.
   * Luego, restaura secciones completadas de otras páginas y aplica eventos y funciones a secciones completadas.
   * Si no hay datos guardados, omite la restauración.
   *
   * La función utiliza Storage para recuperar los datos de progreso y el controlador de secciones
   * para restaurar las secciones completadas.
   */
  restoreSavedSectionProgress(currentPageId) {
    const currentPageIndex = this.courseController.stateManager.getCurrentPage();
    const currentPageData = this.courseController.stateManager.pages[currentPageIndex];
    if (!currentPageData?.completed) {
      console.log(`Page ${currentPageId} was never marked as completed (completed=false). Skipping restore.`);
      return;
    }

    const storedProgress = this._getExistingProgress();
    if (!storedProgress || !storedProgress[currentPageId]) {
      console.log("Sin progreso guardado. Omitiendo restauración.");
      return;
    }

    try {
      const allProgress = this._getSavedProgressData();
      if (!allProgress) return;

      // Restaurar secciones completadas para la página actual
      this._restoreCompletedSectionsForPage(currentPageId, allProgress);

      // Restaurar secciones completadas de otras páginas
      this._restoreCompletedSectionsFromOtherPages(currentPageId, allProgress);

      // Aplicar eventos y funciones a secciones completadas
      this._applyEventsToCompletedSections(currentPageId);

      // Eliminado: this.completedSections.size
    } catch (error) {
      console.error("Error restoring section progress:", error);
    }
  }

  _getSavedProgressData() {
    let savedData = sessionStorage.getItem("sp");
    if (!savedData && this.courseController.isInLMS) {
      savedData = this.courseController.scormManager.getCustomData("sp");
    }
    if (!savedData) {
      console.log("No section progress data found to restore");
      return null;
    }
    const allProgress = JSON.parse(savedData);
    console.log("Restoring section progress:", allProgress);
    if (typeof allProgress !== "object") {
      console.error("Invalid progress data format:", allProgress);
      return null;
    }
    return allProgress;
  }

  _restoreCompletedSectionsForPage(pageId, allProgress) {
    if (Array.isArray(allProgress[pageId]) && allProgress[pageId].length > 0) {
      const sectionIds = allProgress[pageId];
      // Usar el método especial para restaurar sin notificar
      this.courseController.sectionController.sectionStateManager.restoreCompletedSections(sectionIds, pageId);
      console.log(`Restored progress for ${sectionIds.length} sections in page ${pageId}`);
    }
  }

  _restoreCompletedSectionsFromOtherPages(currentPageId, allProgress) {
    Object.entries(allProgress).forEach(([pageId, sectionIds]) => {
      if (pageId !== "currentPage" && pageId !== currentPageId && Array.isArray(sectionIds)) {
        this.courseController.sectionController.sectionStateManager.restoreCompletedSections(sectionIds, pageId);
        console.log(`Also restored ${sectionIds.length} sections from other page: ${pageId}`);
      }
    });
  }

  /**
   * Aplica eventos visuales a secciones completadas
   * @param {string} pageId - ID de la página
   * @private
   */
  _applyEventsToCompletedSections(pageId) {
    if (!pageId) return;
    try {
      const sections = this.courseController.sectionController.sections;
      if (!sections || sections.length === 0) return;
      sections.forEach((section) => {
        if (!section || !section.id) return;
        if (this.isSectionCompleted(section.id, pageId)) {
          this.courseController.sectionController.visibilityManager.markSectionAsCompletedVisually(section);
        }
      });
    } catch (error) {
      console.error("Error applying events to completed sections:", error);
    }
  }

  /**
   * Limpia el progreso guardado de secciones para una página específica
   * @param {string} pageId - ID de la página a limpiar (si se omite, limpia todo)
   * @param {boolean} [onlyIfCompleted=true] - Solo limpiar si la página está completada
   */
  clearSavedSectionProgress(pageId) {
    const currentPageIndex = this.courseController.stateManager.getCurrentPage();
    const currentPageData = this.courseController.stateManager.pages[currentPageIndex];
    if (!currentPageData?.completed) {
      console.log(`Cannot clear saved section progress for page ${pageId}: completed=false.`);
      return;
    }
    const previousPageIndex = this.courseController.stateManager.getCurrentPage() - 1;
    if (previousPageIndex < 0) {
      console.warn("No hay página anterior para limpiar el progreso.");
      return;
    }
    const furthestPageReached = this.courseController.stateManager.getFurthestPage();
    if (previousPageIndex < furthestPageReached) {
      console.log(`Omitiendo limpieza - página actual (${currentPageIndex}) no supera la furthest (${furthestPageReached})`);
      return;
    }
    // Limpiar solo el progreso de la página especificada en storage
    try {
      let allProgress = {};
      const savedData = this.courseController.isInLMS ? this.courseController.scormManager.getCustomData("sp") : sessionStorage.getItem("sp");
      if (savedData) {
        allProgress = JSON.parse(savedData);
        delete allProgress[pageId];
        const dataString = JSON.stringify(allProgress);
        sessionStorage.setItem("sp", dataString);
        if (this.courseController.isInLMS) {
          this.courseController.scormManager.setCustomData("sp", dataString);
        }
      }
    } catch (error) {
      console.error("Error clearing section progress for page:", pageId, error);
    }
    console.log(`Section progress cleared for page ${pageId}`);
  }

  /**
   * Verifica si hay progreso parcial en una página específica
   * @param {string} pageId - ID de la página a verificar
   * @returns {boolean} - Si hay progreso parcial
   */
  hasPartialProgress(pageId) {
    if (!pageId) return false;
    console.log(`Checking partial progress for page ${pageId}`);
    try {
      let savedData = sessionStorage.getItem("sp");
      if (!savedData && this.courseController.isInLMS) {
        savedData = this.courseController.scormManager.getCustomData("sp");
      }
      if (!savedData) {
        console.log("No saved progress data found");
        return false;
      }
      const progressData = JSON.parse(savedData);
      const savedPageId = progressData.currentPage;
      if (savedPageId !== pageId) {
        console.log(`Saved progress is for page ${savedPageId}, not for requested page ${pageId}`);
        return false;
      }
      if (!progressData[pageId] || !Array.isArray(progressData[pageId])) {
        console.log(`No progress data for page ${pageId}`);
        return false;
      }
      const completedCount = progressData[pageId].length;
      const totalSections = this.courseController.sectionController.sections.length;
      const hasPartial = completedCount > 0 && completedCount < totalSections;
      console.log(`Page ${pageId}: ${completedCount}/${totalSections} sections completed. Partial progress: ${hasPartial}`);
      return hasPartial;
    } catch (error) {
      console.error("Error checking partial progress:", error);
      return false;
    }
  }

  /**
   * Obtiene el número de secciones completadas en la página actual
   * @returns {number} - Cantidad de secciones completadas
   */
  getCompletedSectionsCount(pageId) {
    // Devuelve el número de secciones completadas para una página usando SectionStateManager
    return this.getSectionsForPage(pageId).length;
  }

  /**
   * Método unificado para gestionar el estado de sección (actual o pendiente)
   * @param {string} key - Identificador del tipo de estado ("sp" o "psn")
   * @param {string} sectionId - ID de la sección a guardar
   * @param {boolean} remove - Si debe eliminarse en lugar de guardarse
   */
  manageSectionState(key, sectionId, remove = false) {
    if (!key) return;

    if (remove) {
      console.log(`Removing section state: ${key}`);
      sessionStorage.removeItem(key);
      if (this.courseController.isInLMS) {
        this.courseController.scormManager.setCustomData(key, "");
      }
      return;
    }

    if (!sectionId) return;

    // Al guardar un valor, asegurarnos de que sea limpio (sin pageId)
    // Esto facilita su reutilización en diferentes contextos
    let cleanId = sectionId;
    if (sectionId.includes("_")) {
      cleanId = sectionId.split("_").pop();
    }

    console.log(`Saving section state: ${key} = ${cleanId}`);

    // Guardar en sessionStorage
    sessionStorage.setItem(key, cleanId);

    // Guardar en SCORM
    if (this.courseController.isInLMS) {
      this.courseController.scormManager.setCustomData(key, cleanId);
    }
  }

  /**
   * Método unificado para gestionar secciones pendientes
   * @param {string} sectionId - ID de la sección pendiente
   */
  savePendingSectionId(sectionId) {
    if (!sectionId) return;

    // Limpiar el ID de sección para usarlo consistentemente
    let cleanId = this._extractCleanId(sectionId);

    console.log(`Saving pending section: ${cleanId}`);

    // Guardar en sessionStorage y SCORM si está disponible
    sessionStorage.setItem("psn", cleanId);

    if (this.courseController.isInLMS) {
      this.courseController.scormManager.setCustomData("psn", cleanId);
    }
  }

  /**
   * Limpia el ID de la sección pendiente
   */
  setPendingSectionId() {
    this.manageSectionState("psn", null, true);
  }

  /**
   * Obtiene el ID de la sección actual guardada
   * @returns {string|null} - ID de la sección guardada o null
   */
  getSavedCurrentSectionId() {
    // Intentar recuperar la última sección de los datos de progreso
    try {
      const pageId = this.courseController.stateManager.pages[this.courseController.stateManager.getCurrentPage()]?.id;
      if (!pageId) return null;

      // Recuperar progreso desde storage
      const savedData = sessionStorage.getItem("sp") || (this.courseController.isInLMS ? this.courseController.scormManager.getCustomData("sp") : null);

      if (!savedData) return null;

      const progressData = JSON.parse(savedData);
      if (!progressData[pageId] || !Array.isArray(progressData[pageId]) || progressData[pageId].length === 0) {
        return null;
      }

      // Si hay progreso, buscar la primera sección no completada
      const completedIds = new Set(progressData[pageId]);
      for (const section of this.courseController.sectionController.sections) {
        // Normalizar ID para comparación
        const cleanId = section.id.includes("_") ? section.id.split("_").pop() : section.id;
        if (!completedIds.has(cleanId)) {
          return section.id;
        }
      }

      // Si todas están completadas, devolver la última
      return this.courseController.sectionController.sections[this.courseController.sectionController.sections.length - 1]?.id;
    } catch (error) {
      console.error("Error retrieving saved section ID:", error);
      return null;
    }
  }

  /**
   * Obtiene la siguiente sección no completada en una página
   * @param {string} pageId - ID de la página
   * @returns {string|null} - ID de la siguiente sección no completada o null
   */
  getNextIncompleteSection(pageId) {
    if (!pageId) return null;
    try {
      let savedData = sessionStorage.getItem("sp");
      if (!savedData && this.courseController.isInLMS) {
        savedData = this.courseController.scormManager.getCustomData("sp");
      }
      if (!savedData) return null;
      const progressData = JSON.parse(savedData);
      if (progressData.currentPage !== pageId) {
        console.log(`Current page in SP is ${progressData.currentPage}, not ${pageId}`);
        return null;
      }
      const completedSections = new Set();
      if (progressData[pageId] && Array.isArray(progressData[pageId])) {
        progressData[pageId].forEach((id) => completedSections.add(id));
        console.log(`Found ${completedSections.size} completed sections for page ${pageId} in SP`);
      }
      const sections = this.courseController.sectionController.sections;
      for (const section of sections) {
        const sectionId = section.id;
        const cleanId = this._extractCleanId(sectionId);
        if (!completedSections.has(cleanId)) {
          console.log(`Found next incomplete section: ${sectionId}`);
          return sectionId;
        }
      }
      if (sections.length > 0) {
        const lastSection = sections[sections.length - 1].id;
        console.log(`All sections complete, returning last: ${lastSection}`);
        return lastSection;
      }
    } catch (error) {
      console.error("Error finding next incomplete section:", error);
    }
    return null;
  }

  /**
   * Asegura que un ID de sección tenga formato compuesto
   * @param {string} sectionId - ID de sección original
   * @param {string} pageId - ID de la página
   * @returns {string} - ID compuesto normalizado
   * @private
   */
  _normalizeId(sectionId, pageId) {
    return SectionIdUtils.createCompoundId(pageId, SectionIdUtils.extractSectionId(sectionId));
  }

  /**
   * Extrae el ID limpio de un ID de sección
   * @param {string} id - ID original que puede contener prefijo de página
   * @returns {string} - ID limpio
   * @private
   */
  _extractCleanId(id) {
    return SectionIdUtils.extractSectionId(id);
  }
  /**
   * Elimina el progreso parcial de una página específica.
   * @param {string} pageId - ID de la página a limpiar
   * @returns {void}
   */
  clearPartialProgress(pageId) {
    if (!pageId) return;
    // No elimina todo el progreso, solo el parcial para esa página.
    // Ya no manipula this.completedSections
    let allProgress = this._getExistingProgress();
    delete allProgress[pageId];
    this._saveProgressToStorage(allProgress);
    console.log(`[SectionProgressManager] Parcial progress cleared for page ${pageId}`);
  }
}
