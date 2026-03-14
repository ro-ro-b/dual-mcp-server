import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeApiRequest, handleApiError } from "../services/api-client.js";
import { textResult, errorResult } from "../services/formatters.js";
import { CursorPaginationSchema, IdParam } from "../schemas/common.js";

export function registerSupportTools(server: McpServer): void {

  server.registerTool("dual_request_access", {
    title: "Request Feature Access",
    description: "Request access to a gated platform feature.",
    inputSchema: {
      feature: z.string().max(200).describe("Feature name to request access to"),
      reason: z.string().max(5000).optional().describe("Reason for the request"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      await makeApiRequest("support/request-access", "POST", params);
      return textResult(`Access requested for feature: ${params.feature}`);
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_list_support_messages", {
    title: "List Support Messages",
    description: "List support messages.",
    inputSchema: {
      wallet_id: z.string().max(200).optional().describe("Filter by wallet ID"),
      prefix: z.string().max(200).optional().describe("Filter by subject prefix"),
      ...CursorPaginationSchema,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const res = await makeApiRequest<unknown>("support", "GET", undefined, params);
      return textResult(JSON.stringify(res, null, 2));
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_send_support_message", {
    title: "Send Support Message",
    description: "Send a support message to the DUAL team.",
    inputSchema: {
      subject: z.string().max(500).describe("Message subject"),
      body: z.string().max(5000).describe("Message body"),
      public: z.boolean().optional().describe("Whether the message is public"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      const res = await makeApiRequest<Record<string, unknown>>("support", "POST", params);
      return textResult(`Support message sent.\n${JSON.stringify(res, null, 2)}`);
    } catch (e) { return errorResult(handleApiError(e)); }
  });
}
