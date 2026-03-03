import express from "express";
import cors from "cors";
import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import type { GatewayConfig, GatewaySettings } from "../types/index.js";
import { GatewayServer } from "./server.js";
import { createApiRouter } from "./apiRoutes.js";
import { createAuthMiddleware } from "./middleware/auth.js";
import { createRateLimiter } from "./middleware/rateLimiter.js";
import logger from "../utils/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
/** Absolute path to the compiled React admin UI (built with `npm run build:ui`). */
const UI_DIST = resolve(__dirname, "../../ui/dist");

/**
 * HTTP server that exposes:
 *   - The MCP Gateway over Server-Sent Events (SSE)
 *   - A REST + SSE API for the Admin UI  (`/api/*`)
 *   - The compiled React Admin UI static files (when `ui/dist` exists)
 *
 * Endpoints:
 *   GET  /health            — liveness probe (no auth)
 *   GET  /status            — gateway status JSON (no auth)
 *   GET  /api/*             — Admin UI REST API (no auth; add auth via config if needed)
 *   GET  /sse               — MCP SSE connection (auth + rate-limit)
 *   POST /messages          — MCP JSON-RPC messages (auth + rate-limit)
 *   GET  /*                 — React SPA (served from ui/dist when built)
 */
export class HttpGatewayServer {
  private readonly app: express.Application;
  private readonly sessions = new Map<string, SSEServerTransport>();

  constructor(
    private readonly settings: GatewaySettings,
    private readonly gateway: GatewayServer,
    private readonly config: GatewayConfig,
    private readonly configPath?: string,
  ) {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  // ---------------------------------------------------------------------------
  // Setup
  // ---------------------------------------------------------------------------

  private setupMiddleware(): void {
    this.app.use(
      cors({
        origin: "*",
        methods: ["GET", "POST", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
      }),
    );
    this.app.use(express.json());
  }

  private setupRoutes(): void {
    const { auth, rateLimit } = this.settings;
    const paths = this.settings.http.path;
    const authMiddleware = createAuthMiddleware(auth);
    const rateLimiter = createRateLimiter(rateLimit);

    // ---- Public probes --------------------------------------------------------

    this.app.get(paths.health, (_req, res) => {
      res.json({ status: "ok", timestamp: new Date().toISOString() });
    });

    this.app.get("/status", (_req, res) => {
      res.json(this.gateway.getStatus());
    });

    // ---- Admin UI REST + SSE API (no auth by default) -----------------------

    this.app.use(
      "/api",
      createApiRouter(
        this.gateway.getProxy(),
        this.gateway.getAggregator(),
        this.gateway,
        this.config,
        this.configPath,
      ),
    );

    // ---- MCP endpoints (auth + rate-limit) ----------------------------------

    this.app.get(paths.sse, rateLimiter, authMiddleware, async (req, res) => {
      logger.info("New MCP SSE connection", { ip: req.ip });
      const transport = new SSEServerTransport(paths.messages, res);
      this.sessions.set(transport.sessionId, transport);

      const cleanup = (): void => {
        this.sessions.delete(transport.sessionId);
        logger.info("MCP SSE connection closed", { sessionId: transport.sessionId });
      };

      transport.onclose = cleanup;
      res.on("close", cleanup);

      try {
        await this.gateway.getMcpServer().connect(transport);
      } catch (err) {
        logger.error("Error connecting MCP SSE transport", { error: err });
        cleanup();
      }
    });

    this.app.post(paths.messages, rateLimiter, authMiddleware, async (req, res) => {
      const sessionId = req.query["sessionId"] as string | undefined;
      if (!sessionId) {
        res.status(400).json({ error: "Missing sessionId query parameter" });
        return;
      }
      const transport = this.sessions.get(sessionId);
      if (!transport) {
        res.status(404).json({ error: `Session not found: ${sessionId}` });
        return;
      }
      try {
        await transport.handlePostMessage(req, res, req.body as unknown);
      } catch (err) {
        logger.error("Error handling MCP message", { error: err, sessionId });
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // ---- React Admin UI (serve static files when built) ---------------------

    if (existsSync(UI_DIST)) {
      this.app.use(express.static(UI_DIST));
      // SPA fallback: serve index.html for all non-API GET routes
      this.app.get("*", (_req, res) => {
        res.sendFile(resolve(UI_DIST, "index.html"));
      });
      logger.info(`Admin UI → http://${this.settings.http.host}:${this.settings.http.port}/`);
    } else {
      logger.info(
        "Admin UI not built yet — run `npm run build:ui` to enable it.",
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  start(): Promise<void> {
    const { port, host } = this.settings.http;

    return new Promise((resolve, reject) => {
      const httpServer = this.app.listen(port, host, () => {
        logger.info(`HTTP Gateway listening on http://${host}:${port}`);
        logger.info(`  MCP SSE  → http://${host}:${port}${this.settings.http.path.sse}`);
        logger.info(`  Health   → http://${host}:${port}${this.settings.http.path.health}`);
        logger.info(`  API      → http://${host}:${port}/api`);
        resolve();
      });

      httpServer.on("error", reject);
    });
  }
}
