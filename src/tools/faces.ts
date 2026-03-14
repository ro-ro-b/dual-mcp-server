import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeApiRequest, handleApiError } from "../services/api-client.js";
import { textResult, errorResult } from "../services/formatters.js";
import { CursorPaginationSchema, IdParam } from "../schemas/common.js";

export function registerFaceTools(server: McpServer): void {

  server.registerTool("dual_list_faces", {
    title: "List Faces",
    description: "List face definitions. Faces are visual representations (images, 3D models, web views) attached to templates.",
    inputSchema: { ...CursorPaginationSchema },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const res = await makeApiRequest<unknown>("faces", "GET", undefined, params);
      return textResult(JSON.stringify(res, null, 2));
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_create_face", {
    title: "Create Face",
    description: "Create a visual face for a template. Types: image, image_progress, image_policy, image_layered, 3d, web.",
    inputSchema: {
      template_id: z.string().max(200).describe("Template to attach the face to"),
      display_url: z.string().max(2048).describe("URL of the visual asset"),
      type: z.enum(["image", "image_progress", "image_policy", "image_layered", "3d", "web"]).describe("Face type"),
      platform: z.enum(["web", "ios", "android"]).optional().describe("Target platform (optional)"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      const res = await makeApiRequest<Record<string, unknown>>("faces", "POST", params);
      return textResult(`Face created.\n${JSON.stringify(res, null, 2)}`);
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_get_face", {
    title: "Get Face",
    description: "Get details of a specific face.",
    inputSchema: { face_id: IdParam },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const res = await makeApiRequest<Record<string, unknown>>(`faces/${params.face_id}`);
      return textResult(JSON.stringify(res, null, 2));
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_update_face", {
    title: "Update Face",
    description: "Update a face's display URL or type.",
    inputSchema: {
      face_id: IdParam,
      display_url: z.string().max(2048).optional().describe("New display URL"),
      type: z.enum(["image", "image_progress", "image_policy", "image_layered", "3d", "web"]).optional().describe("New face type"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const { face_id, ...body } = params;
      const res = await makeApiRequest<Record<string, unknown>>(`faces/${face_id}`, "PATCH", body);
      return textResult(`Face updated.\n${JSON.stringify(res, null, 2)}`);
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_delete_face", {
    title: "Delete Face",
    description: "Delete a face definition.",
    inputSchema: { face_id: IdParam },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      await makeApiRequest(`faces/${params.face_id}`, "DELETE");
      return textResult(`Face ${params.face_id} deleted.`);
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_get_template_faces", {
    title: "Get Template Faces",
    description: "Get all faces associated with a specific template.",
    inputSchema: { template_id: IdParam },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const res = await makeApiRequest<unknown>(`faces/template/${params.template_id}`);
      return textResult(JSON.stringify(res, null, 2));
    } catch (e) { return errorResult(handleApiError(e)); }
  });
}
