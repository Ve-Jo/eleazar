import promClient from "prom-client";
import { logger } from "../utils/logger.js";

// Create a Registry to register the metrics
const register = new promClient.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: "ai-hub-service",
  version: "1.0.0",
});

// Enable the collection of default metrics
promClient.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new promClient.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
});

const httpRequestTotal = new promClient.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
});

const aiRequestsTotal = new promClient.Counter({
  name: "ai_requests_total",
  help: "Total number of AI requests",
  labelNames: ["provider", "model", "status", "error_type"],
});

const aiRequestDuration = new promClient.Histogram({
  name: "ai_request_duration_seconds",
  help: "Duration of AI requests in seconds",
  labelNames: ["provider", "model", "status"],
  buckets: [0.5, 1, 2, 3, 5, 10, 15, 20, 30, 60],
});

const aiTokensTotal = new promClient.Counter({
  name: "ai_tokens_total",
  help: "Total number of tokens processed",
  labelNames: ["provider", "model", "type"], // type: prompt, completion, total
});

const aiStreamingConnections = new promClient.Gauge({
  name: "ai_streaming_connections",
  help: "Number of active streaming connections",
  labelNames: ["provider", "model"],
});

const aiModelCacheHits = new promClient.Counter({
  name: "ai_model_cache_hits_total",
  help: "Total number of model cache hits",
  labelNames: ["provider"],
});

const aiModelCacheMisses = new promClient.Counter({
  name: "ai_model_cache_misses_total",
  help: "Total number of model cache misses",
  labelNames: ["provider"],
});

const websocketConnections = new promClient.Gauge({
  name: "websocket_connections",
  help: "Number of active WebSocket connections",
});

const websocketMessagesTotal = new promClient.Counter({
  name: "websocket_messages_total",
  help: "Total number of WebSocket messages",
  labelNames: ["type", "status"],
});

const rateLimitHits = new promClient.Counter({
  name: "rate_limit_hits_total",
  help: "Total number of rate limit hits",
  labelNames: ["route", "client_ip"],
});

const providerErrors = new promClient.Counter({
  name: "provider_errors_total",
  help: "Total number of provider errors",
  labelNames: ["provider", "error_type", "status_code"],
});

const memoryUsage = new promClient.Gauge({
  name: "memory_usage_bytes",
  help: "Memory usage in bytes",
  labelNames: ["type"], // rss, heapUsed, heapTotal, external
});

const cpuUsage = new promClient.Gauge({
  name: "cpu_usage_percent",
  help: "CPU usage percentage",
  labelNames: ["type"], // user, system
});

// Register all metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(aiRequestsTotal);
register.registerMetric(aiRequestDuration);
register.registerMetric(aiTokensTotal);
register.registerMetric(aiStreamingConnections);
register.registerMetric(aiModelCacheHits);
register.registerMetric(aiModelCacheMisses);
register.registerMetric(websocketConnections);
register.registerMetric(websocketMessagesTotal);
register.registerMetric(rateLimitHits);
register.registerMetric(providerErrors);
register.registerMetric(memoryUsage);
register.registerMetric(cpuUsage);

// Middleware to track HTTP request metrics
function metricsMiddleware(req, res, next) {
  const start = Date.now();

  res.on("finish", () => {
    const duration = (Date.now() - start) / 1000; // Convert to seconds
    const route = req.route ? req.route.path : req.path;

    // HTTP request metrics
    httpRequestDuration
      .labels(req.method, route, res.statusCode)
      .observe(duration);

    httpRequestTotal.labels(req.method, route, res.statusCode).inc();
  });

  next();
}

// Function to record AI request metrics
function recordAIRequest(provider, model, status, duration, errorType = null) {
  aiRequestsTotal.labels(provider, model, status, errorType || "none").inc();

  aiRequestDuration.labels(provider, model, status).observe(duration);
}

// Function to record token usage
function recordTokenUsage(provider, model, promptTokens, completionTokens) {
  const totalTokens = promptTokens + completionTokens;

  aiTokensTotal.labels(provider, model, "prompt").inc(promptTokens);

  aiTokensTotal.labels(provider, model, "completion").inc(completionTokens);

  aiTokensTotal.labels(provider, model, "total").inc(totalTokens);
}

// Function to update streaming connections
function updateStreamingConnections(provider, model, delta) {
  aiStreamingConnections.labels(provider, model).inc(delta);
}

// Function to record model cache metrics
function recordModelCacheHit(provider) {
  aiModelCacheHits.labels(provider).inc();
}

function recordModelCacheMiss(provider) {
  aiModelCacheMisses.labels(provider).inc();
}

// Function to update WebSocket metrics
function updateWebSocketConnections(delta) {
  websocketConnections.inc(delta);
}

function recordWebSocketMessage(type, status = "success") {
  websocketMessagesTotal.labels(type, status).inc();
}

// Function to record rate limit hits
function recordRateLimitHit(route, clientIp) {
  rateLimitHits.labels(route, clientIp).inc();
}

// Function to record provider errors
function recordProviderError(provider, errorType, statusCode) {
  providerErrors.labels(provider, errorType, statusCode).inc();
}

// Function to update system metrics
function updateSystemMetrics() {
  const memUsage = process.memoryUsage();

  memoryUsage.labels("rss").set(memUsage.rss);

  memoryUsage.labels("heapUsed").set(memUsage.heapUsed);

  memoryUsage.labels("heapTotal").set(memUsage.heapTotal);

  memoryUsage.labels("external").set(memUsage.external);
}

// Function to update CPU metrics (requires additional setup)
function updateCPUMetrics() {
  // This would require additional CPU monitoring setup
  // For now, we'll just log that it's called
  logger.debug("CPU metrics update called");
}

// Setup metrics endpoint
function setupMetrics(app) {
  app.get("/metrics", async (req, res) => {
    try {
      res.set("Content-Type", register.contentType);
      res.end(await register.metrics());
    } catch (error) {
      logger.error("Error generating metrics", { error: error.message });
      res.status(500).end();
    }
  });

  // Apply metrics middleware to all routes
  app.use(metricsMiddleware);

  // Start system metrics update interval
  setInterval(updateSystemMetrics, 30000); // Update every 30 seconds

  logger.info("Metrics endpoint setup complete");
}

// Get metrics register (for custom metrics)
function getMetricsRegister() {
  return register;
}

// Create custom metric
function createCustomMetric(config) {
  const metric = new promClient[config.type](config);
  register.registerMetric(metric);
  return metric;
}

export {
  setupMetrics,
  getMetricsRegister,
  createCustomMetric,
  recordAIRequest,
  recordTokenUsage,
  updateStreamingConnections,
  recordModelCacheHit,
  recordModelCacheMiss,
  updateWebSocketConnections,
  recordWebSocketMessage,
  recordRateLimitHit,
  recordProviderError,
  updateSystemMetrics,
  updateCPUMetrics,

  // Export metric instances for direct access
  httpRequestDuration,
  httpRequestTotal,
  aiRequestsTotal,
  aiRequestDuration,
  aiTokensTotal,
  aiStreamingConnections,
  aiModelCacheHits,
  aiModelCacheMisses,
  websocketConnections,
  websocketMessagesTotal,
  rateLimitHits,
  providerErrors,
  memoryUsage,
  cpuUsage,
};
