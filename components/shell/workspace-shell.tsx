"use client";

import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";

/** Ultramarine rail + work field for every page under `/<orgSlug>`. */
export function WorkspaceShell({
  orgSlug,
  children,
}: {
  orgSlug: string;
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar orgSlug={orgSlug} />
      <SidebarInset className="min-w-0">
        <div className="flex h-10 items-center px-4 md:hidden">
          <SidebarTrigger aria-label="Open navigation" />
        </div>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
