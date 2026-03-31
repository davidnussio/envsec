import { useState } from "react";
import { electroview } from "../rpc";

export function AddSecretModal({
  context,
  onClose,
  onAdded,
}: {
  context: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [expires, setExpires] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(key.trim() && value.trim())) {
      return;
    }

    setSaving(true);
    setError("");
    try {
      const result = await electroview.rpc?.request.addSecret({
        context,
        key: key.trim(),
        value: value.trim(),
        expires: expires.trim() || undefined,
      });
      if (result?.ok) {
        onAdded();
        onClose();
      } else {
        setError(result?.error ?? "Failed to add secret");
      }
    } catch {
      setError("Failed to add secret");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-2xl">
        <h2 className="mb-4 font-semibold text-lg">Add Secret</h2>
        <p className="mb-4 text-muted text-xs">
          Context: <span className="font-mono text-emerald-400">{context}</span>
        </p>

        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <div>
            <label
              className="mb-1 block text-muted text-xs"
              htmlFor="secret-key"
            >
              Key
            </label>
            <input
              autoFocus
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-foreground text-sm placeholder:text-muted/50 focus:border-emerald-500/40 focus:outline-none"
              id="secret-key"
              onChange={(e) => setKey(e.target.value)}
              placeholder="e.g. api.key or db.password"
              type="text"
              value={key}
            />
          </div>
          <div>
            <label
              className="mb-1 block text-muted text-xs"
              htmlFor="secret-value"
            >
              Value
            </label>
            <input
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-foreground text-sm placeholder:text-muted/50 focus:border-emerald-500/40 focus:outline-none"
              id="secret-value"
              onChange={(e) => setValue(e.target.value)}
              placeholder="Secret value"
              type="password"
              value={value}
            />
          </div>
          <div>
            <label
              className="mb-1 block text-muted text-xs"
              htmlFor="secret-expires"
            >
              Expires (optional)
            </label>
            <input
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-foreground text-sm placeholder:text-muted/50 focus:border-emerald-500/40 focus:outline-none"
              id="secret-expires"
              onChange={(e) => setExpires(e.target.value)}
              placeholder="e.g. 30d, 1h, 90d"
              type="text"
              value={expires}
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-red-400 text-xs">
              {error}
            </p>
          )}

          <div className="mt-2 flex justify-end gap-2">
            <button
              className="rounded-lg border border-border px-4 py-2 text-muted text-sm transition-colors hover:text-foreground"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-lg bg-emerald-500 px-4 py-2 font-medium text-black text-sm transition-colors hover:bg-emerald-400 disabled:opacity-50"
              disabled={saving || !key.trim() || !value.trim()}
              type="submit"
            >
              {saving ? "Saving..." : "Add Secret"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
