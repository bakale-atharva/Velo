// Every keyboard shortcut in Velo, in one place. The handlers
// (components/commands/shortcuts.tsx), the help sheet and the palette hints
// all read this map, so a key changes in one spot.
//
// `keys` uses react-hotkeys-hook syntax: "g>i" is G then I; "mod" is Cmd on
// macOS and Ctrl elsewhere. `display` is what the help sheet shows.
// Shortcuts do nothing while focus is in a text field (except the palette).

export const SHORTCUTS = {
  palette: { keys: "mod+k", display: ["⌘/Ctrl", "K"], label: "Open command palette", group: "General" },
  help: { keys: "shift+slash", display: ["?"], label: "Show keyboard shortcuts", group: "General" },
  create: { keys: "c", display: ["C"], label: "Create issue", group: "General" },
  search: { keys: "slash", display: ["/"], label: "Search", group: "General" },
  goMyIssues: { keys: "g>i", display: ["G", "I"], label: "Go to My issues", group: "Navigation" },
  goProjects: { keys: "g>p", display: ["G", "P"], label: "Go to Projects", group: "Navigation" },
  next: { keys: "j", display: ["J"], label: "Select next issue", group: "Issue lists" },
  previous: { keys: "k", display: ["K"], label: "Select previous issue", group: "Issue lists" },
  open: { keys: "enter", display: ["Enter"], label: "Open selected issue", group: "Issue lists" },
  state: { keys: "s", display: ["S"], label: "Change state", group: "Selected or open issue" },
  assign: { keys: "a", display: ["A"], label: "Assign", group: "Selected or open issue" },
  priority: { keys: "p", display: ["P"], label: "Set priority", group: "Selected or open issue" },
  labels: { keys: "l", display: ["L"], label: "Add or remove labels", group: "Selected or open issue" },
} as const;

export type ShortcutId = keyof typeof SHORTCUTS;

export const SHORTCUT_GROUPS = [
  "General",
  "Navigation",
  "Issue lists",
  "Selected or open issue",
] as const;
