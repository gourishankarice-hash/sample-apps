import type { ProxyManager } from "./proxy.js";
import type {
  AggregatedTool,
  AggregatedResource,
  AggregatedPrompt,
} from "../types/index.js";
import type { Prompt } from "@modelcontextprotocol/sdk/types.js";

/**
 * Aggregates capabilities (tools, resources, prompts) from all connected
 * downstream servers.
 *
 * Tool and prompt names are prefixed with the server's configured namespace
 * (e.g. `calc_add`, `weather_get_forecast`) to avoid collisions when multiple
 * servers expose tools with the same name.
 *
 * Resource URIs are kept as-is because they are already globally unique.
 */
export class Aggregator {
  constructor(private readonly proxy: ProxyManager) {}

  // ---------------------------------------------------------------------------
  // Tools
  // ---------------------------------------------------------------------------

  getAggregatedTools(): AggregatedTool[] {
    const result: AggregatedTool[] = [];

    for (const server of this.proxy.getConnectedServers()) {
      const { id, namespace, name: serverName } = server.config;

      for (const tool of server.tools) {
        const prefixedName = `${namespace}_${tool.name}`;

        result.push({
          serverId: id,
          namespace,
          originalName: tool.name,
          prefixedName,
          tool: {
            ...tool,
            name: prefixedName,
            description: tool.description
              ? `[${serverName}] ${tool.description}`
              : `[${serverName}] ${tool.name}`,
          },
        });
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Resources
  // ---------------------------------------------------------------------------

  getAggregatedResources(): AggregatedResource[] {
    const result: AggregatedResource[] = [];

    for (const server of this.proxy.getConnectedServers()) {
      for (const resource of server.resources) {
        result.push({
          serverId: server.config.id,
          namespace: server.config.namespace,
          resource,
        });
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Prompts
  // ---------------------------------------------------------------------------

  getAggregatedPrompts(): AggregatedPrompt[] {
    const result: AggregatedPrompt[] = [];

    for (const server of this.proxy.getConnectedServers()) {
      const { id, namespace, name: serverName } = server.config;

      for (const prompt of server.prompts as Prompt[]) {
        const prefixedName = `${namespace}_${prompt.name}`;

        result.push({
          serverId: id,
          namespace,
          originalName: prompt.name,
          prefixedName,
          prompt: {
            ...prompt,
            name: prefixedName,
            description: prompt.description
              ? `[${serverName}] ${prompt.description}`
              : `[${serverName}] ${prompt.name}`,
          },
        });
      }
    }

    return result;
  }
}
