import { Router } from "express";
import type { Request, Response } from "express";
import type { ProxyManager } from "./proxy.js";
import type { Aggregator } from "./aggregator.js";
import type { GatewayServer } from "./server.js";
import type { GatewayConfig, ServerConfig, StdioTransportConfig, SSETransportConfig } from "../types/index.js";
import { logBuffer, logEmitter, type LogEntry } from "../utils/logEmitter.js";
import logger from "../utils/logger.js";
import { saveConfig } from "../utils/config.js";

/**
 * Creates the Express router that powers the Admin UI REST + SSE API.
 *
 * All endpoints are mounted under `/api` by HttpGatewayServer.
 */
export function createApiRouter(
  proxy: ProxyManager,
  aggregator: Aggregator,
  gateway: GatewayServer,
  config: GatewayConfig,
  configPath?: string,
): Router {
  const router = Router();

  // Helper: only real server entries (filter out _comment placeholders)
  const realServers = (): ServerConfig[] =>
    config.servers.filter(
      (s): s is ServerConfig => "id" in s && typeof (s as ServerConfig).id === "string",
    );

  // ---------------------------------------------------------------------------
  // GET /api/status
  // ---------------------------------------------------------------------------
  router.get("/status", (_req: Request, res: Response) => {
    res.json(gateway.getStatus());
  });

  // ---------------------------------------------------------------------------
  // GET /api/servers  — config + runtime state for every server
  // ---------------------------------------------------------------------------
  router.get("/servers", (_req: Request, res: Response) => {
    const runtime = proxy.getAllServers();
    const result = realServers().map((cs) => {
      const rs = runtime.find((r) => r.config.id === cs.id);
      return {
        id: cs.id,
        name: cs.name,
        description: cs.description,
        namespace: cs.namespace,
        enabled: cs.enabled,
        transportType: cs.transport.type,
        status: rs?.status ?? "disconnected",
        tools: rs?.tools.length ?? 0,
        resources: rs?.resources.length ?? 0,
        prompts: rs?.prompts.length ?? 0,
        connectedAt: rs?.connectedAt?.toISOString() ?? null,
        lastError: rs?.lastError ?? null,
      };
    });
    res.json(result);
  });

  // ---------------------------------------------------------------------------
  // POST /api/servers/:id/reconnect
  // ---------------------------------------------------------------------------
  router.post("/servers/:id/reconnect", async (req: Request, res: Response) => {
    const id = String(req.params["id"]);
    const cfg = realServers().find((s) => s.id === id);
    if (!cfg) {
      res.status(404).json({ error: `Server not found: ${id}` });
      return;
    }
    try {
      await proxy.disconnect(id);
      await proxy.connect(cfg);
      res.json({ success: true, message: `Reconnected to ${id}` });
    } catch (err) {
      logger.error(`Reconnect failed for server: ${id}`, { error: err });
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // ---------------------------------------------------------------------------
  // POST /api/servers  — add a new server, connect it, persist config
  // ---------------------------------------------------------------------------
  router.post("/servers", async (req: Request, res: Response) => {
    const body = req.body as Partial<ServerConfig>;

    // Required string fields
    for (const field of ["id", "name", "namespace"] as const) {
      if (!body[field] || typeof body[field] !== "string" || !(body[field] as string).trim()) {
        res.status(400).json({ error: `Field "${field}" is required` });
        return;
      }
    }

    // ID format check
    if (!/^[a-z0-9_-]+$/i.test(body.id!)) {
      res.status(400).json({ error: "id must contain only letters, numbers, hyphens, or underscores" });
      return;
    }

    // Uniqueness checks
    const existing = realServers();
    if (existing.some((s) => s.id === body.id!.trim())) {
      res.status(409).json({ error: `Server with id "${body.id}" already exists` });
      return;
    }
    if (existing.some((s) => s.namespace === body.namespace!.trim())) {
      res.status(409).json({ error: `Namespace "${body.namespace}" is already used by another server` });
      return;
    }

    // Transport validation
    if (!body.transport || !["stdio", "sse"].includes(body.transport.type)) {
      res.status(400).json({ error: 'transport.type must be "stdio" or "sse"' });
      return;
    }
    if (body.transport.type === "stdio") {
      const t = body.transport as Partial<StdioTransportConfig>;
      if (!t.command?.trim()) {
        res.status(400).json({ error: "transport.command is required for stdio transport" });
        return;
      }
      if (!Array.isArray(t.args)) {
        res.status(400).json({ error: "transport.args must be an array for stdio transport" });
        return;
      }
    }
    if (body.transport.type === "sse") {
      const t = body.transport as Partial<SSETransportConfig>;
      if (!t.url?.trim()) {
        res.status(400).json({ error: "transport.url is required for sse transport" });
        return;
      }
      try { new URL(t.url); } catch {
        res.status(400).json({ error: "transport.url must be a valid URL" });
        return;
      }
    }

    // Build canonical ServerConfig with defaults
    const newServer: ServerConfig = {
      id: body.id!.trim(),
      name: (body.name ?? body.id!).trim(),
      description: (body.description ?? "").trim(),
      namespace: body.namespace!.trim(),
      enabled: body.enabled ?? true,
      transport: body.transport as ServerConfig["transport"],
      healthCheck: {
        enabled: body.healthCheck?.enabled ?? true,
        intervalMs: body.healthCheck?.intervalMs ?? 30000,
      },
      retry: {
        maxAttempts: body.retry?.maxAttempts ?? 3,
        delayMs: body.retry?.delayMs ?? 1000,
        backoffMultiplier: body.retry?.backoffMultiplier ?? 2,
      },
    };

    // Mutate in-memory config and persist
    config.servers.push(newServer);
    try {
      saveConfig(config, configPath);
    } catch (err) {
      config.servers.pop();
      logger.error("Failed to persist config after adding server", { error: err });
      res.status(500).json({ error: "Failed to persist configuration" });
      return;
    }

    // Connect to the new server (non-fatal if it fails)
    if (newServer.enabled) {
      try {
        await proxy.connect(newServer);
        logger.info(`Connected new server: ${newServer.id}`);
      } catch (err) {
        logger.warn(`New server saved but connection failed: ${newServer.id}`, { error: err });
      }
    }

    res.status(201).json(newServer);
  });

  // ---------------------------------------------------------------------------
  // DELETE /api/servers/:id  — disconnect, remove from config, persist
  // ---------------------------------------------------------------------------
  router.delete("/servers/:id", async (req: Request, res: Response) => {
    const id = String(req.params["id"]);

    const serverIndex = config.servers.findIndex(
      (s): s is ServerConfig => "id" in s && (s as ServerConfig).id === id,
    );

    if (serverIndex === -1) {
      res.status(404).json({ error: `Server not found: ${id}` });
      return;
    }

    const removed = config.servers[serverIndex] as ServerConfig;

    // Disconnect (non-fatal if already disconnected)
    try {
      await proxy.disconnect(id);
    } catch (err) {
      logger.warn(`Could not disconnect server before removal: ${id}`, { error: err });
    }

    // Mutate in-memory config and persist
    config.servers.splice(serverIndex, 1);
    try {
      saveConfig(config, configPath);
    } catch (err) {
      // Rollback
      config.servers.splice(serverIndex, 0, removed);
      if (removed.enabled) {
        void proxy.connect(removed).catch(() => { /* best-effort */ });
      }
      logger.error("Failed to persist config after deleting server", { error: err });
      res.status(500).json({ error: "Failed to persist configuration" });
      return;
    }

    logger.info(`Deleted server: ${id}`);
    res.json({ success: true, id });
  });

  // ---------------------------------------------------------------------------
  // GET /api/tools
  // ---------------------------------------------------------------------------
  router.get("/tools", (_req: Request, res: Response) => {
    const tools = aggregator.getAggregatedTools().map((t) => {
      const srv = proxy.getServer(t.serverId);
      return {
        name: t.prefixedName,
        originalName: t.originalName,
        serverId: t.serverId,
        serverName: srv?.config.name ?? t.serverId,
        namespace: t.namespace,
        description: t.tool.description ?? "",
        inputSchema: t.tool.inputSchema,
      };
    });
    res.json(tools);
  });

  // ---------------------------------------------------------------------------
  // POST /api/tools/invoke  — test a tool from the UI
  // ---------------------------------------------------------------------------
  router.post("/tools/invoke", async (req: Request, res: Response) => {
    const { name, arguments: args = {} } = req.body as {
      name: string;
      arguments?: Record<string, unknown>;
    };

    const found = aggregator.getAggregatedTools().find((t) => t.prefixedName === name);
    if (!found) {
      res.status(404).json({ error: `Tool not found: ${name}` });
      return;
    }

    const srv = proxy.getServer(found.serverId);
    if (!srv || srv.status !== "connected") {
      res.status(503).json({ error: `Server "${found.serverId}" is unavailable` });
      return;
    }

    try {
      const result = await srv.client.callTool({ name: found.originalName, arguments: args });
      res.json(result);
    } catch (err) {
      logger.error(`Tool invocation failed: ${name}`, { error: err });
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // ---------------------------------------------------------------------------
  // GET /api/resources
  // ---------------------------------------------------------------------------
  router.get("/resources", (_req: Request, res: Response) => {
    const resources = aggregator.getAggregatedResources().map((r) => {
      const srv = proxy.getServer(r.serverId);
      return {
        uri: r.resource.uri,
        name: r.resource.name,
        description: r.resource.description ?? "",
        mimeType: r.resource.mimeType ?? "",
        serverId: r.serverId,
        serverName: srv?.config.name ?? r.serverId,
        namespace: r.namespace,
      };
    });
    res.json(resources);
  });

  // ---------------------------------------------------------------------------
  // GET /api/prompts
  // ---------------------------------------------------------------------------
  router.get("/prompts", (_req: Request, res: Response) => {
    const prompts = aggregator.getAggregatedPrompts().map((p) => {
      const srv = proxy.getServer(p.serverId);
      return {
        name: p.prefixedName,
        originalName: p.originalName,
        serverId: p.serverId,
        serverName: srv?.config.name ?? p.serverId,
        namespace: p.namespace,
        description: p.prompt.description ?? "",
        arguments: p.prompt.arguments ?? [],
      };
    });
    res.json(prompts);
  });

  // ---------------------------------------------------------------------------
  // GET /api/logs  — SSE stream of log entries
  // ---------------------------------------------------------------------------
  router.get("/logs", (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Replay buffered entries so the client sees recent history immediately.
    for (const entry of logBuffer) {
      res.write(`data: ${JSON.stringify(entry)}\n\n`);
    }

    const onLog = (entry: LogEntry): void => {
      res.write(`data: ${JSON.stringify(entry)}\n\n`);
    };

    logEmitter.on("log", onLog);
    req.on("close", () => logEmitter.off("log", onLog));
  });

  return router;
}
