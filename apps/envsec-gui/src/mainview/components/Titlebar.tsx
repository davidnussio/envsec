export function Titlebar() {
  return (
    <div className="electrobun-drag flex h-12 shrink-0 items-center border-border border-b bg-background px-4">
      <div className="w-16" />
      <div className="flex flex-1 items-center justify-center gap-2">
        <svg
          aria-label="Shield"
          className="h-4 w-4 text-emerald-400"
          fill="none"
          role="img"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
        </svg>
        <span className="font-medium font-mono text-sm tracking-tight">
          envsec
        </span>
      </div>
      <div className="w-16" />
    </div>
  );
}
