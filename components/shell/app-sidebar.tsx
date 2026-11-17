"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { ChevronDown, CircleUser, FolderKanban, Layers, Search, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
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
import { VeloMark } from "./velo-mark";

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
        <Icon aria-hidden className="text-muted-foreground" />
        <span>{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/** A team as a collapsible group; the active page is marked by a diamond on the rail. */
function TeamGroup({
  team,
  base,
  pathname,
}: {
  team: Doc<"teams">;
  base: string;
  pathname: string;
}) {
  const teamBase = `${base}/team/${team.key}`;
  const [open, setOpen] = useState(true);
  const pages = [
    { href: `${teamBase}/issues`, label: "Issues" },
    { href: `${teamBase}/cycles`, label: "Cycles" },
  ];
  return (
    <SidebarMenuItem>
      <SidebarMenuButton aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <ChevronDown
          aria-hidden
          className={`size-4! transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
        />
        <span>{team.name}</span>
      </SidebarMenuButton>
      {open && (
        <SidebarMenuSub>
          {pages.map((page) => {
            const active = pathname === page.href || pathname.startsWith(`${page.href}/`);
            return (
              <SidebarMenuSubItem key={page.href}>
                {active && (
                  <span
                    aria-hidden
                    className="absolute top-1/2 -left-[22px] size-[11px] -translate-y-1/2 rotate-45 rounded-[2px] border-[1.5px] border-count-teal bg-sidebar"
                  />
                )}
                <SidebarMenuSubButton isActive={active} render={<Link href={page.href} />}>
                  {page.label}
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            );
          })}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}

/** The signed-in member on a soft gradient card; the avatar opens account actions. */
function ProfileCard() {
  const { user } = useUser();
  const name = user?.fullName ?? user?.username ?? "Your account";
  const email = user?.primaryEmailAddress?.emailAddress;
  return (
    <div className="profile-card rounded-[24px] p-2 pt-0 shadow-(--shadow-lift)">
      <div className="px-2 pt-3 pb-3">
        <UserButton
          appearance={{
            elements: {
              avatarBox: "size-14 ring-[3px] ring-white shadow-md",
            },
          }}
        />
      </div>
      <div className="iris-ring rounded-[18px] px-4 py-3 [--iris-fill:var(--popover)]">
        <p className="truncate text-[16px] font-semibold">{name}</p>
        {email !== undefined && <p className="truncate text-[13px] text-muted-foreground">{email}</p>}
      </div>
    </div>
  );
}

export function AppSidebar({ orgSlug }: { orgSlug: string }) {
  const pathname = usePathname();
  const teams = useQuery(api.teams.list, {});
  const base = `/${orgSlug}`;
  const is = (path: string) => pathname === `${base}${path}` || pathname.startsWith(`${base}${path}/`);

  return (
    <Sidebar variant="floating">
      <SidebarHeader className="gap-6 px-5 pt-6">
        <Link href={`${base}/my-issues`} className="flex items-center gap-2.5 self-start rounded-lg">
          <VeloMark />
          <span className="text-[22px] leading-none font-semibold tracking-[-0.02em]">Velo</span>
        </Link>
        <Link
          href={`${base}/search`}
          className="flex h-11 items-center gap-2.5 rounded-xl bg-muted px-3.5 text-[15px] text-muted-foreground hover:bg-secondary"
        >
          <Search className="size-[18px]" aria-hidden />
          Search…
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 pt-4">
        <SidebarGroup>
          <SidebarMenu className="gap-1">
            <NavLink href={`${base}/my-issues`} icon={CircleUser} label="My issues" active={is("/my-issues")} />
            <NavLink href={`${base}/projects`} icon={FolderKanban} label="Projects" active={is("/projects")} />
            <NavLink href={`${base}/views`} icon={Layers} label="Views" active={is("/views")} />
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <div className="flex items-center justify-between px-2.5 pb-1">
            <span className="text-[13px] font-medium text-muted-foreground">Teams</span>
            <NewTeamDialog />
          </div>
          <SidebarMenu className="gap-1">
            {teams === undefined ? (
              <>
                <SidebarMenuSkeleton />
                <SidebarMenuSkeleton />
              </>
            ) : teams.length === 0 ? (
              <p className="px-2.5 py-1 text-[13px] text-muted-foreground">
                No teams yet. Create one to start tracking issues.
              </p>
            ) : (
              teams.map((team) => <TeamGroup key={team._id} team={team} base={base} pathname={pathname} />)
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-3 px-3 pb-4">
        <SidebarMenu>
          <NavLink href={`${base}/settings`} icon={Settings} label="Settings" active={is("/settings")} />
        </SidebarMenu>
        <ProfileCard />
      </SidebarFooter>
    </Sidebar>
  );
}
