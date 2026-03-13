import { z } from "zod";
/** Reusable pagination parameters */
export declare const PaginationSchema: {
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
};
/** Cursor-based pagination (DUAL uses 'next' cursor) */
export declare const CursorPaginationSchema: {
    limit: z.ZodDefault<z.ZodNumber>;
    next: z.ZodOptional<z.ZodString>;
};
/** Standard ID parameter */
export declare const IdParam: z.ZodString;
//# sourceMappingURL=common.d.ts.map