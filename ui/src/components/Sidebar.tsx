import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Server,
  Wrench,
  Database,
  MessageSquare,
  ScrollText,
  Zap,
} from "lucide-react";
import { useCallback } from "react";
import { useApi } from "../hooks/useApi.js";
import { api } from "../api/gateway.js";
import type { GatewayStatus } from "../types.js";

const NAV = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/servers", icon: Server, label: "Servers" },
  { to: "/tools", icon: Wrench, label: "Tools" },
  { to: "/resources", icon: Database, label: "Resources" },
  { to: "/prompts", icon: MessageSquare, label: "Prompts" },
  { to: "/logs", icon: ScrollText, label: "Logs" },
];

function formatUptime(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

export function Sidebar() {
  const fetcher = useCallback(() => api.getStatus(), []);
  const { data: status } = useApi<GatewayStatus>(fetcher, 5000);

  const allConnected =
    status && status.connectedServers === status.totalServers;

  return (
    <aside className="w-56 shrink-0 bg-slate-900 border-r border-slate-700/60 flex flex-col">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-slate-700/60">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-600 rounded-lg">
            <Zap size={14} className="text-white" />
          </div>
          <span className="font-semibold text-slate-100 text-sm">MCP Gateway</span>
        </div>
        {status && (
          <p className="text-xs text-slate-500 mt-1.5 ml-0.5">
            v{status.version} · {formatUptime(status.uptime)} up
          </p>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-indigo-600 text-white font-medium"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
              }`
            }
          >
            <Icon size={15} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Status footer */}
      {status && (
        <div className="px-4 py-3 border-t border-slate-700/60">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                allConnected ? "bg-green-400" : "bg-amber-400"
              }`}
            />
            <span className="text-xs text-slate-400">
              {status.connectedServers}/{status.totalServers} servers
            </span>
          </div>
        </div>
      )}
    </aside>
  );
}
