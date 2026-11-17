"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const OPTIONS = [
  { value: "light", label: "Light theme", icon: Sun },
  { value: "dark", label: "Dark theme", icon: Moon },
  { value: "system", label: "Match system theme", icon: Monitor },
] as const;

const noop = () => () => {};

/** Light, dark or system, as a small segmented control. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // The stored theme is only known in the browser; render none selected until then.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const current = mounted ? (theme ?? "system") : null;
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="flex gap-0.5 rounded-xl bg-muted p-1 shadow-[inset_0_0_0_1px_var(--border)]"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={current === value}
          aria-label={label}
          title={label}
          onClick={() => setTheme(value)}
          className={`grid size-8 place-items-center rounded-lg transition-colors ${
            current === value
              ? "bg-panel text-foreground shadow-[0_1px_2px_rgb(20_22_22/0.1)]"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon className="size-4" aria-hidden />
        </button>
      ))}
    </div>
  );
}
