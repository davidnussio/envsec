interface Option {
  description: string;
  name: string;
}

export const OptionsList = ({ options }: { options: Option[] }) => (
  <ul className="text-muted-foreground mb-4 space-y-1.5 text-sm">
    {options.map((opt) => (
      <li className="flex items-baseline gap-2" key={opt.name}>
        <code className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-emerald-400">
          {opt.name}
        </code>
        <span className="text-zinc-500">—</span>
        <span>{opt.description}</span>
      </li>
    ))}
  </ul>
);
