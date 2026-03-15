import { z } from "zod";
import { DEFAULT_LIMIT, MAX_LIMIT } from "../constants.js";

/** Hardened ID parameter — alphanumeric + hyphens/underscores/dots/colons only (H4) */
export const IdParam = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[a-zA-Z0-9_\-:.]+$/, "ID must be alphanumeric with hyphens, underscores, dots, or colons")
  .describe("Resource ID");

/** Reusable pagination parameters (L5: offset bounded) */
export const PaginationSchema = {
  limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT)
    .describe("Maximum results to return (1-100, default 20)"),
  offset: z.number().int().min(0).max(100000).default(0)
    .describe("Number of results to skip for pagination (max 100,000)"),
};

/** Cursor-based pagination (DUAL uses 'next' cursor) */
export const CursorPaginationSchema = {
  limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT)
    .describe("Maximum results to return (1-100, default 20)"),
  next: z.string().max(1024).optional()
    .describe("Cursor for next page (from previous response)"),
};

/** Bounded string schemas for common parameter types (M5) */
export const NameString = z.string().min(1).max(200);
export const DescriptionString = z.string().max(5000);
export const UrlString = z.string().url().max(2048);
export const ShortString = z.string().max(500);

/** Safe filter schema that rejects NoSQL operators (H7) */
export const SafeFilterSchema = z.record(z.string(), z.unknown()).refine(
  (obj) => !hasOperatorKeys(obj),
  "Filter keys starting with '$' are not allowed"
).refine(
  (obj) => JSON.stringify(obj).length < 50000,
  "Filter object too large (max 50KB)"
);

function hasOperatorKeys(obj: Record<string, unknown>): boolean {
  for (const key of Object.keys(obj)) {
    if (key.startsWith("$")) return true;
    const val = obj[key];
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      if (hasOperatorKeys(val as Record<string, unknown>)) return true;
    }
  }
  return false;
}

/** Safe JSON object schema with depth and size limits (H8) */
export function boundedJsonObject(options?: { maxDepth?: number; maxSize?: number }) {
  const maxDepth = options?.maxDepth ?? 5;
  const maxSize = options?.maxSize ?? 50000;

  return z.record(z.string(), z.unknown())
    .refine(
      (obj) => JSON.stringify(obj).length <= maxSize,
      `JSON object too large (max ${Math.round(maxSize / 1024)}KB)`
    )
    .refine(
      (obj) => validateDepth(obj, maxDepth),
      `JSON object too deeply nested (max ${maxDepth} levels)`
    );
}

function validateDepth(obj: unknown, maxDepth: number, current: number = 0): boolean {
  if (current > maxDepth) return false;
  if (obj !== null && typeof obj === "object") {
    return Object.values(obj as Record<string, unknown>).every(
      (v) => validateDepth(v, maxDepth, current + 1)
    );
  }
  return true;
}
