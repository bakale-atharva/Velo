"use client";

import { useMutation, useQuery } from "convex/react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/errors";
import {
  AssigneeSelect,
  CycleSelect,
  EstimateInput,
  LabelPicker,
  PrioritySelect,
  ProjectSelect,
  StateSelect,
} from "./fields";
import { useWorkspaceLookups } from "./lookups";

type Draft = {
  title: string;
  description: string;
  stateId: Id<"workflowStates"> | "";
  priority: number;
  assigneeId: string | null;
  labelIds: Id<"labels">[];
  estimate: number | null;
  projectId: Id<"projects"> | null;
  cycleId: Id<"cycles"> | null;
};

const EMPTY: Draft = {
  title: "",
  description: "",
  stateId: "",
  priority: 0,
  assigneeId: null,
  labelIds: [],
  estimate: null,
  projectId: null,
  cycleId: null,
};

export function CreateIssueDialog({
  team,
  states,
  open,
  onOpenChange,
  defaultStateId,
  defaultProjectId,
  defaultCycleId,
}: {
  team: Doc<"teams">;
  states: Doc<"workflowStates">[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStateId?: Id<"workflowStates">;
  defaultProjectId?: Id<"projects">;
  defaultCycleId?: Id<"cycles">;
}) {
  const create = useMutation(api.issues.create);
  const { labels, members } = useWorkspaceLookups();
  const projects = useQuery(api.projects.list, open ? {} : "skip");
  const cycles = useQuery(api.cycles.list, open ? { teamId: team._id } : "skip");
  const [draft, setDraft] = useState<Draft>({
    ...EMPTY,
    stateId: defaultStateId ?? "",
    projectId: defaultProjectId ?? null,
    cycleId: defaultCycleId ?? null,
  });
  const [another, setAnother] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (draft.title.trim() === "") return;
    setSaving(true);
    setError(null);
    try {
      const { identifier } = await create({
        teamId: team._id,
        title: draft.title,
        description: draft.description,
        stateId: draft.stateId === "" ? undefined : draft.stateId,
        priority: draft.priority,
        assigneeId: draft.assigneeId,
        labelIds: draft.labelIds,
        estimate: draft.estimate,
        projectId: draft.projectId,
        cycleId: draft.cycleId,
      });
      toast.success(`Created ${identifier}`);
      // Keep state and labels for the next one; clear the text.
      setDraft((d) => ({ ...d, title: "", description: "" }));
      if (!another) onOpenChange(false);
    } catch (caught) {
      setError(errorMessage(caught, { INVALID_INPUT: "Check the title (up to 300 characters) and the fields." }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>
              New issue <span className="font-normal text-muted-foreground">in {team.key}</span>
            </DialogTitle>
          </DialogHeader>

          <Input
            aria-label="Title"
            autoFocus
            required
            maxLength={300}
            placeholder="Issue title"
            value={draft.title}
            onChange={(e) => set("title", e.target.value)}
            className="h-10 text-base font-medium"
          />
          <Textarea
            aria-label="Description"
            placeholder="Description (Markdown)"
            rows={5}
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label htmlFor={`${id}-state`} className="grid gap-1 text-xs font-medium">
              State
              <StateSelect id={`${id}-state`} states={states} value={draft.stateId} onChange={(v) => set("stateId", v)} />
            </label>
            <label htmlFor={`${id}-priority`} className="grid gap-1 text-xs font-medium">
              Priority
              <PrioritySelect id={`${id}-priority`} value={draft.priority} onChange={(v) => set("priority", v)} />
            </label>
            <label htmlFor={`${id}-assignee`} className="grid gap-1 text-xs font-medium">
              Assignee
              <AssigneeSelect
                id={`${id}-assignee`}
                members={members}
                value={draft.assigneeId}
                onChange={(v) => set("assigneeId", v)}
              />
            </label>
            <div className="col-span-2 grid gap-1 text-xs font-medium">
              Labels
              <LabelPicker labels={labels} value={draft.labelIds} onChange={(v) => set("labelIds", v)} />
            </div>
            <label htmlFor={`${id}-estimate`} className="grid gap-1 text-xs font-medium">
              Estimate
              <EstimateInput id={`${id}-estimate`} value={draft.estimate} onChange={(v) => set("estimate", v)} />
            </label>
            <label htmlFor={`${id}-project`} className="grid gap-1 text-xs font-medium">
              Project
              <ProjectSelect
                id={`${id}-project`}
                projects={projects ?? []}
                value={draft.projectId}
                onChange={(v) => set("projectId", v)}
              />
            </label>
            <label htmlFor={`${id}-cycle`} className="grid gap-1 text-xs font-medium">
              Cycle
              <CycleSelect
                id={`${id}-cycle`}
                cycles={cycles ?? []}
                value={draft.cycleId}
                onChange={(v) => set("cycleId", v)}
              />
            </label>
          </div>

          {error !== null && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}

          <DialogFooter className="items-center sm:justify-between">
            <label className="inline-flex items-center gap-2 text-xs">
              <Checkbox checked={another} onCheckedChange={(checked) => setAnother(checked === true)} />
              Create another
            </label>
            <Button type="submit" disabled={saving || draft.title.trim() === ""}>
              {saving ? "Creating…" : "Create issue"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
