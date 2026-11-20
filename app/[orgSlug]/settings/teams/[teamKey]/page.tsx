"use client";

import { useMutation, useQuery } from "convex/react";
import { X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MemberName, MemberOptions } from "@/components/issues/agent-tag";
import { AssigneeAvatar } from "@/components/issues/assignee-avatar";
import { displayName, useWorkspaceLookups } from "@/components/issues/lookups";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { WorkflowStates } from "@/components/settings/workflow-states";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorBoundary } from "@/components/states/error-boundary";
import { PageSkeleton } from "@/components/states/page-skeleton";
import { UpgradePrompt } from "@/components/states/upgrade-prompt";
import { usePermission } from "@/components/views/use-permission";
import { errorMessage } from "@/lib/errors";

function Details({ team, canManage }: { team: Doc<"teams">; canManage: boolean }) {
  const update = useMutation(api.teams.update);
  const plan = useQuery(api.billing.currentPlan, {});
  const [name, setName] = useState(team.name);
  const canBePrivate = plan?.features.includes("private_teams") ?? false;

  const save = (patch: { name?: string; isPrivate?: boolean }) =>
    update({ teamId: team._id, ...patch })
      .then(() => toast.success("Team saved"))
      .catch((error: unknown) =>
        toast.error(errorMessage(error, { FEATURE_NOT_IN_PLAN: "Private teams need the Business plan." })),
      );

  return (
    <SettingsPanel title="Details" description={`Issues in this team read ${team.key}-1, ${team.key}-2… The key can’t change.`}>
      <form
        className="flex flex-wrap items-center gap-2 px-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() !== "" && name !== team.name) void save({ name });
        }}
      >
        <Input
          aria-label="Team name"
          maxLength={80}
          readOnly={!canManage}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-72"
        />
        {canManage && (
          <Button type="submit" variant="outline" disabled={name.trim() === "" || name === team.name}>
            Save name
          </Button>
        )}
      </form>
      <div className="mt-4 grid gap-1 px-3">
        <label className="inline-flex items-center gap-2 text-[15px] font-medium">
          <Checkbox
            checked={team.isPrivate}
            disabled={!canManage || (!team.isPrivate && !canBePrivate)}
            onCheckedChange={(checked) => void save({ isPrivate: checked === true })}
          />
          Private team
        </label>
        {team.isPrivate || canBePrivate ? (
          <span className="pl-6 text-[13px] text-muted-foreground">
            Only members of the team can see its issues. Making it private adds you as a member.
          </span>
        ) : (
          <UpgradePrompt feature="private_teams" compact className="pl-6" />
        )}
      </div>
    </SettingsPanel>
  );
}

