/**
 * MCP Gateway — entry point
 *
 * Start modes (set via `gateway.transport` in gateway.config.json):
 *   "stdio"  — MCP over stdin / stdout (for Claude Desktop etc.)
 *   "http"   — MCP over HTTP + SSE
 *   "both"   — stdio + HTTP simultaneously
 */

import "dotenv/config";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "../utils/config.js";
import { ProxyManager } from "./proxy.js";
import { GatewayServer } from "./server.js";
import { HttpGatewayServer } from "./httpServer.js";
import logger from "../utils/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  logger.info("=== MCP Gateway starting ===");

  const configPath =
    process.env.GATEWAY_CONFIG_PATH ??
    resolve(__dirname, "../../config/gateway.config.json");
  const config = loadConfig(configPath);
  const { gateway } = config;

  logger.info(`Name:       ${gateway.name} v${gateway.version}`);
  logger.info(`Transport:  ${gateway.transport}`);

  // -------------------------------------------------------------------------
  // 1. Connect to downstream servers
  // -------------------------------------------------------------------------

  const proxy = new ProxyManager();
  const enabledServers = config.servers.filter((s) => s.enabled);

  logger.info(`Downstream servers configured: ${enabledServers.length}`);

  const results = await Promise.allSettled(
    enabledServers.map((s) => proxy.connect(s)),
  );

  let connectedCount = 0;
  results.forEach((result, i) => {
    const s = enabledServers[i]!;
    if (result.status === "fulfilled") {
      connectedCount++;
      logger.info(`  ✓  ${s.id}  (${s.name})`);
    } else {
      logger.warn(`  ✗  ${s.id}  (${s.name}) — ${(result.reason as Error).message}`);
    }
  });

  logger.info(`Connected: ${connectedCount}/${enabledServers.length} servers`);

  // -------------------------------------------------------------------------
  // 2. Create gateway server
  // -------------------------------------------------------------------------

  const gatewayServer = new GatewayServer(gateway, proxy);

  // -------------------------------------------------------------------------
  // 3. Attach transports
  // -------------------------------------------------------------------------

  const mode = gateway.transport;

  if (mode === "stdio" || mode === "both") {
    const transport = new StdioServerTransport();
    await gatewayServer.getMcpServer().connect(transport);
    logger.info("stdio transport ready");
  }

  if ((mode === "http" || mode === "both") && gateway.http.enabled) {
    const httpServer = new HttpGatewayServer(gateway, gatewayServer, config, configPath);
    await httpServer.start();
  }

  // -------------------------------------------------------------------------
  // 4. Log summary
  // -------------------------------------------------------------------------

  const status = gatewayServer.getStatus();
  const allTools = proxy.getConnectedServers().flatMap((s) => s.tools);
  const allResources = proxy.getConnectedServers().flatMap((s) => s.resources);
  const allPrompts = proxy.getConnectedServers().flatMap((s) => s.prompts);

  logger.info("=== MCP Gateway ready ===");
  logger.info(`  Tools:     ${allTools.length}`);
  logger.info(`  Resources: ${allResources.length}`);
  logger.info(`  Prompts:   ${allPrompts.length}`);
  logger.info(`  Servers:   ${status.connectedServers}/${status.totalServers}`);

  // -------------------------------------------------------------------------
  // 5. Graceful shutdown
  // -------------------------------------------------------------------------

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal} — shutting down gracefully…`);
    await proxy.disconnectAll();
    logger.info("Gateway stopped.");
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  process.on("uncaughtException", (err) => {
    logger.error("Uncaught exception", { error: err });
    void shutdown("uncaughtException");
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled rejection", { reason });
  });
}

main().catch((err: unknown) => {
  // Use stderr directly; the logger may not be initialised yet.
  process.stderr.write(`Fatal: ${(err as Error).message}\n${(err as Error).stack ?? ""}\n`);
  process.exit(1);
});
