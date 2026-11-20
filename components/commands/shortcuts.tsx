"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SHORTCUT_GROUPS, SHORTCUTS, type ShortcutId } from "@/lib/shortcuts";
import type { PaletteMode } from "./command-palette";

// Issue rows mark themselves with `data-issue-row` and `data-identifier`;
// J/K move focus between them and Enter follows the focused row's link.
const ROW = "[data-issue-row]";

function rows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(ROW));
}

function moveSelection(step: 1 | -1) {
  const all = rows();
  if (all.length === 0) return;
  const current = all.indexOf(document.activeElement as HTMLElement);
  const next = current === -1 ? (step === 1 ? 0 : all.length - 1) : current + step;
  const target = all[Math.min(all.length - 1, Math.max(0, next))]!;
  target.focus();
  target.scrollIntoView({ block: "nearest" });
}

/** The focused row's issue, else the issue whose page is open. */
function targetIssue(pathIdentifier: string | undefined): string | undefined {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active.matches(ROW)) {
    return active.dataset.identifier;
  }
  return pathIdentifier;
}

export function Keys({ keys }: { keys: readonly string[] }) {
  return (
    <span className="inline-flex gap-1">
      {keys.map((key) => (
        <kbd
          key={key}
          className="data inline-flex h-6 min-w-6 items-center justify-center border border-rule px-1.5 text-[11px] text-foreground"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}

/**
 * Global keyboard shortcuts from `lib/shortcuts.ts`, plus the help sheet
 * (?). Mounted once in the workspace shell.
 */
export function Shortcuts({
  orgSlug,
  pathIdentifier,
  openPalette,
  openCreateIssue,
}: {
  orgSlug: string;
  pathIdentifier: string | undefined;
  openPalette: (mode?: PaletteMode, identifier?: string) => void;
  openCreateIssue: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [help, setHelp] = useState(false);
  const keys = (id: ShortcutId) => SHORTCUTS[id].keys;
  const options = { preventDefault: true };
  const edit = (mode: PaletteMode) => {
    const identifier = targetIssue(pathIdentifier);
    if (identifier !== undefined) openPalette(mode, identifier);
  };

  useHotkeys(keys("help"), () => setHelp((open) => !open), options);
  useHotkeys(keys("create"), () => openCreateIssue(), options, [openCreateIssue]);
  useHotkeys(
    keys("search"),
    () => {
      if (pathname !== `/${orgSlug}/search`) router.push(`/${orgSlug}/search`);
    },
    options,
    [pathname, orgSlug, router],
  );
  useHotkeys(keys("goMyIssues"), () => router.push(`/${orgSlug}/my-issues`), options, [orgSlug, router]);
  useHotkeys(keys("goProjects"), () => router.push(`/${orgSlug}/projects`), options, [orgSlug, router]);
  useHotkeys(keys("next"), () => moveSelection(1), options);
  useHotkeys(keys("previous"), () => moveSelection(-1), options);
  useHotkeys(keys("state"), () => edit("state"), options, [pathIdentifier, openPalette]);
  useHotkeys(keys("assign"), () => edit("assignee"), options, [pathIdentifier, openPalette]);
  useHotkeys(keys("priority"), () => edit("priority"), options, [pathIdentifier, openPalette]);
  useHotkeys(keys("labels"), () => edit("labels"), options, [pathIdentifier, openPalette]);

  return (
    <Sheet open={help} onOpenChange={setHelp}>
      <SheetContent side="right" className="w-full sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Keyboard shortcuts</SheetTitle>
          <SheetDescription>Shortcuts pause while you type in a field.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-6 overflow-y-auto px-4 pb-6">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group} aria-labelledby={`keys-${group}`}>
              <h3
                id={`keys-${group}`}
                className="pb-1 text-[13px] font-medium text-muted-foreground"
              >
                {group}
              </h3>
              <ul className="divide-y divide-border">
                {Object.values(SHORTCUTS)
                  .filter((s) => s.group === group)
                  .map((s) => (
                    <li key={s.label} className="flex items-center justify-between py-1.5 text-[13px]">
                      {s.label}
                      <Keys keys={s.display} />
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
