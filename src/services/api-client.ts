import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import { API_BASE_URL } from "../constants.js";

/** Auth state — supports both Bearer JWT and API Key */
let authToken: string | undefined = process.env.DUAL_ACCESS_TOKEN;
let apiKey: string | undefined = process.env.DUAL_API_KEY;
let refreshToken: string | undefined = process.env.DUAL_REFRESH_TOKEN;

export function setAuth(token: string, refresh?: string): void {
  authToken = token;
  if (refresh) refreshToken = refresh;
}

export function setApiKey(key: string): void {
  apiKey = key;
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

/** Generic API request with error handling */
export async function makeApiRequest<T>(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
  data?: unknown,
  params?: Record<string, unknown>,
  options?: { timeout?: number; multipart?: boolean }
): Promise<T> {
  const config: AxiosRequestConfig = {
    method,
    url: `${API_BASE_URL}/${endpoint}`,
    headers: getAuthHeaders(),
    timeout: options?.timeout ?? 30000,
  };

  if (data !== undefined) config.data = data;
  if (params) config.params = params;
  if (options?.multipart) {
    config.headers = { ...config.headers, "Content-Type": "multipart/form-data" };
  }

  const response = await axios(config);
  return response.data as T;
}

/** Format API errors into actionable messages */
export function handleApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosErr = error as AxiosError<{ error?: { message?: string }; message?: string }>;
    if (axiosErr.response) {
      const status = axiosErr.response.status;
      const body = axiosErr.response.data;
      const msg = body?.error?.message || body?.message || "";

      switch (status) {
        case 400:
          return `Error: Bad request. ${msg || "Check your parameters and try again."}`;
        case 401:
          return "Error: Authentication required. Use dual_login or set DUAL_ACCESS_TOKEN / DUAL_API_KEY environment variable.";
        case 403:
          return `Error: Permission denied. ${msg || "You don't have access to this resource."}`;
        case 404:
          return `Error: Resource not found. ${msg || "Check the ID is correct."}`;
        case 409:
          return `Error: Conflict. ${msg || "Resource already exists or state conflict."}`;
        case 422:
          return `Error: Validation failed. ${msg || "Check your input data."}`;
        case 429:
          return "Error: Rate limit exceeded. Wait a moment before making more requests.";
        default:
          return `Error: API request failed (${status}). ${msg}`;
      }
    } else if (axiosErr.code === "ECONNABORTED") {
      return "Error: Request timed out. The DUAL API may be slow — try again.";
    } else if (axiosErr.code === "ECONNREFUSED") {
      return "Error: Cannot reach DUAL API. Check your DUAL_API_URL or network connection.";
    }
  }
  return `Error: ${error instanceof Error ? error.message : String(error)}`;
}
