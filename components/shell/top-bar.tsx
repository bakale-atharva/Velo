"use client";

import { OrganizationSwitcher } from "@clerk/nextjs";
import { ChevronRight, Command } from "lucide-react";
import Link from "next/link";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useCommandCenter } from "@/components/commands/command-center";

/**
 * The floating bar over the work field: a breadcrumb from the workspace to
 * the active organization (which doubles as the org switcher), and the
 * command palette button on the right.
 */
export function TopBar({ orgSlug }: { orgSlug: string }) {
  const { openPalette } = useCommandCenter();
  return (
    <div className="panel flex h-[68px] shrink-0 items-center gap-2 px-3 md:px-4">
      <SidebarTrigger aria-label="Open navigation" className="md:hidden" />
      <nav aria-label="Workspace" className="flex min-w-0 items-center gap-2">
        <Link
          href={`/${orgSlug}/my-issues`}
          className="hidden h-10 items-center rounded-xl bg-muted px-3.5 text-[15px] text-muted-foreground hover:bg-secondary hover:text-foreground sm:inline-flex"
        >
          Workspace
        </Link>
        <ChevronRight className="hidden size-4 text-muted-foreground sm:block" aria-hidden />
        <OrganizationSwitcher
          hidePersonal
          afterSelectOrganizationUrl="/:slug/my-issues"
          afterCreateOrganizationUrl="/:slug/my-issues"
          appearance={{
            elements: {
              rootBox: "min-w-0",
              organizationSwitcherTrigger:
                "h-10 rounded-xl px-2 text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
              organizationPreviewAvatarBox: "hidden",
              organizationPreviewMainIdentifier: "text-[15px] font-medium text-foreground",
              organizationSwitcherTriggerIcon: "text-muted-foreground",
            },
          }}
        />
      </nav>
      <button
        type="button"
        onClick={() => openPalette()}
        className="iris-ring ml-auto inline-flex h-11 items-center gap-2 rounded-[14px] px-4 text-[15px] font-medium shadow-(--shadow-lift) [--iris-fill:var(--panel)] hover:[--iris-fill:var(--accent)]"
      >
        <Command className="size-4" aria-hidden />
        Commands
        <kbd className="ml-1 hidden rounded-md bg-muted px-1.5 font-sans text-xs text-muted-foreground sm:inline">
          ⌘K
        </kbd>
      </button>
    </div>
  );
}
