import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../services/api-client.js";
import { aiRequest } from "../services/ai-client.js";
import { textResult, errorResult, truncateIfNeeded } from "../services/formatters.js";
import { IdParam } from "../schemas/common.js";

export function registerIntelligenceTools(server: McpServer, api: ApiClient): void {

  // --- AGENTS ---

  server.registerTool("dual_ai_agent_create", {
    title: "Create AI Agent",
    description: "Create a new autonomous agent with condition/action rules for the DUAL Intelligence Service.",
    inputSchema: {
      name: z.string().max(200).describe("Agent name"),
      description: z.string().max(500).describe("Agent description"),
      status: z.enum(["active", "inactive", "pending"]).optional().describe("Agent status"),
      capabilities: z.array(z.string()).optional().describe("Agent capabilities"),
      rules: z.array(z.object({
        field: z.string(),
        operator: z.enum([">", "<", ">=", "<=", "==", "!=", "contains"]),
        value: z.unknown(),
      })).optional().describe("Evaluation rules"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async (params) => {
    try {
      const res = await aiRequest("intelligence", "/api/agents", "POST", params);
      return textResult(`Agent created:\n${JSON.stringify(res, null, 2)}`);
    } catch (e: unknown) { return errorResult(e instanceof Error ? e.message : String(e)); }
  });

  server.registerTool("dual_ai_agent_list", {
    title: "List AI Agents",
    description: "List all autonomous agents in the DUAL Intelligence Service.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async () => {
    try {
      const res = await aiRequest<{ agents: unknown[]; total: number }>("intelligence", "/api/agents");
      return textResult(truncateIfNeeded(`${res.total} agents:\n${JSON.stringify(res.agents, null, 2)}`, res.total));
    } catch (e: unknown) { return errorResult(e instanceof Error ? e.message : String(e)); }
  });

  server.registerTool("dual_ai_agent_get", {
    title: "Get AI Agent",
    description: "Get details of a specific autonomous agent by ID.",
    inputSchema: {
      id: IdParam.describe("Agent ID"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (params) => {
    try {
      const res = await aiRequest("intelligence", `/api/agents/${params.id}`);
      return textResult(truncateIfNeeded(JSON.stringify(res, null, 2)));
    } catch (e: unknown) { return errorResult(e instanceof Error ? e.message : String(e)); }
  });

  server.registerTool("dual_ai_agent_execute", {
    title: "Execute AI Agent",
    description: "Execute an agent, evaluating its rules against the provided context. Supports dry-run mode.",
    inputSchema: {
      id: IdParam.describe("Agent ID"),
      context: z.record(z.string(), z.unknown()).describe("Context data for rule evaluation"),
      dryRun: z.boolean().optional().describe("If true, evaluate rules without side effects"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async (params) => {
    try {
      const res = await aiRequest<Record<string, unknown>>("intelligence", `/api/agents/${params.id}/execute`, "POST", {
        context: params.context,
        dryRun: params.dryRun,
      });
      const mode = params.dryRun ? "[DRY RUN] " : "";
      return textResult(`${mode}Execution result:\n  Rules evaluated: ${res.rulesEvaluated}\n  Rules passed: ${res.rulesPassed}\n  All passed: ${res.allPassed}\n\n${JSON.stringify(res.results, null, 2)}`);
    } catch (e: unknown) { return errorResult(e instanceof Error ? e.message : String(e)); }
  });

  // --- PREDICTIONS ---

  server.registerTool("dual_ai_history_ingest", {
    title: "Ingest Action History",
    description: "Bulk ingest action history records for lifecycle prediction analysis.",
    inputSchema: {
      records: z.array(z.object({
        objectId: z.string(),
        actionType: z.string(),
        timestamp: z.string(),
        actorId: z.string(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })).describe("Action history records to ingest"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async (params) => {
    try {
      const res = await aiRequest<Record<string, unknown>>("intelligence", "/api/history/ingest", "POST", params);
      return textResult(`History ingested: ${res.ingested} records (${res.skipped} skipped, ${res.totalRecords} total)`);
    } catch (e: unknown) { return errorResult(e instanceof Error ? e.message : String(e)); }
  });

  server.registerTool("dual_ai_predict", {
    title: "Get Lifecycle Predictions",
    description: "Get transfer likelihood, abandonment risk, and spike probability predictions for a specific object.",
    inputSchema: {
      objectId: IdParam.describe("Object ID to predict"),
      types: z.string().optional().describe("Comma-separated types: transfer,abandonment,spike"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (params) => {
    try {
      const query: Record<string, string> = {};
      if (params.types) query.types = params.types;
      const res = await aiRequest<Record<string, unknown>>("intelligence", `/api/predictions/${params.objectId}`, "GET", undefined, query);
      const preds = res.predictions as Array<Record<string, unknown>>;
      let text = `Predictions for ${params.objectId} (${res.count} predictions):\n\n`;
      for (const p of preds) {
        text += `  ${p.predictionType}: confidence ${((p.confidenceScore as number) * 100).toFixed(1)}%\n`;
        text += `    Timeframe: ${p.predictedTimeframe}\n`;
        text += `    Reasoning: ${p.reasoning}\n\n`;
      }
      return textResult(text);
    } catch (e: unknown) { return errorResult(e instanceof Error ? e.message : String(e)); }
  });

  server.registerTool("dual_ai_trending", {
    title: "Get Trending Objects",
    description: "List objects ranked by recent activity score.",
    inputSchema: {
      limit: z.number().int().min(1).max(100).optional().describe("Max results (default 20)"),
      windowDays: z.number().int().min(1).optional().describe("Activity window in days (default 7)"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (params) => {
    try {
      const query: Record<string, string> = {};
      if (params.limit) query.limit = String(params.limit);
      if (params.windowDays) query.windowDays = String(params.windowDays);
      const res = await aiRequest<Record<string, unknown>>("intelligence", "/api/trending", "GET", undefined, query);
      const items = res.trending as Array<Record<string, unknown>>;
      if (!items?.length) return textResult("No trending objects found.");
      let text = `Trending objects (${items.length}):\n\n`;
      for (const item of items) {
        text += `  ${item.objectId}: score ${(item.activityScore as number).toFixed(2)} (${item.recentActions} recent actions, trend: ${item.trend})\n`;
      }
      return textResult(text);
    } catch (e: unknown) { return errorResult(e instanceof Error ? e.message : String(e)); }
  });

  server.registerTool("dual_ai_anomalies", {
    title: "Detect Anomalies",
    description: "Detect anomalous activity patterns across all tracked objects.",
    inputSchema: {
      severity: z.enum(["low", "medium", "high"]).optional().describe("Filter by severity"),
      limit: z.number().int().min(1).max(100).optional().describe("Max results (default 50)"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (params) => {
    try {
      const query: Record<string, string> = {};
      if (params.severity) query.severity = params.severity;
      if (params.limit) query.limit = String(params.limit);
      const res = await aiRequest<Record<string, unknown>>("intelligence", "/api/anomalies", "GET", undefined, query);
      const items = res.anomalies as Array<Record<string, unknown>>;
      if (!items?.length) return textResult("No anomalies detected.");
      let text = `Anomalies detected (${items.length}):\n\n`;
      for (const a of items) {
        text += `  ${a.objectId}: ${a.anomalyType} [${a.severity}] -- detected ${a.detectedAt}\n`;
      }
      return textResult(text);
    } catch (e: unknown) { return errorResult(e instanceof Error ? e.message : String(e)); }
  });

  // --- KNOWLEDGE GRAPH ---

  server.registerTool("dual_ai_graph_ingest", {
    title: "Ingest Graph Data",
    description: "Ingest template or token metadata into the knowledge graph.",
    inputSchema: {
      metadataType: z.enum(["template", "token"]).describe("Type of metadata"),
      data: z.record(z.string(), z.unknown()).describe("Metadata record with id, name, owner, properties"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async (params) => {
    try {
      const res = await aiRequest<Record<string, unknown>>("intelligence", "/api/graph/ingest", "POST", params);
      return textResult(`Graph data ingested: ${res.message || JSON.stringify(res)}`);
    } catch (e: unknown) { return errorResult(e instanceof Error ? e.message : String(e)); }
  });

  server.registerTool("dual_ai_graph_similar", {
    title: "Find Similar Nodes",
    description: "Find nodes similar to a given node using metadata overlap, Jaccard, or cosine similarity.",
    inputSchema: {
      nodeId: IdParam.describe("Source node ID"),
      similarityMetric: z.enum(["metadata", "jaccard", "cosine"]).optional().describe("Similarity metric"),
      limit: z.number().int().min(1).max(100).optional().describe("Max results"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (params) => {
    try {
      const res = await aiRequest<Record<string, unknown>>("intelligence", "/api/graph/query/similar", "POST", params);
      return textResult(truncateIfNeeded(`Similar nodes:\n${JSON.stringify(res, null, 2)}`));
    } catch (e: unknown) { return errorResult(e instanceof Error ? e.message : String(e)); }
  });

  server.registerTool("dual_ai_graph_connected", {
    title: "Graph Traversal",
    description: "Find all nodes connected to a given node within N hops using BFS.",
    inputSchema: {
      nodeId: IdParam.describe("Source node ID"),
      maxHops: z.number().int().min(1).max(5).optional().describe("Max traversal depth (1-5, default 2)"),
      edgeTypes: z.array(z.string()).optional().describe("Filter by edge types"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (params) => {
    try {
      const res = await aiRequest<Record<string, unknown>>("intelligence", "/api/graph/query/connected", "POST", params);
      return textResult(truncateIfNeeded(`Connected nodes:\n${JSON.stringify(res, null, 2)}`));
    } catch (e: unknown) { return errorResult(e instanceof Error ? e.message : String(e)); }
  });

  server.registerTool("dual_ai_graph_analytics", {
    title: "Graph Analytics",
    description: "Get ecosystem-wide analytics: topology, concentration, velocity, top hubs.",
    inputSchema: {
      windowHours: z.number().int().min(1).optional().describe("Analysis window in hours (default 24)"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (params) => {
    try {
      const query: Record<string, string> = {};
      if (params.windowHours) query.windowHours = String(params.windowHours);
      const res = await aiRequest<Record<string, unknown>>("intelligence", "/api/graph/analytics", "GET", undefined, query);
      return textResult(`Graph Analytics:\n  Nodes: ${res.totalNodes}\n  Edges: ${res.totalEdges}\n  Density: ${res.density}\n  Top Hubs: ${JSON.stringify(res.topHubs)}`);
    } catch (e: unknown) { return errorResult(e instanceof Error ? e.message : String(e)); }
  });
}
