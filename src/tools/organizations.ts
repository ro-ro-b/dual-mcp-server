import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient, handleApiError } from "../services/api-client.js";
import { textResult, errorResult } from "../services/formatters.js";
import { CursorPaginationSchema, IdParam } from "../schemas/common.js";

export function registerOrganizationTools(server: McpServer, api: ApiClient): void {

  server.registerTool("dual_list_organizations", {
    title: "List Organizations",
    description: "List all organizations the authenticated wallet belongs to. Supports pagination and role filtering.",
    inputSchema: {
      role_name: z.string().max(200).optional().describe("Filter by role name"),
      ...CursorPaginationSchema,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const res = await api.makeRequest<{ items: unknown[]; next?: string }>("organizations", "GET", undefined, params);
      return textResult(JSON.stringify(res, null, 2));
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_create_organization", {
    title: "Create Organization",
    description: "Create a new organization (multi-tenant workspace). Returns the org with its ID and FQDN.",
    inputSchema: {
      name: z.string().min(1).max(200).describe("Organization name"),
      fqdn: z.string().optional().describe("Fully qualified domain name"),
      description: z.string().max(5000).optional().describe("Organization description"),
      image: z.string().max(2048).optional().describe("Organization logo URL"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      const res = await api.makeRequest<Record<string, unknown>>("organizations", "POST", params);
      return textResult(`Organization created.\n${JSON.stringify(res, null, 2)}`);
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_get_organization", {
    title: "Get Organization",
    description: "Get organization details including members, roles, and account info.",
    inputSchema: { organization_id: IdParam },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const res = await api.makeRequest<Record<string, unknown>>(`organizations/${params.organization_id}`);
      return textResult(JSON.stringify(res, null, 2));
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_update_organization", {
    title: "Update Organization",
    description: "Update an organization's name, description, or image.",
    inputSchema: {
      organization_id: IdParam,
      name: z.string().min(1).max(200).optional().describe("New name"),
      description: z.string().max(5000).optional().describe("New description"),
      image: z.string().max(2048).optional().describe("New logo URL"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const { organization_id, ...body } = params;
      const res = await api.makeRequest<Record<string, unknown>>(`organizations/${organization_id}`, "PUT", body);
      return textResult(`Organization updated.\n${JSON.stringify(res, null, 2)}`);
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_get_org_balance", {
    title: "Get Organization Balance",
    description: "Get the current balance and currency for an organization.",
    inputSchema: { organization_id: IdParam },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const res = await api.makeRequest<Record<string, unknown>>(`organizations/${params.organization_id}/balance`);
      return textResult(JSON.stringify(res, null, 2));
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_list_org_members", {
    title: "List Organization Members",
    description: "List all members of an organization with their roles.",
    inputSchema: { organization_id: IdParam },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const res = await api.makeRequest<{ items: unknown[] }>(`organizations/${params.organization_id}/members`);
      return textResult(JSON.stringify(res, null, 2));
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_add_org_member", {
    title: "Add Organization Member",
    description: "Add a wallet as a member to an organization with a specific role.",
    inputSchema: {
      organization_id: IdParam,
      wallet_id: z.string().max(200).describe("Wallet ID to add"),
      role_id: z.string().max(200).describe("Role ID to assign"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const { organization_id, ...body } = params;
      await api.makeRequest(`organizations/${organization_id}/members`, "POST", body);
      return textResult(`Member ${params.wallet_id} added to organization.`);
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_remove_org_member", {
    title: "Remove Organization Member",
    description: "Remove a member from an organization.",
    inputSchema: {
      organization_id: IdParam,
      member_id: z.string().max(200).describe("Member ID to remove"),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      await api.makeRequest(`organizations/${params.organization_id}/members/${params.member_id}`, "DELETE");
      return textResult(`Member ${params.member_id} removed from organization.`);
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_list_org_roles", {
    title: "List Organization Roles",
    description: "List all roles defined for an organization.",
    inputSchema: { organization_id: IdParam },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const res = await api.makeRequest<{ items: unknown[] }>(`organizations/${params.organization_id}/roles`);
      return textResult(JSON.stringify(res, null, 2));
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  server.registerTool("dual_create_org_role", {
    title: "Create Organization Role",
    description: "Create a new role with specific permissions for an organization.",
    inputSchema: {
      organization_id: IdParam,
      name: z.string().max(200).describe("Role name"),
      permissions: z.array(z.string().max(200)).describe("List of permission strings"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      const { organization_id, ...body } = params;
      const res = await api.makeRequest<Record<string, unknown>>(`organizations/${organization_id}/roles`, "POST", body);
      return textResult(`Role created.\n${JSON.stringify(res, null, 2)}`);
    } catch (e) { return errorResult(handleApiError(e)); }
  });
}
