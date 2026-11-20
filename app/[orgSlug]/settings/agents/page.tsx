"use client";

import { useQuery } from "convex/react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { api } from "@/convex/_generated/api";
import { AgentDialog } from "@/components/agents/agent-dialog";
import { agentAsMember, runtimeLabel, sinceLabel, type AgentView } from "@/components/agents/agent-format";
import { AssigneeAvatar } from "@/components/issues/assignee-avatar";
import { useNow } from "@/components/issues/use-now";
import { Button } from "@/components/ui/button";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorBoundary } from "@/components/states/error-boundary";
import { PageSkeleton } from "@/components/states/page-skeleton";

/** Agents in tree order: each top-level agent, then its subagents below it. */
function treeOrder(agents: AgentView[]): { agent: AgentView; depth: number }[] {
  const ids = new Set(agents.map((a) => a._id));
  const children = new Map<string, AgentView[]>();
  for (const agent of agents) {
    // A parent you can't see (or that is gone) makes the agent a root here.
    const parent = agent.parentAgentId !== null && ids.has(agent.parentAgentId) ? agent.parentAgentId : "root";
    children.set(parent, [...(children.get(parent) ?? []), agent]);
  }
  const ordered: { agent: AgentView; depth: number }[] = [];
  const walk = (parent: string, depth: number) => {
    for (const agent of children.get(parent) ?? []) {
      ordered.push({ agent, depth });
      walk(agent._id, depth + 1);
    }
  };
  walk("root", 0);
  return ordered;
}

function Agents() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const router = useRouter();
  const agents = useQuery(api.agents.list, {});
  const teams = useQuery(api.teams.list, { includeArchived: true });
  const me = useQuery(api.members.me, {});
  const canCreate = me?.role === "admin";
  const now = useNow();
  const [creating, setCreating] = useState(false);
  if (agents === undefined || teams === undefined) {
    return <PageSkeleton rows={4} />;
  }
  const teamKey = new Map(teams.map((t) => [t._id, t.key]));
  const open = (agentId: string) => router.push(`/${orgSlug}/settings/agents/${agentId}`);

  return (
    <SettingsPanel
      title="Agents"
      description={
        <>
          AI agents that work in this workspace through MCP. They can be assigned issues and join teams, and use no
          seats. Every change they make is recorded under their name.{" "}
          <a
            href="https://github.com/bakale-atharva/Velo/blob/main/docs/agents-mcp.md"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Setup guide
          </a>
        </>
      }
      actions={
        canCreate ? (
          <Button variant="outline" onClick={() => setCreating(true)}>
            New agent
          </Button>
        ) : undefined
      }
    >
      {agents.length === 0 ? (
        <EmptyState
          title="No agents yet"
          action={
            canCreate ? <Button onClick={() => setCreating(true)}>Create the first agent</Button> : undefined
          }
        >
          {canCreate
            ? "Create an agent, give it a key, and connect it from Claude Code, Claude Desktop or OpenClaw. It can then create its own subagents."
            : "An admin can create agents here. Agents can also create subagents of their own."}
        </EmptyState>
      ) : (
        <ul className="flex flex-col border-t border-border" aria-label="Agents">
          <li
            aria-hidden
            className="signal-label hidden h-9 items-center gap-4 border-b border-border px-2 text-muted-foreground md:flex"
          >
            <span className="flex-1">Agent</span>
            <span className="w-40">Runs on</span>
            <span className="w-16">Role</span>
            <span className="w-28">Teams</span>
            <span className="w-20 text-right">Active</span>
            <span className="w-4" />
          </li>
          {treeOrder(agents).map(({ agent, depth }) => {
            const since = sinceLabel(agent.lastActiveAt, now);
            const disabled = agent.disabledAt !== null;
            return (
              <li key={agent._id}>
                <Link
                  href={`/${orgSlug}/settings/agents/${agent._id}`}
                  className={`group flex h-11 items-center gap-4 border-b border-border px-2 hover:bg-tile focus-visible:bg-foreground focus-visible:text-background focus-visible:outline-none ${disabled ? "text-muted-foreground" : ""}`}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-3" style={{ paddingLeft: depth * 22 }}>
                    {depth > 0 && (
                      <span aria-hidden className="-mr-1 h-5 w-3 shrink-0 border-b border-l border-rule group-focus-visible:border-background/60" />
                    )}
                    <AssigneeAvatar member={agentAsMember(agent)} size={24} />
                    <span className="min-w-0 truncate text-[14px] font-medium">{agent.name}</span>
                    {depth > 0 && <span className="sr-only">, subagent</span>}
                    {disabled && (
                      <span className="data shrink-0 text-[11px] tracking-[0.14em] uppercase">Disabled</span>
                    )}
                  </span>
                  <span className="data hidden w-40 truncate text-[12px] text-muted-foreground group-focus-visible:text-background md:block">
                    {runtimeLabel(agent.runtime)}
                    {agent.model !== null && ` · ${agent.model}`}
                  </span>
                  <span className="data hidden w-16 text-[12px] text-muted-foreground group-focus-visible:text-background md:block">
                    {agent.role}
                  </span>
                  <span className="data hidden w-28 truncate text-[12px] text-muted-foreground group-focus-visible:text-background md:block">
                    {agent.teamIds.map((id) => teamKey.get(id)).filter(Boolean).join(" ") || "—"}
                  </span>
                  <span className="data w-20 text-right text-[12px] text-muted-foreground tabular-nums group-focus-visible:text-background">
                    {since ?? "never"}
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground group-focus-visible:text-background" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <AgentDialog open={creating} onOpenChange={setCreating} onCreated={open} />
    </SettingsPanel>
  );
}

export default function AgentsSettingsPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSkeleton rows={4} />}>
        <Agents />
      </Suspense>
    </ErrorBoundary>
  );
}
