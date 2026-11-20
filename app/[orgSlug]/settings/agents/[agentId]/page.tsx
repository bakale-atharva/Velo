"use client";

import { useMutation, useQuery } from "convex/react";
import { ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AgentDialog } from "@/components/agents/agent-dialog";
import { agentAsMember, AGENT_MESSAGES, runtimeLabel, sinceLabel, type AgentView } from "@/components/agents/agent-format";
import { AgentKeys } from "@/components/agents/agent-keys";
import { ConnectPanel } from "@/components/agents/connect-panel";
import { MemberName } from "@/components/issues/agent-tag";
import { AssigneeAvatar } from "@/components/issues/assignee-avatar";
import { useWorkspaceLookups } from "@/components/issues/lookups";
import { useNow } from "@/components/issues/use-now";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SettingsFact, SettingsPanel } from "@/components/settings/settings-panel";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorBoundary } from "@/components/states/error-boundary";
import { PageSkeleton } from "@/components/states/page-skeleton";
import { formatDate } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";

/** Agents below `rootId`, in tree order with their depth below it. */
function subtreeOf(agents: AgentView[], rootId: Id<"agents">) {
  const out: { agent: AgentView; depth: number }[] = [];
  const walk = (parentId: Id<"agents">, depth: number) => {
    for (const child of agents.filter((a) => a.parentAgentId === parentId)) {
      out.push({ agent: child, depth });
      walk(child._id, depth + 1);
    }
  };
  walk(rootId, 0);
  return out;
}

function Profile({ agent, parent }: { agent: AgentView; parent: AgentView | undefined }) {
  const { memberById } = useWorkspaceLookups();
  const now = useNow();
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const creator = memberById.get(agent.createdBy);
  const metadata = Object.entries(agent.metadata);
  return (
    <SettingsPanel title="Profile" description="How this agent appears wherever members are shown.">
      <dl>
        <SettingsFact label="Runs on">
          <span className="data text-[13px]">
            {runtimeLabel(agent.runtime)}
            {agent.model !== null && ` · ${agent.model}`}
          </span>
        </SettingsFact>
        <SettingsFact label="Kind">
          {agent.isMaster ? (
            <span>Master agent: creates and manages its own agents</span>
          ) : (
            <span>
              Created by{" "}
              {parent !== undefined ? (
                <Link
                  href={`/${orgSlug}/settings/agents/${parent._id}`}
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  {parent.name}
                </Link>
              ) : (
                "its master agent"
              )}
              <span className="text-muted-foreground">; can’t create agents</span>
            </span>
          )}
        </SettingsFact>
        <SettingsFact label="Created by">
          <MemberName member={creator} />
          <span className="data ml-3 text-[12px] text-muted-foreground">{formatDate(agent._creationTime)}</span>
        </SettingsFact>
        <SettingsFact label="Last active">
          <span className="data text-[13px] tabular-nums">{sinceLabel(agent.lastActiveAt, now) ?? "never"}</span>
        </SettingsFact>
        <SettingsFact label="User id">
          <span className="data text-[12px] text-muted-foreground select-all">{agent.userId}</span>
        </SettingsFact>
        {metadata.map(([key, value]) => (
          <SettingsFact key={key} label={key}>
            <span className="text-[14px]">{value}</span>
          </SettingsFact>
        ))}
      </dl>
    </SettingsPanel>
  );
}

