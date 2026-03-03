import { useCallback, useState } from "react";
import { Search, ChevronDown, ChevronUp } from "lucide-react";
import { useApi } from "../hooks/useApi.js";
import { api } from "../api/gateway.js";
import type { PromptInfo } from "../types.js";

export function Prompts() {
  const fetcher = useCallback(() => api.getPrompts(), []);
  const { data: prompts, loading } = useApi<PromptInfo[]>(fetcher);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = prompts?.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Prompts</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          {prompts ? `${prompts.length} prompts across all servers` : "Loading…"}
        </p>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Search prompts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {loading && !prompts ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : !filtered || filtered.length === 0 ? (
        <p className="text-sm text-slate-500">No prompts found.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((prompt) => (
            <div
              key={prompt.name}
              className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setExpanded(expanded === prompt.name ? null : prompt.name)}
                className="w-full px-5 py-3.5 flex items-center gap-3 text-left hover:bg-slate-700/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono font-medium text-amber-300">{prompt.name}</p>
                  {prompt.description && (
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{prompt.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-slate-500">{prompt.serverName}</span>
                  {prompt.arguments && prompt.arguments.length > 0 && (
                    <span className="text-xs text-slate-500 bg-slate-700/60 px-2 py-0.5 rounded-full">
                      {prompt.arguments.length} args
                    </span>
                  )}
                  {expanded === prompt.name ? (
                    <ChevronUp size={14} className="text-slate-500" />
                  ) : (
                    <ChevronDown size={14} className="text-slate-500" />
                  )}
                </div>
              </button>

              {expanded === prompt.name && prompt.arguments && prompt.arguments.length > 0 && (
                <div className="border-t border-slate-700/60 px-5 py-4">
                  <p className="text-xs font-medium text-slate-400 mb-2">Arguments</p>
                  <div className="space-y-2">
                    {prompt.arguments.map((arg) => (
                      <div
                        key={arg.name}
                        className="flex items-start gap-3 text-xs"
                      >
                        <code className="text-indigo-300 bg-slate-900/60 px-1.5 py-0.5 rounded shrink-0">
                          {arg.name}
                          {arg.required && <span className="text-red-400 ml-0.5">*</span>}
                        </code>
                        {arg.description && (
                          <span className="text-slate-400">{arg.description}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