function Members({ team, canManage }: { team: Doc<"teams">; canManage: boolean }) {
  const userIds = useQuery(api.teams.listMembers, { teamId: team._id });
  const { members, memberById } = useWorkspaceLookups();
  const add = useMutation(api.teams.addMember);
  const remove = useMutation(api.teams.removeMember);
  const [picked, setPicked] = useState("");
  if (userIds === undefined) return <PageSkeleton rows={3} />;
  const inTeam = new Set(userIds);
  const others = members.filter((m) => !inTeam.has(m.userId));
  const fail = (error: unknown) =>
    toast.error(
      errorMessage(error, { INVALID_INPUT: "A private team needs at least one member." }),
    );

  return (
    <SettingsPanel
      title="Members"
      description={team.isPrivate ? "Only these people can see this team’s issues." : "Members get the team in their sidebar. Anyone in the workspace can see its issues."}
    >
      <ul className="flex flex-col gap-0.5">
        {userIds.map((userId) => {
          const member = memberById.get(userId);
          return (
            <li key={userId} className="flex items-center gap-3 border-b border-border px-2 py-2 hover:bg-tile">
              <AssigneeAvatar member={member} size={24} />
              <MemberName member={member} className="flex-1 text-[15px]" />
              {canManage && (
                <button
                  type="button"
                  aria-label={`Remove ${displayName(member)} from ${team.name}`}
                  onClick={() => remove({ teamId: team._id, userId }).catch(fail)}
                  className="grid size-8 place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-destructive focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <X className="size-4" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {canManage && others.length > 0 && (
        <form
          className="mt-4 flex flex-wrap items-center gap-2 border-t border-border px-3 pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (picked === "") return;
            add({ teamId: team._id, userId: picked })
              .then(() => setPicked(""))
              .catch(fail);
          }}
        >
          <select
            aria-label="Member to add"
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
            className="h-9 w-64 rounded-sm border border-input bg-popover px-2 text-[14px] focus-visible:outline-2 focus-visible:outline-ring"
          >
            <option value="">Choose a member…</option>
            <MemberOptions members={others} />
          </select>
          <Button type="submit" variant="outline" disabled={picked === ""}>
            Add to team
          </Button>
        </form>
      )}
    </SettingsPanel>
  );
}

function Archive({ team, orgSlug }: { team: Doc<"teams">; orgSlug: string }) {
  const archive = useMutation(api.teams.archive);
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  return (
    <SettingsPanel
      title="Archive team"
      description="An archived team leaves the sidebar and takes no new issues. Its issues stay readable."
      actions={
        <Button variant="destructive" onClick={() => setConfirming(true)}>
          Archive {team.key}
        </Button>
      }
    >
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Archive {team.name}?</DialogTitle>
            <DialogDescription>
              Nobody can create issues in it until it’s unarchived. Its issues stay readable.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Keep team
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                archive({ teamId: team._id })
                  .then(() => {
                    toast.success(`Archived ${team.name}`);
                    router.push(`/${orgSlug}/settings/teams`);
                  })
                  .catch((error: unknown) => toast.error(errorMessage(error)))
              }
            >
              Archive team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsPanel>
  );
}

/** Unarchive for anyone who manages teams; permanent delete for org admins. */
function ArchivedTeam({ team, orgSlug, isAdmin }: { team: Doc<"teams">; orgSlug: string; isAdmin: boolean }) {
  const unarchive = useMutation(api.teams.unarchive);
  const remove = useMutation(api.teams.remove);
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <SettingsPanel
        title="Archived"
        description="This team is out of the sidebar and takes no new issues. Unarchive it to use it again."
        actions={
          <Button
            variant="outline"
            onClick={() =>
              unarchive({ teamId: team._id })
                .then(() => toast.success(`Unarchived ${team.name}`))
                .catch((error: unknown) => toast.error(errorMessage(error)))
            }
          >
            Unarchive {team.key}
          </Button>
        }
      />
      {isAdmin && (
        <SettingsPanel
          title="Delete team"
          description="Deletes the team for good: its issues with their comments and activity, its cycles and workflow states. Saved views filtered to it are deleted too. This can’t be undone."
          actions={
            <Button variant="destructive" onClick={() => setDeleting(true)}>
              Delete {team.key}
            </Button>
          }
        >
          <Dialog
            open={deleting}
            onOpenChange={(open) => {
              setDeleting(open);
              if (!open) setTyped("");
            }}
          >
            <DialogContent className="sm:max-w-sm">
              <form
                className="grid gap-4"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (typed.trim() !== team.key) return;
                  setBusy(true);
                  try {
                    await remove({ teamId: team._id, confirmKey: typed.trim() });
                    toast.success(`Deleting ${team.name}`);
                    router.push(`/${orgSlug}/settings/teams`);
                  } catch (error) {
                    toast.error(errorMessage(error));
                    setBusy(false);
                  }
                }}
              >
                <DialogHeader>
                  <DialogTitle>Delete {team.name} for good?</DialogTitle>
                  <DialogDescription>
                    Every issue in {team.key}, with its comments and activity, is deleted. This can’t be undone.
                  </DialogDescription>
                </DialogHeader>
                <label className="data grid gap-1.5 text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
                  Type {team.key} to confirm
                  <Input
                    autoFocus
                    autoComplete="off"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value.toUpperCase())}
                    className="data text-[14px] tracking-normal text-foreground normal-case"
                  />
                </label>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDeleting(false)}>
                    Keep team
                  </Button>
                  <Button type="submit" variant="destructive" disabled={busy || typed.trim() !== team.key}>
                    {busy ? "Deleting…" : "Delete team"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </SettingsPanel>
      )}
    </>
  );
}

function TeamSettings() {
  const { orgSlug, teamKey } = useParams<{ orgSlug: string; teamKey: string }>();
  const team = useQuery(api.teams.get, { key: teamKey });
  const states = useQuery(api.workflowStates.list, team ? { teamId: team._id } : "skip");
  const canManage = usePermission("teams.manage") === true;
  const me = useQuery(api.members.me, {});
  if (team === undefined || states === undefined) {
    return <PageSkeleton rows={6} />;
  }
  return (
    <div className="grid">
      <Link href={`/${orgSlug}/settings/teams`} className="signal-label hover:text-foreground">
        All teams
      </Link>
      <h2 className="mt-3 flex items-baseline gap-3 text-[28px] leading-8 font-semibold tracking-[-0.03em]">
        {team.name} <span className="data text-[13px] font-normal tracking-normal text-muted-foreground">{team.key}</span>
      </h2>
      {!canManage && (
        <EmptyState title="Read only">
          Your role can’t change teams. Ask a workspace admin for the Manage teams permission.
        </EmptyState>
      )}
      <Details key={team._id + team.name} team={team} canManage={canManage && team.archivedAt === null} />
      <Members team={team} canManage={canManage && team.archivedAt === null} />
      <SettingsPanel title="Workflow" description="The states issues move through, in board order.">
        <WorkflowStates teamId={team._id} states={states} canManage={canManage && team.archivedAt === null} />
      </SettingsPanel>
      {canManage && team.archivedAt === null && <Archive team={team} orgSlug={orgSlug} />}
      {canManage && team.archivedAt !== null && (
        <ArchivedTeam team={team} orgSlug={orgSlug} isAdmin={me?.role === "admin"} />
      )}
    </div>
  );
}

export default function TeamSettingsPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSkeleton rows={6} />}>
        <TeamSettings />
      </Suspense>
    </ErrorBoundary>
  );
}
