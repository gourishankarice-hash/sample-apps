import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ErrorCode,
  McpError,
  type CallToolResult,
  type ReadResourceResult,
  type GetPromptResult,
} from "@modelcontextprotocol/sdk/types.js";
import type { ProxyManager } from "./proxy.js";
import { Aggregator } from "./aggregator.js";
import { Router } from "./router.js";
import type { GatewaySettings, GatewayStatus } from "../types/index.js";
import logger from "../utils/logger.js";

/**
 * The MCP server exposed to upstream clients.
 *
 * Aggregates tools, resources and prompts from all downstream servers and
 * routes requests to the correct downstream server via the `Router`.
 */
export class GatewayServer {
  private readonly mcpServer: Server;
  private readonly aggregator: Aggregator;
  private readonly router: Router;
  private readonly startedAt = Date.now();

  constructor(
    private readonly settings: GatewaySettings,
    private readonly proxy: ProxyManager,
  ) {
    this.aggregator = new Aggregator(proxy);
    this.router = new Router(proxy, this.aggregator);

    this.mcpServer = new Server(
      { name: settings.name, version: settings.version },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      },
    );

    this.registerHandlers();
  }

  // ---------------------------------------------------------------------------
  // Request handlers
  // ---------------------------------------------------------------------------

  private registerHandlers(): void {
    // --- Tools ---

    this.mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = this.aggregator.getAggregatedTools().map((t) => t.tool);
      logger.debug(`Listing ${tools.length} aggregated tools`);
      return { tools };
    });

    this.mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args = {} } = request.params;
      logger.info(`Tool call: ${name}`);

      try {
        const result = await this.router.callTool(
          name,
          args as Record<string, unknown>,
        );
        return result as CallToolResult;
      } catch (err) {
        logger.error(`Tool call failed: ${name}`, { error: err });
        throw new McpError(
          ErrorCode.InternalError,
          (err as Error).message,
        );
      }
    });

    // --- Resources ---

    this.mcpServer.setRequestHandler(ListResourcesRequestSchema, async () => {
      const resources = this.aggregator
        .getAggregatedResources()
        .map((r) => r.resource);
      logger.debug(`Listing ${resources.length} aggregated resources`);
      return { resources };
    });

    this.mcpServer.setRequestHandler(
      ReadResourceRequestSchema,
      async (request) => {
        const { uri } = request.params;
        logger.info(`Resource read: ${uri}`);

        try {
          const result = await this.router.readResource(uri);
          return result as ReadResourceResult;
        } catch (err) {
          logger.error(`Resource read failed: ${uri}`, { error: err });
          throw new McpError(
            ErrorCode.InternalError,
            (err as Error).message,
          );
        }
      },
    );

    // --- Prompts ---

    this.mcpServer.setRequestHandler(ListPromptsRequestSchema, async () => {
      const prompts = this.aggregator
        .getAggregatedPrompts()
        .map((p) => p.prompt);
      logger.debug(`Listing ${prompts.length} aggregated prompts`);
      return { prompts };
    });

    this.mcpServer.setRequestHandler(
      GetPromptRequestSchema,
      async (request) => {
        const { name, arguments: args = {} } = request.params;
        logger.info(`Prompt get: ${name}`);

        try {
          const result = await this.router.getPrompt(
            name,
            args as Record<string, string>,
          );
          return result as GetPromptResult;
        } catch (err) {
          logger.error(`Prompt get failed: ${name}`, { error: err });
          throw new McpError(
            ErrorCode.InternalError,
            (err as Error).message,
          );
        }
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Public accessors
  // ---------------------------------------------------------------------------

  getMcpServer(): Server {
    return this.mcpServer;
  }

  getAggregator(): Aggregator {
    return this.aggregator;
  }

  getProxy(): ProxyManager {
    return this.proxy;
  }

  getStatus(): GatewayStatus {
    const servers = this.proxy.getAllServers();
    return {
      name: this.settings.name,
      version: this.settings.version,
      uptime: Math.floor((Date.now() - this.startedAt) / 1000),
      connectedServers: servers.filter((s) => s.status === "connected").length,
      totalServers: servers.length,
      totalTools: servers.reduce((acc, s) => acc + s.tools.length, 0),
      totalResources: servers.reduce((acc, s) => acc + s.resources.length, 0),
      totalPrompts: servers.reduce((acc, s) => acc + s.prompts.length, 0),
      servers: servers.map((s) => ({
        id: s.config.id,
        name: s.config.name,
        status: s.status,
        tools: s.tools.length,
        resources: s.resources.length,
        prompts: s.prompts.length,
        connectedAt: s.connectedAt,
        lastError: s.lastError,
      })),
    };
  }
}
