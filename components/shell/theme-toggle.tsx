"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const OPTIONS = [
  { value: "dark", label: "Dark theme", icon: Moon },
  { value: "light", label: "Light theme", icon: Sun },
  { value: "system", label: "Match system theme", icon: Monitor },
] as const;

const noop = () => () => {};

/** Dark, light or system, as a hairline segmented control; the chosen cell inverts. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // The stored theme is only known in the browser; render none selected until then.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const current = mounted ? (theme ?? "dark") : null;
  return (
    <div role="radiogroup" aria-label="Theme" className="flex border border-rule">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={current === value}
          aria-label={label}
          title={label}
          onClick={() => setTheme(value)}
          className={`grid size-7 place-items-center ${
            current === value ? "inverted" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon className="size-3.5" aria-hidden />
        </button>
      ))}
    </div>
  );
}
