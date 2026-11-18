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

/** List / Board as a hairline segmented control; the chosen half inverts. */
export function ViewToggle({ view, onChange }: { view: IssueView; onChange: (view: IssueView) => void }) {
  return (
    <div role="radiogroup" aria-label="Layout" className="flex border border-rule">
      {(["list", "board"] as const).map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={view === option}
          onClick={() => onChange(option)}
          className={`data h-8 px-3 text-[12px] uppercase ${
            view === option ? "inverted" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
