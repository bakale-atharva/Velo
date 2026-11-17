/** Name of a group of issues, a short bar in its state colour, and its count. */
export function StateHeading({
  id,
  name,
  count,
  color,
  as: Tag = "h2",
}: {
  id?: string;
  name: string;
  count: number;
  color: string;
  as?: "h2" | "h3";
}) {
  return (
    <Tag id={id} className="flex items-center gap-3 text-[15px] font-medium">
      <span aria-hidden className="h-6 w-[3px] shrink-0 rounded-full" style={{ background: color }} />
      <span className="truncate">{name}</span>
      <span className="grid h-6 min-w-6 place-items-center rounded-md bg-muted px-1.5 text-[13px] font-medium tabular-nums">
        {count}
      </span>
    </Tag>
  );
}

/** Colour for a workflow state type. */
export function stateColor(type: string) {
  return `var(--state-${type})`;
}
