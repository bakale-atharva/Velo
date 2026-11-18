"use client";

import { useMutation, useQuery } from "convex/react";
import { Trash2 } from "lucide-react";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { ErrorBoundary } from "@/components/states/error-boundary";
import { PageSkeleton } from "@/components/states/page-skeleton";
import { usePermission } from "@/components/views/use-permission";
import { errorMessage } from "@/lib/errors";

const MESSAGES = {
  INVALID_INPUT: "A label with that name already exists, or the name is empty.",
  FORBIDDEN: "Your role can’t change labels. Ask a workspace admin.",
  LIMIT_REACHED: "This workspace has the most labels it can have.",
};

/** One label: colour and name save when you leave the field. */
function LabelRow({ label, canManage }: { label: Doc<"labels">; canManage: boolean }) {
  const update = useMutation(api.labels.update);
  const remove = useMutation(api.labels.remove);
  const [name, setName] = useState(label.name);
  const [color, setColor] = useState(label.color);
  const save = (patch: { name?: string; color?: string }) =>
    update({ labelId: label._id, ...patch }).catch((error: unknown) => {
      toast.error(errorMessage(error, MESSAGES));
      setName(label.name);
      setColor(label.color);
    });

  return (
    <li className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 rounded-[14px] px-3 py-2 hover:bg-tile/60">
      <input
        type="color"
        aria-label={`Colour of ${label.name}`}
        disabled={!canManage}
        value={color}
        onChange={(e) => setColor(e.target.value)}
        onBlur={() => color !== label.color && save({ color })}
        className="size-8 cursor-pointer rounded-[10px] border border-input bg-transparent p-1 disabled:cursor-default"
      />
      <Input
        aria-label="Label name"
        maxLength={40}
        readOnly={!canManage}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          if (name.trim() === "") setName(label.name);
          else if (name !== label.name) void save({ name });
        }}
        className="max-w-sm"
      />
      {canManage ? (
        <button
          type="button"
          aria-label={`Delete ${label.name}`}
          onClick={() =>
            remove({ labelId: label._id })
              .then(() => toast.success(`Deleted ${label.name}`))
              .catch((error: unknown) => toast.error(errorMessage(error, MESSAGES)))
          }
          className="grid size-8 place-items-center rounded-[10px] text-muted-foreground hover:bg-muted hover:text-destructive focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Trash2 className="size-4" />
        </button>
      ) : (
        <span />
      )}
    </li>
  );
}

function Labels() {
  const labels = useQuery(api.labels.list, {});
  const create = useMutation(api.labels.create);
  const canManage = usePermission("labels.manage") === true;
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366d6");
  if (labels === undefined) {
    return <PageSkeleton rows={5} />;
  }

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (name.trim() === "") return;
    try {
      await create({ name, color });
      setName("");
    } catch (error) {
      toast.error(errorMessage(error, MESSAGES));
    }
  }

  return (
    <SettingsPanel
      title="Labels"
      description={
        canManage
          ? "Labels are shared by every team. Deleting one removes it from issues."
          : "Labels are shared by every team. Your role can’t change them."
      }
    >
      {labels.length === 0 ? (
        <p className="px-3 text-[15px] text-muted-foreground">No labels yet.</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {labels.map((label) => (
            <LabelRow key={label._id} label={label} canManage={canManage} />
          ))}
        </ul>
      )}
      {canManage && (
        <form onSubmit={add} className="mt-4 flex flex-wrap items-center gap-2 border-t border-border px-3 pt-4">
          <input
            type="color"
            aria-label="New label colour"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="size-9 cursor-pointer rounded-[10px] border border-input bg-transparent p-1"
          />
          <Input
            aria-label="New label name"
            placeholder="New label, e.g. Security"
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-56"
          />
          <Button type="submit" variant="outline" disabled={name.trim() === ""}>
            Add label
          </Button>
        </form>
      )}
    </SettingsPanel>
  );
}

export default function LabelsSettingsPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSkeleton rows={5} />}>
        <Labels />
      </Suspense>
    </ErrorBoundary>
  );
}
