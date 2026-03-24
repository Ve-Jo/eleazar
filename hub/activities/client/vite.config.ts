import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiTarget = "http://localhost:3007";
const nodeProcess = (globalThis as {
  process?: { env?: Record<string, string | undefined> };
}).process;
const activityClientPort = Number(nodeProcess?.env?.ACTIVITY_TUNNEL_PORT || 5174);
const explicitTunnelHost = nodeProcess?.env?.ACTIVITY_TUNNEL_PUBLIC_HOSTNAME || "";
const explicitPublicBaseUrl = nodeProcess?.env?.ACTIVITY_PUBLIC_BASE_URL || "";

function tryParseHostname(rawUrl: string): string {
  if (!rawUrl) {
    return "";
  }

  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname || "";
  } catch {
    return "";
  }
}

const configuredPublicHost = tryParseHostname(explicitPublicBaseUrl);
const allowedHosts = Array.from(
  new Set(
    [
      "localhost",
      "127.0.0.1",
      ".loca.lt",
      ".trycloudflare.com",
      explicitTunnelHost,
      configuredPublicHost,
    ].filter(Boolean)
  )
);

export default defineConfig({
  plugins: [react()],
  server: {
    port: activityClientPort,
    allowedHosts,
    proxy: {
      "/api": apiTarget,
      "/.proxy/api": apiTarget,
    },
    fs: {
      allow: ["..", "../.."],
    },
  },
});
