"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { Check, Copy, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { PRIORITY_LABELS, useWorkspaceLookups } from "@/components/issues/lookups";
import { aiErrorMessage } from "./ai-errors";

type Duplicate = { issueId: Id<"issues">; identifier: string; title: string; stateType: string; score: number };

const chip =
  "inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-tile pl-3 pr-1 text-[13px]";
const chipButton =
  "grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring";

function SuggestionChips({ suggestions }: { suggestions: Doc<"aiSuggestions">[] }) {
  const accept = useMutation(api.ai.suggestions.acceptSuggestion);
  const dismiss = useMutation(api.ai.suggestions.dismissSuggestion);
  const { labelById } = useWorkspaceLookups();
  const pending = suggestions.filter(
    (s) => s.status === "pending" && (s.kind === "labels" || s.kind === "priority"),
  );
  if (pending.length === 0) return null;
  const fail = (error: unknown) => toast.error(aiErrorMessage(error));

  return (
    <div className="grid gap-2">
      <h3 className="text-[13px] text-muted-foreground">Suggested</h3>
      <ul className="flex flex-wrap gap-2">
        {pending.map((s) => {
          const label =
            s.kind === "priority"
              ? `Priority: ${PRIORITY_LABELS[s.payload.priority ?? 0]}`
              : `Labels: ${(s.payload.labelIds ?? [])
                  .map((id) => labelById.get(id)?.name)
                  .filter(Boolean)
                  .join(", ")}`;
          return (
            <li key={s._id} className={chip}>
              <Sparkles className="size-3.5 text-muted-foreground" aria-hidden />
              {label}
              <button type="button" aria-label={`Accept ${label}`} className={chipButton} onClick={() => accept({ suggestionId: s._id }).catch(fail)}>
                <Check className="size-3.5" />
              </button>
              <button type="button" aria-label={`Dismiss ${label}`} className={chipButton} onClick={() => dismiss({ suggestionId: s._id }).catch(fail)}>
                <X className="size-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Summary({ issueId, stored }: { issueId: Id<"issues">; stored: string | undefined }) {
  const summarize = useAction(api.ai.suggestions.summarizeIssue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const result = await summarize({ issueId });
      if (!result.ok) setError(aiErrorMessage(result.reason));
    } catch (caught) {
      setError(aiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[13px] text-muted-foreground">Summary</h3>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void run()}>
          {busy ? "Summarizing…" : stored === undefined ? "Summarize" : "Refresh"}
        </Button>
      </div>
      {stored !== undefined && (
        <div className="group relative rounded-[14px] bg-tile p-3 pr-9 text-[14px] leading-6">
          {stored}
          <button
            type="button"
            aria-label="Copy summary"
            onClick={() => void navigator.clipboard.writeText(stored).then(() => toast.success("Copied"))}
            className="absolute top-2 right-2 grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Copy className="size-3.5" />
          </button>
        </div>
      )}
      {error !== null && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
    </div>
  );
}

function Duplicates({ issueId }: { issueId: Id<"issues"> }) {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const find = useAction(api.ai.duplicates.findDuplicates);
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<Duplicate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const result = await find({ issueId });
      if (result.ok) setFound(result.duplicates);
      else setError(aiErrorMessage(result.reason));
    } catch (caught) {
      setError(aiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[13px] text-muted-foreground">Possible duplicates</h3>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void run()}>
          {busy ? "Checking…" : found === null ? "Check" : "Check again"}
        </Button>
      </div>
      {found !== null &&
        (found.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No similar issues found.</p>
        ) : (
          <ul className="grid gap-1">
            {found.map((d) => (
              <li key={d.issueId}>
                <Link
                  href={`/${orgSlug}/issue/${d.identifier}`}
                  className="flex items-center gap-2 rounded-[12px] px-2 py-1.5 text-[14px] hover:bg-tile"
                >
                  <span className="shrink-0 text-[13px] text-muted-foreground tabular-nums">{d.identifier}</span>
                  <span className="min-w-0 flex-1 truncate">{d.title}</span>
                  <span className="text-[12px] text-muted-foreground tabular-nums">{Math.round(d.score * 100)}%</span>
                </Link>
              </li>
            ))}
          </ul>
        ))}
      {error !== null && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
    </div>
  );
}

function Assist({ issueId }: { issueId: Id<"issues"> }) {
  const suggestions = useQuery(api.ai.suggestions.listForIssue, { issueId });
  const summary = suggestions?.find((s) => s.kind === "summary")?.payload.text;
  return (
    <section aria-labelledby="issue-assist" className="panel grid gap-5 p-5">
      <h2 id="issue-assist" className="inline-flex items-center gap-2 text-[15px] font-medium">
        <Sparkles className="size-4" aria-hidden />
        Assistant
      </h2>
      <SuggestionChips suggestions={suggestions ?? []} />
      <Summary issueId={issueId} stored={summary} />
      <Duplicates issueId={issueId} />
    </section>
  );
}

/** Assistant help on an issue page; nothing when the plan lacks the assistant. */
export function IssueAssist({ issueId }: { issueId: Id<"issues"> }) {
  const plan = useQuery(api.billing.currentPlan, {});
  if (plan === undefined || !plan.features.includes("ai_assistant")) return null;
  return <Assist issueId={issueId} />;
}
