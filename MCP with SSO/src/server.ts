#!/usr/bin/env node

import express, { Express, Request, Response } from 'express';
import bodyParser from 'body-parser';
import * as dotenv from 'dotenv';
import { PingFederateClient, PingFederateConfig } from './pingfederate.js';
import { AuthenticationTools } from './tools.js';

// Load environment variables
dotenv.config();

/**
 * HTTP MCP Server for PingFederate OAuth 2.0/OIDC integration with Microsoft Copilot Studio
 */
class PingFederateHTTPServer {
  private app: Express;
  private pingfedClient: PingFederateClient;
  private authTools: AuthenticationTools;
  private port: number;
  private host: string;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.HTTP_PORT || '3000', 10);
    this.host = process.env.HTTP_HOST || 'localhost';

    // Initialize PingFederate client
    this.pingfedClient = this.initializePingFederateClient();

    // Initialize authentication tools
    this.authTools = new AuthenticationTools(this.pingfedClient);

    this.setupMiddleware();
    this.setupRoutes();
  }

  private initializePingFederateClient(): PingFederateClient {
    const baseUrl = process.env.PING_BASE_URL;
    const clientId = process.env.PING_CLIENT_ID;
    const clientSecret = process.env.PING_CLIENT_SECRET;
    const redirectUri = process.env.PING_REDIRECT_URI;
    const tokenEndpoint = process.env.PING_TOKEN_ENDPOINT;
    const authorizeEndpoint = process.env.PING_AUTHORIZE_ENDPOINT;
    const userinfoEndpoint = process.env.PING_USERINFO_ENDPOINT;

    // Validate required configuration
    if (
      !baseUrl ||
      !clientId ||
      !clientSecret ||
      !redirectUri ||
      !tokenEndpoint ||
      !authorizeEndpoint ||
      !userinfoEndpoint
    ) {
      throw new Error(
        'Missing required PingFederate configuration. Please check .env file.'
      );
    }

    const config: PingFederateConfig = {
      baseUrl,
      clientId,
      clientSecret,
      redirectUri,
      tokenEndpoint,
      authorizeEndpoint,
      userinfoEndpoint,
      cacheTTL: parseInt(process.env.TOKEN_CACHE_TTL || '3600', 10),
    };

    return new PingFederateClient(config);
  }

  private setupMiddleware(): void {
    // Parse JSON bodies
    this.app.use(bodyParser.json());

    // CORS headers
    this.app.use((req: Request, res: Response, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // Request logging
    this.app.use((req: Request, res: Response, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'ok',
        server: 'pingfederate-mcp-server',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      });
    });

    // MCP Tools List endpoint
    this.app.get('/mcp/tools', (req: Request, res: Response) => {
      try {
        const tools = this.authTools.getTools();
        res.json({
          success: true,
          tools,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
          success: false,
          error: errorMessage,
        });
      }
    });

    // MCP Tool Execute endpoint
    this.app.post('/mcp/execute', async (req: Request, res: Response) => {
      try {
        const { tool_name, arguments: args } = req.body;

        if (!tool_name) {
          return res.status(400).json({
            success: false,
            error: 'Missing required field: tool_name',
          });
        }

        const toolInput = (args ?? {}) as Record<string, unknown>;
        const result = await this.authTools.executeTool(tool_name, toolInput);

        res.json({
          success: true,
          tool_name,
          result: JSON.parse(result),
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error occurred';
        res.status(500).json({
          success: false,
          error: errorMessage,
        });
      }
    });

    // MCP Info endpoint
    this.app.get('/mcp/info', (req: Request, res: Response) => {
      res.json({
        name: 'pingfederate-mcp-server',
        version: '1.0.0',
        description:
          'MCP server for PingFederate OAuth 2.0 and OIDC integration',
        transport: 'http',
        endpoints: {
          health: '/health',
          list_tools: '/mcp/tools',
          execute_tool: '/mcp/execute (POST)',
          info: '/mcp/info',
        },
        pingfederate: {
          base_url: process.env.PING_BASE_URL || 'not set',
          client_id: process.env.PING_CLIENT_ID ? '***' : 'not set',
        },
      });
    });

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        name: 'PingFederate MCP Server',
        message:
          'OAuth 2.0 and OIDC integration for Microsoft Copilot Studio',
        documentation: '/mcp/info',
        health: '/health',
      });
    });

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.path,
        available_endpoints: {
          get_health: 'GET /health',
          get_info: 'GET /mcp/info',
          list_tools: 'GET /mcp/tools',
          execute_tool: 'POST /mcp/execute',
        },
      });
    });
  }

  /**
   * Start the HTTP server
   */
  public async start(): Promise<void> {
    try {
      this.app.listen(this.port, this.host, () => {
        console.log(
          `[PingFederate MCP Server] HTTP server running at http://${this.host}:${this.port}`
        );
        console.log(`[PingFederate MCP Server] Documentation at http://${this.host}:${this.port}/mcp/info`);
        console.log(`[PingFederate MCP Server] Health check at http://${this.host}:${this.port}/health`);
      });

      // Periodic cleanup of state store (every 15 minutes)
      setInterval(() => {
        this.pingfedClient.cleanupStateStore();
        console.log('[PingFederate MCP Server] State store cleaned up');
      }, 15 * 60 * 1000);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('[PingFederate MCP Server] Fatal error:', errorMessage);
      process.exit(1);
    }
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    const server = new PingFederateHTTPServer();
    await server.start();
  } catch (error) {
    console.error(
      'Failed to start MCP server:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    process.exit(1);
  }
}

main();
