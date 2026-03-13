/** Truncate response if it exceeds character limit */
export declare function truncateIfNeeded(text: string, itemCount?: number): string;
/** Format a timestamp to human-readable */
export declare function formatDate(iso: string | undefined): string;
/** Build pagination metadata */
export declare function paginationMeta(total: number, count: number, offset: number): {
    total: number;
    count: number;
    offset: number;
    has_more: boolean;
    next_offset?: number;
};
/** Standard success content response */
export declare function textResult(text: string): {
    content: {
        type: "text";
        text: string;
    }[];
};
/** Standard error content response */
export declare function errorResult(text: string): {
    content: {
        type: "text";
        text: string;
    }[];
    isError: true;
};
//# sourceMappingURL=formatters.d.ts.map