import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeApiRequest, handleApiError } from "../services/api-client.js";
import { textResult, errorResult } from "../services/formatters.js";
import { CursorPaginationSchema, IdParam } from "../schemas/common.js";

export function registerPublicApiTools(server: McpServer): void {

  server.registerTool("dual_public_list_templates", {
    title: "List Public Templates",
    description: "List publicly accessible templates. No authentication required.",
    inputSchema: {
      fqdn: z.string().optional().describe("Filter by FQDN"),
      ...CursorPaginationSchema,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const res = await makeApiRequest<unknown>("public/templates", "GET", undefined, params);
      return textResult(JSON.stringify(res, null, 2));
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_public_get_template", {
    title: "Get Public Template",
    description: "Get a public template's details. No authentication required.",
    inputSchema: { template_id: IdParam },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const res = await makeApiRequest<Record<string, unknown>>(`public/templates/${params.template_id}`);
      return textResult(JSON.stringify(res, null, 2));
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_public_get_object", {
    title: "Get Public Object",
    description: "Get a public object's details. No authentication required.",
    inputSchema: { object_id: IdParam },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const res = await makeApiRequest<Record<string, unknown>>(`public/objects/${params.object_id}`);
      return textResult(JSON.stringify(res, null, 2));
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_public_search_objects", {
    title: "Search Public Objects",
    description: "Search publicly accessible objects. No authentication required.",
    inputSchema: {
      filter: z.record(z.unknown()).describe("Search filter criteria"),
      limit: z.number().int().min(1).max(100).default(20).optional().describe("Max results"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const res = await makeApiRequest<unknown>("public/objects/search", "POST", params);
      return textResult(JSON.stringify(res, null, 2));
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_public_get_stats", {
    title: "Get Platform Statistics",
    description: "Get public platform statistics — total objects, templates, and wallets. No authentication required.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async () => {
    try {
      const res = await makeApiRequest<Record<string, unknown>>("public/stats");
      return textResult(JSON.stringify(res, null, 2));
    } catch (e) { return errorResult(handleApiError(e)); }
  });
}
