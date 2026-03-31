export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface">
        <svg
          aria-hidden="true"
          className="h-6 w-6 text-muted"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
          viewBox="0 0 24 24"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
        </svg>
      </div>
      <h3 className="font-medium text-foreground text-sm">{title}</h3>
      <p className="mt-1 text-muted text-xs">{description}</p>
    </div>
  );
}
