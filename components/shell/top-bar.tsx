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
    <div className="@container/top shrink-0 border-b border-rule">
    <div className="flex h-12 items-center gap-2 px-3 @3xl/top:px-6">
      {/* The sidebar turns into a sheet below the md viewport, so its trigger follows the viewport. */}
      <SidebarTrigger aria-label="Open navigation" className="size-9 md:hidden" />
      <nav aria-label="Workspace" className="flex min-w-0 items-center gap-2">
        <Link
          href={`/${orgSlug}/my-issues`}
          className="signal-label hidden hover:text-foreground @xl/top:inline"
        >
          Workspace
        </Link>
        <span aria-hidden className="data hidden text-[12px] text-faint @xl/top:inline">
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
      <div className="ml-auto hidden @xl/top:block">
        <ThemeToggle />
      </div>
      <button
        type="button"
        onClick={() => openPalette()}
        aria-label="Commands"
        className="ml-auto inline-flex h-9 shrink-0 items-center gap-2 border border-rule px-3 text-[13px] hover:border-foreground @xl/top:ml-0 @xl/top:h-8"
      >
        <Command className="size-3.5" aria-hidden />
        <span className="hidden @md/top:inline">Commands</span>
        <kbd className="data hidden text-[11px] text-muted-foreground @xl/top:inline pointer-coarse:hidden">⌘K</kbd>
      </button>
    </div>
    </div>
  );
}
