import { SectionStateManager } from "../managers/sectionStateManager.js";

/**
 * Manejador de eventos de secciones.
 * Ejecuta y controla la ejecución de funciones asociadas a cada sección.
 */
export class SectionEventHandler {
  /**
   * Constructor del manejador de eventos de secciones.
   * @param {Object} courseController - Referencia al controlador principal del curso.
   */
  constructor(courseController) {
    this.courseController = courseController;
    this.sectionStateManager = courseController.sectionStateManager || new SectionStateManager();
    /**
     * Mapa seguro de funciones asociadas a cada sección.
     * @type {Object.<string, Function>}
     */
    this.functionMap = {};
  }

  /**
   * Registra una función asociada a una sección.
   * @param {string} functionName - Nombre de la función.
   * @param {Function} fn - Función a registrar.
   */
  registerFunction(functionName, fn) {
    if (typeof functionName === "string" && typeof fn === "function") {
      this.functionMap[functionName] = fn;
    }
  }

  /**
   * Ejecuta la función asociada a una sección si no ha sido ejecutada.
   * @param {Element} sectionElement - Elemento de sección.
   * @param {string} sectionId - ID de la sección.
   * @param {string|number} pageId - ID de la página.
   */
  /**
   * Ejecuta la función asociada a una sección si no ha sido ejecutada.
   * @param {Element} sectionElement - Elemento de sección.
   * @param {string} sectionId - ID de la sección.
   * @param {string|number} pageId - ID de la página.
   */
  executeSectionFunction(sectionElement, sectionId, pageId) {
    console.log(`SectionEventHandler: Ejecutando función para sección ${sectionId} en página ${pageId}`);

    if (!sectionElement) {
      console.warn(`SectionEventHandler: sectionElement es nulo o indefinido para ${sectionId}`);
      return;
    }

    const functionName = sectionElement?.dataset?.function;
    console.log(`SectionEventHandler: Nombre de función encontrado: ${functionName}`);

    if (typeof functionName === "string" && this.functionMap[functionName]) {
      try {
        console.log(`SectionEventHandler: Ejecutando función ${functionName}`);
        this.functionMap[functionName](sectionElement, sectionId, pageId);
      } catch (e) {
        console.error(`SectionEventHandler: Error al ejecutar función ${functionName}:`, e);
      }
    } else if (typeof functionName === "string") {
      // Intento de ejecución como función global
      try {
        if (typeof window[functionName] === "function") {
          console.log(`SectionEventHandler: Ejecutando función global ${functionName}`);
          window[functionName](sectionElement, sectionId, pageId);
        } else {
          console.warn(`SectionEventHandler: Función ${functionName} no encontrada`);
        }
      } catch (e) {
        console.error(`SectionEventHandler: Error al ejecutar función global ${functionName}:`, e);
      }
    } else {
      console.warn(`SectionEventHandler: No se encontró nombre de función en el dataset.function del elemento`);
    }
  }

  /**
   * Muestra una sección específica.
   * @param {Element} section - Elemento de sección a mostrar.
   */
  showSection(section) {
    if (!section) {
      console.warn("VisibilityManager: Intento de mostrar una sección nula o indefinida");
      return;
    }

    console.log(`VisibilityManager: Mostrando sección ${section.id}`);

    try {
      section.classList.add("visible");
      section.setAttribute("aria-hidden", "false");
      // Verificar el estado resultante
      const computedStyle = window.getComputedStyle(section);
      console.log(`VisibilityManager: Estado después de mostrar: display=${computedStyle.display}, visibility=${computedStyle.visibility}`);
    } catch (error) {
      console.error(`VisibilityManager: Error al mostrar sección ${section.id}:`, error);
    }
  }
}
