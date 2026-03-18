/**
 * Contract tests for ApiClient.
 *
 * Validates: auth state management, header construction, handleApiError
 * safe message mapping, and makeRequest error handling.
 *
 * Network tests use the actual API_BASE_URL (which won't resolve in CI)
 * to verify connection error handling paths.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

const { ApiClient, handleApiError } = await import("../dist/services/api-client.js");

// ── Auth state ───────────────────────────────────────────────────────

describe("ApiClient auth state", () => {
  it("starts with no auth when env vars are unset", () => {
    const saved = { key: process.env.DUAL_API_KEY, token: process.env.DUAL_ACCESS_TOKEN };
    delete process.env.DUAL_API_KEY;
    delete process.env.DUAL_ACCESS_TOKEN;

    const client = new ApiClient();
    assert.equal(client.hasAuth(), false);

    // Restore
    if (saved.key) process.env.DUAL_API_KEY = saved.key;
    if (saved.token) process.env.DUAL_ACCESS_TOKEN = saved.token;
  });

  it("setAuth / clearAuth cycle works", () => {
    const client = new ApiClient();
    client.setAuth("test-token-123", "refresh-456");
    assert.equal(client.hasAuth(), true);
    assert.equal(client.getRefreshToken(), "refresh-456");

    const headers = client.getAuthHeaders();
    assert.equal(headers["Authorization"], "Bearer test-token-123");

    client.clearAuth();
    assert.equal(client.hasAuth(), false);
    assert.equal(client.getRefreshToken(), undefined);
  });

  it("setApiKey takes precedence over JWT in headers", () => {
    const client = new ApiClient();
    client.setAuth("jwt-token");
    client.setApiKey("api-key-789");
    const headers = client.getAuthHeaders();
    assert.equal(headers["x-api-key"], "api-key-789");
    assert.equal(headers["Authorization"], undefined);
  });

  it("rejects tokens with control characters", () => {
    const client = new ApiClient();
    assert.throws(() => client.setAuth("token\ninjection"), /control/i);
    assert.throws(() => client.setApiKey("key\r\ninjection"), /control/i);
  });

  it("always includes Content-Type and Accept headers", () => {
    const client = new ApiClient();
    const headers = client.getAuthHeaders();
    assert.equal(headers["Content-Type"], "application/json");
    assert.equal(headers["Accept"], "application/json");
  });

  it("seeds auth from DUAL_API_KEY env var", () => {
    const saved = process.env.DUAL_API_KEY;
    process.env.DUAL_API_KEY = "env-key-test";
    const client = new ApiClient();
    assert.equal(client.hasAuth(), true);
    const headers = client.getAuthHeaders();
    assert.equal(headers["x-api-key"], "env-key-test");
    // Restore
    if (saved) process.env.DUAL_API_KEY = saved;
    else delete process.env.DUAL_API_KEY;
  });
});

// ── makeRequest error paths ──────────────────────────────────────────

describe("ApiClient.makeRequest error handling", () => {
  it("throws on connection failure (ENOTFOUND / ECONNREFUSED)", async () => {
    const client = new ApiClient();
    client.setApiKey("test-key");

    // API_BASE_URL points to api.blockv-labs.io which won't resolve in CI
    // This tests the connection error path
    await assert.rejects(
      () => client.makeRequest("test-endpoint", "GET", undefined, undefined, { retries: 0 }),
      (err) => {
        // Should get either ENOTFOUND (DNS failure) or ECONNREFUSED
        return err.code === "ENOTFOUND" || err.code === "ECONNREFUSED" ||
               err.message?.includes("ENOTFOUND") || err.message?.includes("ECONNREFUSED");
      }
    );
  });

  it("respects retries parameter (does not retry non-429 errors)", async () => {
    const client = new ApiClient();
    client.setApiKey("test-key");

    const start = Date.now();
    try {
      await client.makeRequest("test", "GET", undefined, undefined, { retries: 0 });
    } catch {
      // Expected
    }
    const elapsed = Date.now() - start;
    // With retries: 0, should fail fast (not wait for exponential backoff)
    assert.ok(elapsed < 10000, `Should fail fast with retries: 0, took ${elapsed}ms`);
  });
});

// ── handleApiError ───────────────────────────────────────────────────

describe("handleApiError", () => {
  it("maps 400 to bad request", () => {
    const msg = handleApiError({
      isAxiosError: true,
      response: { status: 400, data: { error: { message: "invalid param" } } },
    });
    assert.match(msg, /Bad request/i);
    assert.ok(!msg.includes("invalid param"), "Should not leak raw error detail");
  });

  it("maps 401 to safe auth message", () => {
    const msg = handleApiError({
      isAxiosError: true,
      response: { status: 401, data: { error: { message: "jwt expired" } } },
    });
    assert.match(msg, /Authentication required/i);
    assert.ok(!msg.includes("jwt expired"), "Should not leak raw error detail");
  });

  it("maps 403 to permission denied", () => {
    const msg = handleApiError({
      isAxiosError: true,
      response: { status: 403, data: { message: "Forbidden" } },
    });
    assert.match(msg, /Permission denied/i);
  });

  it("maps 404 to not found", () => {
    const msg = handleApiError({
      isAxiosError: true,
      response: { status: 404, data: {} },
    });
    assert.match(msg, /not found/i);
  });

  it("maps 409 to conflict", () => {
    const msg = handleApiError({
      isAxiosError: true,
      response: { status: 409, data: {} },
    });
    assert.match(msg, /conflict/i);
  });

  it("maps 422 to validation failed", () => {
    const msg = handleApiError({
      isAxiosError: true,
      response: { status: 422, data: {} },
    });
    assert.match(msg, /Validation/i);
  });

  it("maps 429 to rate limit", () => {
    const msg = handleApiError({
      isAxiosError: true,
      response: { status: 429, data: {} },
    });
    assert.match(msg, /Rate limit/i);
  });

  it("maps unknown status codes to generic message", () => {
    const msg = handleApiError({
      isAxiosError: true,
      response: { status: 503, data: {} },
    });
    assert.match(msg, /503/);
    assert.ok(!msg.includes("internal"), "Should not expose server internals");
  });

  it("handles ECONNREFUSED gracefully", () => {
    const msg = handleApiError({
      isAxiosError: true,
      code: "ECONNREFUSED",
      response: undefined,
    });
    assert.match(msg, /Cannot reach/i);
  });

  it("handles timeout gracefully", () => {
    const msg = handleApiError({
      isAxiosError: true,
      code: "ECONNABORTED",
      response: undefined,
    });
    assert.match(msg, /timed out/i);
  });

  it("handles ERR_BAD_RESPONSE", () => {
    const msg = handleApiError({
      isAxiosError: true,
      code: "ERR_BAD_RESPONSE",
      response: undefined,
    });
    assert.match(msg, /Invalid response/i);
  });

  it("handles non-axios errors", () => {
    const msg = handleApiError(new Error("Something broke"));
    assert.match(msg, /Something broke/);
  });

  it("handles unknown error types", () => {
    const msg = handleApiError("string error");
    assert.match(msg, /unexpected/i);
  });
});
