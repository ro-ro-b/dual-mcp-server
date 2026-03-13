import { CHARACTER_LIMIT } from "../constants.js";

/** Truncate response if it exceeds character limit */
export function truncateIfNeeded(text: string, itemCount?: number): string {
  if (text.length <= CHARACTER_LIMIT) return text;

  const truncated = text.slice(0, CHARACTER_LIMIT);
  const lastNewline = truncated.lastIndexOf("\n");
  const cleanTruncated = lastNewline > CHARACTER_LIMIT * 0.8 ? truncated.slice(0, lastNewline) : truncated;

  return cleanTruncated + `\n\n---\n*Response truncated (${text.length} chars).${itemCount ? ` Use limit/offset to paginate through ${itemCount} items.` : " Use more specific filters to reduce results."}*`;
}

/** Format a timestamp to human-readable */
export function formatDate(iso: string | undefined): string {
  if (!iso) return "N/A";
  try {
    return new Date(iso).toLocaleString("en-US", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Build pagination metadata */
export function paginationMeta(total: number, count: number, offset: number): {
  total: number; count: number; offset: number; has_more: boolean; next_offset?: number;
} {
  const has_more = total > offset + count;
  return {
    total, count, offset, has_more,
    ...(has_more ? { next_offset: offset + count } : {}),
  };
}

/** Standard success content response */
export function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

/** Standard error content response */
export function errorResult(text: string) {
  return { content: [{ type: "text" as const, text }], isError: true as const };
}
