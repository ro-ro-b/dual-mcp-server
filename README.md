# DUAL MCP Server

AI-native integration with the [DUAL](https://dual.xyz) tokenization platform via the [Model Context Protocol](https://modelcontextprotocol.io).

This MCP server enables AI agents to interact directly with the DUAL Web3 Operating System — minting tokens, managing templates, executing actions, deploying webhooks, and querying blockchain infrastructure. Not through screen scraping or API wrappers, but through native integration that treats AI agents as first-class users of the system.

## Features

- **60+ tools** across 14 API modules
- **Full CRUD** for wallets, organizations, templates, objects, faces, webhooks, notifications, and API keys
- **Event Bus** — execute actions and batch operations atomically
- **Sequencer & ZK-Rollup** — query batches and checkpoints
- **Public API** — read-only access without authentication
- **Dual transport** — stdio for local use, HTTP for remote deployment

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
TRANSPORT=http PORT=3100 node dist/index.js
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

| Module | Tools | Description |
|--------|-------|-------------|
| **Wallets** | 10 | Authentication, registration, profile management |
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
| `DUAL_API_KEY` | API key for authentication | One of these |
| `DUAL_ACCESS_TOKEN` | JWT access token | One of these |
| `DUAL_REFRESH_TOKEN` | JWT refresh token | Optional |
| `DUAL_API_URL` | API base URL (default: `https://api.blockv-labs.io/v3`) | No |
| `TRANSPORT` | `stdio` (default) or `http` | No |
| `PORT` | HTTP port (default: 3100) | No |

## Architecture

```
dual-mcp-server/
├── src/
│   ├── index.ts              # Server initialization & transport
│   ├── constants.ts          # API URL, limits
│   ├── schemas/
│   │   └── common.ts         # Shared Zod schemas (pagination, IDs)
│   ├── services/
│   │   ├── api-client.ts     # HTTP client, auth, error handling
│   │   └── formatters.ts     # Response formatting, truncation
│   └── tools/
│       ├── wallets.ts        # 10 wallet tools
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
│       └── public-api.ts     # 5 public API tools
└── dist/                     # Compiled JavaScript
```

## License

MIT
