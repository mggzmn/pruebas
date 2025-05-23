
/**
 * Utilidades para reemplazar setTimeout con alternativas basadas en requestAnimationFrame
 */
export const AnimationUtils = {
  /**
   * Ejecuta una función después de un número específico de frames
   * @param {Function} callback - Función a ejecutar
   * @param {number} frames - Número de frames a esperar (por defecto 1)
   */
  executeAfterFrames(callback, frames = 1) {
    if (frames <= 0 || !callback) {
      callback?.();
      return;
    }
    
    let framesElapsed = 0;
    
    const frameCallback = () => {
      framesElapsed++;
      if (framesElapsed >= frames) {
        callback();
      } else {
        requestAnimationFrame(frameCallback);
      }
    };
    
    requestAnimationFrame(frameCallback);
  },
  
  /**
   * Ejecuta una función después de un tiempo aproximado en milisegundos
   * @param {Function} callback - Función a ejecutar
   * @param {number} ms - Milisegundos a esperar
   */
  executeAfterTime(callback, ms = 0) {
    if (ms <= 0 || !callback) {
      callback?.();
      return;
    }
    
    const startTime = performance.now();
    
    const checkTime = () => {
      const elapsed = performance.now() - startTime;
      if (elapsed >= ms) {
        callback();
      } else {
        requestAnimationFrame(checkTime);
      }
    };
    
    requestAnimationFrame(checkTime);
  },
  
  /**
   * Crea una promesa que se resuelve después de un tiempo específico
   * @param {number} ms - Milisegundos a esperar
   * @returns {Promise} - Promesa que se resuelve después del tiempo especificado
   */
  delay(ms) {
    return new Promise(resolve => {
      this.executeAfterTime(resolve, ms);
    });
  }
};