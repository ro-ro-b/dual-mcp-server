import { validateApiUrl } from "./services/security.js";

/** DUAL API base URL */
export const API_BASE_URL = process.env.DUAL_API_URL || "https://api.blockv-labs.io/v3";

// Validate API URL at startup (H6, M1)
validateApiUrl(API_BASE_URL);

// Validate AI service URLs at startup (H6 — only if overridden from defaults)
const AI_URL_VARS: [string, string][] = [
  ["INTELLIGENCE_URL", process.env.INTELLIGENCE_URL || ""],
  ["GOVERNANCE_URL", process.env.GOVERNANCE_URL || ""],
  ["CREATIVE_URL", process.env.CREATIVE_URL || ""],
];
for (const [varName, url] of AI_URL_VARS) {
  if (url) {
    try {
      validateApiUrl(url);
    } catch (err) {
      throw new Error(`${varName} is invalid: ${err instanceof Error ? err.message : err}`);
    }
  }
}

/** Maximum response size in characters */
export const CHARACTER_LIMIT = 25000;

/** Default pagination limit */
export const DEFAULT_LIMIT = 20;

/** Maximum pagination limit */
export const MAX_LIMIT = 100;

/** Maximum axios response size (M2) — 10MB */
export const MAX_RESPONSE_SIZE = 10 * 1024 * 1024;

/** MCP Server API key for HTTP auth (C1) */
export const MCP_SERVER_API_KEY = process.env.MCP_SERVER_API_KEY;
