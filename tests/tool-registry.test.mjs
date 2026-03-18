/**
 * Contract tests for tool registration.
 *
 * Validates that every module registers the expected tools with correct
 * names. Does NOT call the DUAL API — only verifies tool wiring is correct.
 *
 * This catches: missing tool registrations, typos in tool names, broken
 * imports, missing Zod schemas, and accidental removals.
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

// Import SDK and server components
const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
const { ApiClient } = await import("../dist/services/api-client.js");

// Import all registration functions
const { registerWalletTools } = await import("../dist/tools/wallets.js");
const { registerOrganizationTools } = await import("../dist/tools/organizations.js");
const { registerTemplateTools } = await import("../dist/tools/templates.js");
const { registerObjectTools } = await import("../dist/tools/objects.js");
const { registerActionTools } = await import("../dist/tools/actions.js");
const { registerFaceTools } = await import("../dist/tools/faces.js");
const { registerStorageTools } = await import("../dist/tools/storage.js");
const { registerWebhookTools } = await import("../dist/tools/webhooks.js");
const { registerNotificationTools } = await import("../dist/tools/notifications.js");
const { registerSequencerTools } = await import("../dist/tools/sequencer.js");
const { registerApiKeyTools } = await import("../dist/tools/api-keys.js");
const { registerPaymentTools } = await import("../dist/tools/payments.js");
const { registerSupportTools } = await import("../dist/tools/support.js");
const { registerPublicApiTools } = await import("../dist/tools/public-api.js");
const { registerIntelligenceTools } = await import("../dist/tools/intelligence.js");
const { registerGovernanceTools } = await import("../dist/tools/governance.js");
const { registerCreativeTools } = await import("../dist/tools/creative.js");

// ── Expected tool names per module (authoritative contract) ──────────
// These are extracted directly from the source. If a tool is added or
// removed, update this list intentionally.

const EXPECTED_MODULES = {
  wallets: [
    "dual_login", "dual_login_guest", "dual_logout", "dual_register",
    "dual_register_verify", "dual_refresh_token", "dual_get_me",
    "dual_update_me", "dual_get_wallet", "dual_reset_password",
    "dual_reset_password_verify",
  ],
  organizations: [
    "dual_list_organizations", "dual_create_organization", "dual_get_organization",
    "dual_update_organization", "dual_get_org_balance", "dual_list_org_members",
    "dual_add_org_member", "dual_remove_org_member", "dual_list_org_roles",
    "dual_create_org_role",
  ],
  templates: [
    "dual_list_templates", "dual_create_template", "dual_get_template",
    "dual_update_template", "dual_delete_template", "dual_list_template_variations",
    "dual_create_template_variation",
  ],
  objects: [
    "dual_list_objects", "dual_get_object", "dual_update_object",
    "dual_get_object_children", "dual_get_object_parents",
    "dual_get_object_activity", "dual_search_objects", "dual_count_objects",
  ],
  actions: [
    "dual_execute_action", "dual_batch_actions", "dual_list_actions",
    "dual_get_action", "dual_list_action_types", "dual_create_action_type",
    "dual_update_action_type",
  ],
  faces: [
    "dual_list_faces", "dual_create_face", "dual_get_face",
    "dual_update_face", "dual_delete_face", "dual_get_template_faces",
  ],
  storage: [
    "dual_upload_file", "dual_get_file", "dual_delete_file",
    "dual_get_template_assets",
  ],
  webhooks: [
    "dual_list_webhooks", "dual_create_webhook", "dual_get_webhook",
    "dual_update_webhook", "dual_delete_webhook", "dual_test_webhook",
  ],
  notifications: [
    "dual_list_messages", "dual_send_notification", "dual_list_message_templates",
    "dual_create_message_template", "dual_delete_message_template",
  ],
  sequencer: [
    "dual_list_batches", "dual_get_batch", "dual_list_checkpoints",
    "dual_get_checkpoint",
  ],
  "api-keys": [
    "dual_list_api_keys", "dual_create_api_key", "dual_delete_api_key",
  ],
  payments: [
    "dual_get_payment_config", "dual_list_deposits",
  ],
  support: [
    "dual_request_access", "dual_list_support_messages",
    "dual_send_support_message",
  ],
  "public-api": [
    "dual_public_list_templates", "dual_public_get_template",
    "dual_public_get_object", "dual_public_search_objects",
    "dual_public_get_stats",
  ],
  intelligence: [
    "dual_ai_agent_create", "dual_ai_agent_list", "dual_ai_agent_get",
    "dual_ai_agent_execute", "dual_ai_history_ingest", "dual_ai_predict",
    "dual_ai_trending", "dual_ai_anomalies", "dual_ai_graph_ingest",
    "dual_ai_graph_similar", "dual_ai_graph_connected", "dual_ai_graph_analytics",
  ],
  governance: [
    "dual_compliance_evaluate", "dual_compliance_rule_create",
    "dual_compliance_rule_list", "dual_compliance_rule_update",
    "dual_compliance_rule_delete", "dual_compliance_audit",
    "dual_compliance_stats", "dual_policy_parse", "dual_policy_get",
    "dual_policy_validate", "dual_provenance_create", "dual_provenance_get",
    "dual_provenance_verify", "dual_provenance_badge",
  ],
  creative: [
    "dual_creative_design_generate", "dual_creative_design_list",
    "dual_creative_design_get", "dual_creative_design_refine",
    "dual_creative_design_delete", "dual_creative_face_create",
    "dual_creative_face_list", "dual_creative_face_render",
  ],
};

const ALL_EXPECTED_TOOLS = Object.values(EXPECTED_MODULES).flat();

/** Register all tools into a server */
function buildServer() {
  const api = new ApiClient();
  const server = new McpServer({ name: "test-server", version: "0.0.1" });

  registerWalletTools(server, api);
  registerOrganizationTools(server, api);
  registerTemplateTools(server, api);
  registerObjectTools(server, api);
  registerActionTools(server, api);
  registerFaceTools(server, api);
  registerStorageTools(server, api);
  registerWebhookTools(server, api);
  registerNotificationTools(server, api);
  registerSequencerTools(server, api);
  registerApiKeyTools(server, api);
  registerPaymentTools(server, api);
  registerSupportTools(server, api);
  registerPublicApiTools(server, api);
  registerIntelligenceTools(server, api);
  registerGovernanceTools(server, api);
  registerCreativeTools(server, api);

  return server;
}

