import type { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  color?: "indigo" | "green" | "blue" | "amber";
}

const COLOR_MAP = {
  indigo: "text-indigo-400 bg-indigo-500/10",
  green: "text-green-400 bg-green-500/10",
  blue: "text-blue-400 bg-blue-500/10",
  amber: "text-amber-400 bg-amber-500/10",
};

export function StatCard({ label, value, sub, icon: Icon, color = "indigo" }: Props) {
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${COLOR_MAP[color]}`}>
        <Icon size={20} className={COLOR_MAP[color].split(" ")[0]} />
      </div>
      <div>
        <p className="text-sm text-slate-400">{label}</p>
        <p className="text-2xl font-semibold text-slate-100 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
