/**
 * SlideRenderer - Clase responsable de cargar y procesar slides HTML
 * Se encarga de extraer estilos/scripts y manipular el DOM
 */
export class SlideRenderer {
  constructor() {
    this.injectedStyleTags = [];
    this.injectedScriptTags = [];
    this.container = document.getElementById("slide-container");
  }

  /**
   * Limpia el contenedor y elimina scripts/estilos inyectados previamente
   */
  clearSlide() {
    if (this.container) {
      this.container.innerHTML = "";
    }

    this.injectedStyleTags.forEach((styleEl) => {
      if (styleEl.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
      }
    });
    this.injectedStyleTags = [];

    this.injectedScriptTags.forEach((scriptEl) => {
      if (scriptEl.parentNode) {
        scriptEl.parentNode.removeChild(scriptEl);
      }
    });
    this.injectedScriptTags = [];
  }

  /**
   * Carga un slide desde una URL
   * @param {string} url - URL del slide a cargar
   * @returns {Promise} - Promise que se resuelve cuando el slide está cargado
   */
  loadSlide(url) {
    return new Promise((resolve, reject) => {
      this.clearSlide();

      this.fetchSlideContent(url)
        .then((responseText) => {
          const parser = new DOMParser();
          const doc = parser.parseFromString(responseText, "text/html");
          const styleTags = doc.querySelectorAll("head style");
          const scriptTags = doc.querySelectorAll("body script");
          const bodyElement = doc.body;
          this.injectStyles(styleTags);
          this.injectContent(bodyElement);
          this.injectScripts(scriptTags);
          
          resolve();
        })
        .catch((error) => {
          console.error("Error loading slide:", error);
          reject(error);
        });
    });
  }

  /**
   * Obtiene el contenido de un slide desde una URL
   * @param {string} url - URL del slide
   * @returns {Promise<string>} - Promise con el contenido del slide
   */
  fetchSlideContent(url) {
    return fetch(url).then((response) => response.text());
  }

  /**
   * Inserta los estilos en el head del documento
   * @param {NodeList} styleTags - Lista de etiquetas style a insertar
   */
  injectStyles(styleTags) {
    styleTags.forEach((styleElement) => {
      const newStyle = document.createElement("style");
      newStyle.textContent = styleElement.textContent;
      document.head.appendChild(newStyle);
      this.injectedStyleTags.push(newStyle);
    });
  }

  /**
   * Inserta el contenido limpio en el contenedor de slides
   * @param {HTMLElement} bodyElement - Elemento body del cual extraer el contenido
   */
  injectContent(bodyElement) {
    if (!this.container) {
      console.error("Slide container not found!");
      return;
    }
    this.container.innerHTML = ""; // Limpiar el contenedor

    // Iterar sobre los nodos hijos del body del slide cargado
    Array.from(bodyElement.childNodes).forEach((node) => {
      // Verify if it's a script containing JSON configuration
      if (node.nodeType === Node.ELEMENT_NODE && node.tagName === "SCRIPT" && node.getAttribute("type") === "application/json") {
        try {
          // Preserve JSON configs by cloning and appending them correctly
          const clonedNode = node.cloneNode(true);
          this.container.appendChild(clonedNode);
          console.log(`Injected JSON configuration script: ${node.id}`);
        } catch (error) {
          console.error("Error cloning or appending JSON config:", node, error);
        }
      }
      // Handle regular content elements (not scripts)
      else if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== "SCRIPT") {
        try {
          const clonedNode = node.cloneNode(true);
          this.container.appendChild(clonedNode);
        } catch (error) {
          console.error("Error cloning or appending node:", node, error);
        }
      }
    });
    console.log("Slide content injected.");
  }

  /**
   * Inserta los scripts en el body del documento
   * @param {NodeList} scriptTags - Lista de etiquetas script a insertar
   */
  injectScripts(scriptTags) {
    scriptTags.forEach((scriptElement) => {
      // Verifica el tipo de script para manejar configuraciones JSON de forma diferente
      const scriptType = scriptElement.getAttribute("type");
      
      // If it's a JSON script, don't try to execute it
      if (scriptType === "application/json") {
        // Si es un script JSON, simplemente clonarlo directamente
        const clonedNode = scriptElement.cloneNode(true);
        document.body.appendChild(clonedNode);
        this.injectedScriptTags.push(clonedNode);
        return;
      }
      
      // Scripts JavaScript regulares - envolver en IIFE
      const newScript = document.createElement("script");
      const scriptContent = scriptElement.textContent;
      
      // Solo envolver en IIFE si es JavaScript ejecutable
      newScript.textContent = `
          (function() { 
            ${scriptContent} 
          })();
        `;

      document.body.appendChild(newScript);
      this.injectedScriptTags.push(newScript);
    });
  }
}
