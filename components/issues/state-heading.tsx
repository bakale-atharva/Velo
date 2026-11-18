const STAGES = ["backlog", "unstarted", "started", "completed"] as const;

/**
 * Where an issue is in its life, as a fixed-scale five-cell gauge in the
 * state's muted tint: backlog fills one cell, unstarted two, started three,
 * completed all five. Canceled is one struck cell. Same width on every row,
 * so progress compares at a glance without reading the state name.
 */
export function StageGauge({ type, className = "" }: { type: string; className?: string }) {
  const index = STAGES.indexOf(type as (typeof STAGES)[number]);
  const filled = type === "completed" ? 5 : index + 1;
  const canceled = type === "canceled";
  return (
    <span role="img" aria-label={stateLabel(type)} className={`inline-flex shrink-0 gap-[2px] ${className}`}>
      {[0, 1, 2, 3, 4].map((cell) => (
        <span
          key={cell}
          className="h-[7px] w-[9px]"
          style={{
            background:
              canceled && cell === 0
                ? `repeating-linear-gradient(135deg, ${stateColor(type)} 0 1px, transparent 1px 3px)`
                : cell < filled
                  ? stateColor(type)
                  : "var(--chip)",
            boxShadow: canceled && cell === 0 ? `inset 0 0 0 1px ${stateColor(type)}` : undefined,
          }}
        />
      ))}
    </span>
  );
}

/** A group label in the data voice: NAME / 04, with the state's gauge. */
export function StateHeading({
  id,
  name,
  count,
  type,
  as: Tag = "h2",
}: {
  id?: string;
  name: string;
  count: number;
  /** The workflow state type; drives the tint. Omit for non-state groups. */
  type?: string;
  /** Kept for callers that still pass a colour; the type wins. */
  color?: string;
  as?: "h2" | "h3";
}) {
  return (
    <Tag id={id} className="signal-label flex items-center gap-3">
      {type !== undefined && <StageGauge type={type} />}
      <span className="truncate text-foreground">{name}</span>
      <span aria-label={`${count} issues`}>/ {String(count).padStart(2, "0")}</span>
    </Tag>
  );
}

/** Colour for a workflow state type. */
export function stateColor(type: string) {
  return `var(--state-${type})`;
}

function stateLabel(type: string) {
  return (
    { backlog: "Backlog", unstarted: "Not started", started: "In progress", completed: "Done", canceled: "Canceled" }[
      type
    ] ?? type
  );
}
