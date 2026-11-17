"use client";

import { useMutation } from "convex/react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { fromDateInput, toDateInput } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";
import { cycleRange, DAY, overlapping } from "./cycle-dates";

const fieldClass =
  "h-8 w-full min-w-0 rounded-[2px] border border-input bg-background px-2 text-[13px] tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

const DEFAULT_LENGTH_DAYS = 14;

type Draft = { name: string; start: string; end: string };

function startOfToday(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/** A new cycle starts the day after the team's last one ends, or today. */
function newDraft(cycles: Doc<"cycles">[]): Draft {
  const lastEnd = Math.max(0, ...cycles.map((cycle) => cycle.endsAt));
  const start = Math.max(startOfToday(), lastEnd);
  return {
    name: "",
    start: toDateInput(start),
    end: toDateInput(start + (DEFAULT_LENGTH_DAYS - 1) * DAY),
  };
}

function editDraft(cycle: Doc<"cycles">): Draft {
  return {
    name: cycle.name,
    start: toDateInput(cycle.startsAt),
    end: toDateInput(cycle.endsAt - DAY),
  };
}

/** Creates a cycle for a team, or edits one when `cycle` is given. */
export function CycleDialog({
  team,
  cycles,
  cycle,
  open,
  onOpenChange,
}: {
  team: Doc<"teams">;
  cycles: Doc<"cycles">[];
  cycle?: Doc<"cycles">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useMutation(api.cycles.create);
  const update = useMutation(api.cycles.update);
  const [draft, setDraft] = useState<Draft>(() =>
    cycle === undefined ? newDraft(cycles) : editDraft(cycle),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  const startsAt = fromDateInput(draft.start);
  const lastDay = fromDateInput(draft.end);
  const endsAt = lastDay === null ? null : lastDay + DAY;
  const clash =
    startsAt === null || endsAt === null
      ? undefined
      : overlapping(cycles, startsAt, endsAt, cycle?._id);
  const backwards = startsAt !== null && endsAt !== null && endsAt <= startsAt;
  const valid = startsAt !== null && endsAt !== null && !backwards && clash === undefined;

  function changeOpen(next: boolean) {
    if (next) {
      setDraft(cycle === undefined ? newDraft(cycles) : editDraft(cycle));
      setError(null);
    }
    onOpenChange(next);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || startsAt === null || endsAt === null) return;
    setSaving(true);
    setError(null);
    const name = draft.name.trim() === "" ? undefined : draft.name;
    try {
      if (cycle === undefined) {
        await create({ teamId: team._id, name, startsAt, endsAt });
        toast.success("Cycle created");
      } else {
        await update({ cycleId: cycle._id, name, startsAt, endsAt });
        toast.success("Cycle saved");
      }
      onOpenChange(false);
    } catch (caught) {
      setError(
        errorMessage(caught, {
          INVALID_INPUT:
            "Those dates don’t work. A cycle must end in the future and can’t overlap another cycle.",
          FORBIDDEN: "Your role can’t change cycles. Ask a workspace admin.",
        }),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>
              {cycle === undefined ? "New cycle" : `Edit ${cycle.name}`}{" "}
              <span className="font-normal text-muted-foreground">in {team.key}</span>
            </DialogTitle>
            <DialogDescription>Cycles of a team can’t overlap.</DialogDescription>
          </DialogHeader>

          <label htmlFor={`${id}-name`} className="grid gap-1 text-xs font-medium">
            Name
            <Input
              id={`${id}-name`}
              maxLength={80}
              placeholder={cycle === undefined ? "Cycle N (default)" : cycle.name}
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label htmlFor={`${id}-start`} className="grid gap-1 text-xs font-medium">
              First day
              <input
                id={`${id}-start`}
                type="date"
                required
                className={fieldClass}
                value={draft.start}
                aria-invalid={clash !== undefined || backwards}
                onChange={(e) => setDraft((d) => ({ ...d, start: e.target.value }))}
              />
            </label>
            <label htmlFor={`${id}-end`} className="grid gap-1 text-xs font-medium">
              Last day
              <input
                id={`${id}-end`}
                type="date"
                required
                className={fieldClass}
                value={draft.end}
                min={draft.start || undefined}
                aria-invalid={clash !== undefined || backwards}
                onChange={(e) => setDraft((d) => ({ ...d, end: e.target.value }))}
              />
            </label>
          </div>

          {clash !== undefined && (
            <p role="alert" className="text-xs text-destructive">
              Overlaps {clash.name} ({cycleRange(clash)}). Pick dates outside it.
            </p>
          )}
          {backwards && (
            <p role="alert" className="text-xs text-destructive">
              The last day can’t be before the first day.
            </p>
          )}
          {error !== null && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={saving || !valid}>
              {saving ? "Saving…" : cycle === undefined ? "Create cycle" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
