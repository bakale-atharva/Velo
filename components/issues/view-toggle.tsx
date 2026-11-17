"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSyncExternalStore } from "react";

export type IssueView = "list" | "board";

const STORAGE_KEY = "velo:issue-view";
const listeners = new Set<() => void>();

function readStored(): IssueView {
  try {
    return localStorage.getItem(STORAGE_KEY) === "board" ? "board" : "list";
  } catch {
    return "list";
  }
}

function store(view: IssueView) {
  try {
    localStorage.setItem(STORAGE_KEY, view);
  } catch {
    // Storage may be blocked; the URL still carries the view.
  }
  listeners.forEach((listener) => listener());
}

/** `?view=` wins; otherwise the last view this browser used. */
export function useIssueView(): [IssueView, (view: IssueView) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const stored = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    readStored,
    () => "list" as IssueView,
  );
  const fromUrl = params.get("view");
  const view: IssueView = fromUrl === "board" || fromUrl === "list" ? fromUrl : stored;
  const setView = (next: IssueView) => {
    store(next);
    const query = new URLSearchParams(params);
    query.set("view", next);
    router.replace(`${pathname}?${query.toString()}`);
  };
  return [view, setView];
}

export function ViewToggle({ view, onChange }: { view: IssueView; onChange: (view: IssueView) => void }) {
  return (
    <div
      role="radiogroup"
      aria-label="Layout"
      className="flex gap-1 rounded-[14px] bg-muted p-1 shadow-[inset_0_0_0_1px_var(--border)]"
    >
      {(["list", "board"] as const).map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={view === option}
          onClick={() => onChange(option)}
          className={`h-9 rounded-[10px] px-3.5 text-[14px] capitalize transition-colors ${
            view === option
              ? "bg-panel font-medium text-foreground shadow-[0_1px_2px_rgb(20_22_22/0.08),0_4px_10px_-4px_rgb(20_22_22/0.18)]"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
