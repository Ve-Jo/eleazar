/**
 * Simple metrics collection for bot sharding observability.
 * Tracks latency and error rates for hub API calls and event handlers.
 */

type MetricSample = {
  timestamp: number;
  value: number;
};

type HistogramBucket = {
  count: number;
  sum: number;
  min: number;
  max: number;
};

type RouteMetrics = {
  latency: HistogramBucket;
  errors: number;
  total: number;
  recentSamples: MetricSample[];
};

type EventMetrics = {
  duration: HistogramBucket;
  errors: number;
  total: number;
  recentSamples: MetricSample[];
};

type MetricsStore = {
  routes: Map<string, RouteMetrics>;
  events: Map<string, EventMetrics>;
  startTime: number;
};

type MetricStats = {
  count: number;
  errors: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
};

type MetricSnapshotEntry = MetricStats & {
  errorRatePct: number;
};

type MetricsSnapshot = {
  generatedAt: string;
  uptimeSec: number;
  sampleRetentionMs: number;
  maxSamplesPerKey: number;
  routes: Record<string, MetricSnapshotEntry>;
  events: Record<string, MetricSnapshotEntry>;
};

// Global metrics store
const metrics: MetricsStore = {
  routes: new Map(),
  events: new Map(),
  startTime: Date.now(),
};

// Configuration
function readPositiveIntEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(`[metrics] Invalid ${key}=${raw}; using fallback ${fallback}`);
    return fallback;
  }

  return parsed;
}

const MAX_SAMPLES_PER_KEY = readPositiveIntEnv("METRICS_MAX_SAMPLES_PER_KEY", 1000);
const SAMPLE_RETENTION_MS = readPositiveIntEnv(
  "METRICS_SAMPLE_RETENTION_MS",
  15 * 60 * 1000
);

function getOrCreateRoute(route: string): RouteMetrics {
  let entry = metrics.routes.get(route);
  if (!entry) {
    entry = {
      latency: { count: 0, sum: 0, min: Infinity, max: 0 },
      errors: 0,
      total: 0,
      recentSamples: [],
    };
    metrics.routes.set(route, entry);
  }
  return entry;
}

function getOrCreateEvent(eventName: string): EventMetrics {
  let entry = metrics.events.get(eventName);
  if (!entry) {
    entry = {
      duration: { count: 0, sum: 0, min: Infinity, max: 0 },
      errors: 0,
      total: 0,
      recentSamples: [],
    };
    metrics.events.set(eventName, entry);
  }
  return entry;
}

function pruneOldSamples(samples: MetricSample[]): MetricSample[] {
  const cutoff = Date.now() - SAMPLE_RETENTION_MS;
  return samples.filter((s) => s.timestamp > cutoff);
}

/**
 * Record a hub API route call with latency and status.
 */
function recordRouteCall(
  route: string,
  method: string,
  latencyMs: number,
  isError: boolean
): void {
  const key = `${method}:${route}`;
  const entry = getOrCreateRoute(key);

  // Update histogram
  entry.latency.count++;
  entry.latency.sum += latencyMs;
  entry.latency.min = Math.min(entry.latency.min, latencyMs);
  entry.latency.max = Math.max(entry.latency.max, latencyMs);

  // Update counters
  entry.total++;
  if (isError) {
    entry.errors++;
  }

  // Store sample for percentile calculation
  entry.recentSamples.push({ timestamp: Date.now(), value: latencyMs });
  if (entry.recentSamples.length > MAX_SAMPLES_PER_KEY) {
    entry.recentSamples = pruneOldSamples(entry.recentSamples);
    if (entry.recentSamples.length > MAX_SAMPLES_PER_KEY) {
      entry.recentSamples = entry.recentSamples.slice(-MAX_SAMPLES_PER_KEY);
    }
  }
}

/**
 * Record an event handler execution with duration.
 */
function recordEventCall(
  eventName: string,
  durationMs: number,
  isError: boolean
): void {
  const entry = getOrCreateEvent(eventName);

  // Update histogram
  entry.duration.count++;
  entry.duration.sum += durationMs;
  entry.duration.min = Math.min(entry.duration.min, durationMs);
  entry.duration.max = Math.max(entry.duration.max, durationMs);

  // Update counters
  entry.total++;
  if (isError) {
    entry.errors++;
  }

  // Store sample for percentile calculation
  entry.recentSamples.push({ timestamp: Date.now(), value: durationMs });
  if (entry.recentSamples.length > MAX_SAMPLES_PER_KEY) {
    entry.recentSamples = pruneOldSamples(entry.recentSamples);
    if (entry.recentSamples.length > MAX_SAMPLES_PER_KEY) {
      entry.recentSamples = entry.recentSamples.slice(-MAX_SAMPLES_PER_KEY);
    }
  }
}

/**
 * Calculate percentile from samples.
 */
function calculatePercentile(samples: MetricSample[], p: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a.value - b.value);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)]?.value ?? 0;
}

/**
 * Get summary statistics for a route.
 */
function getRouteStats(route: string): {
  count: number;
  errors: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
} | null {
  const entry = metrics.routes.get(route);
  if (!entry || entry.latency.count === 0) return null;

  const samples = pruneOldSamples(entry.recentSamples);

  return {
    count: entry.latency.count,
    errors: entry.errors,
    avgMs: entry.latency.sum / entry.latency.count,
    minMs: entry.latency.min === Infinity ? 0 : entry.latency.min,
    maxMs: entry.latency.max,
    p50Ms: calculatePercentile(samples, 50),
    p95Ms: calculatePercentile(samples, 95),
    p99Ms: calculatePercentile(samples, 99),
  };
}

