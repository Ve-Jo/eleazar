export type ServiceName =
  | "database"
  | "rendering"
  | "localization"
  | "ai"
  | "client"
  | "activities"
  | "linkedRoles";

export const SERVICE_NAMES = {
  DATABASE: "database",
  RENDERING: "rendering",
  LOCALIZATION: "localization",
  AI: "ai",
  CLIENT: "client",
  ACTIVITIES: "activities",
  LINKED_ROLES: "linkedRoles",
} as const;

export const DEFAULT_SERVICE_PORTS: Record<ServiceName, number> = {
  database: 3001,
  rendering: 3002,
  localization: 3005,
  ai: 8080,
  client: 3006,
  activities: 3007,
  linkedRoles: 3008,
};

export const DEFAULT_SERVICE_URLS: Record<ServiceName, string> = {
  database: `http://localhost:${DEFAULT_SERVICE_PORTS.database}`,
  rendering: `http://localhost:${DEFAULT_SERVICE_PORTS.rendering}`,
  localization: `http://localhost:${DEFAULT_SERVICE_PORTS.localization}`,
  ai: `http://localhost:${DEFAULT_SERVICE_PORTS.ai}`,
  client: `http://localhost:${DEFAULT_SERVICE_PORTS.client}`,
  activities: `http://localhost:${DEFAULT_SERVICE_PORTS.activities}`,
  linkedRoles: `http://localhost:${DEFAULT_SERVICE_PORTS.linkedRoles}`,
};

export function buildServiceUrl(
  serviceName: ServiceName,
  host = "http://localhost"
) {
  return `${host}:${DEFAULT_SERVICE_PORTS[serviceName]}`;
}
