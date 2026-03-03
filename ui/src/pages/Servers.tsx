import { useCallback, useState } from "react";
import { RefreshCw, Plus, Trash2 } from "lucide-react";
import { useApi } from "../hooks/useApi.js";
import { api } from "../api/gateway.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { AddServerModal } from "../components/AddServerModal.js";
import { ConfirmDeleteDialog } from "../components/ConfirmDeleteDialog.js";
import type { ServerInfo } from "../types.js";

export function Servers() {
  const fetcher = useCallback(() => api.getServers(), []);
  const { data: servers, loading, refetch } = useApi<ServerInfo[]>(fetcher, 5000);
  const [reconnecting, setReconnecting] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deletingServer, setDeletingServer] = useState<ServerInfo | null>(null);

  async function handleReconnect(id: string) {
    setReconnecting(id);
    try {
      await api.reconnectServer(id);
      await refetch();
    } catch {
      // error handled silently; badge will reflect real status
    } finally {
      setReconnecting(null);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Servers</h1>
          <p className="text-sm text-slate-400 mt-0.5">Downstream MCP server connections</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void refetch()}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors"
          >
            <Plus size={14} />
            Add Server
          </button>
        </div>
      </div>

      {loading && !servers ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : !servers || servers.length === 0 ? (
        <p className="text-sm text-slate-500">No servers configured.</p>
      ) : (
        <div className="space-y-3">
          {servers.map((s) => (
            <div
              key={s.id}
              className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="text-sm font-semibold text-slate-100">{s.name}</p>
                  <StatusBadge status={s.status} />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  ID: <span className="font-mono text-slate-400">{s.id}</span>
                  {" · "}
                  Namespace: <span className="font-mono text-slate-400">{s.namespace}</span>
                </p>
                <div className="flex gap-4 mt-2">
                  <Pill label="Tools" value={s.tools} />
                  <Pill label="Resources" value={s.resources} />
                  <Pill label="Prompts" value={s.prompts} />
                  {s.lastError && (
                    <p className="text-xs text-red-400 mt-0.5 truncate max-w-xs" title={s.lastError}>
                      {s.lastError}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 shrink-0">
                {s.status !== "connected" && (
                  <button
                    onClick={() => void handleReconnect(s.id)}
                    disabled={reconnecting === s.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-300 bg-indigo-600/20 border border-indigo-500/40 rounded-lg hover:bg-indigo-600/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <RefreshCw size={12} className={reconnecting === s.id ? "animate-spin" : ""} />
                    {reconnecting === s.id ? "Reconnecting…" : "Reconnect"}
                  </button>
                )}
                <button
                  onClick={() => setDeletingServer(s)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-300 bg-red-600/20 border border-red-500/40 rounded-lg hover:bg-red-600/40 transition-colors"
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <AddServerModal
          existingIds={servers?.map((s) => s.id) ?? []}
          existingNamespaces={servers?.map((s) => s.namespace) ?? []}
          onClose={() => setShowAddModal(false)}
          onCreated={() => { void refetch(); }}
        />
      )}

      {deletingServer && (
        <ConfirmDeleteDialog
          serverName={deletingServer.name}
          serverId={deletingServer.id}
          onConfirm={async () => {
            await api.deleteServer(deletingServer.id);
            void refetch();
          }}
          onClose={() => setDeletingServer(null)}
        />
      )}
    </div>
  );
}

function Pill({ label, value }: { label: string; value: number }) {
  return (
    <span className="text-xs text-slate-400">
      <span className="font-medium text-slate-300">{value}</span> {label}
    </span>
  );
}
