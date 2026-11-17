"use client";

import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { CircleUser, FolderKanban, Layers, Search, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/convex/_generated/api";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { NewTeamDialog } from "@/components/teams/new-team-dialog";

function NavLink({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: typeof Search;
  label: string;
  active: boolean;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={active} render={<Link href={href} />}>
        <Icon aria-hidden />
        <span>{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar({ orgSlug }: { orgSlug: string }) {
  const pathname = usePathname();
  const teams = useQuery(api.teams.list, {});
  const base = `/${orgSlug}`;
  const is = (path: string) => pathname === `${base}${path}` || pathname.startsWith(`${base}${path}/`);

  return (
    <Sidebar>
      <SidebarHeader className="gap-3 px-4 pt-5">
        <span className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] [font-stretch:80%]">
          Velo
        </span>
        <OrganizationSwitcher
          hidePersonal
          afterSelectOrganizationUrl="/:slug/my-issues"
          afterCreateOrganizationUrl="/:slug/my-issues"
          appearance={{
            elements: {
              rootBox: "w-full",
              organizationSwitcherTrigger:
                "w-full justify-between rounded-[2px] px-2 py-1.5 text-white hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white",
              organizationPreviewMainIdentifier: "text-white text-[13px] font-medium",
              organizationSwitcherTriggerIcon: "text-white",
            },
          }}
        />
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarMenu>
            <NavLink href={`${base}/my-issues`} icon={CircleUser} label="My issues" active={is("/my-issues")} />
            <NavLink href={`${base}/projects`} icon={FolderKanban} label="Projects" active={is("/projects")} />
            <NavLink href={`${base}/views`} icon={Layers} label="Views" active={is("/views")} />
            <NavLink href={`${base}/search`} icon={Search} label="Search" active={is("/search")} />
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <div className="flex items-center justify-between pr-1">
            <SidebarGroupLabel className="text-[11px] font-medium tracking-[0.08em] text-sidebar-foreground/80 uppercase">
              Teams
            </SidebarGroupLabel>
            <NewTeamDialog />
          </div>
          <SidebarMenu>
            {teams === undefined ? (
              <>
                <SidebarMenuSkeleton />
                <SidebarMenuSkeleton />
              </>
            ) : teams.length === 0 ? (
              <p className="px-2 py-1 text-xs text-sidebar-foreground/85">
                No teams yet. Create one to start tracking issues.
              </p>
            ) : (
              teams.map((team) => {
                const teamBase = `/team/${team.key}`;
                return (
                  <SidebarMenuItem key={team._id}>
                    <SidebarMenuButton
                      isActive={pathname === `${base}${teamBase}`}
                      render={<Link href={`${base}${teamBase}/issues`} />}
                    >
                      <span className="w-10 shrink-0 text-xs font-semibold tabular-nums">{team.key}</span>
                      <span>{team.name}</span>
                    </SidebarMenuButton>
                    <SidebarMenuSub className="border-sidebar-border">
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          isActive={is(`${teamBase}/issues`)}
                          render={<Link href={`${base}${teamBase}/issues`} />}
                        >
                          Issues
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          isActive={is(`${teamBase}/cycles`)}
                          render={<Link href={`${base}${teamBase}/cycles`} />}
                        >
                          Cycles
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </SidebarMenuItem>
                );
              })
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-2 pb-4">
        <SidebarMenu>
          <NavLink href={`${base}/settings`} icon={Settings} label="Settings" active={is("/settings")} />
        </SidebarMenu>
        <div className="flex items-center justify-between px-2 pt-2">
          <UserButton />
          <span className="text-xs text-sidebar-foreground/85">
            <kbd className="font-sans">⌘K</kbd> commands
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
