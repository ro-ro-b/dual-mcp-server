import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient, handleApiError } from "../services/api-client.js";
import { textResult, errorResult } from "../services/formatters.js";
import { IdParam } from "../schemas/common.js";
import { assertExternalUrl } from "../services/security.js";

export function registerWebhookTools(server: McpServer, api: ApiClient): void {

  server.registerTool("dual_list_webhooks", {
    title: "List Webhooks",
    description: "List all registered webhooks. Filter by type, template, action, or active status.",
    inputSchema: {
      type: z.string().optional().describe("Filter by event type"),
      template_id: z.string().optional().describe("Filter by template ID"),
      action: z.string().optional().describe("Filter by action type"),
      is_active: z.boolean().optional().describe("Filter by active status"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const res = await api.makeRequest<unknown>("webhooks", "GET", undefined, params);
      return textResult(JSON.stringify(res, null, 2));
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_create_webhook", {
    title: "Create Webhook",
    description: "Register a webhook to receive real-time notifications when events occur on the platform.",
    inputSchema: {
      url: z.string().url().max(2048).describe("HTTPS endpoint to receive webhook payloads"),
      type: z.string().describe("Event type to subscribe to"),
      template_id: z.string().optional().describe("Scope to a specific template"),
      action: z.string().optional().describe("Scope to a specific action type"),
      secret: z.string().optional().describe("Shared secret for webhook signature verification"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      await assertExternalUrl(params.url);
      const res = await api.makeRequest<Record<string, unknown>>("webhooks", "POST", params);
      return textResult(`Webhook created.\n${JSON.stringify(res, null, 2)}`);
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_get_webhook", {
    title: "Get Webhook",
    description: "Get details of a specific webhook.",
    inputSchema: { webhook_id: IdParam },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const res = await api.makeRequest<Record<string, unknown>>(`webhooks/${params.webhook_id}`);
      return textResult(JSON.stringify(res, null, 2));
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_update_webhook", {
    title: "Update Webhook",
    description: "Update a webhook's URL or active status.",
    inputSchema: {
      webhook_id: IdParam,
      url: z.string().url().max(2048).optional().describe("New endpoint URL"),
      is_active: z.boolean().optional().describe("Enable/disable the webhook"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const { webhook_id, ...body } = params;
      if (body.url) await assertExternalUrl(body.url);
      const res = await api.makeRequest<Record<string, unknown>>(`webhooks/${webhook_id}`, "PATCH", body);
      return textResult(`Webhook updated.\n${JSON.stringify(res, null, 2)}`);
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_delete_webhook", {
    title: "Delete Webhook",
    description: "Delete a webhook subscription.",
    inputSchema: { webhook_id: IdParam },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      await api.makeRequest(`webhooks/${params.webhook_id}`, "DELETE");
      return textResult(`Webhook ${params.webhook_id} deleted.`);
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_test_webhook", {
    title: "Test Webhook",
    description: "Send a test payload to a webhook endpoint to verify it's working.",
    inputSchema: {
      webhook_id: IdParam,
      payload: z.record(z.string(), z.unknown()).optional().describe("Custom test payload (optional)"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const { webhook_id, ...body } = params;
      const res = await api.makeRequest<Record<string, unknown>>(`webhooks/${webhook_id}/test`, "POST", body);
      return textResult(`Webhook test sent.\n${JSON.stringify(res, null, 2)}`);
    } catch (e) { return errorResult(handleApiError(e)); }
  });
}
