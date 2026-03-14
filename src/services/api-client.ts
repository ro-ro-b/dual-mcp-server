import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import { API_BASE_URL, MAX_RESPONSE_SIZE } from "../constants.js";
import { assertNoControlChars } from "./security.js";

/** Auth state — supports both Bearer JWT and API Key */
let authToken: string | undefined = process.env.DUAL_ACCESS_TOKEN;
let apiKey: string | undefined = process.env.DUAL_API_KEY;
let refreshToken: string | undefined = process.env.DUAL_REFRESH_TOKEN;

export function setAuth(token: string, refresh?: string): void {
  // M10: Validate tokens don't contain control characters
  assertNoControlChars(token, "Access token");
  if (refresh) assertNoControlChars(refresh, "Refresh token");

  authToken = token;
  if (refresh) refreshToken = refresh;
}

export function setApiKey(key: string): void {
  assertNoControlChars(key, "API key");
  apiKey = key;
}

/** L2: Clear all auth state (logout) */
export function clearAuth(): void {
  authToken = undefined;
  apiKey = undefined;
  refreshToken = undefined;
}

export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  } else if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  return headers;
}

export function hasAuth(): boolean {
  return !!(authToken || apiKey);
}

export function getRefreshToken(): string | undefined {
  return refreshToken;
}

/** Generic API request with error handling and retry for 429 (L1) */
export async function makeApiRequest<T>(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
  data?: unknown,
  params?: Record<string, unknown>,
  options?: { timeout?: number; multipart?: boolean; retries?: number }
): Promise<T> {
  const maxRetries = options?.retries ?? 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const config: AxiosRequestConfig = {
        method,
        url: `${API_BASE_URL}/${endpoint}`,
        headers: getAuthHeaders(),
        timeout: options?.timeout ?? 30000,
        // M2: Response size limits
        maxContentLength: MAX_RESPONSE_SIZE,
        maxBodyLength: MAX_RESPONSE_SIZE,
      };

      if (data !== undefined) config.data = data;
      if (params) config.params = params;
      if (options?.multipart) {
        config.headers = { ...config.headers, "Content-Type": "multipart/form-data" };
      }

      const response = await axios(config);
      return response.data as T;
    } catch (error) {
      // L1: Retry with exponential backoff on 429
      if (
        axios.isAxiosError(error) &&
        error.response?.status === 429 &&
        attempt < maxRetries
      ) {
        const retryAfter = parseInt(error.response.headers["retry-after"] || "0");
        const delay = retryAfter > 0 ? retryAfter * 1000 : Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }

  // Should never reach here, but TypeScript needs it
  throw new Error("Max retries exceeded");
}

/** H2: Format API errors into safe, non-leaking messages */
const SAFE_ERROR_MESSAGES: Record<number, string> = {
  400: "Bad request — check your parameters",
  401: "Authentication required. Use dual_login or set DUAL_ACCESS_TOKEN / DUAL_API_KEY",
  403: "Permission denied — you don't have access to this resource",
  404: "Resource not found — check the ID is correct",
  409: "Resource conflict — already exists or state conflict",
  422: "Validation failed — check your input data",
  429: "Rate limit exceeded — wait a moment before making more requests",
};

export function handleApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosErr = error as AxiosError<{ error?: { message?: string }; message?: string }>;
    if (axiosErr.response) {
      const status = axiosErr.response.status;
      const body = axiosErr.response.data;

      // Log full error server-side for debugging
      const rawMsg = body?.error?.message || body?.message || "";
      console.error(`[DUAL API Error] ${status}: ${rawMsg}`);

      // Return sanitized message to client
      const safeMsg = SAFE_ERROR_MESSAGES[status];
      if (safeMsg) return `Error: ${safeMsg}.`;
      return `Error: API request failed (${status}).`;
    } else if (axiosErr.code === "ECONNABORTED") {
      return "Error: Request timed out. The DUAL API may be slow — try again.";
    } else if (axiosErr.code === "ECONNREFUSED") {
      return "Error: Cannot reach DUAL API. Check your DUAL_API_URL or network connection.";
    } else if (axiosErr.code === "ERR_BAD_RESPONSE") {
      return "Error: Invalid response from DUAL API.";
    }
  }
  return `Error: ${error instanceof Error ? error.message : "An unexpected error occurred"}`;
}
