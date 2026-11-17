"use client";

import { useSyncExternalStore } from "react";

// One shared clock, ticking every minute, so rows can tell what is overdue
// without calling Date.now() during render.
let now = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (timer === null) {
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 60_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** The current time in ms, updated each minute. */
export function useNow() {
  return useSyncExternalStore(
    subscribe,
    () => now,
    () => now,
  );
}
