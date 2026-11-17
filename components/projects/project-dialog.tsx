"use client";

import { useMutation } from "convex/react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AssigneeSelect } from "@/components/issues/fields";
import { useWorkspaceLookups } from "@/components/issues/lookups";
import { fromDateInput, toDateInput } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";
import { PROJECT_STATUSES, type ProjectStatus } from "./project-status";

const fieldClass =
  "h-9 w-full min-w-0 rounded-lg border border-input bg-popover px-2.5 text-[14px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

type Draft = {
  name: string;
  description: string;
  status: ProjectStatus;
  leadId: string | null;
  startDate: string;
  targetDate: string;
};

function draftOf(project: Doc<"projects"> | undefined): Draft {
  return {
    name: project?.name ?? "",
    description: project?.description ?? "",
    status: project?.status ?? "planned",
    leadId: project?.leadId ?? null,
    startDate: toDateInput(project?.startDate ?? null),
    targetDate: toDateInput(project?.targetDate ?? null),
  };
}

/**
 * Creates a project, or edits one when `project` is given. On create it
 * reports the new id so the caller can open it.
 */
export function ProjectDialog({
  project,
  open,
  onOpenChange,
  onCreated,
}: {
  project?: Doc<"projects">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (projectId: Id<"projects">) => void;
}) {
  const create = useMutation(api.projects.create);
  const update = useMutation(api.projects.update);
  const { members } = useWorkspaceLookups();
  const [draft, setDraft] = useState<Draft>(() => draftOf(project));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  function changeOpen(next: boolean) {
    if (next) {
      setDraft(draftOf(project));
      setError(null);
    }
    onOpenChange(next);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (draft.name.trim() === "") return;
    setSaving(true);
    setError(null);
    const fields = {
      name: draft.name,
      description: draft.description,
      status: draft.status,
      leadId: draft.leadId,
      startDate: fromDateInput(draft.startDate),
      targetDate: fromDateInput(draft.targetDate),
    };
    try {
      if (project === undefined) {
        const projectId = await create(fields);
        toast.success(`Created ${draft.name.trim()}`);
        onCreated?.(projectId);
      } else {
        await update({ projectId: project._id, ...fields });
        toast.success("Project saved");
      }
      onOpenChange(false);
    } catch (caught) {
      setError(
        errorMessage(caught, {
          INVALID_INPUT: "Check the name and dates. The target date can’t be before the start date.",
          FORBIDDEN: "Your role can’t change projects. Ask a workspace admin.",
        }),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{project === undefined ? "New project" : "Edit project"}</DialogTitle>
          </DialogHeader>

          <Input
            aria-label="Name"
            autoFocus
            required
            maxLength={120}
            placeholder="Project name"
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            className="h-10 text-base font-medium"
          />
          <Textarea
            aria-label="Description"
            placeholder="What this project delivers (Markdown)"
            rows={4}
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <label htmlFor={`${id}-status`} className="grid gap-1 text-xs font-medium">
              Status
              <select
                id={`${id}-status`}
                className={fieldClass}
                value={draft.status}
                onChange={(e) => set("status", e.target.value as ProjectStatus)}
              >
                {PROJECT_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor={`${id}-lead`} className="grid gap-1 text-xs font-medium">
              Lead
              <AssigneeSelect
                id={`${id}-lead`}
                members={members}
                value={draft.leadId}
                onChange={(v) => set("leadId", v)}
              />
            </label>
            <label htmlFor={`${id}-start`} className="grid gap-1 text-xs font-medium">
              Start date
              <input
                id={`${id}-start`}
                type="date"
                className={`${fieldClass} tabular-nums`}
                value={draft.startDate}
                onChange={(e) => set("startDate", e.target.value)}
              />
            </label>
            <label htmlFor={`${id}-target`} className="grid gap-1 text-xs font-medium">
              Target date
              <input
                id={`${id}-target`}
                type="date"
                className={`${fieldClass} tabular-nums`}
                value={draft.targetDate}
                min={draft.startDate || undefined}
                onChange={(e) => set("targetDate", e.target.value)}
              />
            </label>
          </div>

          {error !== null && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={saving || draft.name.trim() === ""}>
              {saving ? "Saving…" : project === undefined ? "Create project" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
