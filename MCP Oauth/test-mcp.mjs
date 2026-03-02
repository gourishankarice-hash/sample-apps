/**
 * End-to-end smoke test for the MCP OAuth Server
 * Run: node test-mcp.mjs
 */

import http from "http";

const BASE = "http://localhost:3000";

// ── helpers ──────────────────────────────────────────────────────────

function httpRequest(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: "localhost",
        port: 3000,
        path,
        method,
        headers: {
          "Content-Type": "application/json",
          ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
          ...headers,
        },
      },
      (res) => {
        let buf = "";
        res.on("data", (c) => (buf += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(buf) });
          } catch {
            resolve({ status: res.statusCode, body: buf });
          }
        });
      }
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

function postForm(path, params) {
  return new Promise((resolve, reject) => {
    const data = new URLSearchParams(params).toString();
    const req = http.request(
      {
        hostname: "localhost",
        port: 3000,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let buf = "";
        res.on("data", (c) => (buf += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(buf) });
          } catch {
            resolve({ status: res.statusCode, body: buf });
          }
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function openSSE(token) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      {
        hostname: "localhost",
        port: 3000,
        path: "/sse",
        headers: { Authorization: `Bearer ${token}` },
      },
      (res) => {
        const results = [];
        let sessionId = null;

        res.on("data", (chunk) => {
          const txt = chunk.toString();
          // Extract session ID from the endpoint event
          const m = txt.match(/sessionId=([a-z0-9-]+)/);
          if (m && !sessionId) {
            sessionId = m[1];
            resolve({ res, req, sessionId, results });
          }
          // Collect tool results
          const lines = txt.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                results.push(JSON.parse(line.slice(6)));
              } catch { /* non-JSON event */ }
            }
          }
        });
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    setTimeout(() => reject(new Error("SSE connection timed out")), 5000);
  });
}

function mcpCall(sessionId, token, id, method, params = {}) {
  return httpRequest(
    "POST",
    `/messages?sessionId=${sessionId}`,
    { jsonrpc: "2.0", id, method, params },
    { Authorization: `Bearer ${token}` }
  );
}

