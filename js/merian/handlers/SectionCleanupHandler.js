import { SectionStateManager } from "../managers/sectionStateManager.js";

/**
 * Clase encargada de limpiar y resetear el estado de las secciones.
 */
export class SectionCleanupHandler {
  /**
   * Constructor del manejador de limpieza de secciones.
   * @param {Object} sectionController - Controlador de secciones.
   */
  constructor(sectionController) {
    this.sectionController = sectionController;
    this.sectionStateManager = new SectionStateManager();
  }

  /**
   * Realiza la limpieza de recursos y estados de las secciones.
   * Limpia el estado global, popups, listeners, y reinicia variables relacionadas a la página y secciones.
   * @returns {void}
   */
  cleanup() {
    // Limpiar estados y listeners globales asociados a las secciones
    this.sectionStateManager.clearCurrentSection();

    // Limpiar popups o elementos de UI asociados a las secciones
    this._cleanupPopups();

    // Reiniciar variables de progreso si aplica
    if (this.sectionController.progressManager) {
      this.sectionController.progressManager.clearPartialProgress();
    }

    // Limpiar estados de audio y eventos
    if (this.sectionController.audioHandler) {
      this.sectionController.audioHandler.stopCurrentAudio(true);
      this.sectionController.audioHandler.resetDebounceTime();
    }

 
  }

  /**
   * Limpia los popups activos o elementos emergentes asociados a la UI de la sección.
   * @private
   * @returns {void}
   */
  _cleanupPopups() {
    // Ejemplo: Cierra cualquier modal o popup visible
    const openPopups = document.querySelectorAll('.popup.open, .modal.open');
    openPopups.forEach((popup) => {
      popup.classList.remove('open');
      popup.setAttribute('aria-hidden', 'true');
    });
  }
}
