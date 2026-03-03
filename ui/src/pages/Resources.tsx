import { useCallback, useState } from "react";
import { Search, ExternalLink } from "lucide-react";
import { useApi } from "../hooks/useApi.js";
import { api } from "../api/gateway.js";
import type { ResourceInfo } from "../types.js";

export function Resources() {
  const fetcher = useCallback(() => api.getResources(), []);
  const { data: resources, loading } = useApi<ResourceInfo[]>(fetcher);
  const [search, setSearch] = useState("");

  const filtered = resources?.filter(
    (r) =>
      r.uri.toLowerCase().includes(search.toLowerCase()) ||
      (r.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (r.description ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Resources</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          {resources ? `${resources.length} resources across all servers` : "Loading…"}
        </p>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Search resources…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {loading && !resources ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : !filtered || filtered.length === 0 ? (
        <p className="text-sm text-slate-500">No resources found.</p>
      ) : (
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/60">
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  URI
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider hidden md:table-cell">
                  Name
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider hidden lg:table-cell">
                  MIME Type
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Server
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {filtered.map((r, i) => (
                <tr key={i} className="hover:bg-slate-700/20 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <ExternalLink size={12} className="text-slate-600 shrink-0" />
                      <span className="font-mono text-xs text-blue-400 truncate max-w-xs" title={r.uri}>
                        {r.uri}
                      </span>
                    </div>
                    {r.description && (
                      <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{r.description}</p>
                    )}
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    <span className="text-slate-300">{r.name ?? "—"}</span>
                  </td>
                  <td className="px-5 py-3.5 hidden lg:table-cell">
                    {r.mimeType ? (
                      <span className="font-mono text-xs text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded">
                        {r.mimeType}
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs text-slate-400">{r.serverName}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
