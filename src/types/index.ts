/**
 * Core type definitions for the MCP Gateway.
 */

export type ServerStatus = "connecting" | "connected" | "disconnected" | "error";

export type TransportType = "stdio" | "http" | "both";

// ---------------------------------------------------------------------------
// Config types
// ---------------------------------------------------------------------------

export interface GatewayConfig {
  gateway: GatewaySettings;
  servers: ServerConfig[];
}

export interface GatewaySettings {
  name: string;
  version: string;
  description: string;
  /** Transport mode the gateway exposes to upstream clients. */
  transport: TransportType;
  http: HttpSettings;
  auth: AuthSettings;
  rateLimit: RateLimitSettings;
  logging: LoggingSettings;
}

export interface HttpSettings {
  enabled: boolean;
  port: number;
  host: string;
  path: {
    sse: string;
    messages: string;
    health: string;
  };
}

export interface AuthSettings {
  enabled: boolean;
  apiKeys: string[];
}

export interface RateLimitSettings {
  enabled: boolean;
  /** Time window in milliseconds. */
  windowMs: number;
  /** Maximum requests per window. */
  maxRequests: number;
}

export interface LoggingSettings {
  level: "error" | "warn" | "info" | "debug";
  format: "json" | "simple";
}

// ---------------------------------------------------------------------------
// Downstream server config
// ---------------------------------------------------------------------------

export interface ServerConfig {
  id: string;
  name: string;
  description: string;
  /** Prefix namespace prepended to all tool/prompt names from this server. */
  namespace: string;
  enabled: boolean;
  transport: StdioTransportConfig | SSETransportConfig;
  healthCheck: HealthCheckConfig;
  retry: RetryConfig;
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

export interface HealthCheckConfig {
  enabled: boolean;
  intervalMs: number;
}

export interface RetryConfig {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier: number;
}

// ---------------------------------------------------------------------------
// Aggregated capability types (with routing metadata attached)
// ---------------------------------------------------------------------------

import type { Tool, Resource, Prompt } from "@modelcontextprotocol/sdk/types.js";

export interface AggregatedTool {
  serverId: string;
  namespace: string;
  originalName: string;
  /** Name exposed to upstream clients: `{namespace}_{originalName}`. */
  prefixedName: string;
  tool: Tool;
}

export interface AggregatedResource {
  serverId: string;
  namespace: string;
  resource: Resource;
}

export interface AggregatedPrompt {
  serverId: string;
  namespace: string;
  originalName: string;
  prefixedName: string;
  prompt: Prompt;
}

// ---------------------------------------------------------------------------
// Gateway status / health
// ---------------------------------------------------------------------------

export interface ServerHealth {
  id: string;
  name: string;
  status: ServerStatus;
  tools: number;
  resources: number;
  prompts: number;
  connectedAt?: Date;
  lastError?: string;
}

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
