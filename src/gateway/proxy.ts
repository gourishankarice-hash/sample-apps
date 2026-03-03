import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { Tool, Resource, Prompt } from "@modelcontextprotocol/sdk/types.js";
import type {
  ServerConfig,
  ServerStatus,
  StdioTransportConfig,
  SSETransportConfig,
} from "../types/index.js";
import logger from "../utils/logger.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProxyServer {
  config: ServerConfig;
  client: Client;
  status: ServerStatus;
  tools: Tool[];
  resources: Resource[];
  prompts: Prompt[];
  connectedAt?: Date;
  lastError?: string;
}

// ---------------------------------------------------------------------------
// ProxyManager
// ---------------------------------------------------------------------------

/**
 * Manages MCP client connections to downstream servers.
 *
 * Each downstream server is represented by a `ProxyServer` entry that holds
 * an MCP `Client` instance and a cached copy of the server's capabilities
 * (tools, resources, prompts).
 */
export class ProxyManager {
  private readonly servers = new Map<string, ProxyServer>();
  private readonly healthCheckTimers = new Map<string, NodeJS.Timeout>();

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /** Connect to a downstream MCP server and cache its capabilities. */
  async connect(config: ServerConfig): Promise<void> {
    const { id } = config;
    logger.info(`Connecting to downstream server: ${id}`);

    const client = this.createClient(id);
    const server: ProxyServer = {
      config,
      client,
      status: "connecting",
      tools: [],
      resources: [],
      prompts: [],
    };

    this.servers.set(id, server);

    try {
      await this.establishConnection(server);
      logger.info(`Connected to downstream server: ${id}`);
    } catch (err) {
      server.status = "error";
      server.lastError = (err as Error).message;
      logger.error(`Failed to connect to server: ${id}`, { error: err });
      throw err;
    }
  }

  /** Gracefully disconnect from a downstream server. */
  async disconnect(id: string): Promise<void> {
    const server = this.servers.get(id);
    if (!server) return;

    this.clearHealthCheck(id);

    try {
      await server.client.close();
    } catch (err) {
      logger.warn(`Error while closing client for server: ${id}`, { error: err });
    }

    server.status = "disconnected";
    this.servers.delete(id);
    logger.info(`Disconnected from server: ${id}`);
  }

  /** Disconnect from all downstream servers. */
  async disconnectAll(): Promise<void> {
    const ids = Array.from(this.servers.keys());
    await Promise.allSettled(ids.map((id) => this.disconnect(id)));
  }

  getServer(id: string): ProxyServer | undefined {
    return this.servers.get(id);
  }

  getAllServers(): ProxyServer[] {
    return Array.from(this.servers.values());
  }

  getConnectedServers(): ProxyServer[] {
    return this.getAllServers().filter((s) => s.status === "connected");
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private createClient(serverId: string): Client {
    return new Client(
      { name: `mcp-gateway-proxy-${serverId}`, version: "1.0.0" },
      // Client capabilities describe what *this* client supports offering back
      // to servers (e.g. sampling). The gateway doesn't expose any such features.
      { capabilities: {} },
    );
  }

  private async establishConnection(server: ProxyServer): Promise<void> {
    const { config } = server;
    const tc = config.transport;

    let transport;
    if (tc.type === "stdio") {
      const cfg = tc as StdioTransportConfig;
      transport = new StdioClientTransport({
        command: cfg.command,
        args: cfg.args,
        env: cfg.env,
      });
    } else if (tc.type === "sse") {
      const cfg = tc as SSETransportConfig;
      transport = new SSEClientTransport(new URL(cfg.url));
    } else {
      throw new Error(`Unsupported transport type: ${(tc as { type: string }).type}`);
    }

    await server.client.connect(transport);
    server.status = "connected";
    server.connectedAt = new Date();

    await this.refreshCapabilities(server);

    if (config.healthCheck.enabled) {
      this.scheduleHealthCheck(server);
    }
  }

  private async refreshCapabilities(server: ProxyServer): Promise<void> {
    const { id } = server.config;

    const [toolsResult, resourcesResult, promptsResult] = await Promise.allSettled([
      server.client.listTools(),
      server.client.listResources(),
      server.client.listPrompts(),
    ]);

    if (toolsResult.status === "fulfilled") {
      server.tools = toolsResult.value.tools;
      logger.debug(`Loaded ${server.tools.length} tools from ${id}`);
    }

    if (resourcesResult.status === "fulfilled") {
      server.resources = resourcesResult.value.resources;
      logger.debug(`Loaded ${server.resources.length} resources from ${id}`);
    }

    if (promptsResult.status === "fulfilled") {
      server.prompts = promptsResult.value.prompts as Prompt[];
      logger.debug(`Loaded ${server.prompts.length} prompts from ${id}`);
    }
  }

  // -------------------------------------------------------------------------
  // Health checking & reconnection
  // -------------------------------------------------------------------------

  private scheduleHealthCheck(server: ProxyServer): void {
    const { id, healthCheck } = server.config;

    const timer = setInterval(async () => {
      try {
        await server.client.listTools();
        if (server.status !== "connected") {
          server.status = "connected";
          delete server.lastError;
          logger.info(`Server back online: ${id}`);
        }
      } catch (err) {
        server.status = "error";
        server.lastError = (err as Error).message;
        logger.warn(`Health-check failed for server: ${id}`, { error: err });
        this.clearHealthCheck(id);
        void this.reconnect(server);
      }
    }, healthCheck.intervalMs);

    timer.unref(); // Don't prevent the process from exiting cleanly.
    this.healthCheckTimers.set(id, timer);
  }

  private clearHealthCheck(id: string): void {
    const timer = this.healthCheckTimers.get(id);
    if (timer) {
      clearInterval(timer);
      this.healthCheckTimers.delete(id);
    }
  }

  private async reconnect(server: ProxyServer): Promise<void> {
    const { id, retry } = server.config;

    for (let attempt = 1; attempt <= retry.maxAttempts; attempt++) {
      const delay = retry.delayMs * Math.pow(retry.backoffMultiplier, attempt - 1);
      logger.info(
        `Reconnect attempt ${attempt}/${retry.maxAttempts} for server ${id} in ${delay}ms`,
      );
      await sleep(delay);

      try {
        // Replace the old (broken) client with a fresh one.
        server.client = this.createClient(id);
        await this.establishConnection(server);
        logger.info(`Reconnected to server: ${id}`);
        return;
      } catch (err) {
        logger.warn(`Reconnect attempt ${attempt} failed for server: ${id}`, {
          error: err,
        });
      }
    }

    logger.error(
      `All reconnect attempts exhausted for server: ${id}. Marking as error.`,
    );
    server.status = "error";
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
