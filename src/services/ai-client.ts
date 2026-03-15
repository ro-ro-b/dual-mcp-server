/**
 * HTTP client for DUAL AI services running on localhost.
 * Intelligence: port 3201, Governance: port 3202, Creative: port 3203
 */

const AI_SERVICES = {
  intelligence: process.env.INTELLIGENCE_URL || "http://localhost:3201",
  governance: process.env.GOVERNANCE_URL || "http://localhost:3202",
  creative: process.env.CREATIVE_URL || "http://localhost:3203",
} as const;

export type AiServiceName = keyof typeof AI_SERVICES;

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
  };
  if (body && (method === "POST" || method === "PUT")) {
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(url.toString(), opts);
  const text = await res.text();

  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    if (!res.ok) throw new Error(`AI Service ${service} error (${res.status}): ${text}`);
    return text as unknown as T;
  }

  if (!res.ok) {
    const errMsg = (data as Record<string, unknown>)?.error || text;
    throw new Error(`AI Service ${service} error (${res.status}): ${errMsg}`);
  }
  return data;
}
