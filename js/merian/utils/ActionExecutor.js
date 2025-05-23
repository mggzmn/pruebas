import { AnimationUtils } from "./animationUtils.js";
import { SectionIdUtils } from "./SectionIdUtils.js";
export class ActionExecutor {
  /**
   * Ejecuta una lista de acciones con gestión avanzada de sincronización
   * @param {Array<Object>} actions - El arreglo de objetos de acción
   * @param {Object} context - El contexto de ejecución
   */
  static execute(actions = [], context) {
    if (!actions || actions.length === 0 || !context) return;

    // Separar acciones con y sin delay
    const immediateActions = actions.filter((action) => !action.delay);
    const delayedActions = actions.filter((action) => action.delay);

    // Ejecutar acciones inmediatas primero
    immediateActions.forEach((action) => {
      this._executeAction(action, context);
    });

    // Ejecutar acciones con delay de manera sincronizada
    if (delayedActions.length > 0) {
      delayedActions.forEach((action) => {
        this._executeDelayedAction(action, context);
      });
    }
  }

  /**
   * Ejecuta una acción individual
   * @param {Object} action - La acción a ejecutar
   * @param {Object} context - Contexto de ejecución
   * @private
   */
  static _executeAction(action, context) {
    const { controller, audioController, component } = context;
    const componentName = component?.constructor?.name || "ActionExecutor";

    console.log(`ActionExecutor: Ejecutando acción ${action.type}`, action);

    switch (action.type) {
      case "removeClass":
      case "addClass": {
        this._toggleClasses(action, action.type === "addClass" ? "add" : "remove");
        break;
      }

      case "show":
      case "hide": {
        this._handleVisibility(action, action.type === "show");
        break;
      }

      case "addEventListener": {
        this._attachEventListener(action, context);
        break;
      }

      case "openModal": {
        if (controller?.modalManager && action.modalId) {
          console.log(`${componentName}: Abriendo modal ${action.modalId}`);
          controller.modalManager.openModal(action.modalId);
        }
        break;
      }

      case "closeModal": {
        if (component && typeof component.close === "function") {
          console.log(`${componentName}: Cerrando modal via componente`);
          component.close();
        } else if (controller?.modalManager) {
          console.log(`${componentName}: Cerrando modal via controlador`);
          controller.modalManager.closeActiveModal();
        }
        break;
      }

      case "play_pause": {
        audioController?.togglePlayPause();
        break;
      }

      case "setAudioSource": {
        audioController?.setAudioSource(action.newSource);
        break;
      }

      // Añadir nuevo tipo de acción para configurar modales de sección
      case "configureSectionModals": {
        if (controller?.sectionController && action.sectionId && action.modalIds) {
          console.log(`${componentName}: Configurando modales para sección ${action.sectionId}`);
          controller.sectionController.configureSectionModals(action.sectionId, action.modalIds, action.completionActions || []);
        }
        break;
      }

      case "resetSectionModals": {
        if (controller?.sectionController && action.sectionId) {
          console.log(`${componentName}: Restableciendo estado de modales para sección ${action.sectionId}`);
          controller.sectionController.resetSectionModalsCompletion(action.sectionId);
        }
        break;
      }

      case "setAudioVolume": {
        audioController?.adjustVolume(action.newVolume);
        break;
      }

      case "execFunction": {
        const fn = window[action.functionName];
        if (typeof fn === "function") {
          fn(...(action.args || []));
        }
        break;
      }

      case "nextPage":
      case "moveForward": {
        if (controller) {
          console.log(`ActionExecutor: Ejecutando acción ${action.type}`);
          controller.markCurrentPageAsCompleted();
          controller.nextPage();
        }
        break;
      }
      case "sectionCompleted": {
        if (context.sectionController && action.sectionId != null) {
          const pageId = context.sectionController.currentPageId || null;
          context.sectionController.sectionStateManager.markSectionCompleted(action.sectionId, pageId);
        }
        break;
      }
      case "nextSection":
        if (context.sectionController) {
          context.sectionController.nextSection(action.delay);
        }
        break;

      case "markModalAsViewed": {
        if (action.modalId && controller?.modalManager) {
          console.log(`ActionExecutor: Notificando al ModalManager que el modal ${action.modalId} ha sido visto`);
          controller.modalManager.onModalViewed(action.modalId);
        } else if (component?.constructor?.name === "ModalComponent" && component.courseController?.modalManager) {
          console.log(`ActionExecutor: Notificando desde componente que el modal ${action.modalId} ha sido visto`);
          component.courseController.modalManager.onModalViewed(action.modalId);
        } else {
          console.warn(`ActionExecutor: No se pudo notificar que el modal ${action.modalId} ha sido visto`);
        }
        break;
      }

      default: {
        console.warn(`ActionExecutor: Acción no reconocida "${action.type}"`);
      }
    }
  }
  /**
   * Método auxiliar para añadir o remover clases
   * @param {Object} action - Configuración de la acción
   * @param {string} method - 'add' o 'remove'
   * @private
   */
  static _toggleClasses(action, method) {
    try {
      if (action.targetSelector) {
        document.querySelectorAll(action.targetSelector).forEach((el) => {
          el.classList[method](...action.classes);
        });
      } else if (action.targetId) {
        const element = document.getElementById(action.targetId);
        if (element) {
          element.classList[method](...action.classes);
        }
      }
    } catch (error) {
      console.error(`Error en ${method}Class:`, error);
    }
  }

