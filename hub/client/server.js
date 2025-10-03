import express from "express";
import clientApiRouter from "./router.js";
import { authenticateApiKey } from "./middleware.js";
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

const API_PORT = 3006;

if (!process.env.VITE_DISCORD_CLIENT_SECRET) {
  // Check the correct env var name
  console.warn(
    "[API Server] WARNING: No VITE_DISCORD_CLIENT_SECRET found in .env. Authentication may fail or use default key. This is insecure for production!"
  );
}

const app = express();

// Enhanced proxy middleware for Discord's proxy
app.use((req, res, next) => {
  console.log(`[Debug] Incoming request: ${req.method} ${req.url}`);

  // Handle various proxy path formats
  if (req.url.includes("/.proxy")) {
    const originalUrl = req.url;

    // Handle /.proxy/api/... format
    if (req.url.includes("/.proxy/api/")) {
      req.url = req.url.replace("/.proxy/api/", "/api/");
    }
    // Handle /.proxy prefix
    else if (req.url.startsWith("/.proxy")) {
      req.url = req.url.replace("/.proxy", "");
    }

    console.log(
      `[Proxy Middleware] Rewriting URL from ${originalUrl} to ${req.url}`
    );
  }

  // Extract user ID from Discord token if available
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    try {
      // This is a simplified approach - in production you'd properly verify the token
      const token = req.headers.authorization.substring(7); // 'Bearer '.length
      // For now, we'll just use the token presence as authorization
      console.log(`[Auth] Token present in request`);

      // If user ID is in a header, add it to req.user
      if (req.headers["x-user-id"]) {
        req.user = { id: req.headers["x-user-id"] };
        console.log(`[Auth] User ID from header: ${req.user.id}`);
      }
    } catch (error) {
      console.error("[Auth] Error processing token:", error);
    }
  }

  next();
});

// --- Middleware ---
app.use(express.json()); // Parse JSON request bodies

// --- Health Check Route (before auth) ---
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// --- API Routes ---
// Create a function to handle both direct and proxied routes
function setupDualRoutes(app, clientApiRouter) {
  // List of API endpoints that need to be accessible both directly and through proxy
  const apiEndpoints = [
    { method: "post", path: "/games/updateRecord" },
    { method: "get", path: "/shop/upgrades/:guildId/:userId" },
  ];

  // For each endpoint, create both a direct and proxied route
  apiEndpoints.forEach((endpoint) => {
    const directPath = `/api${endpoint.path}`;
    const proxyPath = `/.proxy/api${endpoint.path}`;

    console.log(
      `[API Server] Setting up dual routes for ${endpoint.method.toUpperCase()} ${directPath} and ${proxyPath}`
    );

    // Handler function that forwards requests to the activities server
    const routeHandler = async (req, res) => {
      console.log(
        `[API Server] Forwarding ${req.method} request at ${req.originalUrl} to activities server`
      );

      try {
        // Forward all headers to preserve authentication
        const headers = {
          "Content-Type": "application/json",
        };

        for (const [key, value] of Object.entries(req.headers)) {
          // Skip host and content-length headers to avoid conflicts
          if (!["host", "content-length"].includes(key.toLowerCase())) {
            headers[key] = value;
          }
        }

        // Determine the target URL in the activities server
        const targetPath = req.originalUrl.includes("/.proxy")
          ? req.originalUrl
          : req.originalUrl.replace("/api", "/.proxy/api");

        const forwardResponse = await fetch(
          `http://localhost:3001${targetPath}`,
          {
            method: req.method,
            headers,
            body:
              req.method !== "GET" && req.method !== "HEAD"
                ? JSON.stringify(req.body)
                : undefined,
          }
        );

        const responseData = await forwardResponse.text();
        console.log(
          `[API Server] Activities server response: ${forwardResponse.status}`
        );

        // Return the same status and body from the activities server
        res.status(forwardResponse.status).send(responseData);
      } catch (error) {
        console.error(`[API Server] Error forwarding request:`, error);
        res
          .status(500)
          .json({ error: "Internal server error", message: error.message });
      }
    };

    // Register both direct and proxy routes
    app[endpoint.method](directPath, express.json(), routeHandler);
    app[endpoint.method](proxyPath, express.json(), routeHandler);
  });
}

