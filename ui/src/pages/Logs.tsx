import { useState, useRef, useEffect } from "react";
import { Pause, Play, Trash2 } from "lucide-react";
import { useLogs } from "../hooks/useLogs.js";
import type { LogEntry } from "../types.js";

const LEVELS = ["all", "error", "warn", "info", "debug"] as const;
type LevelFilter = (typeof LEVELS)[number];

const LEVEL_STYLES: Record<string, string> = {
  error: "text-red-400",
  warn: "text-amber-400",
  info: "text-sky-400",
  debug: "text-slate-500",
  verbose: "text-slate-600",
};

const LEVEL_BADGE: Record<string, string> = {
  error: "bg-red-500/20 text-red-400 border-red-500/30",
  warn: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  info: "bg-sky-500/20 text-sky-400 border-sky-500/30",
  debug: "bg-slate-700 text-slate-400 border-slate-600",
  verbose: "bg-slate-800 text-slate-500 border-slate-700",
};

export function Logs() {
  const rawLogs = useLogs();
  const [filter, setFilter] = useState<LevelFilter>("all");
  const [paused, setPaused] = useState(false);
  const [frozen, setFrozen] = useState<LogEntry[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const displayed = paused ? frozen : rawLogs;
  const filtered =
    filter === "all" ? displayed : displayed.filter((l) => l.level === filter);

  // Auto-scroll to bottom unless paused
  useEffect(() => {
    if (!paused) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [rawLogs, paused]);

  function togglePause() {
    if (!paused) {
      setFrozen([...rawLogs]);
    }
    setPaused((p) => !p);
  }

  return (
    <div className="p-6 flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Logs</h1>
          <p className="text-sm text-slate-400 mt-0.5">Real-time gateway log stream</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Level filter */}
          <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg p-0.5">
            {LEVELS.map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFilter(lvl)}
                className={`px-3 py-1 text-xs rounded-md transition-colors capitalize ${
                  filter === lvl
                    ? "bg-indigo-600 text-white font-medium"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          {/* Pause / Resume */}
          <button
            onClick={togglePause}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors"
          >
            {paused ? <Play size={12} /> : <Pause size={12} />}
            {paused ? "Resume" : "Pause"}
          </button>

          {/* Clear (visual only — clears local copy) */}
          <button
            onClick={() => setFrozen([])}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <Trash2 size={12} />
            Clear
          </button>
        </div>
      </div>

      {/* Log panel */}
      <div className="flex-1 bg-slate-900 border border-slate-700 rounded-xl overflow-y-auto font-mono text-xs min-h-0 max-h-[calc(100vh-14rem)]">
        {paused && (
          <div className="sticky top-0 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-400 text-xs">
            Stream paused — showing {frozen.length} frozen entries
          </div>
        )}

        {filtered.length === 0 ? (
          <p className="px-5 py-4 text-slate-600">No log entries yet…</p>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {filtered.map((entry, i) => (
              <LogRow key={i} entry={entry} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function LogRow({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasMeta =
    entry.metadata && Object.keys(entry.metadata).length > 0;

  return (
    <div
      className="px-4 py-1.5 hover:bg-slate-800/40 cursor-pointer"
      onClick={() => hasMeta && setExpanded((e) => !e)}
    >
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="text-slate-600 shrink-0 tabular-nums">
          {entry.timestamp?.slice(0, 19).replace("T", " ") ?? ""}
        </span>
        <span
          className={`inline-flex items-center px-1.5 py-0 rounded border text-[10px] font-medium uppercase tracking-wider shrink-0 ${
            LEVEL_BADGE[entry.level] ?? LEVEL_BADGE["debug"]
          }`}
        >
          {entry.level}
        </span>
        <span className={LEVEL_STYLES[entry.level] ?? "text-slate-400"}>
          {entry.message}
        </span>
      </div>
      {expanded && hasMeta && (
        <pre className="mt-1.5 ml-28 text-slate-500 whitespace-pre-wrap break-all">
          {JSON.stringify(entry.metadata, null, 2)}
        </pre>
      )}
    </div>
  );
}
