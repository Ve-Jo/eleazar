const ACTIVITY_API_KEY =
  process.env.VITE_DISCORD_CLIENT_SECRET || "activity_secret_key";

// Enhanced API Key Authentication Middleware
export const authenticateApiKey = (req, res, next) => {
  // Skip authentication for token endpoint
  if (
    req.path === "/token" ||
    req.originalUrl.includes("/api/token") ||
    req.originalUrl.includes("/.proxy/api/token")
  ) {
    console.log(
      `[API Auth] Bypassing auth for token endpoint: ${req.originalUrl}`
    );
    return next();
  }

  // Skip authentication for development environment if needed
  if (
    process.env.NODE_ENV === "development" &&
    process.env.SKIP_AUTH === "true"
  ) {
    console.log(`[API Auth] Skipping auth in development mode`);
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.warn(`[API Auth] Denied: Missing auth header from ${req.ip}`);
    return res
      .status(401)
      .json({ error: "Unauthorized: Missing Authorization header" });
  }

  // Check for different auth header formats
  if (authHeader.startsWith("Activity ")) {
    // Original format
    const providedKey = authHeader.substring(9); // 'Activity '.length
    if (providedKey !== ACTIVITY_API_KEY) {
      console.warn(`[API Auth] Denied: Invalid API Key from ${req.ip}`);
      return res.status(403).json({ error: "Forbidden: Invalid API Key" });
    }
  } else if (authHeader.startsWith("Bearer ")) {
    // Discord token format - for now we'll accept any Bearer token
    // In production, you should validate the token properly
    console.log(`[API Auth] Bearer token provided from ${req.ip}`);

    // Extract user ID from headers if available
    if (req.headers["x-user-id"]) {
      req.user = { id: req.headers["x-user-id"] };
    }
  } else {
    // Unknown format
    console.warn(`[API Auth] Denied: Invalid auth format from ${req.ip}`);
    return res
      .status(401)
      .json({ error: "Unauthorized: Invalid Authorization format" });
  }

  // Authentication passed
  next();
};

// Add other middleware functions here if needed
