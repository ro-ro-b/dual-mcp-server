/**
 * HTTP client for DUAL AI services running on localhost.
 * Intelligence: port 3201, Governance: port 3202, Creative: port 3203
 */

/** Request timeout for AI service calls (10 seconds) */
const AI_REQUEST_TIMEOUT_MS = 10_000;

const AI_SERVICES = {
  intelligence: process.env.INTELLIGENCE_URL || "http://localhost:3201",
  governance: process.env.GOVERNANCE_URL || "http://localhost:3202",
  creative: process.env.CREATIVE_URL || "http://localhost:3203",
} as const;

export type AiServiceName = keyof typeof AI_SERVICES;

/** Safe error messages for AI service failures — avoids leaking internal details */
function formatAiError(service: AiServiceName, status: number, rawMsg: unknown): string {
  console.error(`[DUAL AI Error] ${service} ${status}: ${rawMsg}`);
  if (status === 400) return `AI Service error: Invalid request parameters.`;
  if (status === 401 || status === 403) return `AI Service error: Not authorized to access ${service} service.`;
  if (status === 404) return `AI Service error: Resource not found in ${service} service.`;
  if (status === 429) return `AI Service error: Rate limit exceeded on ${service} service — try again shortly.`;
  if (status >= 500) return `AI Service error: ${service} service is unavailable (${status}). Is it running?`;
  return `AI Service error: ${service} returned status ${status}.`;
}

export async function aiRequest<T = unknown>(
  service: AiServiceName,
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: unknown,
  queryParams?: Record<string, string>
): Promise<T> {
  const base = AI_SERVICES[service];
  const url = new URL(path, base);
  if (queryParams) {
    for (const [k, v] of Object.entries(queryParams)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    }
  }

  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
  };
  if (body && (method === "POST" || method === "PUT")) {
    opts.body = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), opts);
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error(`AI Service error: ${service} service timed out after ${AI_REQUEST_TIMEOUT_MS / 1000}s. Is it running?`);
    }
    if (err instanceof Error && (err.message.includes("ECONNREFUSED") || err.message.includes("fetch failed"))) {
      throw new Error(`AI Service error: Cannot reach ${service} service. Is it running on ${base}?`);
    }
    throw new Error(`AI Service error: Unexpected error contacting ${service} service.`);
  }

  const text = await res.text();

  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    if (!res.ok) {
      throw new Error(formatAiError(service, res.status, text.slice(0, 200)));
    }
    return text as unknown as T;
  }

  if (!res.ok) {
    const rawMsg = (data as Record<string, unknown>)?.error ?? res.status;
    throw new Error(formatAiError(service, res.status, rawMsg));
  }
  return data;
}
