"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { Suspense } from "react";
import { api } from "@/convex/_generated/api";
import { buttonVariants } from "@/components/ui/button";
import { featureName, permissionName, planName } from "@/components/settings/plans";
import { SettingsFact, SettingsPanel } from "@/components/settings/settings-panel";
import { ErrorBoundary } from "@/components/states/error-boundary";
import { PageSkeleton } from "@/components/states/page-skeleton";

function General() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const org = useQuery(api.organizations.current, {});
  const plan = useQuery(api.billing.currentPlan, {});
  const seats = useQuery(api.billing.seats, {});
  const me = useQuery(api.members.me, {});
  const permissions = useQuery(api.members.permissions, {});

  if (org === undefined || plan === undefined || seats === undefined || me === undefined || permissions === undefined) {
    return <PageSkeleton rows={6} />;
  }
  const base = `/${orgSlug}/settings`;

  return (
    <div className="grid gap-5">
      <SettingsPanel
        title="Workspace"
        description="The name, URL and logo are managed with members and invitations."
        actions={
          <Link href={`${base}/members`} className={buttonVariants({ variant: "outline" })}>
            Edit workspace
          </Link>
        }
      >
        <dl>
          <SettingsFact label="Name">{org?.name ?? "Syncing…"}</SettingsFact>
          <SettingsFact label="URL">
            <span className="text-muted-foreground">/</span>
            {org?.slug ?? orgSlug}
          </SettingsFact>
          <SettingsFact label="Members">
            {seats.used}
            {seats.limit === null ? "" : ` of ${seats.limit} seats`}
          </SettingsFact>
        </dl>
      </SettingsPanel>

      <SettingsPanel
        title="Plan"
        actions={
          me.role === "admin" ? (
            <Link href={`${base}/billing`} className={buttonVariants({ variant: "outline" })}>
              Manage billing
            </Link>
          ) : undefined
        }
      >
        <dl>
          <SettingsFact label="Current plan">{planName(plan.planSlug)}</SettingsFact>
          <SettingsFact label="Includes">
            {plan.features.length === 0 ? (
              <span className="text-muted-foreground">Core issue tracking</span>
            ) : (
              plan.features.map(featureName).join(", ")
            )}
          </SettingsFact>
        </dl>
      </SettingsPanel>

      <SettingsPanel title="You" description="What your role lets you do in this workspace.">
        <dl>
          <SettingsFact label="Role">{me.role === "admin" ? "Admin" : "Member"}</SettingsFact>
          <SettingsFact label="Permissions">
            {permissions.length === 0 ? (
              <span className="text-muted-foreground">Create and edit issues and comments</span>
            ) : (
              <span className="whitespace-normal">{permissions.map(permissionName).join(", ")}</span>
            )}
          </SettingsFact>
        </dl>
      </SettingsPanel>
    </div>
  );
}

export default function GeneralSettingsPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSkeleton rows={6} />}>
        <General />
      </Suspense>
    </ErrorBoundary>
  );
}
