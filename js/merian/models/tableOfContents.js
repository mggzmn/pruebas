export class TableOfContentsModel {
  constructor() {
    this.pages = [];
    this.sections = {};
    this.currentPageIndex = 0;
    this.modules = {};
  }

  setModules(modules) {
    this.modules = modules;
  }

  getModuleTitle(moduleId) {
    return this.modules[moduleId]?.title || "Módulo";
  }

  initializeFromPages(pages, modules) {
    this.modules = modules || {};
    
    this.pages = pages.map((page, index) => {
      // Omitir la página de portada (índice 0)
      if (index === 0) return null;
      
      return {
        id: page.id || `page-${index}`,
        index,
        title: page.title || `Lección ${index}`,
        moduleId: page.moduleId || 'default',
        completed: page.completed || false,
        hasSections: page.sections || false
      };
    }).filter(page => page !== null); // Eliminar entradas nulas (portada)
  }

  setCurrentPage(pageIndex) {
    this.currentPageIndex = pageIndex;
  }

  getCurrentPageIndex() {
    return this.currentPageIndex;
  }

  updatePageStatus(pageIndex, completed) {
    // Buscar la página por índice en nuestro array de páginas
    const pageItem = this.pages.find(page => page.index === pageIndex);
    if (pageItem) {
      pageItem.completed = completed;
    }
  }

  setSections(pageIndex, sections) {
    if (pageIndex <= 0) return;
    
    // Buscar la página por índice
    const pageItem = this.pages.find(page => page.index === pageIndex);
    if (!pageItem) return;
    
    pageItem.hasSections = true;
    
    // Creamos un ID único para cada sección combinando la página y la sección
    this.sections[pageIndex] = sections.map(section => ({
      id: section.id,
      title: section.title,
      // Crear un ID único para cada sección
      uniqueId: `page${pageIndex}_${section.id}`,
      completed: section.completed || false
    }));
  }

  getSections(pageIndex) {
    return this.sections[pageIndex] || [];
  }

  // Actualizar el estado de una sección específica
  updateSectionStatus(pageIndex, sectionId, completed) {
    const sections = this.sections[pageIndex];
    if (!sections) return;

    const sectionIndex = sections.findIndex(s => s.id === sectionId);
    if (sectionIndex !== -1) {
      sections[sectionIndex].completed = completed;
    }
  }

  // Verificar si una sección específica está completada
  isSectionCompleted(pageIndex, sectionId) {
    const sections = this.sections[pageIndex];
    if (!sections) return false;

    const section = sections.find(s => s.id === sectionId);
    return section ? section.completed : false;
  }

  // Verificar si todas las secciones de una página están completadas
  areAllSectionsCompleted(pageIndex) {
    const sections = this.sections[pageIndex];
    if (!sections || sections.length === 0) return false;
    
    return sections.every(section => section.completed);
  }
  
  // Buscar una sección por su ID único
  findSectionByUniqueId(uniqueId) {
    // El formato es page{pageIndex}_{sectionId}
    if (!uniqueId || !uniqueId.includes('_')) return null;
    
    const parts = uniqueId.split('_');
    const pageIndexStr = parts[0].replace('page', '');
    const sectionId = parts[1];
    
    const pageIndex = parseInt(pageIndexStr, 10);
    if (isNaN(pageIndex)) return null;
    
    const sections = this.sections[pageIndex];
    if (!sections) return null;
    
    const section = sections.find(s => s.id === sectionId);
    if (!section) return null;
    
    return {
      pageIndex,
      sectionId,
      section
    };
  }
}