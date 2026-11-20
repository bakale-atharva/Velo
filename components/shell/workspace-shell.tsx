"use client";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { CommandCenterProvider } from "@/components/commands/command-center";
import { AppSidebar } from "./app-sidebar";
import { TopBar } from "./top-bar";

/** A flush sidebar ruled off from the work field; the top strip above the work. */
export function WorkspaceShell({
  orgSlug,
  children,
}: {
  orgSlug: string;
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider style={{ "--sidebar-width": "15rem" } as React.CSSProperties}>
      <CommandCenterProvider orgSlug={orgSlug}>
        <AppSidebar orgSlug={orgSlug} />
        <SidebarInset className="min-w-0 bg-background">
          <TopBar orgSlug={orgSlug} />
          <div className="flex min-w-0 flex-1 flex-col">{children}</div>
        </SidebarInset>
      </CommandCenterProvider>
      <Toaster position="bottom-right" />
    </SidebarProvider>
  );
}
