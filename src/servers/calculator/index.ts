/**
 * Calculator MCP Server
 *
 * Provides arithmetic tools, mathematical constants resources and a
 * math-problem-solver prompt.
 *
 * Run standalone:  npx tsx src/servers/calculator/index.ts
 *                  node dist/servers/calculator/index.js
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Server instance
// ---------------------------------------------------------------------------

const server = new Server(
  { name: "calculator-server", version: "1.0.0" },
  { capabilities: { tools: {}, resources: {}, prompts: {} } },
);

// ---------------------------------------------------------------------------
// Input schemas (validated with Zod)
// ---------------------------------------------------------------------------

const BinarySchema = z.object({
  a: z.number().describe("First operand"),
  b: z.number().describe("Second operand"),
});

const PowerSchema = z.object({
  base: z.number().describe("Base number"),
  exponent: z.number().describe("Exponent"),
});

const SqrtSchema = z.object({
  number: z.number().min(0).describe("Non-negative number"),
});

const ModSchema = z.object({
  dividend: z.number().describe("Dividend"),
  divisor: z.number().describe("Divisor (non-zero)"),
});

const PercentSchema = z.object({
  value: z.number().describe("The value"),
  total: z.number().describe("The total"),
});

// ---------------------------------------------------------------------------
// tools/list
// ---------------------------------------------------------------------------

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "add",
      description: "Add two numbers",
      inputSchema: {
        type: "object",
        properties: {
          a: { type: "number", description: "First operand" },
          b: { type: "number", description: "Second operand" },
        },
        required: ["a", "b"],
      },
    },
    {
      name: "subtract",
      description: "Subtract b from a",
      inputSchema: {
        type: "object",
        properties: {
          a: { type: "number", description: "Minuend" },
          b: { type: "number", description: "Subtrahend" },
        },
        required: ["a", "b"],
      },
    },
    {
      name: "multiply",
      description: "Multiply two numbers",
      inputSchema: {
        type: "object",
        properties: {
          a: { type: "number", description: "First factor" },
          b: { type: "number", description: "Second factor" },
        },
        required: ["a", "b"],
      },
    },
    {
      name: "divide",
      description: "Divide a by b",
      inputSchema: {
        type: "object",
        properties: {
          a: { type: "number", description: "Dividend" },
          b: { type: "number", description: "Divisor (must be non-zero)" },
        },
        required: ["a", "b"],
      },
    },
    {
      name: "power",
      description: "Raise base to exponent (base ^ exponent)",
      inputSchema: {
        type: "object",
        properties: {
          base: { type: "number", description: "Base number" },
          exponent: { type: "number", description: "Exponent" },
        },
        required: ["base", "exponent"],
      },
    },
    {
      name: "sqrt",
      description: "Square root of a non-negative number",
      inputSchema: {
        type: "object",
        properties: {
          number: { type: "number", minimum: 0, description: "Non-negative number" },
        },
        required: ["number"],
      },
    },
    {
      name: "modulo",
      description: "Remainder of dividend ÷ divisor",
      inputSchema: {
        type: "object",
        properties: {
          dividend: { type: "number", description: "Dividend" },
          divisor: { type: "number", description: "Non-zero divisor" },
        },
        required: ["dividend", "divisor"],
      },
    },
    {
      name: "percentage",
      description: "Calculate what percentage value is of total",
      inputSchema: {
        type: "object",
        properties: {
          value: { type: "number", description: "The value" },
          total: { type: "number", description: "The total" },
        },
        required: ["value", "total"],
      },
    },
  ],
}));

// ---------------------------------------------------------------------------
// tools/call
// ---------------------------------------------------------------------------

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: rawArgs = {} } = request.params;

  try {
    switch (name) {
      case "add": {
        const { a, b } = BinarySchema.parse(rawArgs);
        return text(`${a} + ${b} = ${a + b}`);
      }

      case "subtract": {
        const { a, b } = BinarySchema.parse(rawArgs);
        return text(`${a} − ${b} = ${a - b}`);
      }

      case "multiply": {
        const { a, b } = BinarySchema.parse(rawArgs);
        return text(`${a} × ${b} = ${a * b}`);
      }

      case "divide": {
        const { a, b } = BinarySchema.parse(rawArgs);
        if (b === 0) {
          throw new McpError(ErrorCode.InvalidParams, "Division by zero is undefined");
        }
        return text(`${a} ÷ ${b} = ${a / b}`);
      }

      case "power": {
        const { base, exponent } = PowerSchema.parse(rawArgs);
        return text(`${base}^${exponent} = ${Math.pow(base, exponent)}`);
      }

      case "sqrt": {
        const { number } = SqrtSchema.parse(rawArgs);
        return text(`√${number} = ${Math.sqrt(number)}`);
      }

      case "modulo": {
        const { dividend, divisor } = ModSchema.parse(rawArgs);
        if (divisor === 0) {
          throw new McpError(ErrorCode.InvalidParams, "Divisor must be non-zero");
        }
        return text(`${dividend} mod ${divisor} = ${dividend % divisor}`);
      }

      case "percentage": {
        const { value, total } = PercentSchema.parse(rawArgs);
        if (total === 0) {
          throw new McpError(ErrorCode.InvalidParams, "Total must be non-zero");
        }
        const pct = ((value / total) * 100).toFixed(4);
        return text(`${value} / ${total} × 100 = ${pct}%`);
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (err) {
    if (err instanceof McpError) throw err;
    if (err instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid arguments: ${err.message}`);
    }
    throw new McpError(ErrorCode.InternalError, (err as Error).message);
  }
});

// ---------------------------------------------------------------------------
// resources/list + resources/read
// ---------------------------------------------------------------------------

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: "calculator://constants",
      name: "Mathematical Constants",
      description: "Common mathematical constants (π, e, √2, …)",
      mimeType: "application/json",
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  if (uri === "calculator://constants") {
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              PI: Math.PI,
              E: Math.E,
              SQRT2: Math.SQRT2,
              SQRT1_2: Math.SQRT1_2,
              LN2: Math.LN2,
              LN10: Math.LN10,
              LOG2E: Math.LOG2E,
              LOG10E: Math.LOG10E,
              PHI: (1 + Math.sqrt(5)) / 2,
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  throw new McpError(ErrorCode.InvalidRequest, `Resource not found: ${uri}`);
});

// ---------------------------------------------------------------------------
// prompts/list + prompts/get
// ---------------------------------------------------------------------------

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [
    {
      name: "math_problem",
      description: "Step-by-step solver for a mathematical problem",
      arguments: [
        { name: "problem", description: "The problem to solve", required: true },
        {
          name: "detail_level",
          description: "How detailed the solution should be: brief | detailed",
          required: false,
        },
      ],
    },
  ],
}));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  if (name === "math_problem") {
    const problem = (args as Record<string, string>)["problem"] ?? "an unspecified problem";
    const detail = (args as Record<string, string>)["detail_level"] ?? "detailed";

    return {
      description: "Math problem solver",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `Please solve the following mathematical problem step by step:`,
              ``,
              `Problem: ${problem}`,
              ``,
              `Detail level: ${detail}`,
              detail === "brief"
                ? "Provide a concise solution."
                : "Show all working, explain each step, and verify the answer.",
            ].join("\n"),
          },
        },
      ],
    };
  }

  throw new McpError(ErrorCode.InvalidRequest, `Prompt not found: ${name}`);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function text(content: string) {
  return { content: [{ type: "text" as const, text: content }] };
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  process.stderr.write(`Calculator server error: ${(err as Error).message}\n`);
  process.exit(1);
});
