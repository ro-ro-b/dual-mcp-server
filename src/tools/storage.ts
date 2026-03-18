import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient, handleApiError } from "../services/api-client.js";
import { textResult, errorResult } from "../services/formatters.js";
import { IdParam } from "../schemas/common.js";
import { assertExternalUrl } from "../services/security.js";

export function registerStorageTools(server: McpServer, api: ApiClient): void {

  server.registerTool("dual_upload_file", {
    title: "Upload File",
    description: "Upload a file to DUAL storage. Returns a public URL. Useful for template assets, face images, and attachments.",
    inputSchema: {
      file_url: z.string().max(2048).describe("URL of the file to upload (the server will fetch and upload it)"),
      folder: z.string().optional().describe("Optional folder path for organization"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      await assertExternalUrl(params.file_url);
      const res = await api.makeRequest<{ id: string; url: string }>("storage/upload", "POST", params);
      return textResult(`File uploaded.\nID: ${res.id}\nURL: ${res.url}`);
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_get_file", {
    title: "Get File",
    description: "Get a file's URL or content by its storage ID.",
    inputSchema: {
      file_id: IdParam,
      no_redirect: z.boolean().optional().describe("Return URL instead of redirecting"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const res = await api.makeRequest<Record<string, unknown>>(`storage/${params.file_id}`, "GET", undefined, { noRedirect: params.no_redirect });
      return textResult(JSON.stringify(res, null, 2));
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_delete_file", {
    title: "Delete File",
    description: "Delete a file from DUAL storage.",
    inputSchema: { file_id: IdParam },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      await api.makeRequest(`storage/${params.file_id}`, "DELETE");
      return textResult(`File ${params.file_id} deleted.`);
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_get_template_assets", {
    title: "Get Template Assets",
    description: "List all storage assets associated with a template.",
    inputSchema: { template_id: IdParam },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const res = await api.makeRequest<unknown>(`storage/template/${params.template_id}`);
      return textResult(JSON.stringify(res, null, 2));
    } catch (e) { return errorResult(handleApiError(e)); }
  });
}