  /**
   * Maneja la visibilidad de elementos
   * @param {Object} action - Configuración de la acción
   * @param {boolean} show - Si mostrar u ocultar
   * @private
   */
  static _handleVisibility(action, show) {
    try {
      if (action.targetSelector) {
        document.querySelectorAll(action.targetSelector).forEach((el) => {
          el.style.display = show ? "" : "none";
          el.classList.toggle("hidden", !show);
          el.classList.toggle("opacity-0", !show);
        });
      } else {
        const elementToToggle = document.getElementById(action.targetId);
        if (elementToToggle) {
          elementToToggle.style.display = show ? "" : "none";
          elementToToggle.classList.toggle("hidden", !show);
          elementToToggle.classList.toggle("opacity-0", !show);
        }
      }
    } catch (error) {
      console.error(`Error en manejo de visibilidad:`, error);
    }
  }

  /**
   * Adjunta un listener de evento
   * @param {Object} action - Configuración de la acción
   * @param {Object} context - Contexto de ejecución
   * @private
   */
  static _attachEventListener(action, context) {
    const { trackedListeners } = context;
    const element = document.getElementById(action.targetId);
    const handler = window[action.handlerName];
    const eventType = action.eventType || "click";

    if (element && typeof handler === "function" && trackedListeners) {
      element.addEventListener(eventType, handler);
      trackedListeners.push({ element, eventType, handler });
      console.log(`ActionExecutor: Añadido listener ${eventType} con manejador ${action.handlerName} a #${action.targetId}`);
    }
  }

  /**
   * Ejecuta una acción con delay de manera sincronizada
   * @param {Object} action - La acción a ejecutar con delay
   * @param {Object} context - Contexto de ejecución
   * @private
   */
  static _executeDelayedAction(action, context) {
    const { controller } = context;

    // Usar AnimationUtils para respetar el ciclo de renderizado
    AnimationUtils.executeAfterTime(() => {
      // Verificar que sea la primera vez que se ve la sección
      if (!controller) {
        console.warn("No se proporcionó controlador para acción con delay");
        return;
      }

      const currentPageIndex = controller.stateManager.getCurrentPage();
      const furthestPage = controller.stateManager.getFurthestPage();

      // Solo ejecutar si estamos en la página más avanzada o es la primera vez
      if (currentPageIndex === furthestPage) {
        this._executeAction(action, context);
      }
    }, action.delay);
  }
}
