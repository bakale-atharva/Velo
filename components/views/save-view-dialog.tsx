"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { IssueFilter } from "@/components/issues/filters";
import { errorMessage } from "@/lib/errors";
import { usePermission } from "./use-permission";

/** Names the current filter and saves it as a view, then opens the view. */
export function SaveViewDialog({
  filter,
  layout,
  orgSlug,
  open,
  onOpenChange,
}: {
  filter: IssueFilter;
  layout: "list" | "board";
  orgSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useMutation(api.savedViews.create);
  const router = useRouter();
  const mayShare = usePermission("views.share");
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (name.trim() === "") return;
    setSaving(true);
    setError(null);
    try {
      const viewId = await create({ name, filter, layout, isShared: mayShare === true && shared });
      toast.success(`Saved view ${name.trim()}`);
      onOpenChange(false);
      setName("");
      router.push(`/${orgSlug}/views/${viewId}`);
    } catch (caught) {
      setError(errorMessage(caught, { LIMIT_REACHED: "You have 200 views. Delete one to save another." }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Save view</DialogTitle>
            <DialogDescription>Keeps these filters under a name in Views.</DialogDescription>
          </DialogHeader>
          <Input
            aria-label="View name"
            autoFocus
            required
            maxLength={80}
            placeholder="e.g. Urgent bugs"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {mayShare === true && (
            <label className="inline-flex items-center gap-2 text-xs">
              <Checkbox checked={shared} onCheckedChange={(checked) => setShared(checked === true)} />
              Share with the workspace
            </label>
          )}
          {error !== null && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={saving || name.trim() === ""}>
              {saving ? "Saving…" : "Save view"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
