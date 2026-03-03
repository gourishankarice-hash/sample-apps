import type {
  GatewayStatus,
  ServerInfo,
  ServerConfig,
  ToolInfo,
  ResourceInfo,
  PromptInfo,
  CallToolResult,
} from "../types.js";

const BASE = "/api";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const api = {
  getStatus: () => get<GatewayStatus>("/status"),
  getServers: () => get<ServerInfo[]>("/servers"),
  reconnectServer: (id: string) => post<{ success: boolean }>(`/servers/${id}/reconnect`),
  addServer: (serverConfig: ServerConfig) => post<ServerConfig>("/servers", serverConfig),
  deleteServer: (id: string) => del<{ success: boolean; id: string }>(`/servers/${id}`),
  getTools: () => get<ToolInfo[]>("/tools"),
  invokeTool: (name: string, args: Record<string, unknown>) =>
    post<CallToolResult>("/tools/invoke", { name, arguments: args }),
  getResources: () => get<ResourceInfo[]>("/resources"),
  getPrompts: () => get<PromptInfo[]>("/prompts"),
};
