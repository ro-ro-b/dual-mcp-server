import { z } from "zod";
import { DEFAULT_LIMIT, MAX_LIMIT } from "../constants.js";
/** Reusable pagination parameters */
export const PaginationSchema = {
    limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT)
        .describe("Maximum results to return (1-100, default 20)"),
    offset: z.number().int().min(0).default(0)
        .describe("Number of results to skip for pagination"),
};
/** Cursor-based pagination (DUAL uses 'next' cursor) */
export const CursorPaginationSchema = {
    limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT)
        .describe("Maximum results to return (1-100, default 20)"),
    next: z.string().optional()
        .describe("Cursor for next page (from previous response)"),
};
/** Standard ID parameter */
export const IdParam = z.string().min(1).describe("Resource ID");
//# sourceMappingURL=common.js.map