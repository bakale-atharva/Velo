"use client";

import { useMutation, useQuery } from "convex/react";
import { ImageUp, Plus, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/errors";
import { AGENT_MESSAGES, RUNTIMES, type AgentView, type Runtime } from "./agent-format";

const fieldClass =
  "h-9 w-full min-w-0 rounded-sm border border-input bg-popover px-2.5 text-[14px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const MAX_METADATA = 20;

type Draft = {
  name: string;
  description: string;
  imageUrl: string;
  model: string;
  runtime: Runtime;
  teamIds: Id<"teams">[];
  metadata: { key: string; value: string }[];
};

function draftOf(agent: AgentView | undefined): Draft {
  return {
    name: agent?.name ?? "",
    description: agent?.description ?? "",
    // An uploaded photo has a Convex storage URL; only a given URL is editable.
    imageUrl: agent?.imageUrl?.includes("/api/storage/") ? "" : (agent?.imageUrl ?? ""),
    model: agent?.model ?? "",
    runtime: agent?.runtime ?? "claude",
    teamIds: agent?.teamIds ?? [],
    metadata: Object.entries(agent?.metadata ?? {}).map(([key, value]) => ({ key, value })),
  };
}

/** Uploads an image file as the agent's photo. */
export function useAvatarUpload() {
  const generate = useMutation(api.agents.generateAvatarUploadUrl);
  const setAvatar = useMutation(api.agents.setAvatar);
  return async (agentId: Id<"agents">, file: File) => {
    if (!file.type.startsWith("image/") || file.size > MAX_AVATAR_BYTES) {
      throw new Error("Choose an image under 2 MB.");
    }
    const url = await generate({ agentId });
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
    if (!response.ok) throw new Error("The upload failed. Try again.");
    const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
    await setAvatar({ agentId, storageId });
  };
}

/**
 * Creates a master agent (workspace admins only), or edits an agent's
 * profile when `agent` is given. Roles are never chosen here: the backend
 * makes masters admins and the agents they create members.
 */
export function AgentDialog({
  agent,
  open,
  onOpenChange,
  onCreated,
}: {
  agent?: AgentView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (agentId: Id<"agents">) => void;
}) {
  const create = useMutation(api.agents.create);
  const update = useMutation(api.agents.update);
  const upload = useAvatarUpload();
  const teams = useQuery(api.teams.list, {});
  const [draft, setDraft] = useState<Draft>(() => draftOf(agent));
  const [file, setFile] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const id = useId();
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const editing = agent !== undefined;

  function changeOpen(next: boolean) {
    if (next) {
      setDraft(draftOf(agent));
      setFile(null);
      setRemovePhoto(false);
      setError(null);
    }
    onOpenChange(next);
  }

  function setMeta(index: number, field: "key" | "value", value: string) {
    set(
      "metadata",
      draft.metadata.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (draft.name.trim() === "") return;
    setSaving(true);
    setError(null);
    const metadata = Object.fromEntries(
      draft.metadata.filter((row) => row.key.trim() !== "").map((row) => [row.key.trim(), row.value]),
    );
    const profile = {
      name: draft.name,
      description: draft.description,
      model: draft.model.trim() === "" ? null : draft.model,
      runtime: draft.runtime,
      metadata,
    };
    try {
      let agentId: Id<"agents">;
      if (editing) {
        agentId = agent._id;
        // The photo changes only when a file is chosen (uploaded below), the
        // URL was edited, or the photo was removed.
        const urlChanged = draft.imageUrl.trim() !== draftOf(agent).imageUrl;
        await update({
          agentId,
          ...profile,
          ...(file === null && (urlChanged || removePhoto)
            ? { imageUrl: draft.imageUrl.trim() === "" ? null : draft.imageUrl.trim() }
            : {}),
        });
      } else {
        agentId = await create({
          ...profile,
          imageUrl: draft.imageUrl.trim() === "" ? null : draft.imageUrl.trim(),
          teamIds: draft.teamIds,
        });
      }
      if (file !== null) {
        await upload(agentId, file);
      }
      toast.success(editing ? "Agent saved" : `Created ${draft.name.trim()}`);
      onOpenChange(false);
      if (!editing) onCreated?.(agentId);
    } catch (caught) {
      setError(caught instanceof Error && !("data" in caught) ? caught.message : errorMessage(caught, AGENT_MESSAGES));
    } finally {
      setSaving(false);
    }
  }

  const photoName = removePhoto
    ? null
    : (file?.name ?? (agent?.imageUrl?.includes("/api/storage/") ? "Uploaded photo" : null));

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={submit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${agent.name}` : "New agent"}</DialogTitle>
            {!editing && (
              <p className="text-[13.5px] leading-6 text-muted-foreground">
                It can create agents of its own once connected, and hand them issues.
              </p>
            )}
          </DialogHeader>

          <Input
            aria-label="Name"
            autoFocus
            required
            maxLength={80}
            placeholder="Agent name, e.g. Reviewer"
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            className="h-10 text-base font-medium"
          />
          <Textarea
            aria-label="Description"
            placeholder="What this agent does"
            rows={3}
            maxLength={2000}
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
          />

          <fieldset className="grid gap-1.5">
            <legend className="signal-label mb-1.5 text-muted-foreground">Photo</legend>
            <div className="flex flex-wrap items-center gap-2">
              <input
                aria-label="Photo URL"
                type="url"
                inputMode="url"
                placeholder="https://… (or upload)"
                value={draft.imageUrl}
                onChange={(e) => {
                  set("imageUrl", e.target.value);
                  if (e.target.value !== "") setFile(null);
                }}
                className={`${fieldClass} flex-1`}
              />
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(e) => {
                  const picked = e.target.files?.[0] ?? null;
                  setFile(picked);
                  if (picked !== null) {
                    set("imageUrl", "");
                    setRemovePhoto(false);
                  }
                  e.target.value = "";
                }}
              />
              <Button type="button" variant="outline" onClick={() => fileInput.current?.click()}>
                <ImageUp className="size-4" aria-hidden />
                Upload
              </Button>
            </div>
            {photoName !== null && (
              <p className="flex items-center gap-3 text-[12px] text-muted-foreground">
                <span className="data">
                  {photoName}
                  {file !== null && ` · ${Math.ceil(file.size / 1024)} KB`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    set("imageUrl", "");
                    if (editing) setRemovePhoto(true);
                  }}
                  className="underline underline-offset-2 hover:text-foreground focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  Remove photo
                </button>
              </p>
            )}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <label htmlFor={`${id}-runtime`} className="grid gap-1.5">
              <span className="signal-label text-muted-foreground">Runs on</span>
              <select
                id={`${id}-runtime`}
                className={fieldClass}
                value={draft.runtime}
                onChange={(e) => set("runtime", e.target.value as Runtime)}
              >
                {RUNTIMES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor={`${id}-model`} className="grid gap-1.5">
              <span className="signal-label text-muted-foreground">Model</span>
              <input
                id={`${id}-model`}
                placeholder="claude-opus-5-5"
                maxLength={100}
                value={draft.model}
                onChange={(e) => set("model", e.target.value)}
                className={`${fieldClass} font-mono text-[13px]`}
              />
            </label>
          </div>

          {!editing && teams !== undefined && teams.length > 0 && (
            <fieldset>
              <legend className="signal-label mb-2 text-muted-foreground">Teams</legend>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {teams.map((team) => (
                  <label key={team._id} className="flex items-center gap-2 text-[14px]">
                    <Checkbox
                      checked={draft.teamIds.includes(team._id)}
                      onCheckedChange={(next) =>
                        set(
                          "teamIds",
                          next === true
                            ? [...draft.teamIds, team._id]
                            : draft.teamIds.filter((t) => t !== team._id),
                        )
                      }
                    />
                    <span className="data text-[12px] text-muted-foreground">{team.key}</span>
                    {team.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <fieldset className="grid gap-2">
            <legend className="signal-label mb-1 text-muted-foreground">Metadata</legend>
            {draft.metadata.map((row, index) => (
              <div key={index} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_32px] items-center gap-2">
                <input
                  aria-label={`Metadata key ${index + 1}`}
                  placeholder="key"
                  maxLength={40}
                  value={row.key}
                  onChange={(e) => setMeta(index, "key", e.target.value)}
                  className={`${fieldClass} font-mono text-[13px]`}
                />
                <input
                  aria-label={`Metadata value ${index + 1}`}
                  placeholder="value"
                  maxLength={500}
                  value={row.value}
                  onChange={(e) => setMeta(index, "value", e.target.value)}
                  className={fieldClass}
                />
                <button
                  type="button"
                  aria-label={`Remove metadata ${row.key || index + 1}`}
                  onClick={() => set("metadata", draft.metadata.filter((_, i) => i !== index))}
                  className="grid size-8 place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
            {draft.metadata.length < MAX_METADATA && (
              <Button
                type="button"
                variant="ghost"
                className="justify-self-start"
                onClick={() => set("metadata", [...draft.metadata, { key: "", value: "" }])}
              >
                <Plus className="size-4" aria-hidden />
                Add field
              </Button>
            )}
          </fieldset>

          {error !== null && (
            <p role="alert" className="text-[13px] text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={saving || draft.name.trim() === ""}>
              {saving ? "Saving…" : editing ? "Save" : "Create agent"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
