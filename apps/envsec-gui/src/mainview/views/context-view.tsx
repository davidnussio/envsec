import { useState } from "react";
import type { Secret } from "../../shared/types";
import { AddSecretModal } from "../components/add-secret-modal";
import { EmptyState } from "../components/empty-state";
import { electroview } from "../rpc";

export function ContextView({
  context,
  secrets,
  loading,
  onBack,
  onRefresh,
}: {
  context: string;
  secrets: Secret[];
  loading: boolean;
  onBack: () => void;
  onRefresh: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [revealedValues, setRevealedValues] = useState<Record<string, string>>(
    {}
  );
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const toggleReveal = async (key: string) => {
    if (revealedKeys.has(key)) {
      setRevealedKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      return;
    }
    try {
      const value = await electroview.rpc?.request.getSecret({
        context,
        key,
      });
      if (value != null) {
        setRevealedValues((prev) => ({ ...prev, [key]: value }));
        setRevealedKeys((prev) => new Set(prev).add(key));
      }
    } catch {
      // ignore
    }
  };

  const handleDelete = async (key: string) => {
    setDeletingKey(key);
    try {
      const result = await electroview.rpc?.request.deleteSecret({
        context,
        key,
      });
      if (result?.ok) {
        onRefresh();
      }
    } catch {
      // ignore
    } finally {
      setDeletingKey(null);
    }
  };

  const filtered = secrets.filter((s) =>
    s.key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          className="mb-3 flex items-center gap-1.5 text-muted text-xs transition-colors hover:text-emerald-400"
          onClick={onBack}
          type="button"
        >
          <svg
            aria-hidden="true"
            fill="none"
            height="14"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="14"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          All Contexts
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 font-semibold text-xl tracking-tight">
              <span className="font-mono text-emerald-400">{context}</span>
            </h1>
            <p className="mt-1 text-muted text-sm">
              {secrets.length} secret
              {secrets.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-lg border border-border px-3 py-1.5 text-muted text-sm transition-colors hover:border-border-hover hover:text-foreground"
              onClick={onRefresh}
              type="button"
            >
              ↻
            </button>
            <button
              className="rounded-lg bg-emerald-500 px-3 py-1.5 font-medium text-black text-sm transition-colors hover:bg-emerald-400"
              onClick={() => setShowAdd(true)}
              type="button"
            >
              + Add
            </button>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <input
          className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-foreground text-sm placeholder:text-muted/60 focus:border-emerald-500/40 focus:outline-none"
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search secrets..."
          type="text"
          value={searchQuery}
        />
      </div>

      <SecretsContent
        deletingKey={deletingKey}
        filtered={filtered}
        loading={loading}
        onDelete={handleDelete}
        onToggleReveal={toggleReveal}
        revealedKeys={revealedKeys}
        revealedValues={revealedValues}
        searchQuery={searchQuery}
      />

      {showAdd && (
        <AddSecretModal
          context={context}
          onAdded={onRefresh}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}

function SecretsContent({
  loading,
  filtered,
  searchQuery,
  revealedKeys,
  revealedValues,
  deletingKey,
  onToggleReveal,
  onDelete,
}: {
  loading: boolean;
  filtered: Secret[];
  searchQuery: string;
  revealedKeys: Set<string>;
  revealedValues: Record<string, string>;
  deletingKey: string | null;
  onToggleReveal: (key: string) => void;
  onDelete: (key: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <EmptyState
        description={
          searchQuery
            ? "Try a different search term"
            : "Click + Add to store a secret"
        }
        title={searchQuery ? "No matches" : "No secrets"}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="grid grid-cols-[1fr_140px_100px] gap-4 border-border border-b bg-surface/50 px-5 py-2.5 font-medium text-muted text-xs uppercase tracking-wider">
        <span>Key</span>
        <span>Updated</span>
        <span className="text-right">Actions</span>
      </div>
      {filtered.map((secret) => (
        <SecretRow
          deletingKey={deletingKey}
          key={secret.key}
          onDelete={onDelete}
          onToggleReveal={onToggleReveal}
          revealed={revealedKeys.has(secret.key)}
          revealedValue={revealedValues[secret.key]}
          secret={secret}
        />
      ))}
    </div>
  );
}

function SecretRow({
  secret,
  revealed,
  revealedValue,
  deletingKey,
  onToggleReveal,
  onDelete,
}: {
  secret: Secret;
  revealed: boolean;
  revealedValue: string | undefined;
  deletingKey: string | null;
  onToggleReveal: (key: string) => void;
  onDelete: (key: string) => void;
}) {
  return (
    <div className="group grid grid-cols-[1fr_140px_100px] items-center gap-4 border-border border-b px-5 py-3 last:border-0 hover:bg-surface/30">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm">{secret.key}</span>
          {secret.expiresAt && (
            <span className="rounded bg-yellow-500/10 px-1.5 py-0.5 text-[10px] text-yellow-400">
              ⏳ expires
            </span>
          )}
        </div>
        {revealed && revealedValue != null && (
          <code className="mt-1 block rounded bg-surface px-2 py-1 font-mono text-emerald-400 text-xs">
            {revealedValue}
          </code>
        )}
      </div>
      <span className="text-muted text-xs">
        {secret.updatedAt
          ? new Date(secret.updatedAt).toLocaleDateString()
          : "—"}
      </span>
      <div className="flex items-center justify-end gap-1">
        <button
          className="rounded p-1.5 text-muted transition-colors hover:bg-surface hover:text-foreground"
          onClick={() => onToggleReveal(secret.key)}
          title={revealed ? "Hide value" : "Show value"}
          type="button"
        >
          <EyeIcon hidden={revealed} />
        </button>
        <button
          className="rounded p-1.5 text-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
          disabled={deletingKey === secret.key}
          onClick={() => onDelete(secret.key)}
          title="Delete secret"
          type="button"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  if (hidden) {
    return (
      <svg
        aria-hidden="true"
        fill="none"
        height="14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        width="14"
      >
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <line x1="1" x2="23" y1="1" y2="23" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="14"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="14"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="14"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="14"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
