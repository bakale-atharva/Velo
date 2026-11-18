"use client";

import { useQuery } from "convex/react";
import { ChevronDown, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { activeCount, type IssueFilter, type StateType } from "./filters";
import { displayName, PRIORITY_LABELS, useWorkspaceLookups } from "./lookups";

const STATE_OPTIONS: { value: StateType; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "unstarted", label: "Todo" },
  { value: "started", label: "In progress" },
  { value: "completed", label: "Done" },
  { value: "canceled", label: "Canceled" },
];

type Option<T> = { value: T; label: string; swatch?: string };

/** A trigger naming the field and what is picked, opening a checkbox list. */
function MultiFilter<T extends string | number | null>({
  label,
  options,
  value,
  onChange,
  single = false,
}: {
  label: string;
  options: Option<T>[];
  value: T[];
  onChange: (value: T[]) => void;
  single?: boolean;
}) {
  const picked = options.filter((option) => value.includes(option.value));
  const summary =
    picked.length === 0
      ? null
      : picked.length === 1
        ? picked[0]!.label
        : `${picked.length} selected`;
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={`inline-flex h-8 items-center gap-1.5 border px-2.5 text-[13px] focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ring ${
              picked.length > 0
                ? "inverted border-foreground"
                : "border-rule text-muted-foreground hover:border-foreground hover:text-foreground"
            }`}
          />
        }
      >
        <span className={picked.length > 0 ? "font-normal opacity-75" : ""}>{label}</span>
        {summary !== null && <span className="max-w-32 truncate">{summary}</span>}
        <ChevronDown className="size-3.5 opacity-70" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-80 w-60 overflow-y-auto p-1.5">
        {options.length === 0 ? (
          <p className="p-2 text-xs text-muted-foreground">Nothing to filter by yet.</p>
        ) : (
          <ul aria-label={label}>
            {options.map((option) => {
              const checked = value.includes(option.value);
              return (
                <li key={String(option.value)}>
                  <label className="flex cursor-pointer items-center gap-2.5 px-2 py-1.5 text-[13.5px] hover:bg-muted">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(next) => {
                        if (single) onChange(next ? [option.value] : []);
                        else
                          onChange(
                            next
                              ? [...value, option.value]
                              : value.filter((v) => v !== option.value),
                          );
                      }}
                    />
                    {option.swatch !== undefined && (
                      <span
                        className="size-[7px] shrink-0"
                        style={{ background: option.swatch }}
                        aria-hidden
                      />
                    )}
                    <span className="truncate">{option.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Filter controls for an issue list. Produces an `issueFilter` object (the
 * team is supplied by the page); the caller keeps it, usually in the URL.
 * `teamId` enables the cycle filter, which only makes sense within a team.
 */
export function FilterBar({
  filter,
  onChange,
  teamId,
  actions,
}: {
  filter: IssueFilter;
  onChange: (filter: IssueFilter) => void;
  teamId?: Id<"teams">;
  actions?: React.ReactNode;
}) {
  const { labels, members } = useWorkspaceLookups();
  const projects = useQuery(api.projects.list, {});
  const cycles = useQuery(api.cycles.list, teamId === undefined ? "skip" : { teamId });
  const count = activeCount(filter);
  const set = <K extends keyof IssueFilter>(key: K, value: IssueFilter[K]) => {
    const next = { ...filter, [key]: value };
    const empty = value === undefined || (Array.isArray(value) && value.length === 0);
    if (empty) delete next[key];
    onChange(next);
  };

  return (
    <div
      role="toolbar"
      aria-label="Filters"
      className="flex flex-wrap items-center gap-2"
    >
      <MultiFilter
        label="State"
        options={STATE_OPTIONS}
        value={filter.stateTypes ?? []}
        onChange={(v) => set("stateTypes", v)}
      />
      <MultiFilter
        label="Assignee"
        options={[
          { value: null, label: "Unassigned" },
          ...members.map((m) => ({ value: m.userId, label: displayName(m) })),
        ]}
        value={filter.assigneeIds ?? []}
        onChange={(v) => set("assigneeIds", v)}
      />
      <MultiFilter
        label="Priority"
        options={[1, 2, 3, 4, 0].map((p) => ({ value: p, label: PRIORITY_LABELS[p]! }))}
        value={filter.priorities ?? []}
        onChange={(v) => set("priorities", v)}
      />
      <MultiFilter
        label="Labels"
        options={labels.map((l) => ({ value: l._id, label: l.name, swatch: l.color }))}
        value={filter.labelIds ?? []}
        onChange={(v) => set("labelIds", v)}
      />
      <MultiFilter
        single
        label="Project"
        options={(projects ?? []).map((p) => ({ value: p._id, label: p.name }))}
        value={filter.projectId === undefined ? [] : [filter.projectId]}
        onChange={(v) => set("projectId", v[0])}
      />
      {teamId !== undefined && (
        <MultiFilter
          single
          label="Cycle"
          options={(cycles ?? []).map((c) => ({
            value: c._id,
            label: c.status === "active" ? `${c.name} (current)` : c.name,
          }))}
          value={filter.cycleId === undefined ? [] : [filter.cycleId]}
          onChange={(v) => set("cycleId", v[0])}
        />
      )}
      {count > 0 && (
        <button
          type="button"
          onClick={() => onChange({})}
          className="inline-flex h-8 items-center gap-1.5 px-2 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden />
          Clear
        </button>
      )}
      {actions !== undefined && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
