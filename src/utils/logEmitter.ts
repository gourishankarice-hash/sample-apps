import { Writable } from "stream";
import { EventEmitter } from "events";

export interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  service?: string;
  [key: string]: unknown;
}

const MAX_BUFFER = 200;

/** Ring-buffer of recent log entries — sent to new SSE clients on connect. */
export const logBuffer: LogEntry[] = [];

/** Emits "log" events for every new log entry. */
export const logEmitter = new EventEmitter();
logEmitter.setMaxListeners(100); // support many concurrent SSE clients

/**
 * Writable stream consumed by the Winston Stream transport.
 * Winston writes one JSON line per log entry; we parse it and
 * push it into the ring-buffer + emit it on `logEmitter`.
 */
export const logWritableStream = new Writable({
  write(chunk: Buffer, _encoding: string, callback: () => void): void {
    try {
      const raw = chunk.toString().trim();
      if (raw) {
        const entry = JSON.parse(raw) as LogEntry;
        logBuffer.push(entry);
        if (logBuffer.length > MAX_BUFFER) logBuffer.shift();
        logEmitter.emit("log", entry);
      }
    } catch {
      // Ignore malformed JSON lines.
    }
    callback();
  },
});
