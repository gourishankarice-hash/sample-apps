import { useCallback, useState } from "react";
import { Search, Play, X, ChevronDown, ChevronUp } from "lucide-react";
import { useApi } from "../hooks/useApi.js";
import { api } from "../api/gateway.js";
import type { ToolInfo } from "../types.js";

export function Tools() {
  const fetcher = useCallback(() => api.getTools(), []);
  const { data: tools, loading } = useApi<ToolInfo[]>(fetcher);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [invoking, setInvoking] = useState<ToolInfo | null>(null);

  const filtered = tools?.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Tools</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          {tools ? `${tools.length} tools across all servers` : "Loading…"}
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Search tools…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {loading && !tools ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : !filtered || filtered.length === 0 ? (
        <p className="text-sm text-slate-500">No tools found.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((tool) => (
            <div
              key={tool.name}
              className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setExpanded(expanded === tool.name ? null : tool.name)}
                className="w-full px-5 py-3.5 flex items-center gap-3 text-left hover:bg-slate-700/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono font-medium text-indigo-300">{tool.name}</p>
                  {tool.description && (
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{tool.description}</p>
                  )}
                </div>
                <span className="text-xs text-slate-500 shrink-0">{tool.serverName}</span>
                {expanded === tool.name ? (
                  <ChevronUp size={14} className="text-slate-500 shrink-0" />
                ) : (
                  <ChevronDown size={14} className="text-slate-500 shrink-0" />
                )}
              </button>

              {expanded === tool.name && (
                <div className="border-t border-slate-700/60 px-5 py-4 space-y-3">
                  {tool.inputSchema && (
                    <div>
                      <p className="text-xs font-medium text-slate-400 mb-1.5">Input Schema</p>
                      <pre className="text-xs text-slate-300 bg-slate-900/60 rounded-lg p-3 overflow-x-auto">
                        {JSON.stringify(tool.inputSchema, null, 2)}
                      </pre>
                    </div>
                  )}
                  <button
                    onClick={() => setInvoking(tool)}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors"
                  >
                    <Play size={11} />
                    Invoke
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {invoking && (
        <InvokeModal tool={invoking} onClose={() => setInvoking(null)} />
      )}
    </div>
  );
}

function InvokeModal({ tool, onClose }: { tool: ToolInfo; onClose: () => void }) {
  const [args, setArgs] = useState("{}");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleInvoke() {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const parsed = JSON.parse(args) as Record<string, unknown>;
      const res = await api.invokeTool(tool.name, parsed);
      setResult(JSON.stringify(res, null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60">
          <p className="text-sm font-medium text-slate-100">
            Invoke <span className="font-mono text-indigo-300">{tool.name}</span>
          </p>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Arguments (JSON)
            </label>
            <textarea
              rows={6}
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              className="w-full font-mono text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 p-3 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
            />
          </div>

          {result && (
            <div>
              <p className="text-xs font-medium text-green-400 mb-1.5">Result</p>
              <pre className="text-xs text-slate-300 bg-slate-950/80 rounded-lg p-3 overflow-x-auto max-h-48">
                {result}
              </pre>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-700/60">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => void handleInvoke()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Play size={12} />
            {loading ? "Running…" : "Run"}
          </button>
        </div>
      </div>
    </div>
  );
}
