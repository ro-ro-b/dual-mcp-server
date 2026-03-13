import { z } from "zod";
import { makeApiRequest, handleApiError } from "../services/api-client.js";
import { textResult, errorResult } from "../services/formatters.js";
import { CursorPaginationSchema, IdParam } from "../schemas/common.js";
export function registerSequencerTools(server) {
    server.registerTool("dual_list_batches", {
        title: "List Sequencer Batches",
        description: "List sequencer batches. Batches group multiple transactions for efficient on-chain anchoring via ZK-rollup.",
        inputSchema: { ...CursorPaginationSchema },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async (params) => {
        try {
            const res = await makeApiRequest("batches", "GET", undefined, params);
            return textResult(JSON.stringify(res, null, 2));
        }
        catch (e) {
            return errorResult(handleApiError(e));
        }
    });
    server.registerTool("dual_get_batch", {
        title: "Get Batch Details",
        description: "Get details of a sequencer batch including all contained transactions.",
        inputSchema: { batch_id: IdParam },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async (params) => {
        try {
            const res = await makeApiRequest(`batches/${params.batch_id}`);
            return textResult(JSON.stringify(res, null, 2));
        }
        catch (e) {
            return errorResult(handleApiError(e));
        }
    });
    server.registerTool("dual_list_checkpoints", {
        title: "List ZK Checkpoints",
        description: "List ZK-rollup checkpoints. Each checkpoint contains a state root and proof that anchors batches to L1.",
        inputSchema: {
            prev_state_root: z.string().optional().describe("Filter by previous state root"),
            next_state_root: z.string().optional().describe("Filter by next state root"),
            ...CursorPaginationSchema,
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async (params) => {
        try {
            const res = await makeApiRequest("checkpoints", "GET", undefined, params);
            return textResult(JSON.stringify(res, null, 2));
        }
        catch (e) {
            return errorResult(handleApiError(e));
        }
    });
    server.registerTool("dual_get_checkpoint", {
        title: "Get ZK Checkpoint",
        description: "Get a specific ZK-rollup checkpoint with its proof data and state roots.",
        inputSchema: { checkpoint_id: IdParam },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async (params) => {
        try {
            const res = await makeApiRequest(`checkpoints/${params.checkpoint_id}`);
            return textResult(JSON.stringify(res, null, 2));
        }
        catch (e) {
            return errorResult(handleApiError(e));
        }
    });
}
//# sourceMappingURL=sequencer.js.map