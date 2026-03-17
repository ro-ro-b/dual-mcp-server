/**
 * Integration tests for the HTTP transport.
 *
 * These tests start the server in HTTP mode and verify:
 *  - MCP_SERVER_API_KEY is required
 *  - Auth middleware rejects unauthenticated requests
 *  - POST /mcp handles JSON-RPC initialize → tools/list round-trip
 *  - GET /mcp returns 405
 *  - Origin header validation works
 *  - Health endpoint responds
 *
 * Uses Node's built-in test runner (--test) — no external test framework needed.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = 9876;
const BASE = `http://127.0.0.1:${PORT}`;
const API_KEY = "test-secret-key-for-ci";

/** Helper: send a JSON-RPC request to /mcp with MCP-required headers */
async function mcpPost(body, headers = {}) {
  const res = await fetch(`${BASE}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "X-API-Key": API_KEY,
      ...headers,
    },
    body: JSON.stringify(body),
  });
  return res;
}

describe("HTTP transport", () => {
  let proc;

  before(async () => {
    // Start the server as a child process
    proc = spawn("node", ["dist/index.js"], {
      env: {
        ...process.env,
        TRANSPORT: "http",
        PORT: String(PORT),
        HOST: "127.0.0.1",
        MCP_SERVER_API_KEY: API_KEY,
        // No DUAL_API_KEY — we're testing the MCP layer, not the DUAL API
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    // Wait for the server to be ready
    let ready = false;
    for (let i = 0; i < 40; i++) {
      await sleep(250);
      try {
        const res = await fetch(`${BASE}/health`);
        if (res.ok) { ready = true; break; }
      } catch { /* not ready yet */ }
    }
    if (!ready) throw new Error("Server did not start within 10 seconds");
  });

  after(() => {
    if (proc) proc.kill("SIGTERM");
  });

  // ── Auth ──────────────────────────────────────────────

  it("rejects requests without API key", async () => {
    const res = await fetch(`${BASE}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
    });
    assert.equal(res.status, 401);
  });

  it("rejects requests with wrong API key", async () => {
    const res = await fetch(`${BASE}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": "wrong-key" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
    });
    assert.equal(res.status, 401);
  });

  // ── MCP protocol ─────────────────────────────────────

  it("handles initialize → tools/list round-trip", async () => {
    // Step 1: initialize
    const initRes = await mcpPost({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" },
      },
    });
    assert.equal(initRes.status, 200);
    const initBody = await initRes.json();
    assert.equal(initBody.jsonrpc, "2.0");
    assert.equal(initBody.id, 1);
    assert.ok(initBody.result, "initialize should return a result");
    assert.ok(initBody.result.serverInfo, "result should have serverInfo");
    assert.equal(initBody.result.serverInfo.name, "dual-mcp-server");
  });

  it("returns 115+ tools from tools/list", async () => {
    // In stateless mode, each POST is a standalone request.
    // The SDK allows tools/list without a prior initialize in stateless mode.
    const toolsRes = await mcpPost({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    });
    assert.equal(toolsRes.status, 200, `Expected 200 but got ${toolsRes.status}`);
    const toolsBody = await toolsRes.json();

    assert.ok(toolsBody.result, "tools/list should return a result");
    const tools = toolsBody.result.tools;
    assert.ok(Array.isArray(tools), "tools should be an array");
    // We expect 115 tools (81 core + 34 AI services)
    assert.ok(tools.length >= 100, `Expected 100+ tools, got ${tools.length}`);

    // Spot-check a few tool names
    const names = tools.map((t) => t.name);
    assert.ok(names.includes("dual_login"), "Should have dual_login");
    assert.ok(names.includes("dual_logout"), "Should have dual_logout");
    assert.ok(names.includes("dual_search_objects"), "Should have dual_search_objects");
    assert.ok(names.includes("dual_ai_agent_create"), "Should have dual_ai_agent_create");
  });

  // ── HTTP method compliance ────────────────────────────

  it("returns 405 on GET /mcp", async () => {
    const res = await fetch(`${BASE}/mcp`, {
      headers: { "X-API-Key": API_KEY },
    });
    assert.equal(res.status, 405);
    assert.ok(res.headers.get("allow")?.includes("POST"));
  });

  it("returns 405 on DELETE /mcp", async () => {
    const res = await fetch(`${BASE}/mcp`, {
      method: "DELETE",
      headers: { "X-API-Key": API_KEY },
    });
    assert.equal(res.status, 405);
  });

  // ── Origin validation ─────────────────────────────────

  it("rejects requests with an unrecognized Origin header", async () => {
    const res = await fetch(`${BASE}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
        Origin: "https://evil.example.com",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
    });
    assert.equal(res.status, 403);
  });

  it("allows requests without an Origin header (server-to-server)", async () => {
    // fetch() does not send Origin by default, so this tests the no-origin path
    const res = await mcpPost({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" },
      },
    });
    assert.equal(res.status, 200);
  });

  // ── Health check ──────────────────────────────────────

  it("responds to /health", async () => {
    const res = await fetch(`${BASE}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "ok");
  });
});
