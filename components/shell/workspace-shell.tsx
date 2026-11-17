"use client";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { CommandCenterProvider } from "@/components/commands/command-center";
import { AppSidebar } from "./app-sidebar";
import { TopBar } from "./top-bar";

/** Floating sidebar and top bar panels on the canvas, the work field below. */
export function WorkspaceShell({
  orgSlug,
  children,
}: {
  orgSlug: string;
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <CommandCenterProvider orgSlug={orgSlug}>
        <AppSidebar orgSlug={orgSlug} />
        <SidebarInset className="min-w-0 bg-background p-3">
          <TopBar orgSlug={orgSlug} />
          <div className="flex min-w-0 flex-1 flex-col">{children}</div>
        </SidebarInset>
      </CommandCenterProvider>
      <Toaster position="bottom-right" />
    </SidebarProvider>
  );
}
