"use client";

import { OrganizationSwitcher } from "@clerk/nextjs";
import { Command } from "lucide-react";
import Link from "next/link";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useCommandCenter } from "@/components/commands/command-center";
import { ThemeToggle } from "./theme-toggle";

/**
 * A slim strip over the work field, closed by a hairline: the workspace path
 * (the organization doubles as the switcher) on the left, theme and the
 * command palette on the right.
 */
export function TopBar({ orgSlug }: { orgSlug: string }) {
  const { openPalette } = useCommandCenter();
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-rule px-3 md:px-6">
      <SidebarTrigger aria-label="Open navigation" className="md:hidden" />
      <nav aria-label="Workspace" className="flex min-w-0 items-center gap-2">
        <Link
          href={`/${orgSlug}/my-issues`}
          className="signal-label hidden hover:text-foreground sm:inline"
        >
          Workspace
        </Link>
        <span aria-hidden className="data hidden text-[12px] text-faint sm:inline">
          /
        </span>
        <OrganizationSwitcher
          hidePersonal
          afterSelectOrganizationUrl="/:slug/my-issues"
          afterCreateOrganizationUrl="/:slug/my-issues"
          appearance={{
            elements: {
              rootBox: "min-w-0",
              organizationSwitcherTrigger:
                "h-8 rounded-sm px-2 text-foreground hover:bg-muted focus-visible:outline-1 focus-visible:outline-ring",
              organizationPreviewAvatarBox: "hidden",
              organizationPreviewMainIdentifier: "text-[13.5px] font-medium text-foreground",
              organizationSwitcherTriggerIcon: "text-muted-foreground",
            },
          }}
        />
      </nav>
      <div className="ml-auto hidden sm:block">
        <ThemeToggle />
      </div>
      <button
        type="button"
        onClick={() => openPalette()}
        className="ml-auto inline-flex h-8 items-center gap-2 border border-rule px-3 text-[13px] hover:border-foreground sm:ml-0"
      >
        <Command className="size-3.5" aria-hidden />
        Commands
        <kbd className="data hidden text-[11px] text-muted-foreground sm:inline">⌘K</kbd>
      </button>
    </div>
  );
}
