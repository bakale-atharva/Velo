"use client";

import { ArrowDownUp } from "lucide-react";
import { useSyncExternalStore } from "react";

// A list's sort order as a native select (fast, keyboard-driven, like the
// issue fields), remembered per list in this browser.

export type SortOption<K extends string> = { value: K; label: string };

const listeners = new Set<() => void>();

function read(key: string): string | null {
  try {
    return localStorage.getItem(`velo:sort:${key}`);
  } catch {
    return null;
  }
}

/** The chosen sort for list `key`; falls back to the first option. */
export function useSort<K extends string>(key: string, options: SortOption<K>[]): [K, (next: K) => void] {
  const stored = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => read(key),
    () => null,
  );
  const sort = options.find((option) => option.value === stored)?.value ?? options[0].value;
  const setSort = (next: K) => {
    try {
      localStorage.setItem(`velo:sort:${key}`, next);
    } catch {
      // Storage may be blocked; the choice then lasts until reload.
    }
    listeners.forEach((listener) => listener());
  };
  return [sort, setSort];
}

export function SortSelect<K extends string>({
  value,
  options,
  onChange,
  label = "Sort",
}: {
  value: K;
  options: SortOption<K>[];
  onChange: (next: K) => void;
  label?: string;
}) {
  return (
    <label className="relative inline-flex h-8 items-center border border-rule text-muted-foreground focus-within:text-foreground hover:text-foreground">
      <ArrowDownUp className="pointer-events-none absolute left-2.5 size-3.5" aria-hidden />
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as K)}
        className="data h-full appearance-none bg-transparent pr-3 pl-8 text-[12px] uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Case- and accent-insensitive name order that reads 2 before 10. */
export const byName = (a: string, b: string) =>
  a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
