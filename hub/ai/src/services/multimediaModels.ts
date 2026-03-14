type ModelCapabilities = {
  vision: boolean;
  tools: boolean;
  reasoning: boolean;
  image_generation: boolean;
  speech_recognition: boolean;
  maxContext: number;
};

type ModelPricing = {
  prompt: number;
  completion: number;
};

type MultimediaModel = {
  id: string;
  name: string;
  provider: string;
  capabilities: ModelCapabilities;
  pricing: ModelPricing;
  active: boolean;
  isPreferred: boolean;
  description?: string;
  supportedSizes?: string[];
  pricingBySize?: Record<string, number>;
  maxSteps?: number;
  pricingUnit?: string;
};

const IMAGE_GENERATION_MODELS: MultimediaModel[] = [
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
      prompt: 0.015,
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
      prompt: 0.009,
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
      prompt: 0.009,
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
      prompt: 0.005,
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

const SPEECH_RECOGNITION_MODELS: MultimediaModel[] = [
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
      maxContext: 1500000,
    },
    pricing: {
      prompt: 0.04,
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
      maxContext: 1500000,
    },
    pricing: {
      prompt: 0.111,
      completion: 0.111,
    },
    active: true,
    isPreferred: true,
    description:
      "State-of-the-art performance with high accuracy for multilingual transcription and translation",
    pricingUnit: "hour",
  },
];

class MultimediaModelsService {
  imageModels: Map<string, MultimediaModel>;
  speechModels: Map<string, MultimediaModel>;

  constructor() {
    this.imageModels = new Map();
    this.speechModels = new Map();
    this.initializeModels();
  }

  initializeModels() {
    for (const model of IMAGE_GENERATION_MODELS) {
      this.imageModels.set(model.id, model);
    }

    for (const model of SPEECH_RECOGNITION_MODELS) {
      this.speechModels.set(model.id, model);
    }
  }

  getImageGenerationModels() {
    return Array.from(this.imageModels.values());
  }

  getSpeechRecognitionModels() {
    return Array.from(this.speechModels.values());
  }

  getImageGenerationModel(modelId: string) {
    return this.imageModels.get(modelId) || null;
  }

  getSpeechRecognitionModel(modelId: string) {
    return this.speechModels.get(modelId) || null;
  }

  isImageGenerationModel(modelId: string) {
    return this.imageModels.has(modelId);
  }

  isSpeechRecognitionModel(modelId: string) {
    return this.speechModels.has(modelId);
  }

  getAllMultimediaModels() {
    return [
      ...this.getImageGenerationModels(),
      ...this.getSpeechRecognitionModels(),
    ];
  }

  searchMultimediaModels(query: string) {
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

  getMultimediaModelsByProvider(provider: string) {
    const allModels = this.getAllMultimediaModels();
    return allModels.filter((model) => model.provider === provider);
  }

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

  getModelsByProvider(modelsMap: Map<string, MultimediaModel>) {
    const stats: Record<string, number> = {};
    for (const model of modelsMap.values()) {
      if (!stats[model.provider]) {
        stats[model.provider] = 0;
      }
      stats[model.provider] = (stats[model.provider] || 0) + 1;
    }
    return stats;
  }
}

export {
  MultimediaModelsService,
  IMAGE_GENERATION_MODELS,
  SPEECH_RECOGNITION_MODELS,
};
