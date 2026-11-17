import type { Metadata } from "next";
import { CirclePlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DuePill } from "@/components/issues/due-pill";
import { PriorityRamp } from "@/components/issues/priority-ramp";
import { StateHeading, stateColor } from "@/components/issues/state-heading";

export const metadata: Metadata = { title: "Design tokens · Velo" };

const COLORS = [
  { name: "background", label: "Canvas", text: "foreground" },
  { name: "panel", label: "Panel", text: "foreground" },
  { name: "tile", label: "Tile", text: "foreground" },
  { name: "chip", label: "Chip", text: "muted-foreground" },
  { name: "primary", label: "Ink (primary)", text: "primary-foreground" },
  { name: "count-teal", label: "Teal", text: "white" },
  { name: "count-orange", label: "Orange", text: "white" },
  { name: "urgent", label: "Urgent (fill only)", text: "white" },
  { name: "destructive", label: "Destructive", text: "background" },
] as const;

// Sample board counts (synthetic).
const STATES = [
  { type: "backlog", name: "Backlog", count: 9 },
  { type: "unstarted", name: "Todo", count: 14 },
  { type: "started", name: "In progress", count: 6 },
  { type: "completed", name: "Done", count: 27 },
] as const;

const TYPE_SCALE = [
  { name: "Page title", className: "text-[36px] leading-10 font-semibold tracking-[-0.02em]", sample: "Engineering" },
  { name: "Section", className: "text-[22px] leading-7 font-medium tracking-[-0.01em]", sample: "All issues" },
  { name: "Tile title", className: "text-[16px] leading-6 font-medium", sample: "Retry webhook deliveries" },
  { name: "Body", className: "text-[15px] leading-6", sample: "Board drag drops issue in wrong column on Safari" },
  { name: "Meta", className: "text-[13px] leading-5 text-muted-foreground", sample: "ENG-231 · 2 pt · due 18 Nov" },
] as const;

// A fixed reference time so the sample due pills render the same everywhere.
const NOW = Date.UTC(2026, 10, 17);

function Swatches() {
  return (
    <ul className="grid grid-cols-3 gap-3">
      {COLORS.map((color) => (
        <li key={color.name} className="overflow-hidden rounded-[14px] bg-panel shadow-[inset_0_0_0_1px_var(--border)]">
          <div
            className="flex h-14 items-end p-2.5 text-[13px] font-medium"
            style={{
              background: `var(--${color.name})`,
              color: color.text === "white" ? "#fff" : `var(--${color.text})`,
            }}
          >
            Aa
          </div>
          <div className="px-2.5 py-2 text-[12px]">
            <div className="font-medium">{color.label}</div>
            <code className="text-muted-foreground">--{color.name}</code>
          </div>
        </li>
      ))}
    </ul>
  );
}

function SampleTile() {
  return (
    <div className="overflow-hidden rounded-[20px] bg-tile">
      <div className="px-5 pt-5 pb-4">
        <span className="inline-flex h-7 items-center rounded-lg bg-chip px-2.5 text-[13px] font-medium text-muted-foreground">
          ENG-231
        </span>
        <p className="mt-4 text-[16px] leading-6 font-medium">Fix Safari drag</p>
        <p className="mt-1.5 line-clamp-2 text-[14px] leading-6 text-muted-foreground">
          Dropping a card from Todo lands it one column to the right.
        </p>
        <div className="mt-4 flex gap-2">
          <DuePill dueDate={Date.UTC(2026, 10, 20)} finished={false} now={NOW} />
          <DuePill dueDate={Date.UTC(2026, 10, 12)} finished={false} now={NOW} />
        </div>
      </div>
      <div className="flex items-center gap-2.5 border-t-2 border-tile-edge px-5 py-3.5">
        <span className="grid size-7 place-items-center rounded-full bg-[#12705f] text-[11px] font-semibold text-white">AL</span>
        <span className="flex-1 text-[14px] font-medium">Ada Lovelace</span>
        <span className="text-[13px] text-muted-foreground">2 pt</span>
        <PriorityRamp priority={2} />
      </div>
    </div>
  );
}

