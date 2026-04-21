interface Option {
  description: string;
  name: string;
}

export function OptionsList({ options }: { options: Option[] }) {
  return (
    <ul className="mb-4 space-y-1.5 text-muted-foreground text-sm">
      {options.map((opt) => (
        <li className="flex items-baseline gap-2" key={opt.name}>
          <code className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 font-mono text-emerald-400 text-xs">
            {opt.name}
          </code>
          <span className="text-zinc-500">—</span>
          <span>{opt.description}</span>
        </li>
      ))}
    </ul>
  );
}
