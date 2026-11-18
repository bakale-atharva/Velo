"use client";

import { useQuery } from "convex/react";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AssistantPanel } from "@/components/assistant/assistant-panel";
import { CreateIssueDialog } from "@/components/issues/create-issue-dialog";
import { SHORTCUTS } from "@/lib/shortcuts";
import { CommandPalette, type PaletteMode } from "./command-palette";
import { Shortcuts } from "./shortcuts";

type CommandCenter = {
  /** Opens the palette; a mode shows only one kind of issue command. */
  openPalette: (mode?: PaletteMode, identifier?: string) => void;
  /** Opens New issue for a team, or for the team in the URL, or the first. */
  openCreateIssue: (teamId?: Id<"teams">) => void;
  /** Opens the assistant panel (also Cmd/Ctrl+J). */
  openAssistant: () => void;
};

const Context = createContext<CommandCenter | null>(null);

export function useCommandCenter(): CommandCenter {
  const value = useContext(Context);
  if (value === null) throw new Error("useCommandCenter needs CommandCenterProvider");
  return value;
}

/** `/<org>/team/<KEY>/…` → "KEY"; `/<org>/issue/<ID>` → "ID". */
export function routeContext(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  return {
    teamKey: parts[1] === "team" ? parts[2] : undefined,
    identifier: parts[1] === "issue" ? parts[2] : undefined,
  };
}

function CreateIssueHost({
  teamId,
  open,
  onOpenChange,
}: {
  teamId: Id<"teams">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const teams = useQuery(api.teams.list, {});
  const states = useQuery(api.workflowStates.list, { teamId });
  const team = teams?.find((t) => t._id === teamId);
  if (team === undefined || states === undefined) return null;
  return <CreateIssueDialog key={teamId} team={team} states={states} open={open} onOpenChange={onOpenChange} />;
}

/**
 * Holds the command palette (Cmd/Ctrl+K) and a create-issue dialog for any
 * team, so pages and keyboard shortcuts can open either.
 */
export function CommandCenterProvider({
  orgSlug,
  children,
}: {
  orgSlug: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const teams = useQuery(api.teams.list, {});
  const [palette, setPalette] = useState<{ open: boolean; mode: PaletteMode; identifier?: string }>({
    open: false,
    mode: "all",
  });
  const [createFor, setCreateFor] = useState<Id<"teams"> | null>(null);
  const [creating, setCreating] = useState(false);

  const openPalette = useCallback((mode: PaletteMode = "all", identifier?: string) => {
    setPalette({ open: true, mode, identifier });
  }, []);

  const openCreateIssue = useCallback(
    (teamId?: Id<"teams">) => {
      const { teamKey } = routeContext(pathname);
      const fromUrl = teams?.find((t) => t.key === teamKey);
      const target = teamId ?? fromUrl?._id ?? teams?.find((t) => t.archivedAt === null)?._id;
      if (target === undefined) return;
      setCreateFor(target);
      setCreating(true);
    },
    [pathname, teams],
  );

  useHotkeys(
    SHORTCUTS.palette.keys,
    () => setPalette((p) => (p.open ? { ...p, open: false } : { open: true, mode: "all" })),
    { enableOnFormTags: true, preventDefault: true },
  );

  const [assistantOpen, setAssistantOpen] = useState(false);
  const openAssistant = useCallback(() => setAssistantOpen(true), []);
  useHotkeys(SHORTCUTS.assistant.keys, () => setAssistantOpen((open) => !open), {
    enableOnFormTags: true,
    preventDefault: true,
  });

  const value = useMemo(
    () => ({ openPalette, openCreateIssue, openAssistant }),
    [openPalette, openCreateIssue, openAssistant],
  );

  return (
    <Context.Provider value={value}>
      {children}
      <Shortcuts
        orgSlug={orgSlug}
        pathIdentifier={routeContext(pathname).identifier}
        openPalette={openPalette}
        openCreateIssue={openCreateIssue}
      />
      <CommandPalette
        orgSlug={orgSlug}
        open={palette.open}
        mode={palette.mode}
        identifier={palette.identifier ?? routeContext(pathname).identifier}
        onOpenChange={(open) => setPalette((p) => ({ ...p, open }))}
        onCreateIssue={openCreateIssue}
      />
      {createFor !== null && (
        <CreateIssueHost teamId={createFor} open={creating} onOpenChange={setCreating} />
      )}
      <AssistantPanel open={assistantOpen} onOpenChange={setAssistantOpen} />
    </Context.Provider>
  );
}
