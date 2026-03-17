import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import { API_BASE_URL, MAX_RESPONSE_SIZE } from "../constants.js";
import { assertNoControlChars } from "./security.js";

/**
 * Per-session API client. Encapsulates auth state so HTTP-mode sessions
 * are fully isolated from each other.
 *
 * Stdio mode: one ApiClient for the process lifetime.
 * HTTP mode:  one ApiClient per incoming request.
 */
export class ApiClient {
  private authToken: string | undefined;
  private apiKey: string | undefined;
  private refreshToken: string | undefined;

  constructor() {
    // Seed from environment (safe default for stdio)
    this.authToken = process.env.DUAL_ACCESS_TOKEN;
    this.apiKey = process.env.DUAL_API_KEY;
    this.refreshToken = process.env.DUAL_REFRESH_TOKEN;
  }

  /** Set JWT auth (from dual_login / dual_register_verify / dual_refresh_token) */
  setAuth(token: string, refresh?: string): void {
    assertNoControlChars(token, "Access token");
    if (refresh) assertNoControlChars(refresh, "Refresh token");
    this.authToken = token;
    if (refresh) this.refreshToken = refresh;
  }

  /** Set API-key auth (from dual_set_api_key) */
  setApiKey(key: string): void {
    assertNoControlChars(key, "API key");
    this.apiKey = key;
  }

  /** Clear all auth state (logout) */
  clearAuth(): void {
    this.authToken = undefined;
    this.apiKey = undefined;
    this.refreshToken = undefined;
  }

  hasAuth(): boolean {
    return !!(this.authToken || this.apiKey);
  }

  getRefreshToken(): string | undefined {
    return this.refreshToken;
  }

  getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (this.apiKey) {
      headers["x-api-key"] = this.apiKey;
    } else if (this.authToken) {
      headers["Authorization"] = `Bearer ${this.authToken}`;
    }
    return headers;
  }

  /** Generic API request with error handling and retry for 429 */
  async makeRequest<T>(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
    data?: unknown,
    params?: Record<string, unknown>,
    options?: { timeout?: number; multipart?: boolean; retries?: number },
  ): Promise<T> {
    const maxRetries = options?.retries ?? 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const config: AxiosRequestConfig = {
          method,
          url: `${API_BASE_URL}/${endpoint}`,
          headers: this.getAuthHeaders(),
          timeout: options?.timeout ?? 30000,
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

    throw new Error("Max retries exceeded");
  }
}

/* ─── Stateless helpers (no auth state) ─── */

/** Format API errors into safe, non-leaking messages */
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

      const rawMsg = body?.error?.message || body?.message || "";
      console.error(`[DUAL API Error] ${status}: ${rawMsg}`);

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
