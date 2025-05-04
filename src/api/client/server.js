import express from "express";
import clientApiRouter from "./router.js";
import { authenticateApiKey } from "./middleware.js";

const API_PORT = process.env.BOT_API_PORT || 3005; // Use port from env or default 3005

if (!process.env.VITE_DISCORD_CLIENT_SECRET) {
  // Check the correct env var name
  console.warn(
    "[API Server] WARNING: No VITE_DISCORD_CLIENT_SECRET found in .env. Authentication may fail or use default key. This is insecure for production!"
  );
}

const app = express();

// --- Middleware ---
app.use(express.json()); // Parse JSON request bodies

// --- Health Check Route (before auth) ---
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// --- API Routes ---
// Apply authentication middleware specifically to the client API routes
app.use("/api", authenticateApiKey, clientApiRouter);

// Optional: Add other routers here if needed (e.g., for internal bot stats)
// app.use('/internal', internalRouter);

// --- Error Handling Middleware (Example) ---
app.use((err, req, res, next) => {
  console.error("[API Server] Unhandled Error:", err.stack);
  res.status(500).json({ error: "Internal Server Error" });
});

// --- Start Server Function ---
export function startApiClientServer() {
  try {
    app.listen(API_PORT, () => {
      console.log(
        `[API Server - Client] Listening on http://localhost:${API_PORT}`
      );
    });
  } catch (error) {
    console.error("[API Server - Client] Failed to start:", error);
    // Optional: exit process or handle error differently
    process.exit(1);
  }
}
