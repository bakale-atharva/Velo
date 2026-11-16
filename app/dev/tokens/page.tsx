import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PriorityRamp } from "./priority-ramp";

export const metadata: Metadata = { title: "Design tokens · Velo" };

const COLORS = [
  { name: "background", label: "Paper", text: "foreground" },
  { name: "card", label: "Raised", text: "foreground" },
  { name: "muted", label: "Muted", text: "muted-foreground" },
  { name: "primary", label: "Ink (primary)", text: "primary-foreground" },
  { name: "brand", label: "Ultramarine", text: "brand-foreground" },
  // Vermilion is a fill, never a text colour; ink reads on it in both themes.
  { name: "urgent", label: "Vermilion (urgent)", text: "ink" },
  { name: "destructive", label: "Destructive", text: "background" },
  { name: "border", label: "Hairline", text: "foreground" },
  { name: "input", label: "Control edge", text: "background" },
] as const;

// Sample board counts (synthetic).
const STATES = [
  { type: "backlog", name: "Backlog", count: 9 },
  { type: "unstarted", name: "Todo", count: 14 },
  { type: "started", name: "In Progress", count: 6 },
  { type: "completed", name: "Done", count: 27 },
  { type: "canceled", name: "Canceled", count: 3 },
] as const;

const TYPE_SCALE = [
  { name: "Display count", className: "font-display text-[64px] leading-[56px] font-extrabold tracking-[-0.04em] [font-stretch:75%]", sample: "14" },
  { name: "Page title", className: "font-display text-[48px] leading-[48px] font-extrabold tracking-[-0.03em] [font-stretch:80%]", sample: "Engineering" },
  { name: "Heading", className: "text-xl leading-6 font-semibold", sample: "Cycle 14 · Nov 10–23" },
  { name: "Body", className: "text-[13px] leading-4", sample: "Board drag drops issue in wrong column on Safari" },
  { name: "Meta", className: "text-xs leading-4 text-muted-foreground", sample: "ENG-231 · 2 pts · due Nov 18" },
  { name: "Label", className: "text-[11px] leading-4 font-medium tracking-[0.08em] uppercase text-muted-foreground", sample: "Teams" },
] as const;

function Panel({ theme }: { theme: "light" | "dark" }) {
  return (
    <section
      aria-label={`${theme} theme`}
      className={`${theme === "dark" ? "dark" : ""} bg-background text-foreground min-w-0 px-8 py-8`}
    >
      <div className="flex items-baseline justify-between border-b-4 border-rule pb-2">
        <h2 className="font-display text-[48px] leading-[48px] font-extrabold tracking-[-0.03em] [font-stretch:80%]">
          {theme === "light" ? "Light" : "Dark"}
        </h2>
        <span className="text-xs text-muted-foreground">Swiss Grid tokens</span>
      </div>

      <h3 className="mt-8 mb-2 text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
        Colour roles
      </h3>
      <ul className="grid grid-cols-3 border-t border-l border-border">
        {COLORS.map((color) => (
          <li key={color.name} className="border-r border-b border-border">
            <div
              className="flex h-16 items-end p-2 text-xs font-medium"
              style={{
                background: `var(--${color.name})`,
                color: color.text === "ink" ? "#121212" : `var(--${color.text})`,
              }}
            >
              Aa
            </div>
            <div className="px-2 py-2 text-xs">
              <div className="font-medium">{color.label}</div>
              <code className="text-muted-foreground">--{color.name}</code>
            </div>
          </li>
        ))}
      </ul>

      <h3 className="mt-8 mb-2 text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
        Type scale
      </h3>
      <dl className="divide-y divide-border border-y border-border">
        {TYPE_SCALE.map((step) => (
          <div key={step.name} className="grid grid-cols-[112px_1fr] items-baseline gap-4 py-3">
            <dt className="text-xs text-muted-foreground">{step.name}</dt>
            <dd className={`${step.className} min-w-0 truncate`}>{step.sample}</dd>
          </div>
        ))}
      </dl>

      <h3 className="mt-8 mb-2 text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
        Workflow states and priority
      </h3>
      <div className="grid grid-cols-5 gap-4">
        {STATES.map((state) => (
          <div
            key={state.type}
            className="border-t-4 pt-2"
            style={{ borderColor: `var(--state-${state.type})` }}
          >
            <div
              className="font-display text-[48px] leading-[48px] font-extrabold tracking-[-0.03em] [font-stretch:75%]"
              style={{ color: state.type === "started" ? "var(--brand-ink)" : undefined }}
            >
              {state.count}
            </div>
            <div className="text-xs font-semibold">{state.name}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-6 text-xs">
        {[1, 2, 3, 4, 0].map((priority) => (
          <span key={priority} className="inline-flex items-center gap-2">
            <PriorityRamp priority={priority} />
            {["None", "Urgent", "High", "Medium", "Low"][priority]}
          </span>
        ))}
      </div>

      <h3 className="mt-8 mb-2 text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
        Controls
      </h3>
      <div className="flex flex-wrap items-center gap-2">
        <Button>New issue</Button>
        <Button variant="outline">Filter</Button>
        <Button variant="secondary">Board</Button>
        <Button variant="ghost">Cancel</Button>
        <Button variant="destructive">Delete issue</Button>
        <Button disabled>Saving…</Button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <label className="grid gap-1 text-xs font-medium">
          Title
          <Input placeholder="Issue title" defaultValue="Retry webhook deliveries" />
        </label>
        <label className="grid gap-1 text-xs font-medium">
          Key
          <Input aria-invalid placeholder="ENG" defaultValue="eng" />
          <span className="font-normal text-destructive">Use 2–5 capital letters.</span>
        </label>
        <label className="col-span-2 grid gap-1 text-xs font-medium">
          Description
          <Textarea placeholder="Markdown supported" defaultValue="Steps to reproduce: drag ENG-231 from Todo to In Progress in Safari 18." />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
        <label className="inline-flex items-center gap-2">
          <Checkbox defaultChecked /> Create another
        </label>
        <Badge>bug</Badge>
        <Badge variant="outline">infra</Badge>
        <Badge variant="secondary">feature</Badge>
      </div>
    </section>
  );
}

/** Review page for the design system: every token in both themes. */
export default function TokensPage() {
  return (
    <main className="grid min-h-dvh grid-cols-1 lg:grid-cols-2">
      <Panel theme="light" />
      <Panel theme="dark" />
    </main>
  );
}
