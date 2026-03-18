import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../services/api-client.js";
import { aiRequest } from "../services/ai-client.js";
import { textResult, errorResult, truncateIfNeeded } from "../services/formatters.js";
import { IdParam } from "../schemas/common.js";

export function registerGovernanceTools(server: McpServer, api: ApiClient): void {

  // --- COMPLIANCE ---

  server.registerTool("dual_compliance_evaluate", {
    title: "Evaluate Compliance",
    description: "Evaluate a token action against all enabled compliance rules. Returns pass/fail with violation details.",
    inputSchema: {
      actionId: z.string().max(100).describe("Unique action identifier"),
      actionType: z.enum(["transfer", "mint", "trade"]).describe("Type of action"),
      payload: z.record(z.string(), z.unknown()).describe("Action data: amount, sender, recipient, country, etc."),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async (params) => {
    try {
      const res = await aiRequest<Record<string, unknown>>("governance", "/api/compliance/evaluate", "POST", params);
      const status = res.passed ? "PASSED" : "FAILED";
      const violations = res.violations as Array<Record<string, unknown>>;
      let text = `Compliance check ${status}\n  Evaluation ID: ${res.evaluationId}\n  Matched rules: ${res.matchedRules}\n  Explanation: ${res.explanation}\n`;
      if (violations?.length) {
        text += `\nViolations:\n`;
        for (const v of violations) {
          text += `  - ${v.ruleName}: ${v.message}\n`;
        }
      }
      return textResult(text);
    } catch (e: unknown) { return errorResult(e instanceof Error ? e.message : String(e)); }
  });

  server.registerTool("dual_compliance_rule_create", {
    title: "Create Compliance Rule",
    description: "Create a new compliance rule (AML threshold, transfer limit, restricted wallet, or geographic).",
    inputSchema: {
      name: z.string().max(200).describe("Rule name"),
      type: z.enum(["aml_threshold", "transfer_limit", "restricted_wallet", "geographic"]).describe("Rule type"),
      thresholdValue: z.string().max(200).describe("Threshold for comparison"),
      operator: z.enum([">", "<", "==", ">=", "<=", "!=", "contains"]).describe("Comparison operator"),
      scope: z.enum(["transfer", "mint", "trade"]).describe("Action scope"),
      enabled: z.boolean().optional().describe("Enable rule (default true)"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async (params) => {
    try {
      const res = await aiRequest<Record<string, unknown>>("governance", "/api/compliance/rules", "POST", params);
      return textResult(`Rule created:\n  ID: ${res.id}\n  Name: ${res.name}\n  Type: ${res.type}\n  Operator: ${res.operator} ${res.thresholdValue}\n  Scope: ${res.scope}\n  Enabled: ${res.enabled}`);
    } catch (e: unknown) { return errorResult(e instanceof Error ? e.message : String(e)); }
  });

  server.registerTool("dual_compliance_rule_list", {
    title: "List Compliance Rules",
    description: "List all compliance rules with optional filters.",
    inputSchema: {
      type: z.string().optional().describe("Filter by rule type"),
      enabled: z.boolean().optional().describe("Filter by enabled status"),
      limit: z.number().int().optional().describe("Page size (default 50)"),
      offset: z.number().int().optional().describe("Offset (default 0)"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (params) => {
    try {
      const query: Record<string, string> = {};
      if (params.type) query.type = params.type;
      if (params.enabled !== undefined) query.enabled = String(params.enabled);
      if (params.limit) query.limit = String(params.limit);
      if (params.offset) query.offset = String(params.offset);
      const res = await aiRequest<Record<string, unknown>>("governance", "/api/compliance/rules", "GET", undefined, query);
      const rules = res.rules as Array<Record<string, unknown>>;
      if (!rules?.length) return textResult("No compliance rules found.");
      let text = `${res.total} compliance rules:\n\n`;
      for (const r of rules) {
        text += `  [${r.enabled ? "ON" : "OFF"}] ${r.name} (${r.type}): ${r.operator} ${r.thresholdValue} for ${r.scope}\n`;
      }
      return textResult(text);
    } catch (e: unknown) { return errorResult(e instanceof Error ? e.message : String(e)); }
  });

  server.registerTool("dual_compliance_rule_update", {
    title: "Update Compliance Rule",
    description: "Update a compliance rule by ID.",
    inputSchema: {
      id: IdParam.describe("Rule ID"),
      name: z.string().optional(),
      type: z.enum(["aml_threshold", "transfer_limit", "restricted_wallet", "geographic"]).optional(),
      thresholdValue: z.string().optional(),
      operator: z.enum([">", "<", "==", ">=", "<=", "!=", "contains"]).optional(),
      scope: z.enum(["transfer", "mint", "trade"]).optional(),
      enabled: z.boolean().optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (params) => {
    try {
      const { id, ...body } = params;
      const res = await aiRequest<Record<string, unknown>>("governance", `/api/compliance/rules/${id}`, "PUT", body);
      return textResult(`Rule updated: ${res.name} (${res.type})`);
    } catch (e: unknown) { return errorResult(e instanceof Error ? e.message : String(e)); }
  });

  server.registerTool("dual_compliance_rule_delete", {
    title: "Delete Compliance Rule",
    description: "Delete a compliance rule by ID.",
    inputSchema: {
      id: IdParam.describe("Rule ID"),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  }, async (params) => {
    try {
      await aiRequest("governance", `/api/compliance/rules/${params.id}`, "DELETE");
      return textResult(`Rule ${params.id} deleted.`);
    } catch (e: unknown) { return errorResult(e instanceof Error ? e.message : String(e)); }
  });

  server.registerTool("dual_compliance_audit", {
    title: "Get Audit Log",
    description: "Retrieve compliance audit log entries.",
    inputSchema: {
      actionType: z.string().optional().describe("Filter by action type"),
      passed: z.boolean().optional().describe("Filter by pass/fail"),
      limit: z.number().int().optional().describe("Page size"),
      offset: z.number().int().optional().describe("Offset"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (params) => {
    try {
      const query: Record<string, string> = {};
      if (params.actionType) query.actionType = params.actionType;
      if (params.passed !== undefined) query.passed = String(params.passed);
      if (params.limit) query.limit = String(params.limit);
      if (params.offset) query.offset = String(params.offset);
      const res = await aiRequest<Record<string, unknown>>("governance", "/api/compliance/audit", "GET", undefined, query);
      return textResult(truncateIfNeeded(`Audit log (${res.total} entries):\n${JSON.stringify(res.logs, null, 2)}`));
    } catch (e: unknown) { return errorResult(e instanceof Error ? e.message : String(e)); }
  });

  server.registerTool("dual_compliance_stats", {
    title: "Compliance Statistics",
    description: "Get compliance statistics: evaluations, pass rate, violations by type.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async () => {
    try {
      const res = await aiRequest<Record<string, unknown>>("governance", "/api/compliance/stats");
      return textResult(`Compliance Stats:\n  Total evaluations: ${res.totalEvaluations}\n  Pass rate: ${((res.passRate as number) * 100).toFixed(1)}%\n  Violations by type: ${JSON.stringify(res.violationsByType)}`);
    } catch (e: unknown) { return errorResult(e instanceof Error ? e.message : String(e)); }
  });

  // --- POLICIES ---

  server.registerTool("dual_policy_parse", {
    title: "Parse NL Policy",
    description: "Parse a natural language policy description into structured compliance rules.",
    inputSchema: {
      description: z.string().max(2000).describe("Natural language policy text"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async (params) => {
    try {
      const res = await aiRequest<Record<string, unknown>>("governance", "/api/policies/parse", "POST", params);
      const rules = res.parsedRules as Array<Record<string, unknown>>;
      let text = `Policy parsed (confidence: ${((res.confidence as number) * 100).toFixed(0)}%):\n  ID: ${res.id}\n\n`;
      if (rules?.length) {
        text += `Extracted rules:\n`;
        for (const r of rules) {
          text += `  - Role: ${r.role}, Action: ${r.action}, Constraints: ${JSON.stringify(r.constraints)}\n`;
        }
      }
      const notes = res.extractionNotes as string[];
      if (notes?.length) text += `\nNotes: ${notes.join("; ")}`;
      return textResult(text);
    } catch (e: unknown) { return errorResult(e instanceof Error ? e.message : String(e)); }
  });

  server.registerTool("dual_policy_get", {
    title: "Get Policy",
    description: "Get a parsed policy document by ID.",
    inputSchema: {
      id: IdParam.describe("Policy ID"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (params) => {
    try {
      const res = await aiRequest("governance", `/api/policies/${params.id}`);
      return textResult(truncateIfNeeded(JSON.stringify(res, null, 2)));
    } catch (e: unknown) { return errorResult(e instanceof Error ? e.message : String(e)); }
  });

  server.registerTool("dual_policy_validate", {
    title: "Validate Policy",
    description: "Validate a parsed policy for internal consistency.",
    inputSchema: {
      id: IdParam.describe("Policy ID"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (params) => {
    try {
      const res = await aiRequest<Record<string, unknown>>("governance", `/api/policies/${params.id}/validate`);
      return textResult(`Policy validation: ${res.valid ? "VALID" : "INVALID"}\n${res.issues ? `Issues: ${JSON.stringify(res.issues)}` : "No issues found."}`);
    } catch (e: unknown) { return errorResult(e instanceof Error ? e.message : String(e)); }
  });

  // --- PROVENANCE ---

  server.registerTool("dual_provenance_create", {
    title: "Create Provenance Record",
    description: "Record the provenance of AI-generated content with SHA-256 hashing.",
    inputSchema: {
      content: z.string().describe("The content to record provenance for"),
      contentType: z.enum(["text", "image", "audio", "video"]).describe("Content type"),
      modelName: z.string().max(100).describe("AI model name"),
      modelVersion: z.string().max(50).optional().describe("Model version"),
      prompt: z.string().describe("The prompt used to generate the content"),
      metadata: z.record(z.string(), z.unknown()).optional().describe("Additional metadata"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async (params) => {
    try {
      const res = await aiRequest<Record<string, unknown>>("governance", "/api/provenance", "POST", params);
      return textResult(`Provenance record created:\n  ID: ${res.id}\n  Content hash: ${res.contentHash}\n  Content type: ${res.contentType}\n  Model: ${res.modelName}${res.modelVersion ? ` v${res.modelVersion}` : ""}\n  Verified: ${res.verified}`);
    } catch (e: unknown) { return errorResult(e instanceof Error ? e.message : String(e)); }
  });

  server.registerTool("dual_provenance_get", {
    title: "Get Provenance Record",
    description: "Retrieve a provenance record by ID.",
    inputSchema: {
      id: IdParam.describe("Record ID"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (params) => {
    try {
      const res = await aiRequest("governance", `/api/provenance/${params.id}`);
      return textResult(truncateIfNeeded(JSON.stringify(res, null, 2)));
    } catch (e: unknown) { return errorResult(e instanceof Error ? e.message : String(e)); }
  });

  server.registerTool("dual_provenance_verify", {
    title: "Verify Provenance",
    description: "Verify AI-generated content by re-hashing and comparing to the stored provenance record.",
    inputSchema: {
      id: IdParam.describe("Provenance record ID"),
      content: z.string().describe("Content to verify against the stored hash"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (params) => {
    try {
      const res = await aiRequest<Record<string, unknown>>("governance", `/api/provenance/${params.id}/verify`, "POST", {
        content: params.content,
      });
      const status = res.verified ? "VERIFIED" : "MISMATCH";
      return textResult(`Provenance verification: ${status}\n  Record: ${params.id}\n  Match: ${res.verified}`);
    } catch (e: unknown) { return errorResult(e instanceof Error ? e.message : String(e)); }
  });

  server.registerTool("dual_provenance_badge", {
    title: "Generate Verification Badge",
    description: "Generate a verification badge (certificate, seal, or QR) for a provenance record.",
    inputSchema: {
      id: IdParam.describe("Provenance record ID"),
      badgeType: z.enum(["certificate", "seal", "qr"]).optional().describe("Badge type (default certificate)"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (params) => {
    try {
      const query: Record<string, string> = {};
      if (params.badgeType) query.badgeType = params.badgeType;
      const res = await aiRequest<Record<string, unknown>>("governance", `/api/provenance/${params.id}/badge`, "GET", undefined, query);
      return textResult(`Verification badge generated:\n  Type: ${res.badgeType}\n  Signature: ${res.signature}\n  Badge data: ${JSON.stringify(res.badgeData, null, 2)}`);
    } catch (e: unknown) { return errorResult(e instanceof Error ? e.message : String(e)); }
  });
}
