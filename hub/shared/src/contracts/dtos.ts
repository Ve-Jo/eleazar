export interface HealthResponse {
  status: "healthy" | "unhealthy";
  service?: string;
  timestamp: string;
  uptime: number;
  version?: string;
}

export interface ErrorResponse {
  error: string;
  message?: string;
  timestamp?: string;
}

export interface PaginationInput {
  limit?: number;
  offset?: number;
}
