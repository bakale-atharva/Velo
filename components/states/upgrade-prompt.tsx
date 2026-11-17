"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";

export type GatedFeature = "ai_assistant" | "custom_roles" | "audit_log" | "private_teams";

const COPY: Record<GatedFeature, { title: string; body: string; plan: string }> = {
  ai_assistant: {
    title: "The assistant is on paid plans",
    body: "Ask about your workspace, draft issues and get summaries. Every change is shown to you before it applies.",
    plan: "Pro",
  },
  custom_roles: {
    title: "Custom roles are on Business",
    body: "Decide who can delete issues, manage teams or share views.",
    plan: "Business",
  },
  audit_log: {
    title: "The audit log is on Business",
    body: "See who changed teams, roles and sharing, and when. History is kept from today, so it’s there when you upgrade.",
    plan: "Business",
  },
  private_teams: {
    title: "Private teams are on Business",
    body: "Keep a team’s issues visible only to its members.",
    plan: "Business",
  },
};

/** Shown wherever a feature isn't in the workspace's plan. Links to billing. */
export function UpgradePrompt({ feature }: { feature?: GatedFeature }) {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const copy = feature
    ? COPY[feature]
    : { title: "Not in your plan", body: "This is part of a paid plan.", plan: "a paid plan" };
  return (
    <div className="max-w-md border-t-4 border-brand py-6">
      <h2 className="text-xl leading-6 font-semibold">{copy.title}</h2>
      <p className="mt-2 text-[13px] leading-5 text-muted-foreground">{copy.body}</p>
      <Link href={`/${orgSlug}/settings/billing`} className={`${buttonVariants()} mt-4`}>
        See {copy.plan} in Billing
      </Link>
    </div>
  );
}
