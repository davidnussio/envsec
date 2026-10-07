import { cn } from "@/lib/utils";

export const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-14 mb-4 text-2xl font-bold tracking-tight">{children}</h2>
);

export const H3 = ({ children }: { children: React.ReactNode }) => (
  <h3 className="mt-8 mb-3 text-lg font-semibold">{children}</h3>
);

export const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-muted-foreground mb-4 leading-relaxed">{children}</p>
);

export const Mono = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-sm text-emerald-400">
    {children}
  </code>
);

export const Strong = ({ children }: { children: React.ReactNode }) => (
  <strong className="text-foreground font-semibold">{children}</strong>
);

export const List = ({ children }: { children: React.ReactNode }) => (
  <ul className="text-muted-foreground mb-4 list-disc space-y-2 pl-6 leading-relaxed marker:text-emerald-400">
    {children}
  </ul>
);

export const OrderedList = ({ children }: { children: React.ReactNode }) => (
  <ol className="text-muted-foreground mb-4 list-decimal space-y-2 pl-6 leading-relaxed marker:text-emerald-400">
    {children}
  </ol>
);

export const ExternalLink = ({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) => (
  <a
    className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300"
    href={href}
    rel="noopener noreferrer"
    target="_blank"
  >
    {children}
  </a>
);

export interface DataTableColumn {
  label: string;
  /** Visually emphasise this column (e.g. the winning variant). */
  highlight?: boolean;
}

interface DataTableProps {
  caption?: string;
  columns: readonly DataTableColumn[];
  rows: readonly (readonly [string, ...string[]])[];
}

/** First column holds row labels; the remaining cells are right-aligned values. */
export const DataTable = ({ caption, columns, rows }: DataTableProps) => (
  <figure className="my-6">
    <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full min-w-[36rem] text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.02]">
            {columns.map((col, i) => (
              <th
                className={cn(
                  "px-4 py-3 font-medium",
                  i === 0 ? "text-left" : "text-right",
                  col.highlight ? "text-emerald-400" : "text-zinc-300"
                )}
                key={col.label}
                scope="col"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, ...values]) => (
            <tr className="border-b border-white/5 last:border-0" key={label}>
              <th
                className="text-muted-foreground px-4 py-2.5 text-left font-normal whitespace-nowrap"
                scope="row"
              >
                {label}
              </th>
              {values.map((value, i) => (
                <td
                  className={cn(
                    "px-4 py-2.5 text-right font-mono whitespace-nowrap tabular-nums",
                    columns[i + 1]?.highlight
                      ? "font-semibold text-emerald-400"
                      : "text-zinc-300"
                  )}
                  key={`${label}-${columns[i + 1]?.label ?? i}`}
                >
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {caption && (
      <figcaption className="mt-2 text-xs text-zinc-500">{caption}</figcaption>
    )}
  </figure>
);

export interface BarDatum {
  label: string;
  value: number;
  /** Short note shown after the value, e.g. the delta from the previous bar. */
  note?: string;
  highlight?: boolean;
}

interface BarChartProps {
  title: string;
  unit: string;
  data: readonly BarDatum[];
  caption?: string;
}

export const BarChart = ({ title, unit, data, caption }: BarChartProps) => {
  const max = Math.max(...data.map((d) => d.value));
  return (
    <figure className="my-6 rounded-lg border border-white/10 bg-zinc-950 p-5">
      <figcaption className="mb-4 text-sm font-medium text-zinc-300">
        {title}
      </figcaption>
      <ul className="space-y-3">
        {data.map((d) => (
          <li
            className="grid grid-cols-1 gap-1 sm:grid-cols-[11rem_1fr] sm:items-center sm:gap-4"
            key={d.label}
          >
            <span className="text-muted-foreground text-sm">{d.label}</span>
            <div className="flex items-center gap-3">
              <div className="h-5 min-w-0 flex-1">
                <div
                  className={cn(
                    "h-full rounded-sm",
                    d.highlight ? "bg-emerald-400" : "bg-zinc-600"
                  )}
                  style={{ width: `${Math.max((d.value / max) * 100, 1)}%` }}
                />
              </div>
              <span
                className={cn(
                  "w-36 shrink-0 font-mono text-sm tabular-nums",
                  d.highlight ? "text-emerald-400" : "text-zinc-300"
                )}
              >
                {d.value} {unit}
                {d.note && <span className="ml-2 text-zinc-500">{d.note}</span>}
              </span>
            </div>
          </li>
        ))}
      </ul>
      {caption && <p className="mt-4 text-xs text-zinc-500">{caption}</p>}
    </figure>
  );
};
