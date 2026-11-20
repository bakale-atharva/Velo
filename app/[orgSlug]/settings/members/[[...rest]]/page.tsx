"use client";

import { OrganizationProfile } from "@clerk/nextjs";
import { useParams } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/states/page-skeleton";

/**
 * Members, invitations and the workspace's name, URL and logo, managed by
 * Clerk. The catch-all route lets Clerk's own sub-pages (e.g. /general)
 * live under this path.
 */
export default function MembersSettingsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  return (
    <Suspense fallback={<PageSkeleton rows={6} />}>
      <div className="max-w-4xl">
        <OrganizationProfile
          routing="path"
          path={`/${orgSlug}/settings/members`}
          afterLeaveOrganizationUrl="/onboarding"
          appearance={{
            elements: {
              rootBox: "w-full",
              cardBox: "w-full max-w-none rounded-none shadow-none border border-rule",
            },
          }}
        />
      </div>
    </Suspense>
  );
}
