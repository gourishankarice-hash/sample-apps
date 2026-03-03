import { useState, useEffect } from "react";
import type { LogEntry } from "../types.js";

const MAX_LOGS = 500;

/** Streams log entries from the gateway SSE endpoint. */
export function useLogs(): LogEntry[] {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    const source = new EventSource("/api/logs");

    source.onmessage = (event: MessageEvent<string>) => {
      try {
        const entry = JSON.parse(event.data) as LogEntry;
        setLogs((prev) => [...prev.slice(-(MAX_LOGS - 1)), entry]);
      } catch {
        // ignore parse errors
      }
    };

    source.onerror = () => source.close();

    return () => source.close();
  }, []);

  return logs;
}
