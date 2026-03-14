import express from "express";
import cors from "cors";
import helmet from "helmet";
import { generateImage, processImageColors } from "./utils/imageGenerator.ts";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import { DEFAULT_SERVICE_PORTS } from "../../shared/src/serviceConfig.ts";
import { createHealthResponse } from "../../shared/src/utils.ts";

type RequestLike = {
  method: string;
  path: string;
  body?: Record<string, unknown>;
};

type GenerateImageBody = {
  component?: string;
  props?: Record<string, unknown>;
  scaling?: {
    image: number;
    emoji: number;
    debug: boolean;
  };
  locale?: string;
  options?: Record<string, unknown>;
};

type ImageColorsBody = {
  imageUrl?: string;
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (body: unknown) => ResponseLike;
  send: (body: unknown) => ResponseLike;
  set: (header: string, value: string) => ResponseLike;
};

type NextFunctionLike = () => void;

dotenv.config({ path: "../.env" });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(
  process.env.RENDERING_SERVICE_PORT || DEFAULT_SERVICE_PORTS.rendering
);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Serve static files
app.use("/public", express.static(path.join(__dirname, "..", "public")));

// Request logging
app.use((req: RequestLike, _res: ResponseLike, next: NextFunctionLike) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get("/health", (_req: RequestLike, res: ResponseLike) => {
  res.json(createHealthResponse("rendering", "1.0.0"));
});

// Image generation endpoint
app.post("/generate", async (req: RequestLike, res: ResponseLike) => {
  try {
    const { component, props, scaling, locale, options } =
      (req.body as GenerateImageBody | undefined) ?? {};

    if (!component) {
      return res.status(400).json({ error: "Component is required" });
    }

    // Create i18n mock object
    const i18n = {
      getLocale: () => locale || "en",
      __: (key: string, ..._args: unknown[]) => {
        // Simple fallback - in production you might want to load actual translations
        return key;
      },
    };

    const result = await generateImage(
      component,
      props || {},
      scaling || { image: 1, emoji: 1, debug: false },
      i18n,
      options || {}
    );

    if (Buffer.isBuffer(result)) {
      res.set("Content-Type", "image/png");
      res.send(result);
    } else if (Array.isArray(result)) {
      // If returnDominant is true, result is [buffer, coloring]
      const [buffer, coloring] = result as [Buffer, unknown];
      res.json({
        image: buffer.toString("base64"),
        coloring,
      });
    } else {
      res.status(500).json({ error: "Invalid result format" });
    }
  } catch (error) {
    const typedError = error as Error;
    console.error("Error generating image:", error);
    res.status(500).json({
      error: "Failed to generate image",
      message:
        process.env.NODE_ENV === "development"
          ? typedError.message
          : "Image generation failed",
    });
  }
});

// Color processing endpoint
app.post("/colors", async (req: RequestLike, res: ResponseLike) => {
  try {
    const { imageUrl } = (req.body as ImageColorsBody | undefined) ?? {};

    if (!imageUrl) {
      return res.status(400).json({ error: "imageUrl is required" });
    }

    const colors = await processImageColors(imageUrl);
    res.json(colors);
  } catch (error) {
    const typedError = error as Error;
    console.error("Error processing colors:", error);
    res.status(500).json({
      error: "Failed to process colors",
      message:
        process.env.NODE_ENV === "development"
          ? typedError.message
          : "Color processing failed",
    });
  }
});

// List available components
app.get("/components", async (_req: RequestLike, res: ResponseLike) => {
  try {
    const componentsDir = path.join(__dirname, "components");
    const files = await fs.readdir(componentsDir);
    const components = files
      .filter((file) => file.endsWith(".jsx"))
      .map((file) => file.replace(".jsx", ""));

    res.json({ components });
  } catch (error) {
    console.error("Error listing components:", error);
    res.status(500).json({ error: "Failed to list components" });
  }
});

// 404 handler
app.use("*", (_req: RequestLike, res: ResponseLike) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Error handling middleware
app.use((error: Error, _req: RequestLike, res: ResponseLike, _next: NextFunctionLike) => {
  console.error("Rendering service error:", error);
  res.status(500).json({
    error: "Internal server error",
    message:
      process.env.NODE_ENV === "development"
        ? error.message
        : "Something went wrong",
  });
});

app.listen(PORT, () => {
  console.log(`🎨 Rendering service running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🖼️  Static files: http://localhost:${PORT}/public`);
});
