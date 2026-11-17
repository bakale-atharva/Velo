"use client";

import { useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  CircleDot,
  FileText,
  Flag,
  Plus,
  Tag,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { displayName, PRIORITY_LABELS, useWorkspaceLookups } from "@/components/issues/lookups";
import { errorMessage } from "@/lib/errors";

export type PaletteMode = "all" | "state" | "assignee" | "priority" | "labels";

type Item = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
  run: () => void;
};

const PLACEHOLDER: Record<PaletteMode, string> = {
  all: "Type a command or search issues…",
  state: "Change state to…",
  assignee: "Assign to…",
  priority: "Set priority to…",
  labels: "Add or remove a label…",
};

function matches(item: Item, query: string): boolean {
  const q = query.trim().toLowerCase();
  return q === "" || item.label.toLowerCase().includes(q);
}

function Group({ heading, items, query }: { heading: string; items: Item[]; query: string }) {
  const shown = items.filter((item) => matches(item, query));
  if (shown.length === 0) return null;
  return (
    <CommandGroup heading={heading}>
      {shown.map((item) => (
        <CommandItem key={item.id} value={item.id} onSelect={item.run}>
          <item.icon className="text-muted-foreground" />
          <span className="truncate">{item.label}</span>
          {item.hint !== undefined && <CommandShortcut>{item.hint}</CommandShortcut>}
        </CommandItem>
      ))}
    </CommandGroup>
  );
}

/** Commands for one issue: state, assignee, priority, labels. */
function useIssueCommands(identifier: string | undefined, close: () => void) {
  const issue = useQuery(api.issues.get, identifier === undefined ? "skip" : { identifier });
  const states = useQuery(api.workflowStates.list, issue ? { teamId: issue.teamId } : "skip");
  const { members, labels } = useWorkspaceLookups();
  const update = useMutation(api.issues.update);
  if (issue === undefined || states === undefined) {
    return { issue: undefined, state: [], assignee: [], priority: [], labels: [] };
  }
  const apply = (patch: Parameters<typeof update>[0], done: string) => () => {
    close();
    update(patch)
      .then(() => toast.success(`${issue.identifier}: ${done}`))
      .catch((error: unknown) => toast.error(errorMessage(error)));
  };
  const issueId = issue._id;
  return {
    issue,
    state: states
      .filter((s) => s._id !== issue.stateId)
      .map<Item>((s) => ({
        id: `state:${s._id}`,
        label: `Change state to ${s.name}`,
        icon: CircleDot,
        run: apply({ issueId, stateId: s._id }, s.name),
      })),
    assignee: [
      ...(issue.assigneeId === null
        ? []
        : [{ id: "assign:none", label: "Unassign", icon: UserRound, run: apply({ issueId, assigneeId: null }, "unassigned") }]),
      ...members
        .filter((m) => m.userId !== issue.assigneeId)
        .map<Item>((m) => ({
          id: `assign:${m.userId}`,
          label: `Assign to ${displayName(m)}`,
          icon: UserRound,
          run: apply({ issueId, assigneeId: m.userId }, `assigned to ${displayName(m)}`),
        })),
    ],
    priority: [1, 2, 3, 4, 0]
      .filter((p) => p !== issue.priority)
      .map<Item>((p) => ({
        id: `priority:${p}`,
        label: `Set priority to ${PRIORITY_LABELS[p]}`,
        icon: Flag,
        run: apply({ issueId, priority: p }, PRIORITY_LABELS[p]!),
      })),
    labels: labels.map<Item>((l) => {
      const has = issue.labelIds.includes(l._id);
      return {
        id: `label:${l._id}`,
        label: `${has ? "Remove" : "Add"} label ${l.name}`,
        icon: Tag,
        run: apply(
          {
            issueId,
            labelIds: has ? issue.labelIds.filter((id) => id !== l._id) : [...issue.labelIds, l._id],
          },
          `${has ? "removed" : "added"} ${l.name}`,
        ),
      };
    }),
  };
}

