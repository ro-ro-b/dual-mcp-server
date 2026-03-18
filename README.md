# DUAL MCP Server

AI-native integration with the [DUAL](https://dual.xyz) tokenization platform via the [Model Context Protocol](https://modelcontextprotocol.io).

This MCP server enables AI agents to interact directly with the DUAL Web3 Operating System — minting tokens, managing templates, executing actions, deploying webhooks, and querying blockchain infrastructure. Not through screen scraping or API wrappers, but through native integration that treats AI agents as first-class users of the system.

## Features

- **115 tools** across 17 API modules
- **Full CRUD** for wallets, organizations, templates, objects, faces, webhooks, notifications, and API keys
- **Event Bus** — execute actions and batch operations atomically
- **Sequencer & ZK-Rollup** — query batches and checkpoints
- **AI Services** — intelligence (agents, predictions, knowledge graph), governance (compliance, provenance), creative (token design, face templates)
- **Public API** — read-only access without authentication
- **Dual transport** — stdio for local use, HTTP for remote deployment
- **Session-isolated HTTP** — each HTTP request gets its own auth context

## Quick Start

### Install

```bash
npm install
npm run build
```

### Configure

Set your authentication via environment variables:

```bash
# Option 1: API Key (recommended for server-to-server)
export DUAL_API_KEY=your-api-key

# Option 2: JWT Token
export DUAL_ACCESS_TOKEN=your-jwt-token

# Option 3: Use the dual_login tool interactively
```

### Run

```bash
# stdio transport (for Claude, Cursor, etc.)
node dist/index.js

# HTTP transport (for remote/multi-client)
# MCP_SERVER_API_KEY is REQUIRED for HTTP mode
MCP_SERVER_API_KEY=your-secret TRANSPORT=http PORT=3100 node dist/index.js
```

### Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "dual": {
      "command": "node",
      "args": ["/path/to/dual-mcp-server/dist/index.js"],
      "env": {
        "DUAL_API_KEY": "your-api-key"
      }
    }
  }
}
```

## API Modules & Tools

### Core DUAL API (81 tools)

| Module | Tools | Description |
|--------|-------|-------------|
| **Wallets** | 11 | Authentication, registration, profile management, logout |
| **Organizations** | 10 | Multi-tenant workspaces, members, roles |
| **Templates** | 7 | Token template CRUD, variations |
| **Objects** | 8 | Tokenized asset instances, search, hierarchy |
| **Actions (Event Bus)** | 7 | Execute actions, batch operations, action types |
| **Faces** | 6 | Visual representations (image, 3D, web) |
| **Storage** | 4 | File upload, asset management |
| **Webhooks** | 6 | Real-time event subscriptions |
| **Notifications** | 5 | Message sending, templates |
| **Sequencer** | 4 | Batch and ZK-rollup checkpoint queries |
| **API Keys** | 3 | Programmatic access management |
| **Payments** | 2 | Payment config, deposit history |
| **Support** | 3 | Feature access requests, support messages |
| **Public API** | 5 | Read-only public endpoints (no auth) |

### AI Services (34 tools)

These tools require the DUAL AI microservices running alongside the server. See [AI Service Dependencies](#ai-service-dependencies) below.

| Module | Tools | Description |
|--------|-------|-------------|
| **Intelligence** | 12 | Autonomous agents, lifecycle predictions, trending, anomalies, knowledge graph |
| **Governance** | 14 | Compliance rules & evaluation, audit log, policy parsing, provenance verification |
| **Creative** | 8 | Token design generation, face templates, SVG rendering |

## Example Usage

### Natural Language → Token Deployment

> "Create a redeemable reward token for my brand with 1 million supply, set up a rule that expires after 12 months, and mint it on Base."

The AI agent uses:
1. `dual_create_template` — define the reward token structure
2. `dual_create_action_type` — register "Redeem" and "Expire" actions
3. `dual_execute_action` — mint the initial supply
4. `dual_create_webhook` — set up expiry monitoring

### Querying Infrastructure

> "Show me the latest ZK checkpoint and how many objects are on the platform."

1. `dual_list_checkpoints` — latest rollup state
2. `dual_public_get_stats` — platform-wide statistics

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DUAL_API_KEY` | API key for DUAL platform authentication | One of these |
| `DUAL_ACCESS_TOKEN` | JWT access token | One of these |
| `DUAL_REFRESH_TOKEN` | JWT refresh token | No |
| `DUAL_API_URL` | API base URL (default: `https://api.blockv-labs.io/v3`) | No |
| `TRANSPORT` | `stdio` (default) or `http` | No |
| `PORT` | HTTP port (default: `3100`) | No |
| `HOST` | HTTP bind address (default: `127.0.0.1`) | No |
| `MCP_SERVER_API_KEY` | Shared secret for HTTP endpoint auth | **Yes** (HTTP mode) |
| `CORS_ORIGIN` | Comma-separated allowed origins (e.g. `https://app.example.com`) | No |
| `RATE_LIMIT_MAX` | Max requests per minute per IP (default: `100`) | No |

