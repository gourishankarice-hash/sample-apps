import type { ProxyManager } from "./proxy.js";
import type { Aggregator } from "./aggregator.js";
import logger from "../utils/logger.js";

/**
 * Routes MCP requests (tool calls, resource reads, prompt fetches) to the
 * correct downstream server based on the namespace prefix embedded in the
 * capability name.
 */
export class Router {
  constructor(
    private readonly proxy: ProxyManager,
    private readonly aggregator: Aggregator,
  ) {}

  // ---------------------------------------------------------------------------
  // Tool routing
  // ---------------------------------------------------------------------------

  /**
   * Call a tool on the appropriate downstream server.
   *
   * @param prefixedName  The namespaced tool name visible to upstream clients
   *                      (e.g. `calc_add`).
   * @param args          Tool arguments.
   */
  async callTool(
    prefixedName: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const resolved = this.resolveToolServer(prefixedName);
    const server = this.getConnectedServer(resolved.serverId, prefixedName);

    logger.debug(`Routing tool call`, {
      prefixedName,
      serverId: resolved.serverId,
      originalName: resolved.originalName,
    });

    return server.client.callTool({
      name: resolved.originalName,
      arguments: args,
    });
  }

  // ---------------------------------------------------------------------------
  // Resource routing
  // ---------------------------------------------------------------------------

  /**
   * Read a resource from the server that owns it.
   */
  async readResource(uri: string): Promise<unknown> {
    const resources = this.aggregator.getAggregatedResources();
    const found = resources.find((r) => r.resource.uri === uri);

    if (!found) {
      throw new Error(`Resource not found: ${uri}`);
    }

    const server = this.getConnectedServer(found.serverId, uri);

    logger.debug(`Routing resource read`, { uri, serverId: found.serverId });

    return server.client.readResource({ uri });
  }

  // ---------------------------------------------------------------------------
  // Prompt routing
  // ---------------------------------------------------------------------------

  /**
   * Fetch a prompt from the appropriate downstream server.
   *
   * @param prefixedName  Namespaced prompt name (e.g. `calc_math_problem`).
   * @param args          Prompt arguments.
   */
  async getPrompt(
    prefixedName: string,
    args: Record<string, string>,
  ): Promise<unknown> {
    const resolved = this.resolvePromptServer(prefixedName);
    const server = this.getConnectedServer(resolved.serverId, prefixedName);

    logger.debug(`Routing prompt request`, {
      prefixedName,
      serverId: resolved.serverId,
      originalName: resolved.originalName,
    });

    return server.client.getPrompt({
      name: resolved.originalName,
      arguments: args,
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private resolveToolServer(
    prefixedName: string,
  ): { serverId: string; originalName: string } {
    const tools = this.aggregator.getAggregatedTools();

    const match =
      tools.find((t) => t.prefixedName === prefixedName) ??
      tools.find((t) => t.originalName === prefixedName); // fallback: no prefix

    if (!match) {
      throw new Error(`Unknown tool: ${prefixedName}`);
    }

    return { serverId: match.serverId, originalName: match.originalName };
  }

  private resolvePromptServer(
    prefixedName: string,
  ): { serverId: string; originalName: string } {
    const prompts = this.aggregator.getAggregatedPrompts();

    const match =
      prompts.find((p) => p.prefixedName === prefixedName) ??
      prompts.find((p) => p.originalName === prefixedName);

    if (!match) {
      throw new Error(`Unknown prompt: ${prefixedName}`);
    }

    return { serverId: match.serverId, originalName: match.originalName };
  }

  private getConnectedServer(serverId: string, capability: string) {
    const server = this.proxy.getServer(serverId);

    if (!server || server.status !== "connected") {
      throw new Error(
        `Server "${serverId}" is unavailable (requested capability: ${capability})`,
      );
    }

    return server;
  }
}
