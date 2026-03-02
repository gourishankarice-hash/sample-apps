#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import * as XLSX from "xlsx";
import http from "http";

// Zod schema for input validation
const ConvertToExcelSchema = z.object({
  data: z.array(z.record(z.any())).min(1, "Data array cannot be empty"),
  sheetName: z.string().optional().default("Sheet1"),
  fileName: z.string().optional().default("output.xlsx"),
});

type ConvertToExcelInput = z.infer<typeof ConvertToExcelSchema>;

class ExcelMCPServer {
  private transports: Map<string, SSEServerTransport> = new Map();

  private createServer(): Server {
    const server = new Server(
      { name: "mcp-excel-server", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );

    this.setupToolHandlers(server);

    server.onerror = (error) => {
      console.error("[MCP Error]", error);
    };

    return server;
  }

  private setupToolHandlers(server: Server) {
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "convert_to_excel",
          description:
            "Convert tabular data (array of objects) to an Excel file. Returns base64-encoded Excel file.",
          inputSchema: {
            type: "object",
            properties: {
              data: {
                type: "array",
                description:
                  "Array of objects to convert to Excel. Each object represents a row, with keys as column headers.",
                items: { type: "object" },
              },
              sheetName: {
                type: "string",
                description: "Name for the Excel sheet (default: 'Sheet1')",
              },
              fileName: {
                type: "string",
                description: "Name for the Excel file (default: 'output.xlsx')",
              },
            },
            required: ["data"],
          },
        },
      ],
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name !== "convert_to_excel") {
        throw new Error(`Unknown tool: ${request.params.name}`);
      }

      try {
        const validatedInput = ConvertToExcelSchema.parse(
          request.params.arguments
        );
        const base64Excel = this.generateExcel(validatedInput);

        return {
          content: [
            {
              type: "text",
              text: `Excel file generated successfully: ${validatedInput.fileName}`,
            },
            {
              type: "text",
              text: `\n\nBase64-encoded Excel file (you can decode and save this):\n\n${base64Excel}`,
            },
          ],
        };
      } catch (error) {
        console.error("Error in convert_to_excel tool:", error);

        if (error instanceof z.ZodError) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Validation error: ${error.errors
                  .map((e) => `${e.path.join(".")}: ${e.message}`)
                  .join(", ")}`,
              },
            ],
          };
        }

        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error generating Excel: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    });
  }

  private generateExcel(input: ConvertToExcelInput): string {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(input.data);
    XLSX.utils.book_append_sheet(workbook, worksheet, input.sheetName);

    const excelBuffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    const base64 = excelBuffer.toString("base64");

    console.error(`Generated Excel file: ${input.fileName}`);
    console.error(`Data rows: ${input.data.length}`);
    console.error(`Columns: ${Object.keys(input.data[0] || {}).length}`);

    return base64;
  }

  async run() {
    const PORT = parseInt(process.env.PORT || "3000");

    const httpServer = http.createServer(async (req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        res.writeHead(200).end();
        return;
      }

      if (req.method === "GET" && req.url === "/sse") {
        const transport = new SSEServerTransport("/messages", res);
        const server = this.createServer();

        this.transports.set(transport.sessionId, transport);

        transport.onclose = () => {
          this.transports.delete(transport.sessionId);
          console.error(`Client disconnected: ${transport.sessionId}`);
        };

        await server.connect(transport);
        console.error(`Client connected: ${transport.sessionId}`);

      } else if (req.method === "POST" && req.url?.startsWith("/messages")) {
        const url = new URL(req.url, `http://localhost`);
        const sessionId = url.searchParams.get("sessionId");

        if (!sessionId || !this.transports.has(sessionId)) {
          res.writeHead(404).end("Session not found");
          return;
        }

        const transport = this.transports.get(sessionId)!;
        await transport.handlePostMessage(req, res);

      } else {
        res.writeHead(404).end("Not found");
      }
    });

    httpServer.listen(PORT, () => {
      console.error(`MCP Excel Server running in SSE mode`);
      console.error(`SSE endpoint:      http://localhost:${PORT}/sse`);
      console.error(`Messages endpoint: http://localhost:${PORT}/messages`);
    });

    process.on("SIGINT", async () => {
      console.error("Shutting down MCP Excel Server...");
      httpServer.close();
      process.exit(0);
    });
  }
}

const server = new ExcelMCPServer();
server.run().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
