#!/usr/bin/env node
/**
 * DUAL MCP Server
 *
 * AI-native integration with the DUAL tokenization platform.
 * Provides 115 tools across 17 API modules: wallets, organizations, templates,
 * objects, actions (Event Bus), faces, storage, webhooks, notifications,
 * sequencer, API keys, payments, support, public indexer API, plus AI service
 * modules for intelligence, governance, and creative.
 *
 * Authentication:
 *   - Set DUAL_ACCESS_TOKEN (JWT) or DUAL_API_KEY environment variable
 *   - Or use dual_login tool to authenticate interactively
 *
 * Transport:
 *   - stdio (default): For local integrations with Claude, Cursor, etc.
 *   - http: Set TRANSPORT=http for remote/multi-client use
 *     - MCP_SERVER_API_KEY is REQUIRED for HTTP mode
 *     - Binds to 127.0.0.1 by default (set HOST to override)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { MCP_SERVER_API_KEY } from "./constants.js";
import { ApiClient } from "./services/api-client.js";

// Tool registration modules
import { registerWalletTools } from "./tools/wallets.js";
import { registerOrganizationTools } from "./tools/organizations.js";
import { registerTemplateTools } from "./tools/templates.js";
import { registerObjectTools } from "./tools/objects.js";
import { registerActionTools } from "./tools/actions.js";
import { registerFaceTools } from "./tools/faces.js";
import { registerStorageTools } from "./tools/storage.js";
import { registerWebhookTools } from "./tools/webhooks.js";
import { registerNotificationTools } from "./tools/notifications.js";
import { registerSequencerTools } from "./tools/sequencer.js";
import { registerApiKeyTools } from "./tools/api-keys.js";
import { registerPaymentTools } from "./tools/payments.js";
import { registerSupportTools } from "./tools/support.js";
import { registerPublicApiTools } from "./tools/public-api.js";

// AI Service tool modules
import { registerIntelligenceTools } from "./tools/intelligence.js";
import { registerGovernanceTools } from "./tools/governance.js";
import { registerCreativeTools } from "./tools/creative.js";

/**
 * Create a fully-configured McpServer with its own ApiClient.
 * Stdio mode calls this once; HTTP mode calls it per request
 * so each connection gets isolated auth state.
 */
function createServer(apiClient?: ApiClient): { server: McpServer; api: ApiClient } {
  const api = apiClient ?? new ApiClient();
  const server = new McpServer({
    name: "dual-mcp-server",
    version: "0.1.0",
  });

  // Core DUAL API modules
  registerWalletTools(server, api);
  registerOrganizationTools(server, api);
  registerTemplateTools(server, api);
  registerObjectTools(server, api);
  registerActionTools(server, api);
  registerFaceTools(server, api);
  registerStorageTools(server, api);
  registerWebhookTools(server, api);
  registerNotificationTools(server, api);
  registerSequencerTools(server, api);
  registerApiKeyTools(server, api);
  registerPaymentTools(server, api);
  registerSupportTools(server, api);
  registerPublicApiTools(server, api);

  // AI Service modules
  registerIntelligenceTools(server, api);
  registerGovernanceTools(server, api);
  registerCreativeTools(server, api);

  return { server, api };
}

// --- Transport: stdio ---

async function runStdio(): Promise<void> {
  const { server } = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("DUAL MCP server running via stdio");
  console.error(`API URL: ${process.env.DUAL_API_URL || "https://api.blockv-labs.io/v3"}`);
  console.error(`Auth: ${process.env.DUAL_API_KEY ? "API Key" : process.env.DUAL_ACCESS_TOKEN ? "JWT Token" : "None (use dual_login)"}`);
}

// --- Transport: HTTP (streamable) ---

