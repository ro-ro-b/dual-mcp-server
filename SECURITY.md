# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅ Current |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email security details to the repository owner
3. Include steps to reproduce, impact assessment, and any suggested fix
4. You will receive an acknowledgment within 48 hours

## Threat Model

This MCP server operates in two modes with different trust boundaries:

### stdio mode (local, single user)

- The server runs as a child process of the MCP client (Claude Desktop, Cursor, etc.)
- Auth credentials are set via environment variables and persist for the process lifetime
- The trust boundary is the user's machine — no network exposure

### HTTP mode (remote, multi-client)

- The server listens on a network port and accepts JSON-RPC over HTTP
- `MCP_SERVER_API_KEY` is **required** — the server refuses to start without it
- Each HTTP request creates a fresh `McpServer` and `ApiClient` with isolated auth state
- Binds to `127.0.0.1` by default; set `HOST=0.0.0.0` explicitly for external access
- Origin header validation is available via `CORS_ORIGIN`

## Security Controls

| Control | Description |
|---------|-------------|
| Session isolation | Fresh `ApiClient` per HTTP request prevents auth leakage between clients |
| SSRF protection | `assertExternalUrl()` blocks private networks, loopback, and cloud metadata |
| NoSQL injection | `SafeFilterSchema` rejects `$`-operator keys in object filters |
| Input validation | Zod schemas enforce type, size, and depth limits on all tool inputs |
| Header injection | `assertNoControlChars()` validates tokens and API keys |
| Rate limiting | Per-IP rate limiting with configurable max (default: 100 req/min) |
| Body size limit | Express `json({ limit: "1mb" })` prevents large-payload DoS |
| Security headers | CSP, HSTS, X-Content-Type-Options, X-Frame-Options |
| Error sanitization | `handleApiError()` maps status codes to safe messages; raw errors logged server-side only |
| API URL validation | HTTPS required for non-localhost DUAL API URLs |

## Known Limitations

- Rate limiting is in-memory and does not persist across restarts or coordinate across processes
- The AI service modules (`intelligence`, `governance`, `creative`) connect to localhost by default and do not apply the same SSRF protections as the core `assertExternalUrl()` check
- No OAuth/OIDC support for HTTP mode yet — authentication uses a shared static key
