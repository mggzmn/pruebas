export class TableOfContentsView {
  constructor() {
    this.element = null;
    this.onPageSelected = null;
    this.onSectionSelected = null;
    this.navigationListener = null;
    this.outsideClickListener = null;
    this.toggleButtonListener = null;
  }

  initialize(containerId = "table-of-contents") {
    this.element = document.getElementById(containerId);
    if (!this.element) {
      this.element = document.createElement("div");
      this.element.id = containerId;
      this.element.classList.add("toc");
      document.body.appendChild(this.element);
    }

    this.element.addEventListener("click", (event) => this._handleClick(event));

    // Corregir la gestión de eventos de clic fuera del TOC
    document.addEventListener("click", (event) => {
      // No ejecutar si no se hace clic fuera del TOC o en el botón
      if (this.element.contains(event.target) || event.target.matches("#btn-TOC")) {
        return;
      }
      
      if (this.isVisible() && this.outsideClickListener) {
        console.log("TOC: Detected outside click, calling outsideClickListener");
        this.outsideClickListener();
      }
    });

    // Ya no necesitamos configurar el botón TOC aquí - eso lo hace NavigationManager
  }

  _handleClick(event) {
    const target = event.target;

    event.stopPropagation();

    if (target.classList.contains("toc-page") && !target.classList.contains("disabled")) {
      const pageIndex = parseInt(target.dataset.pageIndex, 10);
      if (this.onPageSelected) {
        this.onPageSelected(pageIndex);
      }
    } else if (target.classList.contains("toc-section") && !target.classList.contains("disabled")) {
      const pageIndex = parseInt(target.closest(".toc-page-item").dataset.pageIndex, 10);
      const sectionId = target.dataset.sectionId;
      if (this.onSectionSelected) {
        this.onSectionSelected(pageIndex, sectionId);
      }
    }
  }

  setNavigationListener(callback) {
    this.navigationListener = callback;
  }

  setOutsideClickListener(callback) {
    this.outsideClickListener = callback;
  }

  setToggleButtonListener(callback) {
    // IMPORTANTE: almacenar la referencia real a la función, no su resultado
    this.toggleButtonListener = callback;
    
    // Si queremos asignar de nuevo al botón del TOC, aquí podemos hacerlo
    // const tocButton = document.getElementById("btn-TOC");
    // if (tocButton && this.toggleButtonListener) {
    //   tocButton.addEventListener("click", this.toggleButtonListener);
    // }
  }

  setPageSelectedCallback(callback) {
    this.onPageSelected = callback;
  }

  setSectionSelectedCallback(callback) {
    this.onSectionSelected = callback;
  }

  render(pages, sections, modules) {
    if (!this.element) return;

    this.element.innerHTML = "";
    const toc = document.createElement("div");
    toc.classList.add("toc-content");

    const header = document.createElement("div");
    header.classList.add("toc-header");
    header.textContent = "Contenido";
    toc.appendChild(header);

    // Agrupar páginas por módulo
    const moduleGroups = this._groupByModule(pages, modules);

    // Para cada módulo crear una sección
    for (const [moduleId, modulePages] of Object.entries(moduleGroups)) {
      const moduleTitle = modules[moduleId]?.title || "Módulo";

      const moduleElement = document.createElement("div");
      moduleElement.classList.add("toc-module");
      moduleElement.dataset.moduleId = moduleId;

      const moduleHeader = document.createElement("div");
      moduleHeader.classList.add("toc-module-header");
      moduleHeader.textContent = moduleTitle;
      moduleElement.appendChild(moduleHeader);

      const pagesContainer = document.createElement("div");
      pagesContainer.classList.add("toc-pages");

      // Añadir páginas para este módulo
      modulePages.forEach((page) => {
        // Crear elemento de página con o sin secciones
        const pageItem = this._createPageItem(page, sections);
        pagesContainer.appendChild(pageItem);
      });

      moduleElement.appendChild(pagesContainer);
      toc.appendChild(moduleElement);
    }

    this.element.appendChild(toc);
  }

  _groupByModule(pages, modules) {
    // Agrupar páginas por módulo
    const moduleGroups = {};

    pages.forEach((page) => {
      const moduleId = page.moduleId || "default";
      if (!moduleGroups[moduleId]) {
        moduleGroups[moduleId] = [];
      }
      moduleGroups[moduleId].push(page);
    });

    return moduleGroups;
  }

  _createPageItem(page, sections) {
    // Crear elemento de página con secciones si están disponibles
    const pageItem = document.createElement("div");
    pageItem.classList.add("toc-page-item");
    pageItem.dataset.pageIndex = page.index;

    const pageTitle = document.createElement("div");
    pageTitle.classList.add("toc-page");
    pageTitle.dataset.pageIndex = page.index;
    pageTitle.textContent = page.title || `Page ${page.index}`;
    
    // Si la página tiene secciones, siempre mostramos el título de la página
    // pero solo se habilita cuando todas las secciones están completadas
    pageTitle.classList.toggle("disabled", !page.completed);
    pageItem.appendChild(pageTitle);

    // Si la página tiene secciones, añadirlas
    const pageSections = sections[page.index];
    if (page.hasSections && pageSections && pageSections.length > 0) {
      const sectionsContainer = document.createElement("div");
      sectionsContainer.classList.add("toc-sections");

      pageSections.forEach((section) => {
        const sectionItem = this._createSectionItem(section);
        sectionsContainer.appendChild(sectionItem);
      });

      pageItem.appendChild(sectionsContainer);
    }

    return pageItem;
  }

  _createSectionItem(section) {
    const sectionItem = document.createElement("div");
    sectionItem.classList.add("toc-section");
    sectionItem.dataset.sectionId = section.id;
    sectionItem.textContent = section.title;
    
    // Deshabilitada hasta que se completa
    sectionItem.classList.toggle("disabled", !section.completed);
    return sectionItem;
  }

  updateSectionStatus(pageIndex, sectionId, completed) {
    if (!this.element) return;

    const sectionElement = this.element.querySelector(
      `.toc-page-item[data-page-index="${pageIndex}"] .toc-section[data-section-id="${sectionId}"]`
    );

    if (sectionElement) {
      sectionElement.classList.toggle("disabled", !completed);
    }
  }

  updatePageStatus(pageIndex, completed) {
    if (!this.element) return;

    const pageElement = this.element.querySelector(
      `.toc-page[data-page-index="${pageIndex}"]`
    );

    if (pageElement) {
      pageElement.classList.toggle("disabled", !completed);
    }
  }

  /**
   * Deshabilita una página y sus secciones en el TOC
   * @param {number} pageIndex - Índice de la página a deshabilitar
   */
  disablePageWithSections(pageIndex) {
    const pageElement = this.element.querySelector(`.toc-page-item[data-page-index="${pageIndex}"] .toc-page`);
    if (pageElement) {
      pageElement.classList.add("disabled");
      const sectionElements = pageElement.closest(".toc-page-item").querySelectorAll(".toc-section");
      sectionElements.forEach((section) => section.classList.add("disabled"));
    }
  }

  show() {
    if (this.element) {
      console.log("TOC View: Adding toc-visible class");
      
      // Forzar un reflow antes de agregar la clase para asegurar transición
      void this.element.offsetHeight;
      
      // Hacer visible primero usando visibility
      this.element.style.visibility = 'visible';
      
      // Luego en el siguiente frame agregar la clase para la animación
      window.requestAnimationFrame(() => {
        this.element.classList.add("toc-visible");
        console.log("TOC View: Is visible after show():", this.isVisible());
      });
      
      // Desencadenar evento para debugging
      document.dispatchEvent(new CustomEvent('toc-visibility-changed', { detail: { visible: true } }));
    }
  }

  hide() {
    if (this.element) {
      console.log("TOC View: Removing toc-visible class");
      
      // Primero remover la clase para iniciar transición
      this.element.classList.remove("toc-visible");
      
      // Después de la transición, ocultar completamente
      setTimeout(() => {
        if (!this.element.classList.contains('toc-visible')) {
          this.element.style.visibility = 'hidden';
        }
      }, 300); // Tiempo igual a la duración de la transición CSS
      
      console.log("TOC View: Is visible after hide():", this.isVisible());
      
      // Desencadenar evento para debugging
      document.dispatchEvent(new CustomEvent('toc-visibility-changed', { detail: { visible: false } }));
    }
  }

  isVisible() {
    return this.element?.classList.contains("toc-visible") || false;
  }
}