"use client";

import { useMutation } from "convex/react";
import { Check, Wand2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";

/**
 * A change the assistant proposed, in plain words. Nothing happens until the
 * member applies it; applied cards link to the issues they touched.
 */
export function ProposalCard({ proposal }: { proposal: Doc<"aiProposals"> }) {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const apply = useMutation(api.ai.proposals.apply);
  const reject = useMutation(api.ai.proposals.reject);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(done);
    } catch (error) {
      toast.error(
        errorMessage(error, {
          INVALID_INPUT: "This proposal no longer fits the issue (it may have changed). Ask the assistant again.",
          NOT_FOUND: "An issue in this proposal is gone or no longer visible to you.",
        }),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-label="Proposed change"
      className={`border p-4 ${proposal.status === "pending" ? "border-foreground" : "border-border"}`}
    >
      <h3 className="signal-label inline-flex items-center gap-2">
        <Wand2 className="size-3.5" aria-hidden />
        {proposal.status === "pending"
          ? "Proposed change"
          : proposal.status === "applied"
            ? "Applied"
            : "Dismissed"}
      </h3>
      <ul className="mt-3 grid gap-1.5 text-[14px]">
        {proposal.descriptions.map((line, index) => (
          <li key={index} className={proposal.status === "rejected" ? "text-muted-foreground line-through" : ""}>
            {line}
          </li>
        ))}
      </ul>
      {proposal.status === "pending" && (
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            disabled={busy}
            onClick={() => void run(() => apply({ proposalId: proposal._id }), "Applied")}
          >
            <Check aria-hidden />
            Apply
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void run(() => reject({ proposalId: proposal._id }), "Dismissed")}
          >
            Dismiss
          </Button>
        </div>
      )}
      {proposal.status === "applied" && proposal.appliedIdentifiers.length > 0 && (
        <p className="mt-2 flex flex-wrap gap-2 text-[13px]">
          {proposal.appliedIdentifiers.map((identifier) => (
            <Link
              key={identifier}
              href={`/${orgSlug}/issue/${identifier}`}
              className="data border border-rule px-1.5 py-0.5 text-[12px] text-muted-foreground hover:border-foreground hover:text-foreground"
            >
              {identifier}
            </Link>
          ))}
        </p>
      )}
    </section>
  );
}
