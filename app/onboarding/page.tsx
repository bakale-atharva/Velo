import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspaceLanding } from "@/components/onboarding/workspace-landing";
import { AuthFrame } from "@/components/shell/auth-frame";

export const metadata: Metadata = { title: "Workspace · Velo" };

/**
 * The landing page after sign-up when no workspace is active: join an
 * invitation, open a workspace, or wait for an invite / create one.
 */
export default function OnboardingPage() {
  return (
    <AuthFrame>
      <Suspense>
        <WorkspaceLanding />
      </Suspense>
    </AuthFrame>
  );
}
