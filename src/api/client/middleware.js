const ACTIVITY_API_KEY =
  process.env.VITE_DISCORD_CLIENT_SECRET || "activity_secret_key";

// Simple API Key Authentication Middleware
export const authenticateApiKey = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Activity ")) {
    console.warn(
      `[API Auth] Denied: Missing/invalid auth header from ${req.ip}`
    );
    return res
      .status(401)
      .json({ error: "Unauthorized: Missing or invalid Authorization header" });
  }
  const providedKey = authHeader.substring(9); // 'Activity '.length
  if (providedKey !== ACTIVITY_API_KEY) {
    console.warn(`[API Auth] Denied: Invalid API Key from ${req.ip}`);
    return res.status(403).json({ error: "Forbidden: Invalid API Key" });
  }
  // Optional: Log successful authentication
  // console.log(`[API Auth] Granted: Valid API Key from ${req.ip}`);
  next(); // Key is valid, proceed
};

// Add other middleware functions here if needed