function Teams({ agent }: { agent: AgentView }) {
  const teams = useQuery(api.teams.list, {});
  const add = useMutation(api.agents.addToTeam);
  const remove = useMutation(api.agents.removeFromTeam);
  const [picked, setPicked] = useState("");
  if (teams === undefined) return null;
  const inTeam = new Set(agent.teamIds);
  const fail = (error: unknown) =>
    toast.error(errorMessage(error, { ...AGENT_MESSAGES, INVALID_INPUT: "A private team needs at least one member." }));
  const others = teams.filter((t) => !inTeam.has(t._id) && t.archivedAt === null);
  return (
    <SettingsPanel
      title="Teams"
      description="Membership decides which private teams the agent can see. Any agent can be assigned issues in public teams."
    >
      {agent.teamIds.length === 0 ? (
        <p className="px-2 text-[14px] text-muted-foreground">Not in any team.</p>
      ) : (
        <ul className="border-t border-border">
          {teams
            .filter((t) => inTeam.has(t._id))
            .map((team) => (
              <li key={team._id} className="flex h-11 items-center gap-4 border-b border-border px-2">
                <span className="data w-12 text-[12px] text-muted-foreground">{team.key}</span>
                <span className="min-w-0 flex-1 truncate text-[14px]">{team.name}</span>
                {agent.canManage && (
                  <button
                    type="button"
                    aria-label={`Remove ${agent.name} from ${team.name}`}
                    onClick={() => remove({ agentId: agent._id, teamId: team._id }).catch(fail)}
                    className="grid size-8 place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-destructive focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </li>
            ))}
        </ul>
      )}
      {agent.canManage && others.length > 0 && (
        <form
          className="mt-4 flex flex-wrap items-center gap-2 border-t border-border px-2 pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (picked === "") return;
            add({ agentId: agent._id, teamId: picked as Id<"teams"> })
              .then(() => setPicked(""))
              .catch(fail);
          }}
        >
          <select
            aria-label="Team to add"
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
            className="h-9 w-64 rounded-sm border border-input bg-popover px-2 text-[14px] focus-visible:outline-2 focus-visible:outline-ring"
          >
            <option value="">Choose a team…</option>
            {others.map((t) => (
              <option key={t._id} value={t._id}>
                {t.key} · {t.name}
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline" disabled={picked === ""}>
            Add to team
          </Button>
        </form>
      )}
    </SettingsPanel>
  );
}

function Subagents({ agent, agents }: { agent: AgentView; agents: AgentView[] }) {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const below = subtreeOf(agents, agent._id);
  return (
    <SettingsPanel
      title="Its agents"
      description="Agents this master created over MCP. It manages them, gives them keys and hands them issues."
    >
      {below.length === 0 ? (
        <p className="px-2 text-[14px] text-muted-foreground">
          None yet. Once connected, ask it to create one, e.g. “create an agent called Reviewer and add it to ENG”.
        </p>
      ) : (
        <ul className="border-t border-border">
          {below.map(({ agent: sub, depth }) => (
            <li key={sub._id}>
              <Link
                href={`/${orgSlug}/settings/agents/${sub._id}`}
                className="group flex h-11 items-center gap-3 border-b border-border px-2 hover:bg-tile focus-visible:bg-foreground focus-visible:text-background focus-visible:outline-none"
              >
                <span className="flex min-w-0 flex-1 items-center gap-3" style={{ paddingLeft: depth * 22 }}>
                  <span aria-hidden className="-mr-1 h-5 w-3 shrink-0 border-b border-l border-rule group-focus-visible:border-background/60" />
                  <AssigneeAvatar member={agentAsMember(sub)} size={22} />
                  <span className="truncate text-[14px]">{sub.name}</span>
                  {sub.disabledAt !== null && (
                    <span className="data text-[11px] tracking-[0.14em] uppercase">Disabled</span>
                  )}
                </span>
                <span className="data text-[12px] text-muted-foreground group-focus-visible:text-background">{sub.role}</span>
                <ChevronRight className="size-4 text-muted-foreground group-focus-visible:text-background" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SettingsPanel>
  );
}

function Danger({ agent, subagentCount }: { agent: AgentView; subagentCount: number }) {
  const disable = useMutation(api.agents.disable);
  const enable = useMutation(api.agents.enable);
  const remove = useMutation(api.agents.remove);
  const router = useRouter();
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const disabled = agent.disabledAt !== null;
  const fail = (error: unknown) =>
    toast.error(
      errorMessage(error, {
        ...AGENT_MESSAGES,
        INVALID_INPUT: "It’s the only member of a private team. Add someone else to that team first.",
      }),
    );
  return (
    <>
      <SettingsPanel
        title={disabled ? "Disabled" : "Disable"}
        description={
          disabled
            ? "Its keys are refused and it can’t manage agents. Its issues and history stay."
            : "Stops every key at once and stops it managing agents, without deleting anything. You can enable it again."
        }
        actions={
          <Button
            variant="outline"
            onClick={() =>
              (disabled ? enable : disable)({ agentId: agent._id })
                .then(() => toast.success(disabled ? `Enabled ${agent.name}` : `Disabled ${agent.name}`))
                .catch(fail)
            }
          >
            {disabled ? "Enable agent" : "Disable agent"}
          </Button>
        }
      />
      <SettingsPanel
        title="Delete agent"
        description={`Deletes the agent${subagentCount > 0 ? ` and the ${subagentCount} agent${subagentCount === 1 ? "" : "s"} it created` : ""}, revokes their keys and unassigns their issues. Their past changes keep their name. This can’t be undone.`}
        actions={
          <Button variant="destructive" onClick={() => setDeleting(true)}>
            Delete {agent.name}
          </Button>
        }
      >
        <Dialog open={deleting} onOpenChange={setDeleting}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete {agent.name}?</DialogTitle>
              <DialogDescription>
                {subagentCount > 0
                  ? `The ${subagentCount} agent${subagentCount === 1 ? " it created is" : "s it created are"} deleted too. `
                  : ""}
                Keys stop working at once. This can’t be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeleting(false)}>
                Keep agent
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await remove({ agentId: agent._id });
                    toast.success(`Deleted ${agent.name}`);
                    router.push(`/${orgSlug}/settings/agents`);
                  } catch (error) {
                    fail(error);
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Deleting…" : "Delete agent"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SettingsPanel>
    </>
  );
}

function AgentSettings() {
  const { orgSlug, agentId } = useParams<{ orgSlug: string; agentId: string }>();
  const agents = useQuery(api.agents.list, {});
  const [editing, setEditing] = useState(false);
  if (agents === undefined) return <PageSkeleton rows={6} />;
  const agent = agents.find((a) => a._id === agentId);
  if (agent === undefined) {
    return (
      <EmptyState
        title="Agent not found"
        action={
          <Link href={`/${orgSlug}/settings/agents`} className="underline underline-offset-2">
            All agents
          </Link>
        }
      >
        It was deleted, or it belongs to another workspace.
      </EmptyState>
    );
  }
  const parent = agents.find((a) => a._id === agent.parentAgentId);
  const subagentCount = subtreeOf(agents, agent._id).length;

  return (
    <div className="grid">
      <Link href={`/${orgSlug}/settings/agents`} className="signal-label hover:text-foreground">
        All agents
      </Link>
      <div className="mt-4 flex max-w-6xl flex-wrap items-center gap-5 border-b border-rule pb-6">
        <AssigneeAvatar member={agentAsMember(agent)} size={64} />
        <div className="min-w-0 flex-1">
          <h2 className="flex flex-wrap items-baseline gap-3 text-[34px] leading-10 font-semibold tracking-[-0.035em]">
            <span className="min-w-0 truncate">{agent.name}</span>
            <span className="data text-[12px] font-normal tracking-[0.14em] text-muted-foreground uppercase">
              {agent.isMaster ? "Master agent" : "Agent"}
              {agent.disabledAt !== null && " · disabled"}
            </span>
          </h2>
          {agent.description !== "" && (
            <p className="mt-1 max-w-[72ch] text-[14px] leading-6 text-muted-foreground">{agent.description}</p>
          )}
        </div>
        {agent.canManage && (
          <Button variant="outline" onClick={() => setEditing(true)}>
            Edit agent
          </Button>
        )}
      </div>
      {!agent.canManage && (
        <div className="py-6">
          <EmptyState title="Read only">
            You can see this agent but not change it. Workspace admins manage every agent, and each master agent
            manages the agents it created.
          </EmptyState>
        </div>
      )}
      <Profile agent={agent} parent={parent} />
      <Teams agent={agent} />
      {agent.isMaster && <Subagents agent={agent} agents={agents} />}
      <AgentKeys agentId={agent._id} canManage={agent.canManage} />
      {agent.canManage && <ConnectPanel runtime={agent.runtime} isMaster={agent.isMaster} />}
      {agent.canManage && <Danger agent={agent} subagentCount={subagentCount} />}
      {agent.canManage && <AgentDialog key={agent._id} agent={agent} open={editing} onOpenChange={setEditing} />}
    </div>
  );
}

export default function AgentSettingsPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSkeleton rows={6} />}>
        <AgentSettings />
      </Suspense>
    </ErrorBoundary>
  );
}
