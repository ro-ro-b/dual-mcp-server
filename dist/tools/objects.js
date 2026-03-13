import { z } from "zod";
import { makeApiRequest, handleApiError } from "../services/api-client.js";
import { textResult, errorResult } from "../services/formatters.js";
import { CursorPaginationSchema, IdParam } from "../schemas/common.js";
export function registerObjectTools(server) {
    server.registerTool("dual_list_objects", {
        title: "List Objects",
        description: `List tokenized objects (asset instances). Objects are created from templates and owned by wallets.
Filter by template, owner, FQDN, or geographic hash. Supports pagination.`,
        inputSchema: {
            template_id: z.string().optional().describe("Filter by template ID"),
            owner: z.string().optional().describe("Filter by owner wallet ID"),
            fqdn: z.string().optional().describe("Filter by FQDN"),
            dropped: z.boolean().optional().describe("Filter by dropped status"),
            geo_hash: z.string().optional().describe("Filter by geographic hash"),
            ...CursorPaginationSchema,
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async (params) => {
        try {
            const res = await makeApiRequest("objects", "GET", undefined, params);
            return textResult(JSON.stringify(res, null, 2));
        }
        catch (e) {
            return errorResult(handleApiError(e));
        }
    });
    server.registerTool("dual_get_object", {
        title: "Get Object",
        description: "Get full details of a tokenized object — its properties, ownership, faces, actions, and metadata.",
        inputSchema: { object_id: IdParam },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async (params) => {
        try {
            const res = await makeApiRequest(`objects/${params.object_id}`);
            return textResult(JSON.stringify(res, null, 2));
        }
        catch (e) {
            return errorResult(handleApiError(e));
        }
    });
    server.registerTool("dual_update_object", {
        title: "Update Object Properties",
        description: "Update the properties of a tokenized object. Only mutable properties can be changed.",
        inputSchema: {
            object_id: IdParam,
            properties: z.record(z.unknown()).describe("Properties to update (key-value pairs)"),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async (params) => {
        try {
            const res = await makeApiRequest(`objects/${params.object_id}`, "PATCH", { properties: params.properties });
            return textResult(`Object updated.\n${JSON.stringify(res, null, 2)}`);
        }
        catch (e) {
            return errorResult(handleApiError(e));
        }
    });
    server.registerTool("dual_get_object_children", {
        title: "Get Object Children",
        description: "Get child objects in a hierarchical object tree.",
        inputSchema: { object_id: IdParam },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async (params) => {
        try {
            const res = await makeApiRequest(`objects/${params.object_id}/children`);
            return textResult(JSON.stringify(res, null, 2));
        }
        catch (e) {
            return errorResult(handleApiError(e));
        }
    });
    server.registerTool("dual_get_object_parents", {
        title: "Get Object Parents",
        description: "Get parent objects in a hierarchical object tree.",
        inputSchema: { object_id: IdParam },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async (params) => {
        try {
            const res = await makeApiRequest(`objects/${params.object_id}/parents`);
            return textResult(JSON.stringify(res, null, 2));
        }
        catch (e) {
            return errorResult(handleApiError(e));
        }
    });
    server.registerTool("dual_get_object_activity", {
        title: "Get Object Activity",
        description: "Get the full activity/audit log for an object — all state changes, transfers, and action executions.",
        inputSchema: {
            object_id: IdParam,
            limit: z.number().int().min(1).max(100).default(20).optional().describe("Max results"),
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async (params) => {
        try {
            const res = await makeApiRequest(`objects/${params.object_id}/activity`, "GET", undefined, { limit: params.limit });
            return textResult(JSON.stringify(res, null, 2));
        }
        catch (e) {
            return errorResult(handleApiError(e));
        }
    });
    server.registerTool("dual_search_objects", {
        title: "Search Objects",
        description: `Search tokenized objects with filter criteria. Supports complex queries across all object properties.
Example filters: { "template_id": "abc123", "properties.status": "active" }`,
        inputSchema: {
            filter: z.record(z.unknown()).describe("Search filter criteria (key-value pairs)"),
            sort: z.record(z.unknown()).optional().describe("Sort criteria"),
            limit: z.number().int().min(1).max(100).default(20).optional().describe("Max results"),
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async (params) => {
        try {
            const res = await makeApiRequest("objects/search", "POST", params);
            return textResult(JSON.stringify(res, null, 2));
        }
        catch (e) {
            return errorResult(handleApiError(e));
        }
    });
    server.registerTool("dual_count_objects", {
        title: "Count Objects",
        description: "Count objects matching filter criteria without returning the full objects.",
        inputSchema: {
            filter: z.record(z.unknown()).describe("Filter criteria (same as search)"),
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async (params) => {
        try {
            const res = await makeApiRequest("objects/count", "POST", params);
            return textResult(`Count: ${res.count}`);
        }
        catch (e) {
            return errorResult(handleApiError(e));
        }
    });
}
//# sourceMappingURL=objects.js.map