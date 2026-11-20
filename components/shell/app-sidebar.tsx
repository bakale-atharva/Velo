"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { ChevronDown, CircleUser, FolderKanban, Layers, Search, Settings, Sparkles } from "lucide-react";
import { useCommandCenter } from "@/components/commands/command-center";
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

/** A shortcut hint in the data voice; it inverts with an active row. */
function Hint({ children }: { children: React.ReactNode }) {
  return <kbd className="data ml-auto hidden text-[11px] opacity-60 sm:inline pointer-coarse:hidden">{children}</kbd>;
}

function NavLink({
  href,
  icon: Icon,
  label,
  active,
  hint,
}: {
  href: string;
  icon: typeof Search;
  label: string;
  active: boolean;
  hint?: string;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={active} render={<Link href={href} />}>
        <Icon aria-hidden className="text-muted-foreground" />
        <span>{label}</span>
        {hint !== undefined && <Hint>{hint}</Hint>}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/** A team as a collapsible group: its name, its key in the data voice, its pages. */
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
          className={`size-3.5! text-muted-foreground transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
        />
        <span>{team.name}</span>
        <span className="data ml-auto text-[11px] text-muted-foreground">{team.key}</span>
      </SidebarMenuButton>
      {open && (
        <SidebarMenuSub>
          {pages.map((page) => {
            const active = pathname === page.href || pathname.startsWith(`${page.href}/`);
            return (
              <SidebarMenuSubItem key={page.href}>
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

/** The signed-in member as one hairline row; the avatar opens account actions. */
function ProfileRow() {
  const { user } = useUser();
  const name = user?.fullName ?? user?.username ?? "Your account";
  const email = user?.primaryEmailAddress?.emailAddress;
  return (
    <div className="flex items-center gap-3 border-t border-sidebar-border px-2 pt-3">
      <UserButton appearance={{ elements: { avatarBox: "size-8 grayscale" } }} />
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium">{name}</p>
        {email !== undefined && <p className="data truncate text-[11px] text-muted-foreground">{email}</p>}
      </div>
    </div>
  );
}

export function AppSidebar({ orgSlug }: { orgSlug: string }) {
  const pathname = usePathname();
  const teams = useQuery(api.teams.list, {});
  const { openAssistant, openPalette } = useCommandCenter();
  const base = `/${orgSlug}`;
  const is = (path: string) => pathname === `${base}${path}` || pathname.startsWith(`${base}${path}/`);

  return (
    <Sidebar>
      <SidebarHeader className="gap-5 px-3 pt-5">
        <Link href={`${base}/my-issues`} className="flex items-center gap-2.5 self-start px-1.5">
          <VeloMark size={18} />
          <span className="text-[17px] leading-none font-semibold tracking-[-0.03em]">Velo</span>
        </Link>
        <button
          type="button"
          onClick={() => openPalette()}
          className="flex h-8 items-center gap-2 border border-sidebar-border px-2.5 text-[13px] text-muted-foreground hover:border-input hover:text-foreground"
        >
          <Search className="size-3.5" aria-hidden />
          Search or jump to…
          <Hint>⌘K</Hint>
        </button>
      </SidebarHeader>

      <SidebarContent className="px-1 pt-3">
        <SidebarGroup>
          <SidebarMenu className="gap-px">
            <NavLink href={`${base}/my-issues`} icon={CircleUser} label="My issues" active={is("/my-issues")} hint="G I" />
            <NavLink href={`${base}/projects`} icon={FolderKanban} label="Projects" active={is("/projects")} hint="G P" />
            <NavLink href={`${base}/views`} icon={Layers} label="Views" active={is("/views")} />
            <NavLink href={`${base}/search`} icon={Search} label="Search" active={is("/search")} hint="/" />
            <SidebarMenuItem>
              <SidebarMenuButton onClick={openAssistant}>
                <Sparkles aria-hidden className="text-muted-foreground" />
                <span>Assistant</span>
                <Hint>⌘J</Hint>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="pt-4">
          <div className="flex items-center justify-between px-2.5 pb-2">
            <span className="signal-label">Teams</span>
            <NewTeamDialog />
          </div>
          <SidebarMenu className="gap-px">
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

      <SidebarFooter className="gap-3 px-2 pb-4">
        <SidebarMenu>
          <NavLink href={`${base}/settings`} icon={Settings} label="Settings" active={is("/settings")} />
        </SidebarMenu>
        <ProfileRow />
      </SidebarFooter>
    </Sidebar>
  );
}
