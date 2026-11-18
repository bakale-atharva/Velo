"use client";

import { useMutation, useQuery } from "convex/react";
import { Plus } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useId, useState } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/errors";

const KEY_PATTERN = /^[A-Z]{2,5}$/;

/** "Mobile Platform" → "MP", "Engineering" → "ENG". */
export function suggestKey(name: string): string {
  const words = name.toUpperCase().match(/[A-Z]+/g) ?? [];
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 3);
  return words.map((word) => word[0]).join("").slice(0, 5);
}

const MESSAGES = {
  FORBIDDEN: "Only admins can create teams.",
  INVALID_INPUT: "That key is taken or not 2–5 capital letters.",
  FEATURE_NOT_IN_PLAN: "Private teams need the Business plan.",
  LIMIT_REACHED: "This workspace has reached its team limit.",
};

/** `trigger` replaces the sidebar's small plus button, e.g. with a labelled button. */
export function NewTeamDialog({ trigger }: { trigger?: React.ReactElement } = {}) {
  const router = useRouter();
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const createTeam = useMutation(api.teams.create);
  const plan = useQuery(api.billing.currentPlan, {});
  const canBePrivate = plan?.features.includes("private_teams") ?? false;

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyEdited, setKeyEdited] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const ids = { name: useId(), key: useId(), keyHint: useId(), error: useId() };

  const shownKey = keyEdited ? key : suggestKey(name);
  const keyValid = KEY_PATTERN.test(shownKey);

  function reset() {
    setName("");
    setKey("");
    setKeyEdited(false);
    setIsPrivate(false);
    setError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!keyValid || name.trim() === "") return;
    setSaving(true);
    setError(null);
    try {
      await createTeam({ name, key: shownKey, isPrivate });
      setOpen(false);
      reset();
      router.push(`/${orgSlug}/team/${shownKey}/issues`);
    } catch (caught) {
      setError(errorMessage(caught, MESSAGES));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      {trigger !== undefined ? (
        <DialogTrigger render={trigger} />
      ) : (
        <DialogTrigger
          render={
            <button
              type="button"
              aria-label="New team"
              className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-sidebar-ring"
            />
          }
        >
          <Plus className="size-4" aria-hidden />
        </DialogTrigger>
      )}
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>New team</DialogTitle>
            <DialogDescription>
              A team has its own issues, workflow and cycles. Its key starts every issue id.
            </DialogDescription>
          </DialogHeader>

          <label htmlFor={ids.name} className="grid gap-1 text-xs font-medium">
            Name
            <Input
              id={ids.name}
              autoFocus
              required
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Engineering"
            />
          </label>

          <label htmlFor={ids.key} className="grid gap-1 text-xs font-medium">
            Key
            <Input
              id={ids.key}
              value={shownKey}
              maxLength={5}
              aria-invalid={shownKey !== "" && !keyValid}
              aria-describedby={ids.keyHint}
              onChange={(event) => {
                setKeyEdited(true);
                setKey(event.target.value.toUpperCase().replace(/[^A-Z]/g, ""));
              }}
              className="w-28 font-semibold tracking-[0.04em]"
            />
            <span id={ids.keyHint} className="font-normal text-muted-foreground">
              2–5 capital letters. Issues will read {keyValid ? shownKey : "KEY"}-1, {keyValid ? shownKey : "KEY"}-2…
            </span>
          </label>

          <div className="grid gap-1 text-xs">
            <label className="inline-flex items-center gap-2 font-medium">
              <Checkbox
                checked={isPrivate}
                disabled={!canBePrivate}
                onCheckedChange={(checked) => setIsPrivate(checked === true)}
              />
              Private team
            </label>
            <span className="pl-6 text-muted-foreground">
              {canBePrivate
                ? "Only members of the team can see its issues."
                : "Private teams are part of the Business plan."}
            </span>
          </div>

          {error !== null && (
            <p id={ids.error} role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={saving || !keyValid || name.trim() === ""}>
              {saving ? "Creating…" : "Create team"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
