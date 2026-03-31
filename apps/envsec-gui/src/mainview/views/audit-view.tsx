import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "../components/empty-state";
import { electroview } from "../rpc";

interface AuditResult {
  expired: { context: string; key: string; expiresAt: string }[];
  expiring: {
    context: string;
    key: string;
    expiresAt: string;
    daysLeft: number;
  }[];
}

export function AuditView() {
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAudit = useCallback(async () => {
    setLoading(true);
    try {
      const result = await electroview.rpc?.request.auditSecrets({});
      setAudit(result ?? { expired: [], expiring: [] });
    } catch {
      setAudit({ expired: [], expiring: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  const totalIssues =
    (audit?.expired.length ?? 0) + (audit?.expiring.length ?? 0);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-xl tracking-tight">Audit</h1>
          <p className="mt-1 text-muted text-sm">
            Check for expired or expiring secrets across all contexts
          </p>
        </div>
        <button
          className="rounded-lg border border-border px-3 py-1.5 text-muted text-sm transition-colors hover:border-border-hover hover:text-foreground"
          onClick={loadAudit}
          type="button"
        >
          ↻ Refresh
        </button>
      </div>

      <AuditContent audit={audit} loading={loading} totalIssues={totalIssues} />
    </div>
  );
}

function AuditContent({
  loading,
  totalIssues,
  audit,
}: {
  loading: boolean;
  totalIssues: number;
  audit: AuditResult | null;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
      </div>
    );
  }

  if (totalIssues === 0) {
    return (
      <EmptyState
        description="No expired or expiring secrets found"
        title="All clear"
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {audit && audit.expired.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 font-medium text-sm">
            <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
            Expired ({audit.expired.length})
          </h2>
          <div className="overflow-hidden rounded-xl border border-red-500/20">
            {audit.expired.map((item) => (
              <div
                className="flex items-center justify-between border-border border-b px-5 py-3 last:border-0"
                key={`${item.context}-${item.key}`}
              >
                <div>
                  <span className="font-mono text-red-400 text-sm">
                    {item.key}
                  </span>
                  <p className="mt-0.5 text-muted text-xs">{item.context}</p>
                </div>
                <span className="text-red-400 text-xs">
                  Expired {new Date(item.expiresAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {audit && audit.expiring.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 font-medium text-sm">
            <span className="inline-block h-2 w-2 rounded-full bg-yellow-400" />
            Expiring Soon ({audit.expiring.length})
          </h2>
          <div className="overflow-hidden rounded-xl border border-yellow-500/20">
            {audit.expiring.map((item) => (
              <div
                className="flex items-center justify-between border-border border-b px-5 py-3 last:border-0"
                key={`${item.context}-${item.key}`}
              >
                <div>
                  <span className="font-mono text-sm text-yellow-400">
                    {item.key}
                  </span>
                  <p className="mt-0.5 text-muted text-xs">{item.context}</p>
                </div>
                <span className="text-xs text-yellow-400">
                  {item.daysLeft}d remaining
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