function PaletteBody({
  orgSlug,
  mode,
  identifier,
  close,
  onCreateIssue,
}: {
  orgSlug: string;
  mode: PaletteMode;
  identifier: string | undefined;
  close: () => void;
  onCreateIssue: (teamId?: Id<"teams">) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const teams = useQuery(api.teams.list, {});
  const commands = useIssueCommands(identifier, close);
  const search = query.trim();
  const hits = useQuery(
    api.search.issues,
    mode === "all" && search.length >= 2 ? { query: search } : "skip",
  );
  const go = (href: string) => () => {
    close();
    router.push(href);
  };
  const base = `/${orgSlug}`;
  const active = (teams ?? []).filter((t) => t.archivedAt === null);

  const issueGroups: { heading: string; items: Item[]; mode: PaletteMode }[] =
    commands.issue === undefined
      ? []
      : [
          { heading: "State", items: commands.state, mode: "state" },
          { heading: "Assignee", items: commands.assignee, mode: "assignee" },
          { heading: "Priority", items: commands.priority, mode: "priority" },
          { heading: "Labels", items: commands.labels, mode: "labels" },
        ];

  return (
    <Command shouldFilter={false}>
      <CommandInput
        placeholder={
          commands.issue !== undefined && mode !== "all"
            ? `${commands.issue.identifier}: ${PLACEHOLDER[mode]}`
            : PLACEHOLDER[mode]
        }
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {mode !== "all" && commands.issue === undefined
            ? "Open or select an issue first."
            : "No matching commands."}
        </CommandEmpty>
        {issueGroups
          .filter((g) => mode === "all" || g.mode === mode)
          .map((g) => (
            <Group
              key={g.heading}
              heading={`${commands.issue!.identifier} · ${g.heading}`}
              items={g.items}
              query={query}
            />
          ))}
        {mode === "all" && (
          <>
            <Group
              heading="Create"
              query={query}
              items={active.map((t) => ({
                id: `create:${t._id}`,
                label: `New issue in ${t.name}`,
                icon: Plus,
                hint: t.key,
                run: () => {
                  close();
                  onCreateIssue(t._id);
                },
              }))}
            />
            {hits !== undefined && hits.length > 0 && (
              <Group
                heading="Issues"
                query=""
                items={hits.slice(0, 8).map((issue) => ({
                  id: `issue:${issue._id}`,
                  label: `${issue.identifier} ${issue.title}`,
                  icon: FileText,
                  run: go(`${base}/issue/${issue.identifier}`),
                }))}
              />
            )}
            <Group
              heading="Go to"
              query={query}
              items={[
                { id: "nav:my", label: "My issues", icon: ArrowRight, hint: "G I", run: go(`${base}/my-issues`) },
                { id: "nav:projects", label: "Projects", icon: ArrowRight, hint: "G P", run: go(`${base}/projects`) },
                { id: "nav:views", label: "Views", icon: ArrowRight, run: go(`${base}/views`) },
                { id: "nav:search", label: "Search", icon: ArrowRight, hint: "/", run: go(`${base}/search`) },
                { id: "nav:settings", label: "Settings", icon: ArrowRight, run: go(`${base}/settings`) },
              ]}
            />
            <Group
              heading="Teams"
              query={query}
              items={active.flatMap((t) => [
                { id: `team:${t._id}:issues`, label: `${t.name} issues`, icon: ArrowRight, hint: t.key, run: go(`${base}/team/${t.key}/issues`) },
                { id: `team:${t._id}:cycles`, label: `${t.name} cycles`, icon: ArrowRight, hint: t.key, run: go(`${base}/team/${t.key}/cycles`) },
              ])}
            />
          </>
        )}
      </CommandList>
    </Command>
  );
}

export function CommandPalette({
  orgSlug,
  open,
  mode,
  identifier,
  onOpenChange,
  onCreateIssue,
}: {
  orgSlug: string;
  open: boolean;
  mode: PaletteMode;
  identifier: string | undefined;
  onOpenChange: (open: boolean) => void;
  onCreateIssue: (teamId?: Id<"teams">) => void;
}) {
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Command palette" description="Run a command or find an issue">
      {open && (
        <PaletteBody
          // A fresh body per opening clears the query.
          key={`${mode}:${identifier ?? ""}`}
          orgSlug={orgSlug}
          mode={mode}
          identifier={identifier}
          close={() => onOpenChange(false)}
          onCreateIssue={onCreateIssue}
        />
      )}
    </CommandDialog>
  );
}
