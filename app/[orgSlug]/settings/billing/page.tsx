"use client";

import { PricingTable, useClerk } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { featureName, planName } from "@/components/settings/plans";
import { SettingsFact, SettingsPanel } from "@/components/settings/settings-panel";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorBoundary } from "@/components/states/error-boundary";
import { PageSkeleton } from "@/components/states/page-skeleton";

/**
 * After checkout Clerk sends the admin back with `?upgraded=1`. Reloading the
 * session refreshes the token's plan claims; Convex already has the new plan
 * from the billing webhook, so the panels above update on their own.
 */
function useReloadAfterCheckout() {
  const clerk = useClerk();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const upgraded = params.get("upgraded") === "1";
  useEffect(() => {
    if (!upgraded || !clerk.loaded) return;
    void clerk.session?.reload().then(() => {
      toast.success("Plan updated");
      router.replace(pathname, { scroll: false });
    });
  }, [upgraded, clerk, router, pathname]);
}

function Billing() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const me = useQuery(api.members.me, {});
  const plan = useQuery(api.billing.currentPlan, {});
  const seats = useQuery(api.billing.seats, {});
  useReloadAfterCheckout();

  if (me === undefined || plan === undefined || seats === undefined) {
    return <PageSkeleton rows={6} />;
  }
  if (me.role !== "admin") {
    return (
      <EmptyState title="Billing is for admins">
        Your workspace is on the {planName(plan.planSlug)} plan. Ask a workspace admin to change it.
      </EmptyState>
    );
  }

  return (
    <div className="grid gap-5">
      <SettingsPanel title="Current plan">
        <dl>
          <SettingsFact label="Plan">{planName(plan.planSlug)}</SettingsFact>
          <SettingsFact label="Seats">
            {seats.used} used{seats.limit === null ? ", no limit" : ` of ${seats.limit}`}
          </SettingsFact>
          <SettingsFact label="Assistant">
            {plan.aiDailyLimit === 0 ? (
              <span className="text-muted-foreground">Not included</span>
            ) : (
              `${plan.aiDailyLimit} requests a day for the workspace`
            )}
          </SettingsFact>
          <SettingsFact label="Features">
            {plan.features.length === 0 ? (
              <span className="text-muted-foreground">Core issue tracking</span>
            ) : (
              <span className="whitespace-normal">{plan.features.map(featureName).join(", ")}</span>
            )}
          </SettingsFact>
        </dl>
      </SettingsPanel>

      <SettingsPanel
        title="Change plan"
        description="Plans are billed per workspace. Changes apply as soon as checkout finishes."
      >
        <div className="max-w-4xl">
          <PricingTable
            for="organization"
            newSubscriptionRedirectUrl={`/${orgSlug}/settings/billing?upgraded=1`}
          />
        </div>
      </SettingsPanel>
    </div>
  );
}

export default function BillingSettingsPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSkeleton rows={6} />}>
        <Billing />
      </Suspense>
    </ErrorBoundary>
  );
}
