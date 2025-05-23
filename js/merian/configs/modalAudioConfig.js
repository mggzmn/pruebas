/**
 * Configuración de audio y eventos para modales
 * Cada modal puede tener su propio archivo de audio, eventos de tiempo y acciones
 */
export const ModalAudioConfig = {
  // Modal: El Pedido Fantasma
  "modal-pedido-fantasma": {
    audioSource: "multimedia/audio/06_intro_interactividad_3.mp3", // Ruta absoluta desde la raíz del sitio
    autoClose: true, // Permitir configurar si el modal se cierra automáticamente
    autoCloseDelay: 1500, // Tiempo en milisegundos antes de cerrar automáticamente
    events: [
      {
        time: 1,
        actions: [
          { type: "addClass", targetId: "modal-pedido-fantasma", classes: ["animate"] }
        ]
      },
      {
        time: 3,
        actions: [
          { type: "addClass", targetSelector: "#modal-pedido-fantasma .modal-title", classes: ["visible"] }
        ]
      },
      {
        time: 5,
        actions: [
          { type: "addClass", targetSelector: "#modal-pedido-fantasma .modal-subtitle", classes: ["visible"] }
        ]
      },
      {
        time: 7,
        actions: [
          { type: "addClass", targetSelector: "#modal-pedido-fantasma .modal-text", classes: ["visible"] }
        ]
      }
    ],
    onEndActions: [
      { type: "markModalAsViewed", modalId: "modal-pedido-fantasma" }
    ]
  },
  
  // Modal: Superhéroe Bancario
  "modal-superheroe-bancario": {
    audioSource: "multimedia/audio/06_intro_interactividad_3.mp3",
    autoClose: true,
    autoCloseDelay: 1500,
    events: [
      {
        time: 1,
        actions: [
          { type: "addClass", targetId: "modal-superheroe-bancario", classes: ["animate"] }
        ]
      },
      {
        time: 3,
        actions: [
          { type: "addClass", targetSelector: "#modal-superheroe-bancario .modal-title", classes: ["visible"] }
        ]
      },
      {
        time: 5,
        actions: [
          { type: "addClass", targetSelector: "#modal-superheroe-bancario .modal-subtitle", classes: ["visible"] }
        ]
      },
      {
        time: 7,
        actions: [
          { type: "addClass", targetSelector: "#modal-superheroe-bancario .modal-text", classes: ["visible"] }
        ]
      }
    ],
    onEndActions: [
      { type: "markModalAsViewed", modalId: "modal-superheroe-bancario" }
    ]
  },
  
  // Modal: Eres el Ganador
  "modal-eres-ganador": {
    audioSource: "multimedia/audio/06_intro_interactividad_3.mp3",
    autoClose: true,
    autoCloseDelay: 1500,
    events: [
      {
        time: 1,
        actions: [
          { type: "addClass", targetId: "modal-eres-ganador", classes: ["animate"] }
        ]
      },
      {
        time: 3,
        actions: [
          { type: "addClass", targetSelector: "#modal-eres-ganador .modal-title", classes: ["visible"] }
        ]
      },
      {
        time: 5,
        actions: [
          { type: "addClass", targetSelector: "#modal-eres-ganador .modal-subtitle", classes: ["visible"] }
        ]
      },
      {
        time: 7,
        actions: [
          { type: "addClass", targetSelector: "#modal-eres-ganador .modal-text", classes: ["visible"] }
        ]
      }
    ],
    onEndActions: [
      { type: "markModalAsViewed", modalId: "modal-eres-ganador" }
    ]
  },
  
  // Modal: Eres el Ganador 2
  "modal-eres-ganador2": {
    audioSource: "multimedia/audio/06_intro_interactividad_3.mp3",
    autoClose: true,
    autoCloseDelay: 1500,
    events: [
      {
        time: 1,
        actions: [
          { type: "addClass", targetId: "modal-eres-ganador2", classes: ["animate"] }
        ]
      }
    ],
    onEndActions: [
      { type: "markModalAsViewed", modalId: "modal-eres-ganador2" }
    ]
  },
  
  // Modal: Eres el Ganador 3
  "modal-eres-ganador3": {
    audioSource: "multimedia/audio/06_intro_interactividad_3.mp3",
    autoClose: true,
    autoCloseDelay: 1500,
    events: [
      {
        time: 1,
        actions: [
          { type: "addClass", targetId: "modal-eres-ganador3", classes: ["animate"] }
        ]
      }
    ],
    onEndActions: [
      { type: "markModalAsViewed", modalId: "modal-eres-ganador3" }
    ]
  }
};