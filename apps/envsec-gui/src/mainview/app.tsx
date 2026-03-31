import { useCallback, useEffect, useState } from "react";
import type { Context, Secret } from "../shared/types";
import { EmptyState } from "./components/empty-state";
import { Sidebar } from "./components/sidebar";
import { Titlebar } from "./components/titlebar";
import { electroview } from "./rpc";
import { AuditView } from "./views/audit-view";
import { ContextView } from "./views/context-view";

export type View = "contexts" | "secrets" | "audit";

function App() {
  const [view, setView] = useState<View>("contexts");
  const [contexts, setContexts] = useState<Context[]>([]);
  const [selectedContext, setSelectedContext] = useState<string | null>(null);
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const loadContexts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await electroview.rpc?.request.listContexts({});
      setContexts(result ?? []);
    } catch (err) {
      console.error("Failed to load contexts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSecrets = useCallback(async (ctx: string) => {
    setLoading(true);
    try {
      const result = await electroview.rpc?.request.listSecrets({
        context: ctx,
      });
      setSecrets(result ?? []);
    } catch (err) {
      console.error("Failed to load secrets:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContexts();
  }, [loadContexts]);

  useEffect(() => {
    if (selectedContext) {
      loadSecrets(selectedContext);
    }
  }, [selectedContext, loadSecrets]);

  const handleSelectContext = (name: string) => {
    setSelectedContext(name);
    setView("secrets");
  };

  const handleBack = () => {
    setSelectedContext(null);
    setSecrets([]);
    setView("contexts");
    loadContexts();
  };

  const handleRefresh = () => {
    if (view === "secrets" && selectedContext) {
      loadSecrets(selectedContext);
    } else {
      loadContexts();
    }
  };

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <Titlebar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          onNavigate={(v: View) => {
            if (v === "contexts") {
              handleBack();
            } else {
              setView(v);
            }
          }}
          view={view}
        />
        <main className="flex-1 overflow-y-auto">
          <MainContent
            contexts={contexts}
            handleBack={handleBack}
            handleRefresh={handleRefresh}
            handleSelectContext={handleSelectContext}
            loading={loading}
            onSearchChange={setSearchQuery}
            searchQuery={searchQuery}
            secrets={secrets}
            selectedContext={selectedContext}
            view={view}
          />
        </main>
      </div>
    </div>
  );
}

function MainContent({
  view,
  selectedContext,
  contexts,
  secrets,
  loading,
  searchQuery,
  onSearchChange,
  handleSelectContext,
  handleBack,
  handleRefresh,
}: {
  view: View;
  selectedContext: string | null;
  contexts: Context[];
  secrets: Secret[];
  loading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  handleSelectContext: (name: string) => void;
  handleBack: () => void;
  handleRefresh: () => void;
}) {
  if (view === "audit") {
    return <AuditView />;
  }

  if (view === "secrets" && selectedContext) {
    return (
      <ContextView
        context={selectedContext}
        loading={loading}
        onBack={handleBack}
        onRefresh={handleRefresh}
        secrets={secrets}
      />
    );
  }

  return (
    <ContextListView
      contexts={contexts}
      loading={loading}
      onRefresh={handleRefresh}
      onSearchChange={onSearchChange}
      onSelect={handleSelectContext}
      searchQuery={searchQuery}
    />
  );
}

function ContextListView({
  contexts,
  loading,
  searchQuery,
  onSearchChange,
  onSelect,
  onRefresh,
}: {
  contexts: Context[];
  loading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelect: (name: string) => void;
  onRefresh: () => void;
}) {
  const filtered = contexts.filter((c) =>
    c.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-xl tracking-tight">Contexts</h1>
          <p className="mt-1 text-muted text-sm">
            {contexts.length} context
            {contexts.length === 1 ? "" : "s"} stored in your keychain
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-lg border border-border px-3 py-1.5 text-muted text-sm transition-colors hover:border-border-hover hover:text-foreground"
            onClick={onRefresh}
            type="button"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      <div className="mb-4">
        <input
          className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-foreground text-sm placeholder:text-muted/60 focus:border-emerald-500/40 focus:outline-none"
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search contexts..."
          type="text"
          value={searchQuery}
        />
      </div>

      <ContextListContent
        filtered={filtered}
        loading={loading}
        onSelect={onSelect}
        searchQuery={searchQuery}
      />
    </div>
  );
}

function ContextListContent({
  loading,
  filtered,
  searchQuery,
  onSelect,
}: {
  loading: boolean;
  filtered: Context[];
  searchQuery: string;
  onSelect: (name: string) => void;
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
            : "Add secrets with the envsec CLI to see them here"
        }
        title={searchQuery ? "No matches" : "No contexts yet"}
      />
    );
  }

  return (
    <div className="grid gap-2">
      {filtered.map((ctx) => (
        <button
          className="group flex items-center justify-between rounded-xl border border-border bg-surface/50 px-5 py-4 text-left transition-all hover:border-border-hover hover:bg-surface"
          key={ctx.name}
          onClick={() => onSelect(ctx.name)}
          type="button"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <svg
                aria-hidden="true"
                fill="none"
                height="16"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="16"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
              </svg>
            </div>
            <div>
              <span className="font-medium font-mono text-sm">{ctx.name}</span>
              <p className="mt-0.5 text-muted text-xs">
                {ctx.count} secret
                {ctx.count === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <svg
            aria-hidden="true"
            className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-400"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      ))}
    </div>
  );
}

export default App;
