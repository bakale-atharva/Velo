"use client";

import { Check, Tags } from "lucide-react";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { displayName, PRIORITY_LABELS, type Member } from "./lookups";

// Issue property controls shared by the create dialog and the detail panel.
// Native selects keep them fast, accessible and fully keyboard-driven.

const selectClass =
  "h-9 w-full min-w-0 rounded-lg border border-input bg-popover px-2.5 text-[14px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function StateSelect({
  states,
  value,
  onChange,
  id,
}: {
  states: Doc<"workflowStates">[];
  value: Id<"workflowStates"> | "";
  onChange: (value: Id<"workflowStates">) => void;
  id?: string;
}) {
  return (
    <select id={id} className={selectClass} value={value} onChange={(e) => onChange(e.target.value as Id<"workflowStates">)}>
      {value === "" && <option value="">Default state</option>}
      {states.map((state) => (
        <option key={state._id} value={state._id}>
          {state.name}
        </option>
      ))}
    </select>
  );
}

export function PrioritySelect({
  value,
  onChange,
  id,
}: {
  value: number;
  onChange: (value: number) => void;
  id?: string;
}) {
  return (
    <select id={id} className={selectClass} value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {[0, 1, 2, 3, 4].map((priority) => (
        <option key={priority} value={priority}>
          {PRIORITY_LABELS[priority]}
        </option>
      ))}
    </select>
  );
}

export function AssigneeSelect({
  members,
  value,
  onChange,
  id,
}: {
  members: Member[];
  value: string | null;
  onChange: (value: string | null) => void;
  id?: string;
}) {
  return (
    <select
      id={id}
      className={selectClass}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
    >
      <option value="">Unassigned</option>
      {members.map((member) => (
        <option key={member.userId} value={member.userId}>
          {displayName(member)}
        </option>
      ))}
    </select>
  );
}

export function EstimateInput({
  value,
  onChange,
  id,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  id?: string;
}) {
  return (
    <input
      id={id}
      type="number"
      min={0}
      step={1}
      inputMode="numeric"
      placeholder="—"
      className={`${selectClass} tabular-nums`}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : Math.max(0, Number(e.target.value)))}
    />
  );
}

export function ProjectSelect({
  projects,
  value,
  onChange,
  id,
}: {
  projects: Doc<"projects">[];
  value: Id<"projects"> | null;
  onChange: (value: Id<"projects"> | null) => void;
  id?: string;
}) {
  // Finished projects are hidden unless the issue is already in one.
  const choices = projects.filter(
    (project) =>
      project._id === value || (project.status !== "completed" && project.status !== "canceled"),
  );
  return (
    <select
      id={id}
      className={selectClass}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : (e.target.value as Id<"projects">))}
    >
      <option value="">No project</option>
      {choices.map((project) => (
        <option key={project._id} value={project._id}>
          {project.name}
        </option>
      ))}
    </select>
  );
}

export function CycleSelect({
  cycles,
  value,
  onChange,
  id,
}: {
  cycles: Doc<"cycles">[];
  value: Id<"cycles"> | null;
  onChange: (value: Id<"cycles"> | null) => void;
  id?: string;
}) {
  // Completed cycles take no new issues; keep the current one visible.
  const choices = cycles
    .filter((cycle) => cycle._id === value || cycle.status !== "completed")
    .sort((a, b) => a.startsAt - b.startsAt);
  return (
    <select
      id={id}
      className={selectClass}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : (e.target.value as Id<"cycles">))}
    >
      <option value="">No cycle</option>
      {choices.map((cycle) => (
        <option key={cycle._id} value={cycle._id} disabled={cycle.status === "completed"}>
          {cycle.name}
          {cycle.status === "active" ? " (current)" : ""}
        </option>
      ))}
    </select>
  );
}

export function LabelPicker({
  labels,
  value,
  onChange,
}: {
  labels: Doc<"labels">[];
  value: Id<"labels">[];
  onChange: (value: Id<"labels">[]) => void;
}) {
  const selected = new Set(value);
  const names = labels.filter((label) => selected.has(label._id)).map((label) => label.name);
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button type="button" className={`${selectClass} flex items-center gap-2 text-left`} />
        }
      >
        <Tags className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate">{names.length === 0 ? "No labels" : names.join(", ")}</span>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-1">
        {labels.length === 0 ? (
          <p className="p-2 text-xs text-muted-foreground">No labels yet. Admins add them in Settings → Labels.</p>
        ) : (
          <ul>
            {labels.map((label) => (
              <li key={label._id}>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] hover:bg-muted">
                  <Checkbox
                    checked={selected.has(label._id)}
                    onCheckedChange={(checked) =>
                      onChange(checked ? [...value, label._id] : value.filter((id) => id !== label._id))
                    }
                  />
                  <span className="size-2 rounded-full" style={{ background: label.color }} aria-hidden />
                  {label.name}
                  {selected.has(label._id) && <Check className="ml-auto size-3.5" aria-hidden />}
                </label>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