function Panel({ theme }: { theme: "light" | "dark" }) {
  return (
    <section
      aria-label={`${theme} theme`}
      className={`${theme === "dark" ? "dark" : ""} min-w-0 bg-background p-6 text-foreground md:p-10`}
    >
      <div className="flex items-center gap-4">
        <span aria-hidden className="size-[18px] rounded-full border-2 border-count-teal" />
        <h2 className="text-[36px] leading-10 font-semibold tracking-[-0.02em]">{theme === "light" ? "Light" : "Dark"}</h2>
        <span className="chip-dark inline-flex h-8 items-center rounded-[10px] px-3 text-[13px] font-medium">Soft Panels</span>
      </div>
      <div aria-hidden className="mt-8 h-[3px] rounded-full bg-gradient-to-r from-rule via-rule to-transparent" />

      <h3 className="mt-8 mb-3 text-[15px] font-medium text-muted-foreground">Colour roles</h3>
      <Swatches />

      <h3 className="mt-10 mb-3 text-[15px] font-medium text-muted-foreground">Type scale</h3>
      <dl className="panel grid gap-1 p-5">
        {TYPE_SCALE.map((step) => (
          <div key={step.name} className="grid grid-cols-[96px_1fr] items-baseline gap-4 py-2">
            <dt className="text-[12px] text-muted-foreground">{step.name}</dt>
            <dd className={`${step.className} min-w-0 truncate`}>{step.sample}</dd>
          </div>
        ))}
      </dl>

      <h3 className="mt-10 mb-3 text-[15px] font-medium text-muted-foreground">States, tiles and priority</h3>
      <div className="panel grid gap-4 p-5">
        <div className="grid grid-cols-2 gap-4">
          {STATES.map((state) => (
            <StateHeading key={state.type} as="h3" name={state.name} count={state.count} color={stateColor(state.type)} />
          ))}
        </div>
        <SampleTile />
        <div className="flex flex-wrap items-center gap-5 text-[13px]">
          {[1, 2, 3, 4, 0].map((priority) => (
            <span key={priority} className="inline-flex items-center gap-2">
              <PriorityRamp priority={priority} />
              {["None", "Urgent", "High", "Medium", "Low"][priority]}
            </span>
          ))}
        </div>
      </div>

      <h3 className="mt-10 mb-3 text-[15px] font-medium text-muted-foreground">Controls</h3>
      <div className="panel grid gap-5 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" className="h-11 px-5 text-[15px]">
            <CirclePlus aria-hidden />
            New issue
          </Button>
          <Button variant="outline">Filter</Button>
          <Button variant="secondary">Board</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="destructive">Delete issue</Button>
          <Button disabled>Saving…</Button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label className="grid gap-1.5 text-[13px] font-medium">
            Title
            <Input placeholder="Issue title" defaultValue="Retry webhook deliveries" />
          </label>
          <label className="grid gap-1.5 text-[13px] font-medium">
            Key
            <Input aria-invalid placeholder="ENG" defaultValue="eng" />
            <span className="font-normal text-destructive">Use 2–5 capital letters.</span>
          </label>
          <label className="col-span-2 grid gap-1.5 text-[13px] font-medium">
            Description
            <Textarea placeholder="Markdown supported" defaultValue="Steps to reproduce: drag ENG-231 from Todo to In progress in Safari 18." />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[13px]">
          <label className="inline-flex items-center gap-2">
            <Checkbox defaultChecked /> Create another
          </label>
          <Badge>bug</Badge>
          <Badge variant="outline">infra</Badge>
          <Badge variant="secondary">feature</Badge>
        </div>
      </div>
    </section>
  );
}

/** Review page for the design system: every token in both themes. */
export default function TokensPage() {
  return (
    <main className="grid min-h-dvh grid-cols-1 xl:grid-cols-2">
      <Panel theme="light" />
      <Panel theme="dark" />
    </main>
  );
}
