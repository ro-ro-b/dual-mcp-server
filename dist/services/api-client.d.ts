export declare function setAuth(token: string, refresh?: string): void;
export declare function setApiKey(key: string): void;
export declare function getAuthHeaders(): Record<string, string>;
export declare function hasAuth(): boolean;
export declare function getRefreshToken(): string | undefined;
/** Generic API request with error handling */
export declare function makeApiRequest<T>(endpoint: string, method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", data?: unknown, params?: Record<string, unknown>, options?: {
    timeout?: number;
    multipart?: boolean;
}): Promise<T>;
/** Format API errors into actionable messages */
export declare function handleApiError(error: unknown): string;
//# sourceMappingURL=api-client.d.ts.map