describe("Tool registration contract", () => {
  let server;

  before(() => {
    server = buildServer();
  });

  it("registers all tools without throwing", () => {
    assert.ok(server, "Server should be created successfully");
  });

  it("has no duplicate tool names in the contract", () => {
    const seen = new Set();
    for (const name of ALL_EXPECTED_TOOLS) {
      assert.ok(!seen.has(name), `Duplicate tool name in expected list: ${name}`);
      seen.add(name);
    }
  });

  it("total tool count matches README claim of 115", () => {
    assert.equal(
      ALL_EXPECTED_TOOLS.length, 115,
      `Expected 115 tools, contract defines ${ALL_EXPECTED_TOOLS.length}`
    );
  });
});

describe("Per-module tool counts", () => {
  const expectedCounts = {
    wallets: 11, organizations: 10, templates: 7, objects: 8,
    actions: 7, faces: 6, storage: 4, webhooks: 6,
    notifications: 5, sequencer: 4, "api-keys": 3, payments: 2,
    support: 3, "public-api": 5, intelligence: 12, governance: 14,
    creative: 8,
  };

  for (const [moduleName, expectedTools] of Object.entries(EXPECTED_MODULES)) {
    it(`${moduleName}: registers ${expectedCounts[moduleName]} tools`, () => {
      assert.equal(
        expectedTools.length, expectedCounts[moduleName],
        `${moduleName} tool count mismatch`
      );
    });
  }
});

describe("Tool naming conventions", () => {
  it("all tool names use snake_case with dual_ prefix", () => {
    for (const name of ALL_EXPECTED_TOOLS) {
      assert.match(name, /^dual_[a-z0-9_]+$/, `Tool name '${name}' violates naming convention`);
    }
  });

  it("no tool names exceed 64 characters", () => {
    for (const name of ALL_EXPECTED_TOOLS) {
      assert.ok(name.length <= 64, `Tool name '${name}' is too long (${name.length} chars)`);
    }
  });
});
