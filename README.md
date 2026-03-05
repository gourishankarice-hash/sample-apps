# MCP Gateway

A production-ready **Model Context Protocol (MCP) Gateway** written in TypeScript that aggregates multiple downstream MCP servers into a single unified interface, with a full React admin dashboard for monitoring and management.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Directory Structure](#directory-structure)
- [Core Components](#core-components)
- [Execution Flow](#execution-flow)
- [Admin UI](#admin-ui)
- [REST API Reference](#rest-api-reference)
- [Configuration](#configuration)
- [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
- [Adding External MCP Servers](#adding-external-mcp-servers)
- [Transport Modes](#transport-modes)
- [Security](#security)

---

## Overview

The MCP Gateway acts as both an **MCP server** (to upstream clients like Claude Desktop, LLM apps) and an **MCP client** (to downstream servers like Calculator, Weather, GitHub, Filesystem, etc.).

```
┌──────────────────────────────────────────────────────────────┐
│                        Upstream Clients                      │
│           (Claude Desktop / LLM App / Admin UI)              │
└────────────────────────────┬─────────────────────────────────┘
                             │  MCP over SSE / stdio
┌────────────────────────────▼─────────────────────────────────┐
│                       MCP GATEWAY                            │
│  ┌─────────────┐  ┌────────────┐  ┌──────────────────────┐  │
│  │ GatewayServer│  │ Aggregator │  │   HttpGatewayServer  │  │
│  │  (MCP Server)│  │            │  │   Express + SSE      │  │
│  └──────┬──────┘  └──────┬─────┘  └──────────┬───────────┘  │
│         │                │                    │              │
│  ┌──────▼──────┐  ┌──────▼─────┐  ┌──────────▼───────────┐  │
│  │   Router    │  │ProxyManager│  │   Admin UI REST API   │  │
│  │             │  │            │  │   /api/*              │  │
│  └──────┬──────┘  └──────┬─────┘  └──────────────────────┘  │
└─────────┼────────────────┼─────────────────────────────────-─┘
          │ MCP Client     │ MCP Client
  ┌───────▼───┐     ┌──────▼──────┐     ┌──────────────┐
  │Calculator │     │   Weather   │     │  Any MCP     │
  │  Server   │     │   Server    │     │  Server ...  │
  └───────────┘     └─────────────┘     └──────────────┘
```

### Key Concepts

| Concept | Description |
|---------|-------------|
| **Namespace prefixing** | Tool/prompt names are prefixed with `{namespace}_` (e.g. `calc_add`, `weather_get_forecast`) to avoid collisions across servers |
| **Aggregation** | All tools, resources, and prompts from all connected servers are merged into one flat list |
| **Routing** | Incoming requests are decoded by namespace prefix and forwarded to the correct downstream server |
| **Health checking** | Each server is periodically pinged; failed servers are automatically reconnected with exponential back-off |

---

## Architecture

### Layer Diagram

```
src/
├── gateway/                    ← Core gateway logic
│   ├── index.ts                ← Entry point & bootstrap
│   ├── server.ts               ← GatewayServer (upstream MCP server)
│   ├── proxy.ts                ← ProxyManager (downstream MCP clients)
│   ├── aggregator.ts           ← Aggregator (merges capabilities)
│   ├── router.ts               ← Router (routes requests by namespace)
│   ├── httpServer.ts           ← Express HTTP server + SSE transport
│   ├── apiRoutes.ts            ← Admin REST API (/api/*)
│   └── middleware/
│       ├── auth.ts             ← API key authentication
│       └── rateLimiter.ts      ← Sliding-window rate limiter
├── servers/                    ← Built-in example MCP servers
│   ├── calculator/index.ts     ← Math tools (8 tools, 1 resource, 1 prompt)
│   └── weather/index.ts        ← Weather tools (3 tools, 7 resources, 1 prompt)
├── types/index.ts              ← All TypeScript interfaces
└── utils/
    ├── config.ts               ← Config loader (JSON + env overrides)
    ├── logger.ts               ← Winston logger (stderr + log emitter)
    └── logEmitter.ts           ← Ring-buffer + EventEmitter for log streaming

ui/                             ← React Admin Dashboard
├── src/
│   ├── App.tsx                 ← React Router routes
│   ├── api/gateway.ts          ← API client functions
│   ├── hooks/
│   │   ├── useApi.ts           ← Polling data hook
│   │   └── useLogs.ts          ← SSE log stream hook
│   ├── components/
│   │   ├── Layout.tsx          ← Page shell (sidebar + outlet)
│   │   ├── Sidebar.tsx         ← Navigation sidebar
│   │   ├── StatusBadge.tsx     ← Server status badge
│   │   └── StatCard.tsx        ← Metric card
│   └── pages/
│       ├── Dashboard.tsx       ← Overview: stats + server list + live logs
│       ├── Servers.tsx         ← Server management + add/delete/reconnect
│       ├── Tools.tsx           ← Tool browser + invoke modal
│       ├── Resources.tsx       ← Resource table
│       ├── Prompts.tsx         ← Prompt list with argument details
│       └── Logs.tsx            ← Real-time log stream with filtering

config/
└── gateway.config.json         ← Gateway & server configuration
```

---

## Directory Structure

```
mcp-gatway/
├── config/
│   └── gateway.config.json     ← Main config file
├── src/
│   ├── gateway/                ← Gateway source
│   ├── servers/                ← Example MCP servers
│   ├── types/                  ← TypeScript types
│   └── utils/                  ← Shared utilities
├── ui/                         ← React Admin UI
│   ├── src/
│   └── dist/                   ← Built UI (served by gateway)
├── dist/                       ← Compiled TypeScript output
├── .env.example                ← Environment variable template
├── package.json
└── tsconfig.json
```

---

## Core Components

### 1. `ProxyManager` — [src/gateway/proxy.ts](src/gateway/proxy.ts)

Manages one MCP `Client` instance per downstream server.

**Responsibilities:**
- Establishes connections via `StdioClientTransport` (subprocess) or `SSEClientTransport` (HTTP)
- Caches each server's tools, resources, and prompts after connecting
- Runs periodic health checks; triggers exponential back-off reconnection on failure
- Exposes `connect()`, `disconnect()`, `disconnectAll()`, `getServer()`, `getAllServers()`, `getConnectedServers()`

**Health Check Flow:**
```
Health check timer fires
    → calls client.listTools() as a ping
    → success → keep status "connected"
    → failure → status = "error", clear timer, begin reconnect loop
         → attempt 1 after delayMs
         → attempt 2 after delayMs × backoffMultiplier
         → ... up to maxAttempts
         → all failed → status = "error" (stays down until manual reconnect)
```

---

### 2. `Aggregator` — [src/gateway/aggregator.ts](src/gateway/aggregator.ts)

Merges capabilities from all **connected** downstream servers into flat lists.

**Namespace prefixing rules:**
- Tools: `{namespace}_{originalName}` → e.g. `calc_add`, `weather_get_forecast`
- Prompts: `{namespace}_{originalName}` → e.g. `calc_math_problem`
- Resources: URIs are kept as-is (already globally unique by design)
- Tool/prompt descriptions are prefixed with `[ServerName]` for clarity

---

### 3. `Router` — [src/gateway/router.ts](src/gateway/router.ts)

Routes incoming MCP requests to the correct downstream server.

**Resolution logic:**
1. Look up the prefixed tool/prompt name in the aggregated list
2. Extract the `serverId` and `originalName`
3. Verify the server is currently `"connected"`
4. Forward the call to `server.client.callTool()` / `readResource()` / `getPrompt()`
5. Return the result upstream

---

### 4. `GatewayServer` — [src/gateway/server.ts](src/gateway/server.ts)

The upstream-facing MCP server — the face the gateway shows to external clients.

**Handles MCP protocol requests:**
- `ListTools` → returns aggregated tool list
- `CallTool` → delegates to `Router.callTool()`
- `ListResources` → returns aggregated resource list
- `ReadResource` → delegates to `Router.readResource()`
- `ListPrompts` → returns aggregated prompt list
- `GetPrompt` → delegates to `Router.getPrompt()`

Also exposes `getStatus()` which returns live gateway health including totals for tools, resources, prompts, and per-server connection state.

---

### 5. `HttpGatewayServer` — [src/gateway/httpServer.ts](src/gateway/httpServer.ts)

Express-based HTTP server that ties everything together.

**Endpoints mounted:**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness probe (no auth) |
| `GET` | `/status` | Gateway status JSON (no auth) |
| `GET` | `/api/*` | Admin UI REST + SSE API |
| `GET` | `/sse` | MCP SSE connection (auth + rate-limit) |
| `POST` | `/messages` | MCP JSON-RPC messages (auth + rate-limit) |
| `GET` | `/*` | React SPA (served from `ui/dist/`) |

---

### 6. `apiRoutes` — [src/gateway/apiRoutes.ts](src/gateway/apiRoutes.ts)

Express Router powering all Admin UI API endpoints.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/status` | Gateway health + server counts |
| `GET` | `/api/servers` | All servers with runtime status |
| `POST` | `/api/servers` | Add a new server (persists to config) |
| `POST` | `/api/servers/:id/reconnect` | Reconnect a disconnected server |
| `DELETE` | `/api/servers/:id` | Remove a server (persists to config) |
| `GET` | `/api/tools` | All aggregated tools |
| `POST` | `/api/tools/invoke` | Invoke a tool by name |
| `GET` | `/api/resources` | All aggregated resources |
| `GET` | `/api/prompts` | All aggregated prompts |
| `GET` | `/api/logs` | SSE stream of live log entries |

---

### 7. `LogEmitter` — [src/utils/logEmitter.ts](src/utils/logEmitter.ts)

Bridges Winston logging to the browser Admin UI.

```
Winston logger
    → Stream transport writes JSON lines
    → logWritableStream.write() parses each line
    → pushes into logBuffer (ring buffer, max 200 entries)
    → emits "log" event on logEmitter

GET /api/logs (SSE client connects)
    → replays entire logBuffer immediately (catch-up)
    → subscribes to logEmitter "log" events
    → streams every new entry as text/event-stream
```

---

## Execution Flow

### Startup Sequence

```
node dist/gateway/index.js
│
├── 1. Load config (gateway.config.json + env overrides)
│
├── 2. ProxyManager.connect() for each enabled server (parallel)
│   ├── Create MCP Client
│   ├── Create transport (StdioClientTransport or SSEClientTransport)
│   ├── client.connect(transport)
│   ├── Fetch capabilities: listTools(), listResources(), listPrompts()
│   └── Schedule health check timer
│
├── 3. Create GatewayServer
│   ├── Create Aggregator(proxy)
│   ├── Create Router(proxy, aggregator)
│   ├── Create MCP Server with capabilities: { tools, resources, prompts }
│   └── Register request handlers (ListTools, CallTool, ...)
│
├── 4. Attach transports (based on gateway.transport)
│   ├── "stdio"  → StdioServerTransport (reads stdin, writes stdout)
│   ├── "http"   → HttpGatewayServer.start() (Express on port 3000)
│   └── "both"   → both simultaneously
│
└── 5. Log summary + register SIGINT/SIGTERM handlers
```

### Tool Call Flow (end-to-end)

```
Upstream client (e.g. Claude Desktop)
    │
    │  MCP CallTool { name: "calc_add", arguments: { a: 5, b: 3 } }
    ▼
GatewayServer.setRequestHandler(CallToolRequestSchema)
    │
    ▼
Router.callTool("calc_add", { a: 5, b: 3 })
    │
    ├── Aggregator.getAggregatedTools()
    │       finds tool where prefixedName === "calc_add"
    │       resolves: serverId = "calculator", originalName = "add"
    │
    ├── ProxyManager.getServer("calculator")
    │       verifies status === "connected"
    │
    └── server.client.callTool({ name: "add", arguments: { a: 5, b: 3 } })
            │
            ▼ (MCP JSON-RPC over stdio)
        Calculator MCP Server process
            └── returns { content: [{ type: "text", text: "8" }] }
    │
    ▼
Result returned upstream to client
```

### Reconnection Flow

```
Health check timer fires (every 30s by default)
    │
    ├── server.client.listTools()  ← used as heartbeat
    │
    ├── Success → server.status = "connected" (no-op if already connected)
    │
    └── Failure → server.status = "error"
                  clearHealthCheck timer
                  │
                  ▼
              reconnect loop (attempt 1..maxAttempts)
                  ├── wait delayMs × (backoffMultiplier ^ attempt)
                  ├── server.client = new Client()          ← fresh client
                  ├── establishConnection(server)
                  │   ├── success → status = "connected", restart health check
                  │   └── failure → next attempt
                  └── all attempts exhausted → status = "error"
```

### Log Streaming Flow

```
Any component calls logger.info("...")
    │
    ├── Winston Console transport → stderr (keeps stdout clean for stdio MCP)
    │
    └── Winston Stream transport → logWritableStream
            │
            ├── parse JSON → push to logBuffer (ring buffer, 200 entries)
            └── logEmitter.emit("log", entry)
                    │
                    └── all connected SSE clients (GET /api/logs)
                            receive: "data: {...}\n\n"
```

---

## Admin UI

The React admin dashboard is served at `http://localhost:3000/` when built.

### Pages

| Page | Route | Features |
|------|-------|---------|
| **Dashboard** | `/` | 4 stat cards (servers, tools, resources, prompts), server health table, recent live logs |
| **Servers** | `/servers` | All server cards with status badge, capability counts, error messages, Reconnect / Delete / Add Server buttons |
| **Tools** | `/tools` | Searchable tool list, expandable JSON schema view, **Invoke modal** — run any tool with custom arguments and see results live |
| **Resources** | `/resources` | Searchable table showing URI, name, MIME type, owning server |
| **Prompts** | `/prompts` | Searchable list with expandable argument details (name, description, required flag) |
| **Logs** | `/logs` | Real-time SSE log stream, level filter (all / error / warn / info / debug), pause/resume, expandable metadata |

### UI Tech Stack

| Technology | Purpose |
|------------|---------|
| React 18 | UI framework |
| React Router v6 | Client-side routing |
| Tailwind CSS v3 | Utility-first styling (dark theme) |
| Vite | Build tool + dev server |
| TypeScript | Type safety |
| lucide-react | Icons |
| EventSource API | SSE log streaming |

---

## REST API Reference

### `GET /api/status`

```json
{
  "name": "mcp-gateway",
  "version": "1.0.0",
  "uptime": 142,
  "connectedServers": 2,
  "totalServers": 2,
  "totalTools": 11,
  "totalResources": 8,
  "totalPrompts": 2,
  "servers": [
    {
      "id": "calculator",
      "name": "Calculator Server",
      "status": "connected",
      "tools": 8,
      "resources": 1,
      "prompts": 1,
      "connectedAt": "2026-01-01T10:00:00.000Z"
    }
  ]
}
```

### `GET /api/tools`

```json
[
  {
    "name": "calc_add",
    "originalName": "add",
    "serverId": "calculator",
    "serverName": "Calculator Server",
    "namespace": "calc",
    "description": "[Calculator Server] Add two numbers",
    "inputSchema": {
      "type": "object",
      "properties": {
        "a": { "type": "number", "description": "First operand" },
        "b": { "type": "number", "description": "Second operand" }
      },
      "required": ["a", "b"]
    }
  }
]
```

### `POST /api/tools/invoke`

Request:
```json
{ "name": "calc_add", "arguments": { "a": 10, "b": 5 } }
```

Response:
```json
{ "content": [{ "type": "text", "text": "15" }] }
```

### `POST /api/servers` — Add a new server

Request:
```json
{
  "id": "my-server",
  "name": "My Server",
  "namespace": "myns",
  "transport": {
    "type": "stdio",
    "command": "node",
    "args": ["dist/servers/my-server/index.js"]
  }
}
```

### `DELETE /api/servers/:id` — Remove a server

Disconnects the server, removes it from in-memory config, and persists the change to `gateway.config.json`.

### `GET /api/logs` (SSE)

Streams `text/event-stream` events. Each event data is a JSON `LogEntry`:

```json
{
  "level": "info",
  "message": "Connected to downstream server: calculator",
  "timestamp": "2026-01-01 10:00:00"
}
```

---

## Configuration

Edit [`config/gateway.config.json`](config/gateway.config.json):

```jsonc
{
  "gateway": {
    "name": "mcp-gateway",
    "version": "1.0.0",
    "transport": "http",        // "stdio" | "http" | "both"
    "http": {
      "enabled": true,
      "port": 3000,
      "host": "0.0.0.0",
      "path": {
        "sse": "/sse",
        "messages": "/messages",
        "health": "/health"
      }
    },
    "auth": {
      "enabled": false,         // set true to require API keys on MCP endpoints
      "apiKeys": ["your-key"]
    },
    "rateLimit": {
      "enabled": true,
      "windowMs": 60000,        // 1 minute
      "maxRequests": 100
    },
    "logging": {
      "level": "info",          // "error" | "warn" | "info" | "debug"
      "format": "json"
    }
  },
  "servers": [
    {
      "id": "calculator",
      "name": "Calculator Server",
      "namespace": "calc",      // prefix for all tool/prompt names
      "enabled": true,
      "transport": {
        "type": "stdio",
        "command": "node",
        "args": ["dist/servers/calculator/index.js"]
      },
      "healthCheck": { "enabled": true, "intervalMs": 30000 },
      "retry": { "maxAttempts": 3, "delayMs": 1000, "backoffMultiplier": 2 }
    }
  ]
}
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GATEWAY_PORT` | `3000` | Override HTTP port |
| `GATEWAY_HOST` | `0.0.0.0` | Override bind host |
| `GATEWAY_AUTH_ENABLED` | `false` | Enable API key auth |
| `GATEWAY_API_KEYS` | `""` | Comma-separated API keys |
| `LOG_LEVEL` | `info` | `error / warn / info / debug` |
| `GATEWAY_CONFIG_PATH` | `config/gateway.config.json` | Path to config file |

Copy `.env.example` to `.env` and fill in values.

---

## Running the Application

### Prerequisites

- Node.js 20+
- npm 9+

### Install & Build

```bash
# Install backend dependencies
npm install

# Build backend (TypeScript → dist/)
npm run build

# Build everything (backend + React UI)
npm run build:all
```

### Start (production)

```bash
npm start
# Gateway running at http://localhost:3000
# Admin UI at  http://localhost:3000/
# MCP SSE at   http://localhost:3000/sse
# Health at    http://localhost:3000/health
```

### Development (hot-reload)

```bash
# Terminal 1: backend with tsx watch
npm run dev

# Terminal 2: Vite dev server for UI (proxies /api to localhost:3000)
npm run dev:ui
# UI available at http://localhost:5173
```

### Run individual servers

```bash
npm run dev:calculator
npm run dev:weather
```

---

## Adding External MCP Servers

Add an entry to the `servers` array in `gateway.config.json`:

### stdio server (subprocess)

```json
{
  "id": "github",
  "name": "GitHub Server",
  "description": "GitHub tools via MCP",
  "namespace": "github",
  "enabled": true,
  "transport": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-github"],
    "env": {
      "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_your_token"
    }
  },
  "healthCheck": { "enabled": true, "intervalMs": 30000 },
  "retry": { "maxAttempts": 3, "delayMs": 1000, "backoffMultiplier": 2 }
}
```

### SSE server (remote HTTP)

```json
{
  "id": "remote",
  "name": "Remote MCP Server",
  "namespace": "remote",
  "enabled": true,
  "transport": {
    "type": "sse",
    "url": "http://your-server:4000/sse",
    "headers": {
      "Authorization": "Bearer your-token"
    }
  },
  "healthCheck": { "enabled": true, "intervalMs": 30000 },
  "retry": { "maxAttempts": 3, "delayMs": 2000, "backoffMultiplier": 2 }
}
```

**Pre-configured templates** (set `"enabled": true` to activate):

| Template ID | Package | Notes |
|------------|---------|-------|
| `filesystem` | `@modelcontextprotocol/server-filesystem` | Local file access |
| `github` | `@modelcontextprotocol/server-github` | Needs `GITHUB_PERSONAL_ACCESS_TOKEN` |
| `brave-search` | `@modelcontextprotocol/server-brave-search` | Needs `BRAVE_API_KEY` |
| `postgres` | `@modelcontextprotocol/server-postgres` | Needs connection string |
| `remote-sse-example` | — | Any remote SSE MCP server |

---

## Transport Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `stdio` | MCP over stdin/stdout | Claude Desktop integration |
| `http` | MCP over HTTP + SSE | Web clients, multiple simultaneous clients |
| `both` | Both simultaneously | Maximum compatibility |

### Claude Desktop config example (stdio mode)

Set `"transport": "stdio"` in `gateway.config.json`, then add to Claude Desktop:

```json
{
  "mcpServers": {
    "mcp-gateway": {
      "command": "node",
      "args": ["C:/Users/gouri/mcp-gatway/dist/gateway/index.js"]
    }
  }
}
```

### HTTP/SSE client example

```json
{
  "mcpServers": {
    "mcp-gateway": {
      "url": "http://localhost:3000/sse"
    }
  }
}
```

---

## Security

### Authentication (MCP endpoints)

Enable API key auth in config:

```json
"auth": {
  "enabled": true,
  "apiKeys": ["secret-key-1", "secret-key-2"]
}
```

Clients must send the key as:
- `x-api-key: secret-key-1` header, or
- `Authorization: Bearer secret-key-1` header

> The `/api/*` (Admin UI) and `/health` endpoints are **not** protected by auth. Add network-level access control (firewall, VPN) for production.

### Rate Limiting

Applies to MCP endpoints (`/sse`, `/messages`) only. Uses an in-process sliding-window limiter per client IP. For production behind a load balancer, replace the in-memory store with Redis.

```json
"rateLimit": {
  "enabled": true,
  "windowMs": 60000,
  "maxRequests": 100
}
```

Exceeded requests receive `HTTP 429` with a `Retry-After` header.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20+ (ESM) |
| Language | TypeScript 5.7 |
| MCP SDK | `@modelcontextprotocol/sdk ^1.5.0` |
| HTTP server | Express 4 |
| Logging | Winston 3 |
| Validation | Zod 3 |
| UI framework | React 18 |
| UI build | Vite 6 |
| UI styling | Tailwind CSS 3 |
| UI routing | React Router v6 |
