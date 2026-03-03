import winston from "winston";
import { logWritableStream } from "./logEmitter.js";

/**
 * Application-wide logger.
 *
 * All output is sent to stderr so that stdout remains clean for the stdio
 * MCP transport (which multiplexes JSON-RPC messages over stdout).
 *
 * A second Stream transport feeds every log entry into the in-memory
 * ring-buffer / EventEmitter used by the admin UI log-streaming endpoint.
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: "mcp-gateway" },
  transports: [
    // Human-readable output on stderr (safe for stdio MCP transport).
    new winston.transports.Console({
      stderrLevels: ["error", "warn", "info", "http", "verbose", "debug", "silly"],
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          const metaStr =
            Object.keys(meta).length > 0 && meta.service !== "mcp-gateway"
              ? ` ${JSON.stringify(meta)}`
              : "";
          return `${timestamp} [${level}] ${message}${metaStr}`;
        }),
      ),
    }),
    // JSON lines → in-memory buffer → SSE stream for the admin UI.
    new winston.transports.Stream({
      stream: logWritableStream,
      format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.json(),
      ),
    }),
  ],
});

export default logger;
