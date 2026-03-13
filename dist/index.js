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
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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
// --- Transport ---
async function runStdio() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("DUAL MCP server running via stdio");
    console.error(`API URL: ${process.env.DUAL_API_URL || "https://api.blockv-labs.io/v3"}`);
    console.error(`Auth: ${process.env.DUAL_API_KEY ? "API Key" : process.env.DUAL_ACCESS_TOKEN ? "JWT Token" : "None (use dual_login)"}`);
}
async function runHTTP() {
    // Dynamic import for HTTP transport (only loaded when needed)
    const { default: express } = await import("express");
    const { StreamableHTTPServerTransport } = await import("@modelcontextprotocol/sdk/server/streamableHttp.js");
    const app = express();
    app.use(express.json());
    app.post("/mcp", async (req, res) => {
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
            enableJsonResponse: true,
        });
        res.on("close", () => transport.close());
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    });
    // Health check
    app.get("/health", (_req, res) => {
        res.json({ status: "ok", server: "dual-mcp-server", version: "1.0.0" });
    });
    const port = parseInt(process.env.PORT || "3100");
    app.listen(port, () => {
        console.error(`DUAL MCP server running on http://localhost:${port}/mcp`);
    });
}
// Launch
const transport = process.env.TRANSPORT || "stdio";
if (transport === "http") {
    runHTTP().catch((err) => { console.error("Server error:", err); process.exit(1); });
}
else {
    runStdio().catch((err) => { console.error("Server error:", err); process.exit(1); });
}
//# sourceMappingURL=index.js.map