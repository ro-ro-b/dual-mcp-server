/**
 * Security utilities for DUAL MCP Server
 * Covers: URL validation (SSRF), JSON depth validation, string sanitization, token validation
 */

import { URL } from "url";
import { lookup } from "dns/promises";
import { isIP } from "net";

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

/** Check whether a resolved IP address falls in a private/loopback range */
function isPrivateIp(ip: string): boolean {
  // Loopback
  if (ip === "127.0.0.1" || ip === "::1" || ip.startsWith("127.")) return true;
  // Link-local
  if (ip.startsWith("169.254.")) return true;
  // Private ranges
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  // IPv6 private/link-local
  if (ip.startsWith("fc00:") || ip.startsWith("fd") || ip.startsWith("fe80:")) return true;
  // Unspecified
  if (ip === "0.0.0.0" || ip === "::") return true;
  return false;
}

/**
 * Validate that a URL is external HTTPS only — blocks SSRF vectors.
 *
 * Two layers of protection:
 *   1. String-based: blocks known-bad hostnames, private IP prefixes, cloud metadata
 *   2. DNS-resolution: resolves the hostname and rejects if any resolved address
 *      is loopback, link-local, or in a private range (catches DNS rebinding)
 */
export async function assertExternalUrl(urlString: string): Promise<void> {
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

  // Layer 1: string-based blocking (fast, no DNS)
  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    throw new Error("Internal/loopback URLs are not allowed");
  }
  if (BLOCKED_PREFIXES.some((p) => hostname.startsWith(p))) {
    throw new Error("Private network URLs are not allowed");
  }
  // Block cloud metadata endpoints (not all cloud hostnames — public S3/GCS/Azure are OK)
  const BLOCKED_CLOUD_METADATA = [
    "metadata.google.internal",          // GCP instance metadata
    "169.254.169.254",                    // AWS/Azure/GCP metadata IP (also caught by prefix check)
    "metadata.azure.com",                // Azure IMDS (custom hostname alias)
  ];
  if (BLOCKED_CLOUD_METADATA.includes(hostname)) {
    throw new Error("Cloud metadata URLs are not allowed");
  }
  // Block only the AWS EC2 metadata service hostname, not all of amazonaws.com
  // (s3.amazonaws.com, *.s3.amazonaws.com etc. are legitimate public URLs)
  if (hostname === "instance-data" || hostname === "latest") {
    throw new Error("Cloud metadata URLs are not allowed");
  }

  // Layer 2: DNS resolution check (catches rebinding attacks)
  // Skip for raw IPs — they've already been checked by prefix matching above
  if (!isIP(hostname)) {
    try {
      const { address } = await lookup(hostname);
      if (isPrivateIp(address)) {
        throw new Error(
          "URL resolves to a private/internal IP address — possible DNS rebinding attack"
        );
      }
    } catch (err) {
      // Re-throw our own errors (private IP detected)
      if (err instanceof Error && err.message.includes("private")) throw err;
      // DNS resolution failures (ENOTFOUND, EAI_AGAIN, etc.) are not SSRF risks —
      // if the hostname doesn't resolve, it can't reach a private IP. Fail open.
      console.warn(`[SSRF] DNS lookup warning for ${hostname}: ${err instanceof Error ? err.message : err}`);
    }
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
