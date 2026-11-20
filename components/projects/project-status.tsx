import type { Doc } from "@/convex/_generated/dataModel";

export type ProjectStatus = Doc<"projects">["status"];

export const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: "planned", label: "Planned" },
  { value: "started", label: "In progress" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "canceled", label: "Canceled" },
];

const DOT: Record<ProjectStatus, string> = {
  planned: "var(--state-unstarted)",
  started: "var(--state-started)",
  paused: "var(--state-backlog)",
  completed: "var(--state-completed)",
  canceled: "var(--state-canceled)",
};

export function statusLabel(status: ProjectStatus): string {
  return PROJECT_STATUSES.find((s) => s.value === status)!.label;
}

/** A small square in the status tint, then its name in the data voice. */
export function ProjectStatusTag({ status }: { status: ProjectStatus }) {
  return (
    <span className="data inline-flex items-center gap-2 text-[11px] tracking-[0.1em] whitespace-nowrap uppercase">
      <span className="size-[7px] shrink-0" style={{ background: DOT[status] }} aria-hidden />
      {statusLabel(status)}
    </span>
  );
}
