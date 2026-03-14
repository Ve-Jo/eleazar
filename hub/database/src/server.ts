import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import Database from "./client.ts";
import { DEFAULT_SERVICE_PORTS } from "../../shared/src/serviceConfig.ts";
import { createHealthResponse } from "../../shared/src/utils.ts";
import userRoutes from "./routes/users.ts";
import economyRoutes from "./routes/economy.ts";
import gameRoutes from "./routes/games.ts";
import statsRoutes from "./routes/stats.ts";
import marriageRoutes from "./routes/marriage.ts";
import musicRoutes from "./routes/music.ts";
import cacheRoutes from "./routes/cache.ts";
import xpRoutes from "./routes/xp.ts";
import cooldownRoutes from "./routes/cooldowns.ts";
import guildRoutes from "./routes/guilds.ts";
import voiceRoutes from "./routes/voice.ts";
import levelRoutes from "./routes/levels.ts";
import cryptoRoutes from "./routes/crypto.ts";
import cryptoWalletRoutes from "./routes/cryptoWallet.ts";
import transactionRoutes from "./routes/transactions.ts";
import crateRoutes from "./routes/crates.ts";
import seasonRoutes from "./routes/seasons.ts";
import guildVaultRoutes from "./routes/guildVault.ts";

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
  process.env.DATABASE_SERVICE_PORT || DEFAULT_SERVICE_PORTS.database
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
  res.json(createHealthResponse("database", "1.0.0"));
});

// Routes
app.use("/users", userRoutes);
app.use("/economy", economyRoutes);
app.use("/games", gameRoutes);
app.use("/stats", statsRoutes);
app.use("/marriage", marriageRoutes);
app.use("/music", musicRoutes);
app.use("/cache", cacheRoutes);
app.use("/xp", xpRoutes);
app.use("/cooldowns", cooldownRoutes);
app.use("/guilds", guildRoutes);
app.use("/voice", voiceRoutes);
app.use("/levels", levelRoutes);
app.use("/crypto", cryptoRoutes);
app.use("/crypto-wallet", cryptoWalletRoutes);
app.use("/transactions", transactionRoutes);
app.use("/crates", crateRoutes);
app.use("/seasons", seasonRoutes);
app.use("/guild-vault", guildVaultRoutes);

// 404 handler
app.use("*", (_req: RequestLike, res: ResponseLike) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Error handling middleware
app.use((error: Error, _req: RequestLike, res: ResponseLike, _next: NextFunctionLike) => {
  console.error("Database service error:", error);
  res.status(500).json({
    error: "Internal server error",
    message:
      process.env.NODE_ENV === "development"
        ? error.message
        : "Something went wrong",
  });
});

// Initialize database and start server
async function startServer() {
  try {
    await Database.initialize();
    app.listen(PORT, () => {
      console.log(`🗄️ Database service running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error("Failed to initialize database service:", error);
    process.exit(1);
  }
}

startServer();
