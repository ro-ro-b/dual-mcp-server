import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient, handleApiError } from "../services/api-client.js";
import { textResult, errorResult } from "../services/formatters.js";
import { CursorPaginationSchema, IdParam } from "../schemas/common.js";

export function registerNotificationTools(server: McpServer, api: ApiClient): void {

  server.registerTool("dual_list_messages", {
    title: "List Messages",
    description: "List notification messages sent through the platform.",
    inputSchema: { ...CursorPaginationSchema },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const res = await api.makeRequest<unknown>("messages", "GET", undefined, params);
      return textResult(JSON.stringify(res, null, 2));
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_send_notification", {
    title: "Send Notification",
    description: "Send a notification message to one or more wallets using a message template.",
    inputSchema: {
      to: z.array(z.string().max(200)).min(1).describe("Array of recipient wallet IDs"),
      template_id: z.string().max(200).describe("Message template ID"),
      subject: z.string().max(500).optional().describe("Override template subject"),
      body: z.string().max(5000).optional().describe("Override template body"),
      data: z.record(z.string(), z.unknown()).optional().describe("Template variable substitutions"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      const res = await api.makeRequest<Record<string, unknown>>("messages/send", "POST", params);
      return textResult(`Notification sent to ${params.to.length} recipient(s).\n${JSON.stringify(res, null, 2)}`);
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_list_message_templates", {
    title: "List Message Templates",
    description: "List all notification message templates.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async () => {
    try {
      const res = await api.makeRequest<unknown>("messages/templates");
      return textResult(JSON.stringify(res, null, 2));
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_create_message_template", {
    title: "Create Message Template",
    description: "Create a notification template with subject, body (with placeholders), and delivery channels.",
    inputSchema: {
      name: z.string().max(200).describe("Template name"),
      subject: z.string().max(500).describe("Message subject (supports {{variable}} placeholders)"),
      body: z.string().max(5000).describe("Message body (supports {{variable}} placeholders)"),
      channels: z.array(z.enum(["email", "push", "sms"])).describe("Delivery channels"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      const res = await api.makeRequest<Record<string, unknown>>("messages/templates", "POST", params);
      return textResult(`Message template created.\n${JSON.stringify(res, null, 2)}`);
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_delete_message_template", {
    title: "Delete Message Template",
    description: "Delete a message template.",
    inputSchema: { template_id: IdParam },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      await api.makeRequest(`messages/templates/${params.template_id}`, "DELETE");
      return textResult(`Message template ${params.template_id} deleted.`);
    } catch (e) { return errorResult(handleApiError(e)); }
  });
}
