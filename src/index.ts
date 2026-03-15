#!/usr/bin/env node
/**
 * DUAL MCP Server
 *
 * AI-native integration with the DUAL tokenization platform.
 * Provides 60+ tools across 14 API modules: wallets, organizations, templates,
 * objects, actions (Event Bus), faces, storage, webhooks, notifications,
 * sequencer, API keys, payments, support, and the public indexer API.
 *
 * Authentication:
 *   - Set DUAL_ACCESS_TOKEN (JWT) or DUAL_API_KEY environment variable
 *   - Or use dual_login tool to authenticate interactively
 *
 * Transport:
 *   - stdio (default): For local integrations with Claude, Cursor, etc.
 *   - http: Set TRANSPORT=http for remote/multi-client use
 *     - Set MCP_SERVER_API_KEY to protect the HTTP endpoint (REQUIRED)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { MCP_SERVER_API_KEY } from "./constants.js";

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

// Create the MCP server
const server = new McpServer({
  name: "dual-mcp-server",
  version: "1.0.0",
});

// Register all tool modules
registerWalletTools(server);
registerOrganizationTools(server);
registerTemplateTools(server);
registerObjectTools(server);
registerActionTools(server);
registerFaceTools(server);
registerStorageTools(server);
registerWebhookTools(server);
registerNotificationTools(server);
registerSequencerTools(server);
registerApiKeyTools(server);
registerPaymentTools(server);
registerSupportTools(server);
registerPublicApiTools(server);

// AI Services
registerIntelligenceTools(server);
registerGovernanceTools(server);
registerCreativeTools(server);

// --- Transport ---

async function runStdio(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("DUAL MCP server running via stdio");
  console.error(`API URL: ${process.env.DUAL_API_URL || "https://api.blockv-labs.io/v3"}`);
  console.error(`Auth: ${process.env.DUAL_API_KEY ? "API Key" : process.env.DUAL_ACCESS_TOKEN ? "JWT Token" : "None (use dual_login)"}`);
}

async function runHTTP(): Promise<void> {
  // Dynamic import for HTTP transport (only loaded when needed)
  const { default: express } = await import("express");
  const { StreamableHTTPServerTransport } = await import("@modelcontextprotocol/sdk/server/streamableHttp.js");

  const app = express();

  // --- H1: Security middleware ---
  // Body size limit (prevents DoS via large payloads)
  app.use(express.json({ limit: "1mb" }));

  // Security headers (subset of helmet, inline to avoid extra dependency)
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "0"); // modern approach: rely on CSP
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Content-Security-Policy", "default-src 'none'");
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    next();
  });

  // CORS: deny all by default (server-to-server use)
  app.use((_req, res, next) => {
    const allowedOrigin = process.env.CORS_ORIGIN;
    if (allowedOrigin) {
      res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
      res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
    }
    next();
  });

  // Rate limiting (simple in-memory, H1)
  const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
  const RATE_LIMIT_WINDOW = 60_000; // 1 minute
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

  // Periodic cleanup of rate limit map
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of rateLimitMap) {
      if (now > val.resetAt) rateLimitMap.delete(key);
    }
  }, RATE_LIMIT_WINDOW);

  // --- C1: Authentication middleware ---
  function authMiddleware(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction): void {
    // Skip auth if no server key is configured (dev mode)
    if (!MCP_SERVER_API_KEY) {
      console.error("WARNING: MCP_SERVER_API_KEY not set — HTTP endpoint is UNPROTECTED");
      return next();
    }

    const providedKey =
      (req.headers["x-api-key"] as string | undefined) ??
      (req.headers["authorization"]?.startsWith("Bearer ") ? req.headers["authorization"].slice(7) : undefined);

    if (!providedKey || providedKey !== MCP_SERVER_API_KEY) {
      res.status(401).json({ error: "Unauthorized. Provide a valid X-API-Key or Authorization: Bearer <key> header." });
      return;
    }
    next();
  }

  app.post("/mcp", authMiddleware, async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  // M9: Health check — minimal info disclosure
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // M8: Port validation
  const rawPort = parseInt(process.env.PORT || "3100");
  const port = Number.isNaN(rawPort) ? 3100 : Math.max(1, Math.min(65535, rawPort));

  app.listen(port, () => {
    console.error(`DUAL MCP server running on http://localhost:${port}/mcp`);
    if (!MCP_SERVER_API_KEY) {
      console.error("⚠️  WARNING: Set MCP_SERVER_API_KEY to protect the HTTP endpoint!");
    }
  });
}

// Launch
const transport = process.env.TRANSPORT || "stdio";
if (transport === "http") {
  runHTTP().catch((err) => { console.error("Server error:", err); process.exit(1); });
} else {
  runStdio().catch((err) => { console.error("Server error:", err); process.exit(1); });
}
