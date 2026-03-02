/**
 * MCP OAuth Server
 * ────────────────────────────────────────────────────────────────────
 * Exposes a Model Context Protocol (MCP) server over HTTP/SSE with
 * OAuth 2.0 protection, consumable by Microsoft Copilot Studio.
 *
 * Endpoints:
 *   OAuth:
 *     GET  /.well-known/openid-configuration   Discovery document
 *     POST /oauth/token                         Token endpoint
 *     GET  /oauth/authorize                     Authorization endpoint
 *     GET  /oauth/userinfo                      UserInfo endpoint
 *     POST /oauth/introspect                    Token introspection
 *     POST /oauth/revoke                        Token revocation
 *
 *   MCP (SSE transport — requires Bearer token):
 *     GET  /sse                                 Open SSE connection
 *     POST /messages?sessionId=<id>             Send MCP message
 *
 *   Utility:
 *     GET  /health                              Health check
 *     GET  /                                    Welcome / API docs
 */

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import {
  validateToken,
  validateClient,
  generateToken,
  generateAuthCode,
  exchangeAuthCode,
  revokeToken,
  introspectToken,
  getDiscoveryDocument,
  getUser,
  TokenPayload,
} from "./auth.js";

import { getWeather, listSupportedCities }         from "./tools/weather.js";
import { calculate }                                from "./tools/calculator.js";
import { getCurrentDatetime, listTimezoneAliases }  from "./tools/datetime.js";
import { searchKnowledgeBase, getCategories }       from "./tools/knowledge.js";
import { createTask, listTasks, updateTask }        from "./tools/tasks.js";
import { getUserProfile }                           from "./tools/profile.js";

dotenv.config();

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? `http://localhost:${PORT}`;

// ─────────────────────────────────────────────────────────────────────
// Express app
// ─────────────────────────────────────────────────────────────────────

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─────────────────────────────────────────────────────────────────────
// Auth middleware
// ─────────────────────────────────────────────────────────────────────

// Extend Request to carry the token payload
declare global {
  namespace Express {
    interface Request {
      tokenPayload?: TokenPayload;
    }
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({
      error: "unauthorized",
      error_description: "Bearer token required. Obtain one via POST /oauth/token",
    });
    return;
  }

  const payload = validateToken(token);
  if (!payload) {
    res.status(401).json({
      error: "invalid_token",
      error_description: "Token is expired, invalid, or has been revoked.",
    });
    return;
  }

  req.tokenPayload = payload;
  next();
}

// ─────────────────────────────────────────────────────────────────────
// OAuth Endpoints
// ─────────────────────────────────────────────────────────────────────

/** GET /.well-known/openid-configuration */
app.get("/.well-known/openid-configuration", (_req, res) => {
  res.json(getDiscoveryDocument());
});

/** POST /oauth/token */
app.post("/oauth/token", (req, res) => {
  const { grant_type, client_id, client_secret, code, redirect_uri, scope } = req.body as Record<string, string>;

  // Support Basic auth as well
  let cId = client_id;
  let cSecret = client_secret;
  const basicAuth = req.headers.authorization?.match(/^Basic (.+)$/);
  if (basicAuth) {
    const decoded = Buffer.from(basicAuth[1], "base64").toString();
    [cId, cSecret] = decoded.split(":");
  }

  const client = validateClient(cId, cSecret);
  if (!client) {
    res.status(401).json({ error: "invalid_client", error_description: "Invalid client_id or client_secret." });
    return;
  }

  // ── Client Credentials ─────────────────────────────────────────────
  if (grant_type === "client_credentials") {
    if (!client.allowedGrants.includes("client_credentials")) {
      res.status(400).json({ error: "unauthorized_client" });
      return;
    }
    const requestedScope = scope ?? client.allowedScopes.join(" ");
    const token = generateToken(cId, requestedScope, "client_credentials");

    res.json({
      access_token:  token,
      token_type:    "Bearer",
      expires_in:    3600,
      scope:         requestedScope,
    });
    return;
  }

  // ── Authorization Code ─────────────────────────────────────────────
  if (grant_type === "authorization_code") {
    if (!code || !redirect_uri) {
      res.status(400).json({ error: "invalid_request", error_description: "code and redirect_uri are required." });
      return;
    }
    const result = exchangeAuthCode(code, cId, redirect_uri);
    if (!result) {
      res.status(400).json({ error: "invalid_grant", error_description: "Authorization code is invalid, expired, or already used." });
      return;
    }
    const token = generateToken(cId, result.scope, "authorization_code", result.userId);

    res.json({
      access_token:  token,
      token_type:    "Bearer",
      expires_in:    3600,
      scope:         result.scope,
    });
    return;
  }

  res.status(400).json({
    error: "unsupported_grant_type",
    error_description: "Supported grant types: client_credentials, authorization_code",
  });
});

