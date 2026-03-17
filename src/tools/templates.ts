import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient, handleApiError } from "../services/api-client.js";
import { textResult, errorResult } from "../services/formatters.js";
import { CursorPaginationSchema, IdParam, boundedJsonObject } from "../schemas/common.js";

export function registerTemplateTools(server: McpServer, api: ApiClient): void {

  server.registerTool("dual_list_templates", {
    title: "List Templates",
    description: "List token templates. Templates define the structure, properties, and actions of tokenized objects. Filter by prefix or FQDN.",
    inputSchema: {
      prefix: z.string().optional().describe("Filter by template name prefix"),
      fqdn: z.string().optional().describe("Filter by fully qualified domain name"),
      ...CursorPaginationSchema,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const res = await api.makeRequest<{ items: unknown[]; next?: string }>("templates", "GET", undefined, params);
      return textResult(JSON.stringify(res, null, 2));
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_create_template", {
    title: "Create Template",
    description: `Create a new token template that defines the structure of tokenized objects.
Specify the property schema, allowed actions, and access rules.
Example: Create a "Reward Token" template with properties like points, expiry_date, and redeemable status.`,
    inputSchema: {
      name: z.string().min(1).max(200).describe("Template name (e.g. 'Reward Token', 'Digital Product Passport')"),
      fqdn: z.string().optional().describe("Fully qualified domain name"),
      object: boundedJsonObject().describe("Properties schema defining the object structure (JSON object)"),
      actions: z.array(z.string()).optional().describe("List of action type names allowed on objects of this template"),
      public_access: z.boolean().optional().describe("Whether objects are publicly accessible without auth"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      const res = await api.makeRequest<Record<string, unknown>>("templates", "POST", params);
      return textResult(`Template created.\n${JSON.stringify(res, null, 2)}`);
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_get_template", {
    title: "Get Template",
    description: "Get full details of a template including its property schema, actions, and factory config.",
    inputSchema: { template_id: IdParam },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const res = await api.makeRequest<Record<string, unknown>>(`templates/${params.template_id}`);
      return textResult(JSON.stringify(res, null, 2));
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_update_template", {
    title: "Update Template",
    description: "Update a template's name, property schema, or access rules.",
    inputSchema: {
      template_id: IdParam,
      name: z.string().min(1).max(200).optional().describe("New name"),
      object: boundedJsonObject().optional().describe("Updated properties schema"),
      public_access: z.boolean().optional().describe("Updated public access setting"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const { template_id, ...body } = params;
      const res = await api.makeRequest<Record<string, unknown>>(`templates/${template_id}`, "PATCH", body);
      return textResult(`Template updated.\n${JSON.stringify(res, null, 2)}`);
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_delete_template", {
    title: "Delete Template",
    description: "Permanently delete a template. This cannot be undone.",
    inputSchema: { template_id: IdParam },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      await api.makeRequest(`templates/${params.template_id}`, "DELETE");
      return textResult(`Template ${params.template_id} deleted.`);
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_list_template_variations", {
    title: "List Template Variations",
    description: "List all variations of a template. Variations are alternative configurations of the same template.",
    inputSchema: { template_id: IdParam },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const res = await api.makeRequest<unknown>(`templates/${params.template_id}/variations`);
      return textResult(JSON.stringify(res, null, 2));
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_create_template_variation", {
    title: "Create Template Variation",
    description: "Create a variation of an existing template with overridden properties.",
    inputSchema: {
      template_id: IdParam,
      name: z.string().min(1).max(200).describe("Variation name"),
      object: boundedJsonObject().describe("Variation-specific property overrides"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      const { template_id, ...body } = params;
      const res = await api.makeRequest<Record<string, unknown>>(`templates/${template_id}/variations`, "POST", body);
      return textResult(`Variation created.\n${JSON.stringify(res, null, 2)}`);
    } catch (e) { return errorResult(handleApiError(e)); }
  });
}
