"use client";

import { useAction, useQuery } from "convex/react";
import { Copy, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Markdown } from "@/components/issues/markdown";
import { aiErrorMessage } from "./ai-errors";

export type ReportKind = "cycle" | "project" | "standup";

const TITLES: Record<ReportKind, string> = {
  cycle: "Cycle summary",
  project: "Project update",
  standup: "Standup digest",
};

/**
 * Generates a Markdown report and shows it with a copy button. `id` is the
 * cycle, project or team id. Uses one assistant request per run.
 */
export function ReportDialog({
  kind,
  id,
  open,
  onOpenChange,
  subject,
}: {
  kind: ReportKind;
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: string;
}) {
  const generate = useAction(api.ai.suggestions.generateReport);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  // Start once, the first time the dialog is open.
  useEffect(() => {
    if (open && !started.current) {
      started.current = true;
      void run();
    }
  });

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const result = await generate({ kind, id });
      if (result.ok) setMarkdown(result.markdown);
      else setError(aiErrorMessage(result.reason));
    } catch (caught) {
      setError(aiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <Sparkles className="size-4" aria-hidden />
            {TITLES[kind]}
          </DialogTitle>
          <DialogDescription>{subject}. Written by the assistant from the issues; check before sharing.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] min-h-32 overflow-y-auto border border-rule p-4" aria-live="polite">
          {busy ? (
            <p role="status" className="signal-label">Writing the report…</p>
          ) : error !== null ? (
            <p role="alert" className="text-[14px] text-destructive">{error}</p>
          ) : markdown !== null ? (
            <Markdown>{markdown}</Markdown>
          ) : null}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={() => void run()}>
            {markdown === null && error === null ? "Generate" : "Regenerate"}
          </Button>
          <Button
            disabled={markdown === null || busy}
            onClick={() => void navigator.clipboard.writeText(markdown ?? "").then(() => toast.success("Copied as Markdown"))}
          >
            <Copy aria-hidden />
            Copy
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** "Generate summary" for a page header; hidden when the plan lacks the assistant. */
export function ReportButton({ kind, id, subject }: { kind: ReportKind; id: string; subject: string }) {
  const plan = useQuery(api.billing.currentPlan, {});
  const [open, setOpen] = useState(false);
  if (plan === undefined || !plan.features.includes("ai_assistant")) return null;
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Sparkles aria-hidden />
        Generate summary
      </Button>
      <ReportDialog kind={kind} id={id} subject={subject} open={open} onOpenChange={setOpen} />
    </>
  );
}