### AI Service Dependencies

The intelligence, governance, and creative tool modules connect to separate DUAL AI microservices. If these services are not running, those 34 tools will return connection errors; the remaining 81 core tools are unaffected.

| Variable | Default | Service |
|----------|---------|---------|
| `INTELLIGENCE_URL` | `http://localhost:3201` | Intelligence (agents, predictions, graph) |
| `GOVERNANCE_URL` | `http://localhost:3202` | Governance (compliance, provenance, policies) |
| `CREATIVE_URL` | `http://localhost:3203` | Creative (token design, face rendering) |

## Architecture

```
dual-mcp-server/
├── src/
│   ├── index.ts              # Server factory, transport setup (stdio + HTTP)
│   ├── constants.ts          # API URL, limits, MCP_SERVER_API_KEY
│   ├── schemas/
│   │   └── common.ts         # Shared Zod schemas (pagination, IDs, filters)
│   ├── services/
│   │   ├── api-client.ts     # ApiClient class (per-session auth + HTTP requests)
│   │   ├── ai-client.ts      # HTTP client for AI microservices
│   │   ├── security.ts       # SSRF, NoSQL injection, input validation
│   │   └── formatters.ts     # Response formatting, truncation
│   └── tools/
│       ├── wallets.ts        # 11 wallet tools (incl. login, logout)
│       ├── organizations.ts  # 10 organization tools
│       ├── templates.ts      # 7 template tools
│       ├── objects.ts        # 8 object tools
│       ├── actions.ts        # 7 event bus tools
│       ├── faces.ts          # 6 face tools
│       ├── storage.ts        # 4 storage tools
│       ├── webhooks.ts       # 6 webhook tools
│       ├── notifications.ts  # 5 notification tools
│       ├── sequencer.ts      # 4 sequencer tools
│       ├── api-keys.ts       # 3 API key tools
│       ├── payments.ts       # 2 payment tools
│       ├── support.ts        # 3 support tools
│       ├── public-api.ts     # 5 public API tools
│       ├── intelligence.ts   # 12 intelligence tools
│       ├── governance.ts     # 14 governance tools
│       └── creative.ts       # 8 creative tools
├── SECURITY.md               # Security policy & reporting
└── dist/                     # Compiled JavaScript
```

## Security

See [SECURITY.md](SECURITY.md) for the security policy, threat model, and how to report vulnerabilities.

Key security features:
- **Session isolation**: HTTP mode creates a fresh server + auth context per request
- **SSRF protection**: External URL validation blocks private networks and cloud metadata
- **NoSQL injection prevention**: Filter schemas reject `$`-operator keys
- **Input validation**: Zod schemas with size/depth limits on all tool inputs
- **Rate limiting**: Per-IP rate limiting with configurable max
- **Security headers**: X-Content-Type-Options, CSP, HSTS, X-Frame-Options

## License

MIT
