import { useState } from "react";
import { X, Trash2, Loader2 } from "lucide-react";

interface Props {
  serverName: string;
  serverId: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export function ConfirmDeleteDialog({ serverName, serverId, onConfirm, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Trash2 size={16} className="text-red-400" />
            Delete Server
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-3">
          <p className="text-sm text-slate-300">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-white">{serverName}</span>?
          </p>
          <p className="text-sm text-slate-400">
            This will disconnect it and remove it from the configuration. This action cannot be
            undone.
          </p>
          <p className="text-xs text-slate-500 font-mono bg-slate-900 px-3 py-2 rounded-lg">
            ID: {serverId}
          </p>

          {error && (
            <div className="px-3 py-2 bg-red-900/40 border border-red-700/60 rounded-lg text-sm text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-700">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600 disabled:opacity-60 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleDelete()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
