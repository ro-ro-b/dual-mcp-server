import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeApiRequest, handleApiError, setAuth } from "../services/api-client.js";
import { textResult, errorResult, formatDate } from "../services/formatters.js";

export function registerWalletTools(server: McpServer): void {

  // --- LOGIN ---
  server.registerTool("dual_login", {
    title: "Login to DUAL",
    description: "Authenticate with email/phone and password. Returns JWT tokens for subsequent API calls. Sets auth automatically for this session.",
    inputSchema: {
      email: z.string().max(320).optional().describe("Email address"),
      phone_number: z.string().max(20).optional().describe("Phone number (alternative to email)"),
      password: z.string().min(8).max(128).describe("Account password"),
      otp: z.string().max(20).optional().describe("One-time password for 2FA"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      if (!params.email && !params.phone_number) {
        return errorResult("Error: Either email or phone_number is required for login.");
      }
      const res = await makeApiRequest<{ wallet: Record<string, unknown>; access_token: string; refresh_token: string }>(
        "wallets/login", "POST", params
      );
      setAuth(res.access_token, res.refresh_token);
      return textResult(`Logged in as ${res.wallet.nickname || res.wallet.email || res.wallet.id}. Session authenticated.`);
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  // --- GUEST LOGIN ---
  server.registerTool("dual_login_guest", {
    title: "Guest Login",
    description: "Create a guest session with limited permissions. No credentials required.",
    inputSchema: {
      nickname: z.string().max(200).optional().describe("Optional display name for the guest"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      const res = await makeApiRequest<{ wallet: Record<string, unknown>; access_token: string; refresh_token: string }>(
        "wallets/login/guest", "POST", params
      );
      setAuth(res.access_token, res.refresh_token);
      return textResult(`Guest session created as ${res.wallet.nickname || "anonymous"}. Limited permissions apply.`);
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  // --- REGISTER ---
  server.registerTool("dual_register", {
    title: "Register DUAL Wallet",
    description: "Create a new wallet account. A verification code will be sent to the email/phone provided.",
    inputSchema: {
      email: z.string().max(320).optional().describe("Email address"),
      phone_number: z.string().max(20).optional().describe("Phone number (alternative to email)"),
      password: z.string().min(8).max(128).describe("Account password (min 8 characters)"),
      nickname: z.string().max(200).optional().describe("Display name"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      if (!params.email && !params.phone_number) {
        return errorResult("Error: Either email or phone_number is required for registration.");
      }
      await makeApiRequest("wallets/register", "POST", params);
      return textResult("Registration initiated. A verification code has been sent — use dual_register_verify to complete.");
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  // --- REGISTER VERIFY ---
  server.registerTool("dual_register_verify", {
    title: "Verify Registration",
    description: "Complete registration by submitting the verification code sent to your email/phone.",
    inputSchema: {
      code: z.string().max(20).describe("Verification code received via email/SMS"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const res = await makeApiRequest<{ wallet: Record<string, unknown>; access_token: string; refresh_token: string }>(
        "wallets/register/verify", "POST", params
      );
      setAuth(res.access_token, res.refresh_token);
      return textResult(`Registration complete. Logged in as ${res.wallet.nickname || res.wallet.id}.`);
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  // --- REFRESH TOKEN ---
  server.registerTool("dual_refresh_token", {
    title: "Refresh Access Token",
    description: "Exchange a refresh token for a new access token.",
    inputSchema: {
      refresh_token: z.string().max(2048).describe("Refresh token from login"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const res = await makeApiRequest<{ access_token: string; refresh_token: string }>(
        "wallets/token/refresh", "POST", params
      );
      setAuth(res.access_token, res.refresh_token);
      return textResult("Token refreshed. Session re-authenticated.");
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  // --- GET CURRENT WALLET ---
  server.registerTool("dual_get_me", {
    title: "Get Current Wallet",
    description: "Get the authenticated wallet's profile — ID, nickname, email, avatar, language, activation status.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async () => {
    try {
      const w = await makeApiRequest<Record<string, unknown>>("wallets/me");
      return textResult(JSON.stringify(w, null, 2));
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  // --- UPDATE WALLET ---
  server.registerTool("dual_update_me", {
    title: "Update Current Wallet",
    description: "Update the authenticated wallet's nickname, language, or avatar.",
    inputSchema: {
      nickname: z.string().max(200).optional().describe("New display name"),
      language: z.string().max(10).optional().describe("Language code (e.g. 'en')"),
      avatar: z.string().max(2048).optional().describe("Avatar URL"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const w = await makeApiRequest<Record<string, unknown>>("wallets/me", "PATCH", params);
      return textResult(`Wallet updated.\n${JSON.stringify(w, null, 2)}`);
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  // --- GET WALLET BY ID ---
  server.registerTool("dual_get_wallet", {
    title: "Get Wallet by ID",
    description: "Retrieve a wallet's public profile by its ID.",
    inputSchema: {
      wallet_id: z.string().max(200).describe("Wallet ID to look up"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const w = await makeApiRequest<Record<string, unknown>>(`wallets/${params.wallet_id}`);
      return textResult(JSON.stringify(w, null, 2));
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  // --- PASSWORD RESET ---
  server.registerTool("dual_reset_password", {
    title: "Request Password Reset",
    description: "Send a password reset code to the wallet's email/phone.",
    inputSchema: {
      email: z.string().max(320).optional().describe("Email address"),
      phone_number: z.string().max(20).optional().describe("Phone number"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      if (!params.email && !params.phone_number) {
        return errorResult("Error: Either email or phone_number is required for password reset.");
      }
      await makeApiRequest("wallets/reset-code", "POST", params);
      return textResult("Reset code sent. Use dual_reset_password_verify with the code and new password.");
    } catch (e) { return errorResult(handleApiError(e)); }
  });

  // --- PASSWORD RESET VERIFY ---
  server.registerTool("dual_reset_password_verify", {
    title: "Verify Password Reset",
    description: "Submit reset code and set a new password.",
    inputSchema: {
      code: z.string().max(20).describe("Reset code received"),
      new_password: z.string().min(8).max(128).describe("New password (min 8 characters)"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      await makeApiRequest("wallets/reset-code/verify", "POST", params);
      return textResult("Password reset successful. You can now log in with the new password.");
    } catch (e) { return errorResult(handleApiError(e)); }
  });
}
