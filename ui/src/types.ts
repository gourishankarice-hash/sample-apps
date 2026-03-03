export type ServerStatus = "connecting" | "connected" | "disconnected" | "error";

export interface GatewayStatus {
  name: string;
  version: string;
  uptime: number;
  connectedServers: number;
  totalServers: number;
  totalTools: number;
  totalResources: number;
  totalPrompts: number;
  servers: ServerHealth[];
}

export interface ServerHealth {
  id: string;
  name: string;
  status: ServerStatus;
  tools: number;
  resources: number;
  prompts: number;
  connectedAt?: string;
  lastError?: string;
}

export interface ServerInfo {
  id: string;
  name: string;
  description: string;
  namespace: string;
  enabled: boolean;
  transportType: "stdio" | "sse";
  status: ServerStatus;
  tools: number;
  resources: number;
  prompts: number;
  connectedAt: string | null;
  lastError: string | null;
}

export interface SchemaProperty {
  type: string;
  description?: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  default?: unknown;
}

export interface InputSchema {
  type: string;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
}

export interface ToolInfo {
  name: string;
  originalName: string;
  serverId: string;
  serverName: string;
  namespace: string;
  description: string;
  inputSchema: InputSchema;
}

export interface ResourceInfo {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  serverId: string;
  serverName: string;
  namespace: string;
}

export interface PromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

export interface PromptInfo {
  name: string;
  originalName: string;
  serverId: string;
  serverName: string;
  namespace: string;
  description: string;
  arguments: PromptArgument[];
}

export interface CallToolResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

export interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  service?: string;
  metadata?: Record<string, unknown>;
}

export interface StdioTransportConfig {
  type: "stdio";
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface SSETransportConfig {
  type: "sse";
  url: string;
  headers?: Record<string, string>;
}

export interface ServerConfig {
  id: string;
  name: string;
  description: string;
  namespace: string;
  enabled: boolean;
  transport: StdioTransportConfig | SSETransportConfig;
  healthCheck: { enabled: boolean; intervalMs: number };
  retry: { maxAttempts: number; delayMs: number; backoffMultiplier: number };
}
