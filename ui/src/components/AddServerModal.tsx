import { useState } from "react";
import { X, Plus, Trash2, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { api } from "../api/gateway.js";
import type { ServerConfig, StdioTransportConfig, SSETransportConfig } from "../types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KVPair {
  key: string;
  value: string;
}

interface FormState {
  id: string;
  name: string;
  description: string;
  namespace: string;
  enabled: boolean;
  transportType: "stdio" | "sse";
  // stdio
  command: string;
  args: string[];
  envPairs: KVPair[];
  // sse
  url: string;
  headerPairs: KVPair[];
  // advanced
  healthCheckEnabled: boolean;
  healthCheckIntervalMs: string;
  retryMaxAttempts: string;
  retryDelayMs: string;
  retryBackoffMultiplier: string;
}

interface Props {
  existingIds: string[];
  existingNamespaces: string[];
  onClose: () => void;
  onCreated: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const INITIAL: FormState = {
  id: "",
  name: "",
  description: "",
  namespace: "",
  enabled: true,
  transportType: "stdio",
  command: "",
  args: [""],
  envPairs: [],
  url: "",
  headerPairs: [],
  healthCheckEnabled: true,
  healthCheckIntervalMs: "30000",
  retryMaxAttempts: "3",
  retryDelayMs: "1000",
  retryBackoffMultiplier: "2",
};

function validate(
  form: FormState,
  existingIds: string[],
  existingNamespaces: string[],
): string | null {
  if (!form.id.trim()) return "Server ID is required";
  if (!/^[a-z0-9_-]+$/i.test(form.id.trim()))
    return "ID must contain only letters, numbers, hyphens, or underscores";
  if (existingIds.includes(form.id.trim())) return `Server ID "${form.id.trim()}" is already in use`;
  if (!form.name.trim()) return "Server name is required";
  if (!form.namespace.trim()) return "Namespace is required";
  if (existingNamespaces.includes(form.namespace.trim()))
    return `Namespace "${form.namespace.trim()}" is already in use`;
  if (form.transportType === "stdio" && !form.command.trim())
    return "Command is required for stdio transport";
  if (form.transportType === "sse") {
    if (!form.url.trim()) return "URL is required for SSE transport";
    try {
      new URL(form.url.trim());
    } catch {
      return "URL must be a valid URL (include http:// or https://)";
    }
  }
  const interval = parseInt(form.healthCheckIntervalMs, 10);
  if (isNaN(interval) || interval < 1000) return "Health check interval must be at least 1000 ms";
  const maxAttempts = parseInt(form.retryMaxAttempts, 10);
  if (isNaN(maxAttempts) || maxAttempts < 1) return "Retry max attempts must be at least 1";
  return null;
}

function buildPayload(form: FormState): ServerConfig {
  const transport: StdioTransportConfig | SSETransportConfig =
    form.transportType === "stdio"
      ? {
          type: "stdio",
          command: form.command.trim(),
          args: form.args.map((a) => a.trim()).filter(Boolean),
          ...(form.envPairs.some((p) => p.key.trim()) && {
            env: Object.fromEntries(
              form.envPairs.filter((p) => p.key.trim()).map((p) => [p.key.trim(), p.value]),
            ),
          }),
        }
      : {
          type: "sse",
          url: form.url.trim(),
          ...(form.headerPairs.some((p) => p.key.trim()) && {
            headers: Object.fromEntries(
              form.headerPairs.filter((p) => p.key.trim()).map((p) => [p.key.trim(), p.value]),
            ),
          }),
        };

  return {
    id: form.id.trim(),
    name: form.name.trim(),
    description: form.description.trim(),
    namespace: form.namespace.trim(),
    enabled: form.enabled,
    transport,
    healthCheck: {
      enabled: form.healthCheckEnabled,
      intervalMs: parseInt(form.healthCheckIntervalMs, 10),
    },
    retry: {
      maxAttempts: parseInt(form.retryMaxAttempts, 10),
      delayMs: parseInt(form.retryDelayMs, 10),
      backoffMultiplier: parseFloat(form.retryBackoffMultiplier),
    },
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KVEditor({
  pairs,
  onChange,
  addLabel,
  keyPlaceholder = "KEY",
  valuePlaceholder = "VALUE",
}: {
  pairs: KVPair[];
  onChange: (pairs: KVPair[]) => void;
  addLabel: string;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}) {
  const add = () => onChange([...pairs, { key: "", value: "" }]);
  const remove = (i: number) => onChange(pairs.filter((_, idx) => idx !== i));
  const update = (i: number, field: "key" | "value", val: string) => {
    const next = [...pairs];
    next[i] = { ...next[i]!, [field]: val };
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {pairs.map((pair, i) => (
        <div key={i} className="flex gap-2">
          <input
            className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-200 font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            placeholder={keyPlaceholder}
            value={pair.key}
            onChange={(e) => update(i, "key", e.target.value)}
          />
          <input
            className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            placeholder={valuePlaceholder}
            value={pair.value}
            onChange={(e) => update(i, "value", e.target.value)}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
      >
        <Plus size={12} /> {addLabel}
      </button>
    </div>
  );
}

function ArgsEditor({
  args,
  onChange,
}: {
  args: string[];
  onChange: (args: string[]) => void;
}) {
  const add = () => onChange([...args, ""]);
  const remove = (i: number) => onChange(args.filter((_, idx) => idx !== i));
  const update = (i: number, val: string) => {
    const next = [...args];
    next[i] = val;
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {args.map((arg, i) => (
        <div key={i} className="flex gap-2">
          <input
            className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-200 font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            placeholder={`arg[${i}]`}
            value={arg}
            onChange={(e) => update(i, e.target.value)}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            disabled={args.length === 1}
            className="p-1.5 text-slate-500 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
      >
        <Plus size={12} /> Add argument
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AddServerModal({ existingIds, existingNamespaces, onClose, onCreated }: Props) {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate(form, existingIds, existingNamespaces);
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.addServer(buildPayload(form));
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors";
  const labelCls = "block text-xs font-medium text-slate-400 mb-1";
  const sectionTitleCls = "text-sm font-semibold text-slate-300 mb-3";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
          <h2 className="text-base font-semibold text-white">Add MCP Server</h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
            {/* Basic Info */}
            <div>
              <p className={sectionTitleCls}>Basic Info</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>
                    Server ID <span className="text-red-400">*</span>
                  </label>
                  <input
                    className={`${inputCls} font-mono`}
                    placeholder="my-server"
                    value={form.id}
                    onChange={(e) => set("id", e.target.value)}
                    autoFocus
                  />
                  <p className="text-xs text-slate-500 mt-1">lowercase, hyphens or underscores</p>
                </div>
                <div>
                  <label className={labelCls}>
                    Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    className={inputCls}
                    placeholder="My Server"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>Description</label>
                  <input
                    className={inputCls}
                    placeholder="What this server provides"
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    Namespace <span className="text-red-400">*</span>
                  </label>
                  <input
                    className={`${inputCls} font-mono`}
                    placeholder="myns"
                    value={form.namespace}
                    onChange={(e) => set("namespace", e.target.value)}
                  />
                  <p className="text-xs text-slate-500 mt-1">prefix for tool names, e.g. myns_toolname</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <input
                  id="enabled"
                  type="checkbox"
                  className="w-4 h-4 accent-indigo-500"
                  checked={form.enabled}
                  onChange={(e) => set("enabled", e.target.checked)}
                />
                <label htmlFor="enabled" className="text-sm text-slate-300 cursor-pointer">
                  Connect immediately on add
                </label>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-slate-700" />

            {/* Transport */}
            <div>
              <p className={sectionTitleCls}>Transport</p>

              {/* Type selector pills */}
              <div className="flex gap-2 mb-4">
                {(["stdio", "sse"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set("transportType", t)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      form.transportType === t
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {form.transportType === "stdio" && (
                <div className="space-y-4">
                  <div>
                    <label className={labelCls}>
                      Command <span className="text-red-400">*</span>
                    </label>
                    <input
                      className={`${inputCls} font-mono`}
                      placeholder="node"
                      value={form.command}
                      onChange={(e) => set("command", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Arguments</label>
                    <ArgsEditor args={form.args} onChange={(v) => set("args", v)} />
                  </div>
                  <div>
                    <label className={labelCls}>Environment Variables</label>
                    <KVEditor
                      pairs={form.envPairs}
                      onChange={(v) => set("envPairs", v)}
                      addLabel="Add env var"
                      keyPlaceholder="API_KEY"
                      valuePlaceholder="value"
                    />
                  </div>
                </div>
              )}

              {form.transportType === "sse" && (
                <div className="space-y-4">
                  <div>
                    <label className={labelCls}>
                      URL <span className="text-red-400">*</span>
                    </label>
                    <input
                      className={inputCls}
                      placeholder="http://localhost:4000/sse"
                      value={form.url}
                      onChange={(e) => set("url", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Headers</label>
                    <KVEditor
                      pairs={form.headerPairs}
                      onChange={(v) => set("headerPairs", v)}
                      addLabel="Add header"
                      keyPlaceholder="Authorization"
                      valuePlaceholder="Bearer token"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-slate-700" />

            {/* Advanced (collapsible) */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
              >
                {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                Advanced Settings
              </button>

              {showAdvanced && (
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="col-span-2 flex items-center gap-3">
                    <input
                      id="hcEnabled"
                      type="checkbox"
                      className="w-4 h-4 accent-indigo-500"
                      checked={form.healthCheckEnabled}
                      onChange={(e) => set("healthCheckEnabled", e.target.checked)}
                    />
                    <label htmlFor="hcEnabled" className="text-sm text-slate-300 cursor-pointer">
                      Enable health checks
                    </label>
                  </div>
                  <div>
                    <label className={labelCls}>Health check interval (ms)</label>
                    <input
                      type="number"
                      className={inputCls}
                      disabled={!form.healthCheckEnabled}
                      value={form.healthCheckIntervalMs}
                      onChange={(e) => set("healthCheckIntervalMs", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Retry max attempts</label>
                    <input
                      type="number"
                      className={inputCls}
                      value={form.retryMaxAttempts}
                      onChange={(e) => set("retryMaxAttempts", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Retry delay (ms)</label>
                    <input
                      type="number"
                      className={inputCls}
                      value={form.retryDelayMs}
                      onChange={(e) => set("retryDelayMs", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Retry backoff multiplier</label>
                    <input
                      type="number"
                      step="0.1"
                      className={inputCls}
                      value={form.retryBackoffMultiplier}
                      onChange={(e) => set("retryBackoffMultiplier", e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mx-6 mb-2 px-4 py-2.5 bg-red-900/40 border border-red-700/60 rounded-lg text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              Add Server
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
