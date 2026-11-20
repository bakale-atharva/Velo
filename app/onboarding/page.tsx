import { OrganizationList } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthFrame } from "@/components/shell/auth-frame";

export const metadata: Metadata = { title: "Choose a workspace · Velo" };

/** Pick or create the organization (workspace) to work in. */
export default function OnboardingPage() {
  return (
    <AuthFrame>
      <div className="grid w-full max-w-md gap-6">
        <div>
          <h1 className="text-[40px] leading-[1] font-semibold tracking-[-0.04em]">Workspace</h1>
          <p className="mt-3 text-[14px] leading-6 text-muted-foreground">
            Join a workspace you were invited to, or create one for your team.
          </p>
        </div>
        <Suspense>
          <OrganizationList
            hidePersonal
            afterCreateOrganizationUrl="/:slug/my-issues"
            afterSelectOrganizationUrl="/:slug/my-issues"
          />
        </Suspense>
      </div>
    </AuthFrame>
  );
}
