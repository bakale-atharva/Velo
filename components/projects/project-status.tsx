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

/** A pill with a dot in the status colour, then its name. */
export function ProjectStatusTag({ status }: { status: ProjectStatus }) {
  return (
    <span className="inline-flex h-7 items-center gap-2 rounded-full border border-rule bg-panel px-3 text-[13px] whitespace-nowrap">
      <span className="size-2 shrink-0 rounded-full" style={{ background: DOT[status] }} aria-hidden />
      {statusLabel(status)}
    </span>
  );
}
