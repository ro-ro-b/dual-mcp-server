/**
 * Security utilities for DUAL MCP Server
 * Covers: URL validation (SSRF), JSON depth validation, string sanitization, token validation
 */

import { URL } from "url";

// --- SSRF Protection (C2, H3) ---

const BLOCKED_HOSTNAMES = ["localhost", "127.0.0.1", "0.0.0.0", "[::1]", "[::]"];
const BLOCKED_PREFIXES = [
  "10.", "192.168.", "169.254.",
  "172.16.", "172.17.", "172.18.", "172.19.",
  "172.20.", "172.21.", "172.22.", "172.23.",
  "172.24.", "172.25.", "172.26.", "172.27.",
  "172.28.", "172.29.", "172.30.", "172.31.",
  "fc00:", "fd00:", "fe80:",
];

/** Validate that a URL is external HTTPS only — blocks SSRF vectors */
export function assertExternalUrl(urlString: string): void {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error("Invalid URL format");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Only HTTPS URLs are allowed");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    throw new Error("Internal/loopback URLs are not allowed");
  }
  if (BLOCKED_PREFIXES.some((p) => hostname.startsWith(p))) {
    throw new Error("Private network URLs are not allowed");
  }
  // Block cloud metadata endpoints
  if (hostname === "metadata.google.internal" || hostname.endsWith(".amazonaws.com")) {
    throw new Error("Cloud metadata URLs are not allowed");
  }
}

// --- NoSQL Injection Prevention (H7) ---

/** Check that filter object keys don't contain MongoDB-style operators */
export function assertNoOperatorKeys(obj: Record<string, unknown>): void {
  const keys = Object.keys(obj);
  for (const key of keys) {
    if (key.startsWith("$")) {
      throw new Error(`Filter keys starting with '$' are not allowed (found: '${key}')`);
    }
    // Recurse into nested objects
    const val = obj[key];
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      assertNoOperatorKeys(val as Record<string, unknown>);
    }
  }
}

// --- Token/Header Injection Prevention (M10) ---

/** Validate that a token/header value doesn't contain control characters */
export function assertNoControlChars(value: string, name: string = "value"): void {
  if (/[\r\n\x00]/.test(value)) {
    throw new Error(`${name} contains invalid control characters`);
  }
}

// --- API URL Validation (H6, M1) ---

/** Validate the DUAL API URL at startup */
export function validateApiUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`DUAL_API_URL is not a valid URL: ${url}`);
  }

  // Allow HTTP only for localhost/dev
  const isLocal = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !isLocal) {
    throw new Error(
      `DUAL_API_URL must use HTTPS for non-local hosts (got: ${parsed.protocol}//${parsed.hostname}). ` +
      `HTTP is only allowed for localhost development.`
    );
  }
}

// --- String Sanitization (L4) ---

/** Sanitize a string by stripping HTML tags and control characters */
export function sanitizeString(input: string): string {
  return input
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "") // strip control chars (keep \t, \n, \r)
    .replace(/<[^>]*>/g, ""); // strip HTML tags
}