async function runHTTP(): Promise<void> {
  // H1: Require MCP_SERVER_API_KEY in HTTP mode
  if (!MCP_SERVER_API_KEY) {
    console.error("ERROR: MCP_SERVER_API_KEY is required when running in HTTP mode.");
    console.error("Set MCP_SERVER_API_KEY to a strong random string to protect the endpoint.");
    process.exit(1);
  }

  const { default: express } = await import("express");
  const { StreamableHTTPServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/streamableHttp.js"
  );
  const app = express();

  // ── Security middleware ──────────────────────────────────────

  // Body size limit (DoS prevention)
  app.use(express.json({ limit: "1mb" }));

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "0");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Content-Security-Policy", "default-src 'none'");
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    next();
  });

  // C3: Origin validation — default-on per MCP transport spec.
  // Requests with an Origin header are rejected unless the origin is in CORS_ORIGIN.
  // Requests WITHOUT an Origin header (server-to-server / curl) are allowed through.
  // Set CORS_ORIGIN=* to disable origin checking entirely (not recommended).
  const ALLOWED_ORIGINS = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
    : [];
  const CORS_WILDCARD = ALLOWED_ORIGINS.includes("*");

  app.use((req, res, next) => {
    const origin = req.headers.origin;

    // No Origin header = server-to-server request, allow through
    if (!origin) return next();

    // Wildcard disables origin checking (opt-in, not recommended)
    if (CORS_WILDCARD) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
      return next();
    }

    // Check allowlist
    if (ALLOWED_ORIGINS.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
      return next();
    }

    // Default: reject any browser request with an unrecognized Origin
    res.status(403).json({
      error: "Forbidden: Origin not allowed. Set CORS_ORIGIN to allowlist browser origins.",
    });
  });

  // Rate limiting (in-memory)
  const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
  const RATE_LIMIT_WINDOW = 60_000;
  const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || "100");

  app.use((req, res, next) => {
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const entry = rateLimitMap.get(clientIp);

    if (!entry || now > entry.resetAt) {
      rateLimitMap.set(clientIp, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
      return next();
    }

    entry.count++;
    if (entry.count > RATE_LIMIT_MAX) {
      res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: "Rate limit exceeded. Try again later." });
    }
    next();
  });

  // Periodic cleanup
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of rateLimitMap) {
      if (now > val.resetAt) rateLimitMap.delete(key);
    }
  }, RATE_LIMIT_WINDOW);

  // ── Authentication middleware ────────────────────────────────

  function authMiddleware(
    req: import("express").Request,
    res: import("express").Response,
    next: import("express").NextFunction,
  ): void {
    const providedKey =
      (req.headers["x-api-key"] as string | undefined) ??
      (req.headers["authorization"]?.startsWith("Bearer ")
        ? req.headers["authorization"].slice(7)
        : undefined);

    if (!providedKey || providedKey !== MCP_SERVER_API_KEY) {
      res
        .status(401)
        .json({ error: "Unauthorized. Provide a valid X-API-Key or Authorization: Bearer <key> header." });
      return;
    }
    next();
  }

  // ── MCP endpoint ────────────────────────────────────────────

  // C5: Respond to CORS preflight requests (OPTIONS /mcp).
  // Browser clients send an OPTIONS preflight before POST to verify CORS policy.
  // Without this handler, preflights return an unexpected response and browser
  // clients fail before they can send any JSON-RPC request.
  app.options("/mcp", (req, res) => {
    const origin = req.headers.origin;
    if (origin && (CORS_WILDCARD || ALLOWED_ORIGINS.includes(origin))) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
      res.setHeader("Access-Control-Max-Age", "86400");
    }
    res.status(204).end();
  });

  // M1: Fresh server + ApiClient per HTTP request (session isolation).
  // Uses stateless mode (sessionIdGenerator: undefined) because each request
  // gets its own McpServer — there is no cross-request session to track.
  app.post("/mcp", authMiddleware, async (req, res) => {
    const { server } = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  // C2: GET on /mcp — 405 Method Not Allowed (SSE not yet supported)
  app.get("/mcp", (_req, res) => {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method Not Allowed. Use POST for JSON-RPC requests." });
  });

  // DELETE on /mcp — 405
  app.delete("/mcp", (_req, res) => {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method Not Allowed. Use POST for JSON-RPC requests." });
  });

  // Health check (minimal info disclosure)
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // ── Listen ──────────────────────────────────────────────────

  const rawPort = parseInt(process.env.PORT || "3100");
  const port = Number.isNaN(rawPort) ? 3100 : Math.max(1, Math.min(65535, rawPort));

  // C4: Bind to 127.0.0.1 by default (localhost only)
  const host = process.env.HOST || "127.0.0.1";

  app.listen(port, host, () => {
    console.error(`DUAL MCP server running on http://${host}:${port}/mcp`);
    console.error("HTTP mode: session-isolated, auth required");
  });
}

// ── Launch ──────────────────────────────────────────────────────

const transport = process.env.TRANSPORT || "stdio";
if (transport === "http") {
  runHTTP().catch((err) => {
    console.error("Server error:", err);
    process.exit(1);
  });
} else {
  runStdio().catch((err) => {
    console.error("Server error:", err);
    process.exit(1);
  });
}