/** GET /oauth/authorize — Authorization Code flow */
app.get("/oauth/authorize", (req, res) => {
  const { client_id, redirect_uri, scope, state, response_type } = req.query as Record<string, string>;

  if (response_type !== "code") {
    res.status(400).send("Only response_type=code is supported.");
    return;
  }

  // In production: show a real login page. For demo, auto-approve as user1.
  const loginPage = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>MCP OAuth - Sign In</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
           background: #f0f4f8; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,.1); width: 360px; }
    h2 { margin-top: 0; color: #1a1a2e; }
    .scope-badge { background: #e8f4fd; color: #0078d4; padding: 4px 10px; border-radius: 20px;
                   font-size: 12px; display: inline-block; margin: 2px; }
    input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;
            box-sizing: border-box; margin-bottom: 1rem; font-size: 14px; }
    button { width: 100%; padding: 12px; background: #0078d4; color: white; border: none;
             border-radius: 6px; font-size: 16px; cursor: pointer; }
    button:hover { background: #106ebe; }
    .app-name { color: #0078d4; font-weight: 600; }
    .hint { font-size: 12px; color: #888; margin-top: 8px; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Sign In</h2>
    <p>
      <span class="app-name">${client_id}</span> is requesting access with scopes:<br>
      ${(scope ?? "tools:read").split(" ").map((s: string) => `<span class="scope-badge">${s}</span>`).join("")}
    </p>
    <form method="POST" action="/oauth/approve">
      <input type="hidden" name="client_id"    value="${client_id}">
      <input type="hidden" name="redirect_uri" value="${redirect_uri}">
      <input type="hidden" name="scope"        value="${scope ?? "tools:read"}">
      <input type="hidden" name="state"        value="${state ?? ""}">
      <input type="text"   name="username"     placeholder="Username (try: user1 or user2)" value="user1">
      <input type="password" name="password"   placeholder="Password (any value for demo)" value="demo">
      <button type="submit">Sign In & Authorize</button>
    </form>
    <p class="hint">Demo: any password is accepted. Username must be user1 or user2.</p>
  </div>
</body>
</html>`;

  res.send(loginPage);
});

/** POST /oauth/approve — Process the login form */
app.post("/oauth/approve", (req, res) => {
  const { client_id, redirect_uri, scope, state, username } = req.body as Record<string, string>;

  // Demo: accept any login for user1/user2
  const userId = username === "user2" ? "user2" : "user1";
  const code = generateAuthCode(client_id, scope, userId, redirect_uri);

  const redirectUrl = new URL(redirect_uri);
  redirectUrl.searchParams.set("code", code);
  if (state) redirectUrl.searchParams.set("state", state);

  res.redirect(redirectUrl.toString());
});

/** GET /oauth/userinfo */
app.get("/oauth/userinfo", requireAuth, (req, res) => {
  const payload = req.tokenPayload!;
  const user = getUser(payload.sub);

  if (!user) {
    // Service account — return minimal info
    res.json({ sub: payload.sub, client_id: payload.client_id, token_type: "service_account" });
    return;
  }

  const profile = getUserProfile(payload.sub);
  res.json({ sub: user.userId, ...profile });
});

/** POST /oauth/introspect */
app.post("/oauth/introspect", (req, res) => {
  const { token } = req.body as { token: string };
  res.json(introspectToken(token ?? ""));
});

/** POST /oauth/revoke */
app.post("/oauth/revoke", (req, res) => {
  const { token } = req.body as { token: string };
  if (token) revokeToken(token);
  res.status(200).json({ message: "Token revoked." });
});

// ─────────────────────────────────────────────────────────────────────
// MCP Server setup
// ─────────────────────────────────────────────────────────────────────

// Active SSE transports keyed by session ID
const sseTransports: Map<string, SSEServerTransport> = new Map();

function createMCPServer(): Server {
  const server = new Server(
    { name: "mcp-oauth-server", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  // ── Tool Listing ──────────────────────────────────────────────────
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      // ── Public tools (no special scope needed) ──
      {
        name: "get_weather",
        description: "Get current weather conditions and forecast for a city. Supports 10 major cities worldwide.",
        inputSchema: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description: "City name (e.g. 'London', 'New York', 'Tokyo')",
            },
            unit: {
              type: "string",
              enum: ["celsius", "fahrenheit"],
              description: "Temperature unit. Defaults to celsius.",
            },
          },
          required: ["location"],
        },
      },
      {
        name: "calculate",
        description: "Safely evaluate a mathematical expression. Supports +, -, *, /, %, **, sqrt(), sin(), cos(), tan(), log(), PI, E, and more.",
        inputSchema: {
          type: "object",
          properties: {
            expression: {
              type: "string",
              description: "Math expression to evaluate, e.g. '2 * PI * 5' or 'sqrt(144) + log(100)'",
            },
          },
          required: ["expression"],
        },
      },
      {
        name: "get_current_datetime",
        description: "Get the current date and time in any IANA timezone or common abbreviations (EST, IST, JST, etc.).",
        inputSchema: {
          type: "object",
          properties: {
            timezone: {
              type: "string",
              description: "IANA timezone or abbreviation. Defaults to UTC. Examples: 'America/New_York', 'Asia/Kolkata', 'IST', 'PST'",
            },
          },
        },
      },
      {
        name: "search_knowledge_base",
        description: "Search the internal company knowledge base for articles, guides, and documentation.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query (keywords or natural language)",
            },
            category: {
              type: "string",
              description: "Optional category filter: IT Support, HR, Engineering, Finance, Operations",
            },
            limit: {
              type: "number",
              description: "Maximum number of results to return (1-10). Defaults to 5.",
            },
          },
          required: ["query"],
        },
      },

      // ── Authenticated tools (require valid token) ──
      {
        name: "get_user_profile",
        description: "Get the profile of the currently authenticated user including name, role, department, and permissions. Requires authentication.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "list_tasks",
        description: "List tasks with optional filtering by status, priority, or assignee. Requires authentication.",
        inputSchema: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["todo", "in_progress", "done", "cancelled"],
              description: "Filter by task status",
            },
            priority: {
              type: "string",
              enum: ["low", "medium", "high", "critical"],
              description: "Filter by priority level",
            },
            assignee: {
              type: "string",
              description: "Filter by assignee email (partial match)",
            },
          },
        },
      },
      {
        name: "create_task",
        description: "Create a new task. Requires authentication with tasks:write scope.",
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Task title",
            },
            description: {
              type: "string",
              description: "Detailed task description",
            },
            priority: {
              type: "string",
              enum: ["low", "medium", "high", "critical"],
              description: "Task priority. Defaults to medium.",
            },
            assignee: {
              type: "string",
              description: "Assignee email address",
            },
            dueDate: {
              type: "string",
              description: "Due date in YYYY-MM-DD format",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "List of tags",
            },
          },
          required: ["title", "description"],
        },
      },
      {
        name: "update_task",
        description: "Update an existing task's status, priority, or other fields. Requires authentication.",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Task ID (UUID)",
            },
            status: {
              type: "string",
              enum: ["todo", "in_progress", "done", "cancelled"],
            },
            priority: {
              type: "string",
              enum: ["low", "medium", "high", "critical"],
            },
            assignee: { type: "string" },
            title:    { type: "string" },
          },
          required: ["id"],
        },
      },
    ],
  }));

  // ── Tool Execution ────────────────────────────────────────────────
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name, arguments: args } = request.params;

    // Retrieve the session context (token payload injected at SSE level)
    // We store it on the transport object via a custom property
    const sessionId = (extra as Record<string, unknown>)?.sessionId as string | undefined;
    const transport = sessionId ? sseTransports.get(sessionId) : undefined;
    const tokenPayload = (transport as (SSEServerTransport & { _tokenPayload?: TokenPayload }) | undefined)?._tokenPayload;

    try {
      switch (name) {
        // ── get_weather ──────────────────────────────────────────
        case "get_weather": {
          const schema = z.object({
            location: z.string().min(1),
            unit: z.enum(["celsius", "fahrenheit"]).optional(),
          });
          const { location, unit } = schema.parse(args);
          const weather = getWeather(location, unit ?? "celsius");

          if (!weather) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `No weather data found for "${location}". Supported cities: ${listSupportedCities().join(", ")}`,
                },
              ],
            };
          }

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(weather, null, 2),
              },
            ],
          };
        }

        // ── calculate ────────────────────────────────────────────
        case "calculate": {
          const { expression } = z.object({ expression: z.string().min(1) }).parse(args);
          const result = calculate(expression);
          return {
            content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          };
        }

        // ── get_current_datetime ─────────────────────────────────
        case "get_current_datetime": {
          const { timezone } = z.object({ timezone: z.string().optional() }).parse(args ?? {});
          const dt = getCurrentDatetime(timezone);
          return {
            content: [{ type: "text" as const, text: JSON.stringify(dt, null, 2) }],
          };
        }

        // ── search_knowledge_base ────────────────────────────────
        case "search_knowledge_base": {
          const schema = z.object({
            query:    z.string().min(1),
            category: z.string().optional(),
            limit:    z.number().int().min(1).max(10).optional(),
          });
          const { query, category, limit } = schema.parse(args);
          const results = searchKnowledgeBase(query, category, limit ?? 5);
          return {
            content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }],
          };
        }

        // ── get_user_profile (requires auth) ─────────────────────
        case "get_user_profile": {
          const userId = tokenPayload?.sub ?? "service-account";
          const profile = getUserProfile(userId);
          return {
            content: [{ type: "text" as const, text: JSON.stringify(profile, null, 2) }],
          };
        }

        // ── list_tasks (requires auth) ───────────────────────────
        case "list_tasks": {
          const schema = z.object({
            status:   z.enum(["todo", "in_progress", "done", "cancelled"]).optional(),
            priority: z.enum(["low", "medium", "high", "critical"]).optional(),
            assignee: z.string().optional(),
          });
          const filters = schema.parse(args ?? {});
          const tasks = listTasks(filters);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ total: tasks.length, tasks }, null, 2),
              },
            ],
          };
        }

        // ── create_task (requires auth + tasks:write) ─────────────
        case "create_task": {
          const schema = z.object({
            title:       z.string().min(1).max(200),
            description: z.string().min(1),
            priority:    z.enum(["low", "medium", "high", "critical"]).optional(),
            assignee:    z.string().email().optional(),
            dueDate:     z.string().optional(),
            tags:        z.array(z.string()).optional(),
          });
          const input = schema.parse(args);
          const createdBy = tokenPayload?.sub ?? "anonymous";
          const task = createTask(
            input.title,
            input.description,
            input.priority ?? "medium",
            input.assignee ?? "unassigned",
            createdBy,
            input.dueDate,
            input.tags ?? []
          );
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ message: "Task created successfully.", task }, null, 2),
              },
            ],
          };
        }

        // ── update_task (requires auth) ───────────────────────────
        case "update_task": {
          const schema = z.object({
            id:       z.string().uuid(),
            status:   z.enum(["todo", "in_progress", "done", "cancelled"]).optional(),
            priority: z.enum(["low", "medium", "high", "critical"]).optional(),
            assignee: z.string().optional(),
            title:    z.string().optional(),
          });
          const { id, ...updates } = schema.parse(args);
          const updated = updateTask(id, updates);

          if (!updated) {
            return {
              content: [{ type: "text" as const, text: `Task with id "${id}" not found.` }],
            };
          }

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ message: "Task updated.", task: updated }, null, 2),
              },
            ],
          };
        }

        default:
          return {
            content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  return server;
}

// ─────────────────────────────────────────────────────────────────────
// MCP SSE Endpoints  (protected by Bearer token)
// ─────────────────────────────────────────────────────────────────────

/** GET /sse — establish SSE connection */
app.get("/sse", requireAuth, async (req: Request, res: Response) => {
  const mcpServer = createMCPServer();
  const transport = new SSEServerTransport("/messages", res);

  // Attach the token payload to the transport for tool-level access
  (transport as SSEServerTransport & { _tokenPayload?: TokenPayload })._tokenPayload = req.tokenPayload;

  const sessionId = transport.sessionId;
  sseTransports.set(sessionId, transport);

  res.on("close", () => {
    sseTransports.delete(sessionId);
    console.log(`[MCP] SSE session closed: ${sessionId}`);
  });

  console.log(`[MCP] New SSE session: ${sessionId} | user: ${req.tokenPayload?.sub}`);
  await mcpServer.connect(transport);
});

/** POST /messages — receive MCP client messages */
app.post("/messages", requireAuth, async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const transport = sseTransports.get(sessionId);

  if (!transport) {
    res.status(404).json({ error: "Session not found. Establish an SSE connection first via GET /sse" });
    return;
  }

  // Pass req.body so the SDK doesn't re-read an already-consumed stream (express.json conflict)
  await transport.handlePostMessage(req, res, req.body);
});

// ─────────────────────────────────────────────────────────────────────
// Utility Endpoints
// ─────────────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    service: "mcp-oauth-server",
    version: "1.0.0",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    endpoints: {
      oauth_discovery: `${HOST}/.well-known/openid-configuration`,
      token: `${HOST}/oauth/token`,
      authorize: `${HOST}/oauth/authorize`,
      mcp_sse: `${HOST}/sse`,
      mcp_messages: `${HOST}/messages`,
    },
  });
});

app.get("/", (_req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>MCP OAuth Server</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
           max-width: 900px; margin: 40px auto; padding: 0 20px; color: #1a1a2e; }
    h1 { color: #0078d4; }
    h2 { color: #106ebe; border-bottom: 1px solid #e0e0e0; padding-bottom: 8px; }
    .badge { background: #0078d4; color: white; padding: 2px 8px; border-radius: 4px;
             font-size: 12px; font-family: monospace; margin-right: 4px; }
    .get    { background: #107c10; }
    .post   { background: #c7380d; }
    table   { border-collapse: collapse; width: 100%; }
    th, td  { text-align: left; padding: 8px 12px; border-bottom: 1px solid #eee; }
    th      { background: #f5f5f5; }
    code    { background: #f0f4f8; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
    .card   { background: #f0f8ff; border-left: 4px solid #0078d4; padding: 12px 16px;
              border-radius: 0 8px 8px 0; margin: 16px 0; }
  </style>
</head>
<body>
  <h1>MCP OAuth Server</h1>
  <p>A Model Context Protocol server with OAuth 2.0 — consumable by Microsoft Copilot Studio.</p>

  <div class="card">
    <strong>Quick Start:</strong> Get a token →
    <code>POST /oauth/token</code> with
    <code>client_id=demo-client&client_secret=demo-secret-change-me&grant_type=client_credentials</code>
    then connect to <code>GET /sse</code> with <code>Authorization: Bearer &lt;token&gt;</code>
  </div>

  <h2>OAuth Endpoints</h2>
  <table>
    <tr><th>Method</th><th>Path</th><th>Description</th></tr>
    <tr><td><span class="badge get">GET</span></td><td><code>/.well-known/openid-configuration</code></td><td>OIDC/OAuth discovery document</td></tr>
    <tr><td><span class="badge post">POST</span></td><td><code>/oauth/token</code></td><td>Get access token (client_credentials or authorization_code)</td></tr>
    <tr><td><span class="badge get">GET</span></td><td><code>/oauth/authorize</code></td><td>Authorization Code flow — login page</td></tr>
    <tr><td><span class="badge get">GET</span></td><td><code>/oauth/userinfo</code></td><td>Get current user info (requires Bearer token)</td></tr>
    <tr><td><span class="badge post">POST</span></td><td><code>/oauth/introspect</code></td><td>Inspect a token</td></tr>
    <tr><td><span class="badge post">POST</span></td><td><code>/oauth/revoke</code></td><td>Revoke a token</td></tr>
  </table>

  <h2>MCP Endpoints (Bearer token required)</h2>
  <table>
    <tr><th>Method</th><th>Path</th><th>Description</th></tr>
    <tr><td><span class="badge get">GET</span></td><td><code>/sse</code></td><td>Open SSE connection for MCP</td></tr>
    <tr><td><span class="badge post">POST</span></td><td><code>/messages?sessionId=&lt;id&gt;</code></td><td>Send MCP messages</td></tr>
  </table>

  <h2>Available MCP Tools</h2>
  <table>
    <tr><th>Tool</th><th>Description</th><th>Auth Required</th></tr>
    <tr><td><code>get_weather</code></td><td>Current weather for major cities</td><td>Token only</td></tr>
    <tr><td><code>calculate</code></td><td>Safe math expression evaluator</td><td>Token only</td></tr>
    <tr><td><code>get_current_datetime</code></td><td>Date/time in any timezone</td><td>Token only</td></tr>
    <tr><td><code>search_knowledge_base</code></td><td>Search company knowledge base</td><td>Token only</td></tr>
    <tr><td><code>get_user_profile</code></td><td>Current user's profile</td><td>Token + user identity</td></tr>
    <tr><td><code>list_tasks</code></td><td>List tasks with filters</td><td>Token required</td></tr>
    <tr><td><code>create_task</code></td><td>Create a new task</td><td>Token required</td></tr>
    <tr><td><code>update_task</code></td><td>Update task status/priority</td><td>Token required</td></tr>
  </table>

  <h2>Pre-registered Test Clients</h2>
  <table>
    <tr><th>Client ID</th><th>Client Secret</th><th>Use Case</th></tr>
    <tr><td><code>copilot-studio-client</code></td><td><code>copilot-studio-secret-change-me</code></td><td>Microsoft Copilot Studio</td></tr>
    <tr><td><code>demo-client</code></td><td><code>demo-secret-change-me</code></td><td>Testing / demos</td></tr>
  </table>
</body>
</html>`);
});

// ─────────────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🚀 MCP OAuth Server running at ${HOST}`);
  console.log(`\n  OAuth discovery:  ${HOST}/.well-known/openid-configuration`);
  console.log(`  Token endpoint:   ${HOST}/oauth/token`);
  console.log(`  MCP SSE:          ${HOST}/sse`);
  console.log(`  API docs:         ${HOST}/`);
  console.log(`\n  Test token:  curl -X POST ${HOST}/oauth/token \\`);
  console.log(`    -d "grant_type=client_credentials&client_id=demo-client&client_secret=demo-secret-change-me"\n`);
});
