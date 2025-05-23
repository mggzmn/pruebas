/**
 * Utilidades para manejar IDs de sección compuestos
 */
export class SectionIdUtils {
  /**
   * Crea un ID compuesto de sección
   * @param {string} pageId - ID de la página
   * @param {string} sectionId - ID de la sección
   * @returns {string} - ID compuesto (pageId_sectionId)
   */
  static createCompoundId(pageId, sectionId) {
    if (!pageId || !sectionId) return sectionId;
    return `${pageId}_${sectionId}`;
  }

  /**
   * Extrae el ID de sección de un ID compuesto
   * @param {string} compoundId - ID compuesto (pageId_sectionId)
   * @returns {string} - ID de sección
   */
  static extractSectionId(compoundId) {
    if (!compoundId) return "";
    const strId = String(compoundId);
    const parts = strId.split("_");
    return parts.length > 1 ? parts[1] : strId;
  }

  /**
   * Extrae el ID de página de un ID compuesto
   * @param {string} compoundId - ID compuesto (pageId_sectionId)
   * @returns {string} - ID de página
   */
  static extractPageId(compoundId) {
    if (!compoundId) return "";
    const parts = compoundId.split("_");
    return parts.length > 1 ? parts[0] : "";
  }

  /**
   * Verifica si un ID es un ID compuesto
   * @param {string} id - ID a verificar
   * @returns {boolean} - Si es un ID compuesto
   */
  /**
   * Verifica si un ID es compuesto (contiene un prefijo de página)
   * @param {string} id - El ID a verificar
   * @returns {boolean} - Verdadero si el ID es compuesto
   */
  static isCompoundId(id) {
      // Verificar que id sea una cadena de texto antes de usar includes
      if (typeof id !== 'string') {
          return false;
      }
      
      return id.includes('_');
  }

  /**
   * Verifica si un ID compuesto pertenece a una página específica
   * @param {string} compoundId - ID compuesto a verificar
   * @param {string} pageId - ID de página a comparar
   * @returns {boolean} - Si el ID pertenece a la página
   */
  static belongsToPage(compoundId, pageId) {
    if (!compoundId || !pageId) return false;
    return compoundId.startsWith(`${pageId}_`);
  }

  /**
   * Compara dos IDs de sección para determinar si se refieren a la misma sección
   * @param {string} id1 - Primer ID de sección
   * @param {string} id2 - Segundo ID de sección
   * @param {string} [pageId] - ID de la página (opcional, para contextualizar)
   * @returns {boolean} - Si los IDs se refieren a la misma sección
   */
  static isSameSectionId(id1, id2, pageId) {
    // Si son iguales literalmente, devolver true inmediatamente
    if (id1 === id2) return true;
    
    // Si alguno es nulo o vacío, no pueden ser iguales
    if (!id1 || !id2) return false;
    
    // Extraer los IDs base (sin prefijos de página)
    const baseId1 = this.extractSectionId(id1);
    const baseId2 = this.extractSectionId(id2);
    
    // Si los IDs base coinciden, son la misma sección
    if (baseId1 === baseId2) return true;
    
    // Si se proporciona pageId, verificar con IDs normalizados
    if (pageId) {
      const normalizedId1 = this.normalizeId(id1, pageId);
      const normalizedId2 = this.normalizeId(id2, pageId);
      return normalizedId1 === normalizedId2;
    }
    
    return false;
  }

  /**
   * Normaliza un ID de sección asegurando que tenga el formato pageId_sectionId
   * @param {string} sectionId - ID de sección original
   * @param {string} pageId - ID de la página
   * @returns {string} - ID compuesto normalizado
   */
  /**
   * Normaliza los IDs de sección combinando el ID de página y el ID de sección
   * @param {string} sectionId - El ID de la sección
   * @param {string} pageId - El ID de la página
   * @returns {string} - ID normalizado en formato "pageId_sectionId"
   */
  static normalizeId(sectionId, pageId) {
      // Verificar que ambos parámetros sean cadenas de texto
      if (!sectionId || !pageId || typeof sectionId !== 'string' || typeof pageId !== 'string') {
          return sectionId;
      }
      
      // Si ya es un ID compuesto, verificar si ya tiene el prefijo correcto
      if (this.isCompoundId(sectionId)) {
          // Si ya tiene el prefijo correcto, devolverlo tal cual
          if (sectionId.startsWith(`${pageId}_`)) {
              return sectionId;
          }
          
          // Si tiene otro prefijo, extraer la parte base
          const parts = sectionId.split('_');
          return `${pageId}_${parts[parts.length - 1]}`;
      }
      
      // Si no es compuesto, simplemente agregar el prefijo
      return `${pageId}_${sectionId}`;
  }

  /**
   * Extrae el ID limpio (sin prefijo de página) de un ID de sección
   * @param {string} id - ID original que puede contener prefijo de página
   * @returns {string} - ID limpio
   */
  static extractCleanId(id) {
    return this.extractSectionId(id);
  }
}
