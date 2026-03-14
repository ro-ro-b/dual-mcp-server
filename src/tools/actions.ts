import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeApiRequest, handleApiError } from "../services/api-client.js";
import { textResult, errorResult } from "../services/formatters.js";
import { CursorPaginationSchema, IdParam } from "../schemas/common.js";
import { assertNoOperatorKeys } from "../services/security.js";

export function registerActionTools(server: McpServer): void {

  server.registerTool("dual_execute_action", {
    title: "Execute Action",
    description: `Execute an action on a tokenized object via the Event Bus. Actions are the primary way to change object state.
Examples: mint tokens, transfer ownership, redeem rewards, update status.
The action_type must match a registered action type, and the object must belong to a template that allows it.`,
    inputSchema: {
      action_type: z.string().max(200).describe("Action type name (e.g. 'Transfer', 'Redeem', 'Mint')"),
      object_id: z.string().max(200).describe("Target object ID"),
      payload: z.record(z.unknown()).optional().describe("Action payload data (depends on action type schema)"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      const res = await makeApiRequest<Record<string, unknown>>("ebus/actions", "POST", params);
      return textResult(`Action executed.\n${JSON.stringify(res, null, 2)}`);
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_batch_actions", {
    title: "Execute Batch Actions",
    description: `Execute multiple actions atomically in a single batch. All actions succeed or all fail.
Useful for complex operations like: mint + transfer + configure in one transaction.`,
    inputSchema: {
      actions: z.array(z.object({
        action_type: z.string().max(200).describe("Action type name"),
        object_id: z.string().max(200).describe("Target object ID"),
        payload: z.record(z.unknown()).optional().describe("Action payload"),
      })).min(1).max(50).describe("Array of actions to execute atomically (1-50)"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      // M7: Validate total batch payload size
      const payloadSize = JSON.stringify(params.actions).length;
      if (payloadSize > 500000) {
        return errorResult("Error: Batch payload too large (max 500KB total).");
      }
      const res = await makeApiRequest<Record<string, unknown>>("ebus/actions/batch", "POST", params);
      return textResult(`Batch of ${params.actions.length} actions executed.\n${JSON.stringify(res, null, 2)}`);
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_list_actions", {
    title: "List Actions",
    description: "List executed actions. Filter by action ID or template.",
    inputSchema: {
      action_id: z.string().optional().describe("Filter by specific action ID"),
      template_id: z.string().optional().describe("Filter by template ID"),
      ...CursorPaginationSchema,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const res = await makeApiRequest<{ items: unknown[]; next?: string }>("ebus/actions", "GET", undefined, params);
      return textResult(JSON.stringify(res, null, 2));
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_get_action", {
    title: "Get Action Details",
    description: "Get full details of a specific executed action.",
    inputSchema: { action_id: IdParam },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const res = await makeApiRequest<Record<string, unknown>>(`ebus/actions/${params.action_id}`);
      return textResult(JSON.stringify(res, null, 2));
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_list_action_types", {
    title: "List Action Types",
    description: "List all registered action types. Action types define what operations can be performed on objects.",
    inputSchema: {
      name: z.string().max(200).optional().describe("Filter by action type name"),
      limit: z.number().int().min(1).max(100).default(20).optional().describe("Max results"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const res = await makeApiRequest<unknown>("ebus/action-types", "GET", undefined, params);
      return textResult(JSON.stringify(res, null, 2));
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_create_action_type", {
    title: "Create Action Type",
    description: "Register a new action type with an optional JSON schema for payload validation.",
    inputSchema: {
      name: z.string().max(200).describe("Action type name (e.g. 'Transfer', 'Redeem', 'UpdateStatus')"),
      description: z.string().max(5000).optional().describe("Human-readable description"),
      schema: z.record(z.unknown()).optional().describe("JSON Schema for validating action payloads"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      const res = await makeApiRequest<Record<string, unknown>>("ebus/action-types", "POST", params);
      return textResult(`Action type created.\n${JSON.stringify(res, null, 2)}`);
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_update_action_type", {
    title: "Update Action Type",
    description: "Update an action type's name, description, or payload schema.",
    inputSchema: {
      action_type_id: IdParam,
      name: z.string().max(200).optional().describe("New name"),
      description: z.string().max(5000).optional().describe("New description"),
      schema: z.record(z.unknown()).optional().describe("Updated JSON Schema"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const { action_type_id, ...body } = params;
      const res = await makeApiRequest<Record<string, unknown>>(`ebus/action-types/${action_type_id}`, "PUT", body);
      return textResult(`Action type updated.\n${JSON.stringify(res, null, 2)}`);
    } catch (e) { return errorResult(handleApiError(e)); }
  });
}
