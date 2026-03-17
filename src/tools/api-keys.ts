import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient, handleApiError } from "../services/api-client.js";
import { textResult, errorResult } from "../services/formatters.js";
import { IdParam } from "../schemas/common.js";

export function registerApiKeyTools(server: McpServer, api: ApiClient): void {

  server.registerTool("dual_list_api_keys", {
    title: "List API Keys",
    description: "List all API keys for the authenticated wallet.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async () => {
    try {
      const res = await api.makeRequest<{ items: unknown[] }>("api-keys");
      return textResult(JSON.stringify(res, null, 2));
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_create_api_key", {
    title: "Create API Key",
    description: "Create a new API key for server-to-server integration. The key value is only shown once — save it immediately.",
    inputSchema: {
      name: z.string().max(200).describe("Descriptive name for the key"),
      permissions: z.array(z.string().max(200)).optional().describe("Optional permissions to restrict the key's access"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      const res = await api.makeRequest<{ id: string; key: string; name: string }>("api-keys", "POST", params);
      return textResult(`API Key created.\nName: ${res.name}\nID: ${res.id}\nKey: ${res.key}\n\n⚠️ SECURITY: Save this key immediately — it will NOT be shown again.\n⚠️ This key may appear in conversation history and logs. Rotate if compromised.`);
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_delete_api_key", {
    title: "Delete API Key",
    description: "Permanently revoke and delete an API key.",
    inputSchema: { api_key_id: IdParam },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      await api.makeRequest(`api-keys/${params.api_key_id}`, "DELETE");
      return textResult(`API key ${params.api_key_id} deleted and revoked.`);
    } catch (e) { return errorResult(handleApiError(e)); }
  });
}
