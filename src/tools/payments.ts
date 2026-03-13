import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeApiRequest, handleApiError } from "../services/api-client.js";
import { textResult, errorResult } from "../services/formatters.js";
import { CursorPaginationSchema } from "../schemas/common.js";

export function registerPaymentTools(server: McpServer): void {

  server.registerTool("dual_get_payment_config", {
    title: "Get Payment Configuration",
    description: "Get the platform's payment configuration — deposit addresses, supported tokens, and fee structure.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async () => {
    try {
      const res = await makeApiRequest<Record<string, unknown>>("payments/config");
      return textResult(JSON.stringify(res, null, 2));
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_list_deposits", {
    title: "List Deposits",
    description: "List deposit transactions. Filter by transaction hash, token, or token address.",
    inputSchema: {
      tx_hash: z.string().optional().describe("Filter by transaction hash"),
      token: z.string().optional().describe("Filter by token symbol"),
      token_address: z.string().optional().describe("Filter by token contract address"),
      ...CursorPaginationSchema,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const res = await makeApiRequest<unknown>("payments/deposits", "GET", undefined, params);
      return textResult(JSON.stringify(res, null, 2));
    } catch (e) { return errorResult(handleApiError(e)); }
  });
}