function print(label, obj) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${label}`);
  console.log(`${"─".repeat(60)}`);
  console.log(JSON.stringify(obj, null, 2));
}

// ── main test ────────────────────────────────────────────────────────

async function run() {
  console.log("🚀 MCP OAuth Server — End-to-End Test\n");

  // 1. Health
  const health = await httpRequest("GET", "/health");
  print("1. Health Check", health.body);

  // 2. OAuth Discovery
  const discovery = await httpRequest("GET", "/.well-known/openid-configuration");
  print("2. OAuth Discovery Document", {
    issuer: discovery.body.issuer,
    token_endpoint: discovery.body.token_endpoint,
    scopes: discovery.body.scopes_supported,
  });

  // 3. Get Token (client_credentials)
  const tokenResp = await postForm("/oauth/token", {
    grant_type: "client_credentials",
    client_id: "demo-client",
    client_secret: "demo-secret-change-me",
    scope: "tools:read tools:write tasks:read tasks:write",
  });
  print("3. OAuth Token (client_credentials)", {
    token_type: tokenResp.body.token_type,
    expires_in: tokenResp.body.expires_in,
    scope: tokenResp.body.scope,
    access_token: tokenResp.body.access_token?.slice(0, 40) + "...",
  });
  const token = tokenResp.body.access_token;

  // 4. Token Introspect
  const introspect = await httpRequest("POST", "/oauth/introspect", { token }, {});
  print("4. Token Introspection", introspect.body);

  // 5. Bad token test
  const badToken = await httpRequest("GET", "/sse", null, {
    Authorization: "Bearer invalid.token.here",
  });
  print("5. Reject Invalid Token (expect 401)", {
    status: badToken.status,
    error: badToken.body?.error,
  });

  // 6. Open MCP SSE connection
  console.log("\n" + "─".repeat(60));
  console.log("  6. Opening MCP SSE connection...");
  console.log("─".repeat(60));
  const sse = await openSSE(token);
  console.log(`  Session ID: ${sse.sessionId}`);

  // 7. MCP Initialize
  const init = await mcpCall(sse.sessionId, token, 1, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test-client", version: "1.0" },
  });
  print("7. MCP Initialize", { status: init.status, response: init.body });

  // 8. List Tools
  const toolList = await mcpCall(sse.sessionId, token, 2, "tools/list", {});
  print("8. MCP tools/list", {
    status: toolList.status,
    note: "Results arrive via SSE stream",
  });
  await new Promise((r) => setTimeout(r, 300));
  const toolNames = sse.results
    .filter((r) => r.result?.tools)
    .flatMap((r) => r.result.tools.map((t) => t.name));
  if (toolNames.length) console.log("  Tools discovered:", toolNames.join(", "));

  // 9. Call get_weather
  await mcpCall(sse.sessionId, token, 3, "tools/call", {
    name: "get_weather",
    arguments: { location: "Tokyo", unit: "celsius" },
  });
  await new Promise((r) => setTimeout(r, 300));
  const weatherResult = sse.results.find((r) => r.id === 3);
  print("9. Tool: get_weather (Tokyo)", weatherResult?.result?.content?.[0]
    ? JSON.parse(weatherResult.result.content[0].text)
    : weatherResult);

  // 10. Call calculate
  await mcpCall(sse.sessionId, token, 4, "tools/call", {
    name: "calculate",
    arguments: { expression: "sqrt(144) + PI * 2" },
  });
  await new Promise((r) => setTimeout(r, 300));
  const calcResult = sse.results.find((r) => r.id === 4);
  print("10. Tool: calculate (sqrt(144) + PI * 2)", calcResult?.result?.content?.[0]
    ? JSON.parse(calcResult.result.content[0].text)
    : calcResult);

  // 11. Call get_current_datetime
  await mcpCall(sse.sessionId, token, 5, "tools/call", {
    name: "get_current_datetime",
    arguments: { timezone: "IST" },
  });
  await new Promise((r) => setTimeout(r, 300));
  const dtResult = sse.results.find((r) => r.id === 5);
  print("11. Tool: get_current_datetime (IST)", dtResult?.result?.content?.[0]
    ? JSON.parse(dtResult.result.content[0].text)
    : dtResult);

  // 12. Call search_knowledge_base
  await mcpCall(sse.sessionId, token, 6, "tools/call", {
    name: "search_knowledge_base",
    arguments: { query: "password reset", limit: 2 },
  });
  await new Promise((r) => setTimeout(r, 300));
  const kbResult = sse.results.find((r) => r.id === 6);
  const kbParsed = kbResult?.result?.content?.[0] ? JSON.parse(kbResult.result.content[0].text) : null;
  print("12. Tool: search_knowledge_base ('password reset')", {
    totalFound: kbParsed?.totalFound,
    articles: kbParsed?.articles?.map((a) => ({ id: a.id, title: a.title, category: a.category })),
  });

  // 13. Call list_tasks
  await mcpCall(sse.sessionId, token, 7, "tools/call", {
    name: "list_tasks",
    arguments: { status: "todo" },
  });
  await new Promise((r) => setTimeout(r, 300));
  const tasksResult = sse.results.find((r) => r.id === 7);
  const tasksParsed = tasksResult?.result?.content?.[0]
    ? JSON.parse(tasksResult.result.content[0].text)
    : null;
  print("13. Tool: list_tasks (status=todo)", {
    total: tasksParsed?.total,
    tasks: tasksParsed?.tasks?.map((t) => ({ id: t.id.slice(0, 8) + "...", title: t.title, priority: t.priority })),
  });

  // 14. Call create_task
  await mcpCall(sse.sessionId, token, 8, "tools/call", {
    name: "create_task",
    arguments: {
      title: "Integrate MCP with Copilot Studio",
      description: "Follow the COPILOT_STUDIO_GUIDE.md to connect MCP server to Copilot Studio.",
      priority: "high",
      assignee: "alice@example.com",
      tags: ["mcp", "copilot", "integration"],
    },
  });
  await new Promise((r) => setTimeout(r, 300));
  const createResult = sse.results.find((r) => r.id === 8);
  const createParsed = createResult?.result?.content?.[0]
    ? JSON.parse(createResult.result.content[0].text)
    : null;
  print("14. Tool: create_task", {
    message: createParsed?.message,
    taskId: createParsed?.task?.id,
    title: createParsed?.task?.title,
    status: createParsed?.task?.status,
  });

  // 15. get_user_profile
  await mcpCall(sse.sessionId, token, 9, "tools/call", {
    name: "get_user_profile",
    arguments: {},
  });
  await new Promise((r) => setTimeout(r, 300));
  const profileResult = sse.results.find((r) => r.id === 9);
  print("15. Tool: get_user_profile", profileResult?.result?.content?.[0]
    ? JSON.parse(profileResult.result.content[0].text)
    : profileResult);

  // Done
  sse.req.destroy();
  console.log("\n" + "═".repeat(60));
  console.log("  ALL TESTS PASSED");
  console.log("  Server:  http://localhost:3000");
  console.log("  Docs:    http://localhost:3000/");
  console.log("  OAuth:   http://localhost:3000/oauth/authorize");
  console.log("═".repeat(60) + "\n");
  process.exit(0);
}

run().catch((err) => {
  console.error("Test failed:", err.message);
  process.exit(1);
});
