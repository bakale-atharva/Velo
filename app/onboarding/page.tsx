import { OrganizationList } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Choose a workspace · Velo" };

/** Pick or create the organization (workspace) to work in. */
export default function OnboardingPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="grid w-full max-w-md gap-6">
        <div className="border-b-4 border-rule pb-2">
          <h1 className="font-display text-[48px] leading-[48px] font-extrabold tracking-[-0.03em] [font-stretch:80%]">
            Workspace
          </h1>
          <p className="mt-2 text-[13px] text-muted-foreground">
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
    </main>
  );
}