// Add token endpoint for OAuth flow
app.post(
  ["/api/token", "/.proxy/api/token"],
  express.json(),
  async (req, res) => {
    try {
      const { code } = req.body;

      console.log(
        `[API Server] Token request received with code: ${
          code ? code.substring(0, 5) + "..." : "undefined"
        }`
      );
      console.log(`[API Server] Request body:`, req.body);

      // Instead of handling the token exchange ourselves, forward the request to the activities server
      console.log("[API Server] Forwarding token request to activities server");

      // Forward to the activities server at port 3001
      const forwardResponse = await fetch("http://localhost:3001/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      });

      const responseData = await forwardResponse.text();
      console.log(
        `[API Server] Activities server response: ${forwardResponse.status}`
      );

      // Return the same status and body from the activities server
      res.status(forwardResponse.status).send(responseData);
    } catch (error) {
      console.error("[API Server] Error forwarding token request:", error);
      return res
        .status(500)
        .json({ error: "Internal server error", message: error.message });
    }
  }
);

// Add config endpoint to provide client ID
app.get(["/api/config", "/.proxy/api/config"], async (req, res) => {
  try {
    // Forward to the activities server at port 3001
    console.log("[API Server] Forwarding config request to activities server");
    const forwardResponse = await fetch("http://localhost:3001/api/config");

    const responseData = await forwardResponse.text();
    console.log(
      `[API Server] Activities server config response: ${forwardResponse.status}`
    );

    // Return the same status and body from the activities server
    res.status(forwardResponse.status).send(responseData);
  } catch (error) {
    console.error("[API Server] Error forwarding config request:", error);
    return res
      .status(500)
      .json({ error: "Internal server error", message: error.message });
  }
});

// Add launcher-data endpoint to provide user data
app.get(
  ["/api/launcher-data", "/.proxy/api/launcher-data"],
  async (req, res) => {
    try {
      // Forward to the activities server at port 3001
      console.log(
        "[API Server] Forwarding launcher-data request to activities server"
      );

      // Forward all headers to preserve authentication
      const headers = {};
      for (const [key, value] of Object.entries(req.headers)) {
        // Skip host header to avoid conflicts
        if (key.toLowerCase() !== "host") {
          headers[key] = value;
        }
      }

      const forwardResponse = await fetch(
        "http://localhost:3001/api/launcher-data",
        {
          headers,
        }
      );

      const responseData = await forwardResponse.text();
      console.log(
        `[API Server] Activities server launcher-data response: ${forwardResponse.status}`
      );

      // Return the same status and body from the activities server
      res.status(forwardResponse.status).send(responseData);
    } catch (error) {
      console.error(
        "[API Server] Error forwarding launcher-data request:",
        error
      );
      return res
        .status(500)
        .json({ error: "Internal server error", message: error.message });
    }
  }
);

// Add high score update endpoint for database integration
app.post(
  ["/api/games/records/update", "/.proxy/api/games/records/update"],
  express.json(),
  async (req, res) => {
    console.log(
      `[API Server] Forwarding ${req.method} request at ${req.originalUrl} to database service`
    );

    try {
      const headers = { "Content-Type": "application/json" };

      for (const [key, value] of Object.entries(req.headers)) {
        if (key.toLowerCase() !== "host" && key.toLowerCase() !== "content-length") {
          headers[key] = value;
        }
      }

      const forwardResponse = await fetch(
        `http://localhost:3001/games/records/update`,
        {
          method: req.method,
          headers,
          body: JSON.stringify(req.body),
        }
      );

      const responseData = await forwardResponse.text();
      res.status(forwardResponse.status).send(responseData);
    } catch (error) {
      res.status(500).json({ error: "Internal server error", message: error.message });
    }
  }
);

// Add update-balance endpoint to forward to activities server
app.post(
  ["/api/update-balance", "/.proxy/api/update-balance"],
  express.json(),
  async (req, res) => {
    try {
      console.log("[API Server] Processing update-balance request locally");

      // Extract from headers and body
      const guildId = req.headers["x-guild-id"] || req.body.guildId;
      let userId = req.body.userId || req.headers["x-user-id"]; // Try to get from body first, then headers
      const { amount, reason } = req.body;

      // If userId is not provided, try to extract it from the Discord token
      if (
        !userId &&
        req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer ")
      ) {
        try {
          const accessToken = req.headers.authorization.substring(7); // Remove "Bearer "
          const userResponse = await fetch(
            "https://discord.com/api/users/@me",
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );

          if (userResponse.ok) {
            const discordUser = await userResponse.json();
            userId = discordUser.id;
            console.log(
              `[API Server] Extracted user ID from Discord token: ${userId}`
            );
          } else {
            console.error(
              `[API Server] Failed to extract user ID from Discord token: ${userResponse.status}`
            );
          }
        } catch (error) {
          console.error(
            `[API Server] Error extracting user ID from Discord token:`,
            error
          );
        }
      }

      console.log(
        `[API Server] Update balance request: guild=${guildId}, user=${userId}, amount=${amount}, reason=${reason}`
      );

      if (!guildId || !userId || amount === undefined) {
        return res.status(400).json({
          error: "Missing required fields: guildId, userId, amount",
          received: {
            guildId,
            userId,
            amount,
            reason,
            headers: {
              "x-guild-id": req.headers["x-guild-id"],
              "x-user-id": req.headers["x-user-id"],
              authorization: req.headers.authorization
                ? "Present (not shown)"
                : "Missing",
            },
          },
          help: "Make sure to include guildId in x-guild-id header, userId in x-user-id header or body, and amount in the request body",
        });
      }

      // Use our hub client to update the balance
      const hubClient = await import("../hubClient.js");
      const result = await hubClient.default.addBalance(
        guildId,
        userId,
        amount
      );

      const responseData = {
        success: true,
        newBalance: result?.balance?.toString() ?? "N/A",
        message: "Balance updated successfully",
      };

      console.log(`[API Server] Balance update successful:`, responseData);
      res.json(responseData);
    } catch (error) {
      console.error(
        "[API Server] Error processing update-balance request:",
        error
      );
      return res
        .status(500)
        .json({ error: "Internal server error", message: error.message });
    }
  }
);

// Apply authentication middleware specifically to the client API routes
app.use("/api", authenticateApiKey, clientApiRouter);

// Set up dual routes for direct and proxied access
setupDualRoutes(app, clientApiRouter);

// Optional: Add other routers here if needed (e.g., for internal bot stats)
// app.use('/internal', internalRouter);

// Diagnostic catch-all route to log unhandled paths
app.use("*", (req, res) => {
  console.log(`[API Server] Unhandled route: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: "API route not found",
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
});

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

// Start the server
startApiClientServer();
