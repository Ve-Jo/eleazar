/**
 * Hardcoded models for image generation and speech recognition
 * Since providers don't expose these through their model listing APIs
 */

// Image generation models for NanoGPT (based on actual available models)
const IMAGE_GENERATION_MODELS = [
  {
    id: "hidream",
    name: "HiDream",
    provider: "nanogpt",
    capabilities: {
      vision: false,
      tools: false,
      reasoning: false,
      image_generation: true,
      speech_recognition: false,
      maxContext: 4096,
    },
    pricing: {
      prompt: 0.015, // $0.015 per image (based on your pricing)
      completion: 0.015,
    },
    active: true,
    isPreferred: true,
    description:
      "High-quality image generation model with multiple aspect ratios",
    supportedSizes: [
      "1024x1024",
      "768x1360",
      "1360x768",
      "880x1168",
      "1168x880",
      "1248x832",
      "832x1248",
    ],
    maxSteps: 20,
  },
  {
    id: "chroma",
    name: "Chroma",
    provider: "nanogpt",
    capabilities: {
      vision: false,
      tools: false,
      reasoning: false,
      image_generation: true,
      speech_recognition: false,
      maxContext: 4096,
    },
    pricing: {
      prompt: 0.009, // $0.009 per image
      completion: 0.009,
    },
    active: true,
    isPreferred: true,
    description: "Versatile image generation model with various aspect ratios",
    supportedSizes: [
      "1024x1024",
      "512x512",
      "768x1024",
      "576x1024",
      "1024x768",
      "1024x576",
    ],
    maxSteps: 4,
  },
  {
    id: "qwen-image",
    name: "Qwen Image",
    provider: "nanogpt",
    capabilities: {
      vision: false,
      tools: false,
      reasoning: false,
      image_generation: true,
      speech_recognition: false,
      maxContext: 4096,
    },
    pricing: {
      prompt: 0.009, // $0.009 per image
      completion: 0.009,
    },
    active: true,
    isPreferred: true,
    description:
      "Qwen image generation model with auto-sizing and manual options",
    supportedSizes: [
      "auto",
      "1024x1024",
      "512x512",
      "768x1024",
      "576x1024",
      "1024x768",
      "1024x576",
    ],
    maxSteps: 4,
  },
  {
    id: "artiwaifu-diffusion",
    name: "ArtiWaifu Diffusion",
    provider: "nanogpt",
    capabilities: {
      vision: false,
      tools: false,
      reasoning: false,
      image_generation: true,
      speech_recognition: false,
      maxContext: 4096,
    },
    pricing: {
      prompt: 0.005, // $0.005 per image for most sizes
      completion: 0.005,
    },
    active: true,
    isPreferred: true,
    description:
      "Juggernaut XL based model optimized for anime/artistic styles",
    supportedSizes: [
      "1024x1024",
      "1920x1088",
      "1088x1920",
      "768x1024",
      "1024x768",
      "1408x1024",
      "1024x1408",
      "512x512",
      "2048x2048",
    ],
    pricingBySize: {
      "512x512": 0.003,
      "2048x2048": 0.006,
    },
    maxSteps: 20,
  },
];

// Speech recognition models for Groq (based on actual available models)
const SPEECH_RECOGNITION_MODELS = [
  {
    id: "whisper-large-v3-turbo",
    name: "Whisper Large V3 Turbo",
    provider: "groq",
    capabilities: {
      vision: false,
      tools: false,
      reasoning: false,
      image_generation: false,
      speech_recognition: true,
      maxContext: 1500000, // ~25 minutes of audio
    },
    pricing: {
      prompt: 0.04, // $0.04 per hour of audio
      completion: 0.04,
    },
    active: true,
    isPreferred: true,
    description:
      "Fine-tuned version of pruned Whisper Large V3 for fast, multilingual transcription",
    pricingUnit: "hour",
  },
  {
    id: "whisper-large-v3",
    name: "Whisper Large V3",
    provider: "groq",
    capabilities: {
      vision: false,
      tools: false,
      reasoning: false,
      image_generation: false,
      speech_recognition: true,
      maxContext: 1500000, // ~25 minutes of audio
    },
    pricing: {
      prompt: 0.111, // $0.111 per hour of audio
      completion: 0.111,
    },
    active: true,
    isPreferred: true,
    description:
      "State-of-the-art performance with high accuracy for multilingual transcription and translation",
    pricingUnit: "hour",
  },
];

/**
 * Multimedia Models Service
 * Manages hardcoded models for image generation and speech recognition
 */
class MultimediaModelsService {
  constructor() {
    this.imageModels = new Map();
    this.speechModels = new Map();
    this.initializeModels();
  }

  initializeModels() {
    // Initialize image generation models
    for (const model of IMAGE_GENERATION_MODELS) {
      this.imageModels.set(model.id, model);
    }

    // Initialize speech recognition models
    for (const model of SPEECH_RECOGNITION_MODELS) {
      this.speechModels.set(model.id, model);
    }
  }

  /**
   * Get all image generation models
   */
  getImageGenerationModels() {
    return Array.from(this.imageModels.values());
  }

  /**
   * Get all speech recognition models
   */
  getSpeechRecognitionModels() {
    return Array.from(this.speechModels.values());
  }

  /**
   * Get a specific image generation model
   */
  getImageGenerationModel(modelId) {
    return this.imageModels.get(modelId) || null;
  }

  /**
   * Get a specific speech recognition model
   */
  getSpeechRecognitionModel(modelId) {
    return this.speechModels.get(modelId) || null;
  }

  /**
   * Check if a model is an image generation model
   */
  isImageGenerationModel(modelId) {
    return this.imageModels.has(modelId);
  }

  /**
   * Check if a model is a speech recognition model
   */
  isSpeechRecognitionModel(modelId) {
    return this.speechModels.has(modelId);
  }

  /**
   * Get all multimedia models (image + speech)
   */
  getAllMultimediaModels() {
    return [
      ...this.getImageGenerationModels(),
      ...this.getSpeechRecognitionModels(),
    ];
  }

  /**
   * Search multimedia models
   */
  searchMultimediaModels(query) {
    const lowercaseQuery = query.toLowerCase();
    const allModels = this.getAllMultimediaModels();

    return allModels.filter(
      (model) =>
        model.name.toLowerCase().includes(lowercaseQuery) ||
        model.id.toLowerCase().includes(lowercaseQuery) ||
        (model.description &&
          model.description.toLowerCase().includes(lowercaseQuery))
    );
  }

  /**
   * Filter multimedia models by provider
   */
  getMultimediaModelsByProvider(provider) {
    const allModels = this.getAllMultimediaModels();
    return allModels.filter((model) => model.provider === provider);
  }

  /**
   * Get multimedia model statistics
   */
  getMultimediaStats() {
    return {
      imageGeneration: {
        total: this.imageModels.size,
        byProvider: this.getModelsByProvider(this.imageModels),
      },
      speechRecognition: {
        total: this.speechModels.size,
        byProvider: this.getModelsByProvider(this.speechModels),
      },
      total: this.imageModels.size + this.speechModels.size,
    };
  }

  /**
   * Helper method to get models grouped by provider
   */
  getModelsByProvider(modelsMap) {
    const stats = {};
    for (const model of modelsMap.values()) {
      if (!stats[model.provider]) {
        stats[model.provider] = 0;
      }
      stats[model.provider]++;
    }
    return stats;
  }
}

export {
  MultimediaModelsService,
  IMAGE_GENERATION_MODELS,
  SPEECH_RECOGNITION_MODELS,
};
