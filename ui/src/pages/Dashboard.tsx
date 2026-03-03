import { useCallback } from "react";
import { Server, Wrench, Database, MessageSquare, Activity } from "lucide-react";
import { useApi } from "../hooks/useApi.js";
import { useLogs } from "../hooks/useLogs.js";
import { api } from "../api/gateway.js";
import { StatCard } from "../components/StatCard.js";
import { StatusBadge } from "../components/StatusBadge.js";
import type { GatewayStatus, ServerInfo } from "../types.js";

export function Dashboard() {
  const statusFetcher = useCallback(() => api.getStatus(), []);
  const serversFetcher = useCallback(() => api.getServers(), []);

  const { data: status } = useApi<GatewayStatus>(statusFetcher, 5000);
  const { data: servers } = useApi<ServerInfo[]>(serversFetcher, 5000);
  const logs = useLogs();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Dashboard</h1>
        <p className="text-sm text-slate-400 mt-0.5">Gateway overview and health</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Connected Servers"
          value={status ? `${status.connectedServers}/${status.totalServers}` : "—"}
          icon={Server}
          color={
            status && status.connectedServers === status.totalServers ? "green" : "amber"
          }
        />
        <StatCard
          label="Total Tools"
          value={status?.totalTools ?? "—"}
          icon={Wrench}
          color="indigo"
        />
        <StatCard
          label="Total Resources"
          value={status?.totalResources ?? "—"}
          icon={Database}
          color="blue"
        />
        <StatCard
          label="Total Prompts"
          value={status?.totalPrompts ?? "—"}
          icon={MessageSquare}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Servers table */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl">
          <div className="px-5 py-4 border-b border-slate-700/60 flex items-center gap-2">
            <Server size={15} className="text-slate-400" />
            <h2 className="text-sm font-medium text-slate-200">Servers</h2>
          </div>
          <div className="divide-y divide-slate-700/40">
            {!servers ? (
              <p className="px-5 py-4 text-sm text-slate-500">Loading…</p>
            ) : servers.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-500">No servers configured.</p>
            ) : (
              servers.map((s) => (
                <div key={s.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-200 font-medium">{s.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {s.tools} tools · {s.resources} resources · {s.prompts} prompts
                    </p>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent logs */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl flex flex-col">
          <div className="px-5 py-4 border-b border-slate-700/60 flex items-center gap-2">
            <Activity size={15} className="text-slate-400" />
            <h2 className="text-sm font-medium text-slate-200">Recent Logs</h2>
          </div>
          <div className="flex-1 overflow-y-auto max-h-72 px-4 py-3 space-y-1 font-mono">
            {logs.length === 0 ? (
              <p className="text-xs text-slate-500">No logs yet…</p>
            ) : (
              logs.map((entry, i) => (
                <div key={i} className="flex gap-2 text-xs">
                  <span className="text-slate-600 shrink-0">{entry.timestamp?.slice(11, 19) ?? ""}</span>
                  <span
                    className={
                      entry.level === "error"
                        ? "text-red-400"
                        : entry.level === "warn"
                        ? "text-amber-400"
                        : "text-slate-400"
                    }
                  >
                    {entry.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
