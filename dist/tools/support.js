import { z } from "zod";
import { makeApiRequest, handleApiError } from "../services/api-client.js";
import { textResult, errorResult } from "../services/formatters.js";
import { CursorPaginationSchema } from "../schemas/common.js";
export function registerSupportTools(server) {
    server.registerTool("dual_request_access", {
        title: "Request Feature Access",
        description: "Request access to a gated platform feature.",
        inputSchema: {
            feature: z.string().describe("Feature name to request access to"),
            reason: z.string().optional().describe("Reason for the request"),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async (params) => {
        try {
            await makeApiRequest("support/request-access", "POST", params);
            return textResult(`Access requested for feature: ${params.feature}`);
        }
        catch (e) {
            return errorResult(handleApiError(e));
        }
    });
    server.registerTool("dual_list_support_messages", {
        title: "List Support Messages",
        description: "List support messages.",
        inputSchema: {
            wallet_id: z.string().optional().describe("Filter by wallet ID"),
            prefix: z.string().optional().describe("Filter by subject prefix"),
            ...CursorPaginationSchema,
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async (params) => {
        try {
            const res = await makeApiRequest("support", "GET", undefined, params);
            return textResult(JSON.stringify(res, null, 2));
        }
        catch (e) {
            return errorResult(handleApiError(e));
        }
    });
    server.registerTool("dual_send_support_message", {
        title: "Send Support Message",
        description: "Send a support message to the DUAL team.",
        inputSchema: {
            subject: z.string().describe("Message subject"),
            body: z.string().describe("Message body"),
            public: z.boolean().optional().describe("Whether the message is public"),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    }, async (params) => {
        try {
            const res = await makeApiRequest("support", "POST", params);
            return textResult(`Support message sent.\n${JSON.stringify(res, null, 2)}`);
        }
        catch (e) {
            return errorResult(handleApiError(e));
        }
    });
}
//# sourceMappingURL=support.js.map