/**
 * Get summary statistics for an event.
 */
function getEventStats(eventName: string): {
  count: number;
  errors: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
} | null {
  const entry = metrics.events.get(eventName);
  if (!entry || entry.duration.count === 0) return null;

  const samples = pruneOldSamples(entry.recentSamples);

  return {
    count: entry.duration.count,
    errors: entry.errors,
    avgMs: entry.duration.sum / entry.duration.count,
    minMs: entry.duration.min === Infinity ? 0 : entry.duration.min,
    maxMs: entry.duration.max,
    p50Ms: calculatePercentile(samples, 50),
    p95Ms: calculatePercentile(samples, 95),
    p99Ms: calculatePercentile(samples, 99),
  };
}

function toSnapshotEntry(stats: MetricStats): MetricSnapshotEntry {
  const errorRatePct = stats.count > 0 ? (stats.errors / stats.count) * 100 : 0;

  return {
    ...stats,
    errorRatePct: Number(errorRatePct.toFixed(2)),
  };
}

function toSnapshotSection(
  values: Record<string, MetricStats | null>
): Record<string, MetricSnapshotEntry> {
  const entries = Object.entries(values)
    .filter((entry): entry is [string, MetricStats] => entry[1] != null)
    .sort((a, b) => b[1].count - a[1].count);

  return Object.fromEntries(entries.map(([key, stats]) => [key, toSnapshotEntry(stats)]));
}

function getMetricsSnapshot(): MetricsSnapshot {
  const uptimeSec = Math.round((Date.now() - metrics.startTime) / 1000);

  return {
    generatedAt: new Date().toISOString(),
    uptimeSec,
    sampleRetentionMs: SAMPLE_RETENTION_MS,
    maxSamplesPerKey: MAX_SAMPLES_PER_KEY,
    routes: toSnapshotSection(getAllRouteMetrics()),
    events: toSnapshotSection(getAllEventMetrics()),
  };
}

/**
 * Get all route metrics.
 */
function getAllRouteMetrics(): Record<string, ReturnType<typeof getRouteStats>> {
  const result: Record<string, ReturnType<typeof getRouteStats>> = {};
  for (const [key] of metrics.routes) {
    result[key] = getRouteStats(key);
  }
  return result;
}

/**
 * Get all event metrics.
 */
function getAllEventMetrics(): Record<string, ReturnType<typeof getEventStats>> {
  const result: Record<string, ReturnType<typeof getEventStats>> = {};
  for (const [key] of metrics.events) {
    result[key] = getEventStats(key);
  }
  return result;
}

/**
 * Log a summary of current metrics (for debugging/monitoring).
 */
function logMetricsSummary(): void {
  const snapshot = getMetricsSnapshot();
  console.log(`[metrics] Uptime: ${snapshot.uptimeSec}s`);

  // Log top routes by call count
  const routes = Object.entries(snapshot.routes)
    .filter(([, stats]) => stats.count > 0)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);

  if (routes.length > 0) {
    console.log("[metrics] Top routes by call count:");
    for (const [key, stats] of routes) {
      console.log(
        `  ${key}: ${stats.count} calls, ${Math.round(stats.avgMs)}ms avg, p95=${Math.round(
          stats.p95Ms
        )}ms, p99=${Math.round(stats.p99Ms)}ms, ${stats.errorRatePct.toFixed(1)}% errors`
      );
    }
  }

  // Log events
  const events = Object.entries(snapshot.events).filter(([, stats]) => stats.count > 0);

  if (events.length > 0) {
    console.log("[metrics] Event handlers:");
    for (const [key, stats] of events) {
      console.log(
        `  ${key}: ${stats.count} calls, ${Math.round(stats.avgMs)}ms avg, p95=${Math.round(
          stats.p95Ms
        )}ms, p99=${Math.round(stats.p99Ms)}ms, ${stats.errorRatePct.toFixed(1)}% errors`
      );
    }
  }
}

/**
 * Log a machine-readable snapshot that can be ingested by log tooling
 * during baseline capture windows.
 */
function logMetricsSnapshot(reason = "manual"): void {
  console.log(`[metrics] snapshot reason=${reason} ${JSON.stringify(getMetricsSnapshot())}`);
}

/**
 * Extract route path from URL for metrics labeling.
 */
function extractRouteFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Normalize path by replacing numeric IDs with placeholders
    const path = parsed.pathname
      .replace(/\/[0-9]+/g, "/:id")
      .replace(/\/:[id]+\/:[id]+/g, "/:id/:id");
    return path;
  } catch {
    return url;
  }
}

// Periodic metrics logging in production
if (process.env.NODE_ENV === "production") {
  setInterval(() => {
    logMetricsSummary();
  }, 60000); // Log every minute
}

export {
  recordRouteCall,
  recordEventCall,
  getRouteStats,
  getEventStats,
  getAllRouteMetrics,
  getAllEventMetrics,
  getMetricsSnapshot,
  logMetricsSummary,
  logMetricsSnapshot,
  extractRouteFromUrl,
};
