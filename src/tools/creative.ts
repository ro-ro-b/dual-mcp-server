import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { aiRequest } from "../services/ai-client.js";
import { textResult, errorResult } from "../services/formatters.js";

export function registerCreativeTools(server: McpServer): void {

  // --- DESIGNS ---

  server.registerTool("dual_creative_design_generate", {
    title: "Generate Token Design",
    description: "Generate a complete token template design from a natural language description.",
    inputSchema: {
      description: z.string().max(1000).describe("Description of the desired token design"),
      useCase: z.enum(["collectible", "ticket", "loyalty", "certificate", "membership", "asset"]).optional().describe("Use case category"),
      constraints: z.object({
        maxFields: z.number().int().optional().describe("Maximum template fields"),
        requiredFields: z.array(z.string()).optional().describe("Fields that must be included"),
      }).optional().describe("Design constraints"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async (params) => {
    try {
      const res = await aiRequest<Record<string, unknown>>("creative", "/api/designs/generate", "POST", params);
      return textResult(`Design generated:\n  ID: ${res.id}\n  Name: ${res.name}\n  Use case: ${res.useCase}\n  Version: ${res.version}\n\nTemplate spec:\n${JSON.stringify(res.templateSpec, null, 2)}`);
    } catch (e: unknown) { return errorResult(e instanceof Error ? e.message : String(e)); }
  });

  server.registerTool("dual_creative_design_list", {
    title: "List Token Designs",
    description: "List all generated token designs with optional use case filter.",
    inputSchema: {
      useCase: z.string().optional().describe("Filter by use case"),
      limit: z.number().int().optional().describe("Page size"),
      offset: z.number().int().optional().describe("Offset"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (params) => {
    try {
      const query: Record<string, string> = {};
      if (params.useCase) query.useCase = params.useCase;
      if (params.limit) query.limit = String(params.limit);
      if (params.offset) query.offset = String(params.offset);
      const res = await aiRequest<Record<string, unknown>>("creative", "/api/designs", "GET", undefined, query);
      const designs = res.designs as Array<Record<string, unknown>>;
      if (!designs?.length) return textResult("No designs found.");
      let text = `${res.total} designs:\n\n`;
      for (const d of designs) {
        text += `  [${d.id}] ${d.name} (${d.useCase}) v${d.version}\n`;
      }
      return textResult(text);
    } catch (e: unknown) { return errorResult(e instanceof Error ? e.message : String(e)); }
  });

  server.registerTool("dual_creative_design_get", {
    title: "Get Token Design",
    description: "Get a specific token design by ID with full template specification.",
    inputSchema: {
      id: z.string().describe("Design ID"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (params) => {
    try {
      const res = await aiRequest("creative", `/api/designs/${params.id}`);
      return textResult(JSON.stringify(res, null, 2));
    } catch (e: unknown) { return errorResult(e instanceof Error ? e.message : String(e)); }
  });

  server.registerTool("dual_creative_design_refine", {
    title: "Refine Token Design",
    description: "Refine an existing token design — add/remove fields, adjust properties.",
    inputSchema: {
      id: z.string().describe("Design ID to refine"),
      refinement: z.string().max(1000).describe("Description of desired changes"),
      addFields: z.array(z.object({
        fieldName: z.string(),
        fieldType: z.string(),
        required: z.boolean().optional(),
        description: z.string().optional(),
      })).optional().describe("Fields to add"),
      removeFields: z.array(z.string()).optional().describe("Field names to remove"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async (params) => {
    try {
      const { id, ...body } = params;
      const res = await aiRequest<Record<string, unknown>>("creative", `/api/designs/${id}/refine`, "POST", body);
      return textResult(`Design refined:\n  ID: ${res.id}\n  Name: ${res.name}\n  Version: ${res.version}\n\nUpdated spec:\n${JSON.stringify(res.templateSpec, null, 2)}`);
    } catch (e: unknown) { return errorResult(e instanceof Error ? e.message : String(e)); }
  });

  server.registerTool("dual_creative_design_delete", {
    title: "Delete Token Design",
    description: "Delete a token design by ID.",
    inputSchema: {
      id: z.string().describe("Design ID"),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  }, async (params) => {
    try {
      await aiRequest("creative", `/api/designs/${params.id}`, "DELETE");
      return textResult(`Design ${params.id} deleted.`);
    } catch (e: unknown) { return errorResult(e instanceof Error ? e.message : String(e)); }
  });

  // --- FACE TEMPLATES ---

  server.registerTool("dual_creative_face_create", {
    title: "Create Face Template",
    description: "Create a face template with SVG base and data bindings for dynamic token rendering.",
    inputSchema: {
      name: z.string().max(200).describe("Template name"),
      svgBase: z.string().describe("SVG template string with {{binding}} placeholders"),
      bindings: z.array(z.object({
        field: z.string().describe("Binding field name"),
        type: z.enum(["text", "image", "color", "number"]).describe("Data type"),
        required: z.boolean().optional().describe("Is this binding required?"),
        fallback: z.string().optional().describe("Default value if not provided"),
      })).describe("Data binding definitions"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async (params) => {
    try {
      const res = await aiRequest<Record<string, unknown>>("creative", "/api/faces/templates", "POST", params);
      return textResult(`Face template created:\n  ID: ${res.id}\n  Name: ${res.name}\n  Bindings: ${(res.bindings as unknown[]).length}`);
    } catch (e: unknown) { return errorResult(e instanceof Error ? e.message : String(e)); }
  });

  server.registerTool("dual_creative_face_list", {
    title: "List Face Templates",
    description: "List all face templates.",
    inputSchema: {
      limit: z.number().int().optional().describe("Page size"),
      offset: z.number().int().optional().describe("Offset"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (params) => {
    try {
      const query: Record<string, string> = {};
      if (params.limit) query.limit = String(params.limit);
      if (params.offset) query.offset = String(params.offset);
      const res = await aiRequest<Record<string, unknown>>("creative", "/api/faces/templates", "GET", undefined, query);
      const templates = res.templates as Array<Record<string, unknown>>;
      if (!templates?.length) return textResult("No face templates found.");
      let text = `${res.total} face templates:\n\n`;
      for (const t of templates) {
        text += `  [${t.id}] ${t.name}\n`;
      }
      return textResult(text);
    } catch (e: unknown) { return errorResult(e instanceof Error ? e.message : String(e)); }
  });

  server.registerTool("dual_creative_face_render", {
    title: "Render Face Template",
    description: "Render a face template with token data, producing HTML output.",
    inputSchema: {
      templateId: z.string().describe("Face template ID"),
      tokenData: z.record(z.string(), z.unknown()).describe("Token data to bind into the template"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (params) => {
    try {
      const res = await aiRequest<Record<string, unknown>>("creative", "/api/faces/render", "POST", params);
      return textResult(`Face rendered:\n  Face ID: ${res.faceId}\n  Rendered at: ${res.renderedAt}\n  HTML length: ${(res.html as string).length} chars`);
    } catch (e: unknown) { return errorResult(e instanceof Error ? e.message : String(e)); }
  });
}
