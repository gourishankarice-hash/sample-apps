import type { ServerStatus } from "../types.js";

const STYLES: Record<ServerStatus, string> = {
  connected: "bg-green-500/15 text-green-400 border-green-500/30",
  connecting: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  disconnected: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  error: "bg-red-500/15 text-red-400 border-red-500/30",
};

const DOTS: Record<ServerStatus, string> = {
  connected: "bg-green-400",
  connecting: "bg-amber-400 animate-pulse",
  disconnected: "bg-slate-500",
  error: "bg-red-400",
};

interface Props {
  status: ServerStatus;
}

export function StatusBadge({ status }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${STYLES[status]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${DOTS[status]}`} />
      {status}
    </span>
  );
}
