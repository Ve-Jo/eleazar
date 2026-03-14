import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import i18nRoutes from "./routes/i18n.ts";
import { DEFAULT_SERVICE_PORTS } from "../../shared/src/serviceConfig.ts";
import { createHealthResponse } from "../../shared/src/utils.ts";

type RequestLike = {
  method: string;
  path: string;
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (body: unknown) => ResponseLike;
};

type NextFunctionLike = () => void;

dotenv.config({ path: "../.env" });

const app = express();
const PORT = Number(
  process.env.LOCALIZATION_SERVICE_PORT || DEFAULT_SERVICE_PORTS.localization
);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Request logging
app.use((req: RequestLike, _res: ResponseLike, next: NextFunctionLike) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get("/health", (_req: RequestLike, res: ResponseLike) => {
  res.json(createHealthResponse("localization", "1.0.0"));
});

// Routes
app.use("/i18n", i18nRoutes);

// 404 handler
app.use("*", (_req: RequestLike, res: ResponseLike) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Error handling middleware
app.use((error: Error, _req: RequestLike, res: ResponseLike, _next: NextFunctionLike) => {
  console.error("Localization service error:", error);
  res.status(500).json({
    error: "Internal server error",
    message:
      process.env.NODE_ENV === "development"
        ? error.message
        : "Something went wrong",
  });
});

app.listen(PORT, () => {
  console.log(`🌐 Localization service running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
