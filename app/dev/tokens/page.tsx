import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { DuePill } from "@/components/issues/due-pill";
import { PriorityRamp } from "@/components/issues/priority-ramp";
import { StageGauge, StateHeading } from "@/components/issues/state-heading";
import { Progress } from "@/components/projects/progress";
import { VeloMark } from "@/components/shell/velo-mark";

export const metadata: Metadata = { title: "Design tokens · Velo" };

// The Datamatics reference: every token and core component on one page.
// All values here are samples, not workspace data.

const SIGNAL = [
  { name: "background", label: "Ground" },
  { name: "tile", label: "Tile (hover)" },
  { name: "chip", label: "Chip (empty cell)" },
  { name: "border", label: "Border (row rule)" },
  { name: "rule", label: "Rule (section rule)" },
  { name: "faint", label: "Faint" },
  { name: "muted-foreground", label: "Muted ink" },
  { name: "foreground", label: "Ink" },
  { name: "destructive", label: "Destructive" },
] as const;

const STATES = [
  { type: "backlog", name: "Backlog", count: 9 },
  { type: "unstarted", name: "Todo", count: 14 },
  { type: "started", name: "In progress", count: 6 },
  { type: "completed", name: "Done", count: 27 },
  { type: "canceled", name: "Canceled", count: 2 },
] as const;

const TYPE_SCALE = [
  { name: "Page title · Geist 64 / -0.04em", className: "text-[64px] leading-[0.95] font-semibold tracking-[-0.04em]", sample: "Web" },
  { name: "Issue title · Geist 34 / -0.035em", className: "text-[34px] leading-10 font-semibold tracking-[-0.035em]", sample: "Board drag drops issue in wrong column" },
  { name: "Body · Geist 14", className: "text-[14px] leading-6", sample: "Every change appears for everyone the moment it happens." },
  { name: "Data · Geist Mono 12", className: "data text-[12px]", sample: "WEB-142 · 3p · DUE 18 NOV" },
  { name: "Label · Geist Mono 11 / 0.18em caps", className: "signal-label", sample: "In progress / 04" },
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-x-12 gap-y-4 border-b border-rule px-4 py-8 md:grid-cols-[220px_minmax(0,1fr)] md:px-8">
      <h2 className="signal-label pt-1 text-foreground">{title}</h2>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export default function TokensPage() {
  return (
    <main className="min-h-dvh">
      <header className="flex items-end justify-between gap-6 border-b border-rule px-4 pt-10 pb-6 md:px-8">
        <h1 className="text-[64px] leading-[0.95] font-semibold tracking-[-0.04em]">Datamatics</h1>
        <VeloMark size={40} />
      </header>

      <Section title="Signal scale">
        <ul className="grid grid-cols-3 border-t border-l border-rule sm:grid-cols-5 lg:grid-cols-9">
          {SIGNAL.map((swatch) => (
            <li key={swatch.name} className="border-r border-b border-rule">
              <div className="h-16" style={{ background: `var(--${swatch.name})` }} />
              <p className="data border-t border-rule p-2 text-[11px] text-muted-foreground">{swatch.label}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="States">
        <div className="grid gap-3">
          {STATES.map((state) => (
            <StateHeading key={state.type} as="h3" name={state.name} count={state.count} type={state.type} />
          ))}
        </div>
      </Section>

      <Section title="Type">
        <div className="grid gap-6">
          {TYPE_SCALE.map((step) => (
            <div key={step.name}>
              <p className="data mb-2 text-[11px] text-muted-foreground">{step.name}</p>
              <p className={step.className}>{step.sample}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Marks">
        <div className="flex flex-wrap items-center gap-8">
          {[0, 1, 2, 3, 4].map((priority) => (
            <PriorityRamp key={priority} priority={priority} />
          ))}
          <StageGauge type="started" />
          <DuePill dueDate={Date.UTC(2026, 10, 18)} finished={false} now={Date.UTC(2026, 10, 10)} />
          <DuePill dueDate={Date.UTC(2026, 10, 1)} finished={false} now={Date.UTC(2026, 10, 10)} />
          <Progress completed={7} total={12} className="w-64" />
        </div>
      </Section>

      <Section title="Controls">
        <div className="flex flex-wrap items-center gap-3">
          <Button>
            <Plus aria-hidden />
            New issue
          </Button>
          <Button variant="outline">Save view</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="destructive">Delete</Button>
          <Input placeholder="Issue title" className="w-56" />
          <label className="flex items-center gap-2 text-[13.5px]">
            <Checkbox defaultChecked /> Bug
          </label>
        </div>
      </Section>

      <Section title="Active path">
        <div className="max-w-2xl border-t border-border">
          <div className="grid h-10 grid-cols-[84px_56px_minmax(0,1fr)] items-center gap-4 border-b border-border px-3">
            <span className="data text-[12px] text-muted-foreground">WEB-141</span>
            <StageGauge type="unstarted" />
            <span className="text-[14px]">A resting row</span>
          </div>
          <div className="inverted grid h-10 grid-cols-[84px_56px_minmax(0,1fr)] items-center gap-4 px-3">
            <span className="data text-[12px]">WEB-142</span>
            <StageGauge type="started" />
            <span className="text-[14px]">The focused row inverts</span>
          </div>
        </div>
      </Section>
    </main>
  );
}
