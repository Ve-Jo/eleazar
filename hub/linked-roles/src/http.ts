import { LINKED_ROLES_HTTP_TIMEOUT_MS } from "./config.ts";

export type JsonRequestOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
};

export type HttpError = Error & {
  status?: number;
  responseBody?: string;
  retryable?: boolean;
};

export async function jsonRequest<T>(
  url: string,
  options: JsonRequestOptions = {}
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    options.timeoutMs || LINKED_ROLES_HTTP_TIMEOUT_MS
  );

  try {
    const response = await fetch(url, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const raw = await response.text();
    if (!response.ok) {
      const error = new Error(
        raw || `Request failed with status ${response.status}`
      ) as HttpError;
      error.status = response.status;
      error.responseBody = raw;
      error.retryable = response.status === 429 || response.status >= 500;
      throw error;
    }

    if (!raw) {
      return null as T;
    }

    return JSON.parse(raw) as T;
  } catch (error) {
    const typed = error as HttpError;
    if (typed.name === "AbortError") {
      typed.retryable = true;
      typed.message = "Request timed out";
    }
    throw typed;
  } finally {
    clearTimeout(timeoutId);
  }
}
