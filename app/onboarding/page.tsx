import { OrganizationList } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Choose a workspace · Velo" };

/** Pick or create the organization (workspace) to work in. */
export default function OnboardingPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="grid w-full max-w-md gap-6">
        <div>
          <h1 className="flex items-center gap-3 text-[36px] leading-10 font-semibold tracking-[-0.02em]">
            <span aria-hidden className="size-[18px] rounded-full border-2 border-count-teal" />
            Workspace
          </h1>
          <p className="mt-2 text-[15px] text-muted-foreground">
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
