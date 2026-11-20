"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useNow } from "@/components/issues/use-now";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { formatDate } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";
import { AGENT_MESSAGES, sinceLabel } from "./agent-format";

export async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`Copied ${what}`);
  } catch {
    toast.error("Couldn’t copy. Select the text and copy it yourself.");
  }
}

/** A key just made: shown once, inverted, until it is dismissed. */
function NewKey({ value, onDone }: { value: string; onDone: () => void }) {
  return (
    <div role="status" className="mb-5 grid gap-3 border border-foreground p-4">
      <p className="text-[14px] font-medium">Copy this key now. It won’t be shown again.</p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="inverted min-w-0 flex-1 truncate px-2.5 py-1.5 font-mono text-[13px] select-all">{value}</code>
        <Button type="button" variant="outline" onClick={() => void copy(value, "the key")}>
          <Copy className="size-4" aria-hidden />
          Copy
        </Button>
      </div>
      <p className="text-[13px] leading-5 text-muted-foreground">
        Store it where the agent runs, e.g. <code className="data text-[12px]">export VELO_API_KEY=…</code>, and use
        the connect steps below.
      </p>
      <Button type="button" variant="ghost" className="justify-self-start" onClick={onDone}>
        I’ve stored it
      </Button>
    </div>
  );
}

function KeyRow({
  keyDoc,
  canManage,
  now,
}: {
  keyDoc: { _id: Id<"agentKeys">; _creationTime: number; label: string; prefix: string; lastUsedAt: number | null; revokedAt: number | null };
  canManage: boolean;
  now: number;
}) {
  const revoke = useMutation(api.agentKeys.revoke);
  const [confirming, setConfirming] = useState(false);
  const revoked = keyDoc.revokedAt !== null;
  return (
    <li
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-2 py-2.5 ${revoked ? "text-muted-foreground" : ""}`}
    >
      <span className="data w-32 shrink-0 text-[12px]">{keyDoc.prefix}…</span>
      <span className="min-w-0 flex-1 truncate text-[14px]">{keyDoc.label}</span>
      <span className="data text-[12px] text-muted-foreground tabular-nums">
        {revoked
          ? `revoked ${formatDate(keyDoc.revokedAt!)}`
          : `used ${sinceLabel(keyDoc.lastUsedAt, now) ?? "never"} · made ${formatDate(keyDoc._creationTime)}`}
      </span>
      {canManage && !revoked && (
        <span className="flex items-center gap-1">
          {confirming && (
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Keep
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={() => {
              if (!confirming) {
                setConfirming(true);
                return;
              }
              revoke({ keyId: keyDoc._id })
                .then(() => toast.success(`Revoked ${keyDoc.label}`))
                .catch((error: unknown) => toast.error(errorMessage(error, AGENT_MESSAGES)))
                .finally(() => setConfirming(false));
            }}
          >
            {confirming ? "Revoke now" : "Revoke"}
          </Button>
        </span>
      )}
    </li>
  );
}

/** An agent's API keys: make one (shown once), see when each was used, revoke. */
export function AgentKeys({ agentId, canManage }: { agentId: Id<"agents">; canManage: boolean }) {
  const keys = useQuery(api.agentKeys.list, canManage ? { agentId } : "skip");
  const create = useAction(api.agentKeys.create);
  const now = useNow();
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);

  if (!canManage) {
    return (
      <SettingsPanel title="API keys" description="Only people who manage this agent can see or make its keys." />
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (label.trim() === "") return;
    setBusy(true);
    try {
      const created = await create({ agentId, label });
      setFresh(created.key);
      setLabel("");
    } catch (error) {
      toast.error(errorMessage(error, AGENT_MESSAGES));
    } finally {
      setBusy(false);
    }
  }

  const active = keys?.filter((k) => k.revokedAt === null).length ?? 0;
  return (
    <SettingsPanel
      title="API keys"
      description="The agent sends a key as a Bearer token to Velo’s MCP server. Make one key per place it runs; revoking one stops it on the next request."
    >
      {fresh !== null && <NewKey value={fresh} onDone={() => setFresh(null)} />}
      {keys === undefined ? null : keys.length === 0 ? (
        <p className="px-2 text-[14px] text-muted-foreground">No keys yet. Make one to connect this agent.</p>
      ) : (
        <ul className="border-t border-border" aria-label={`API keys, ${active} active`}>
          {keys.map((k) => (
            <KeyRow key={k._id} keyDoc={k} canManage={canManage} now={now} />
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="mt-4 flex flex-wrap items-center gap-2 border-t border-border px-2 pt-4">
        <Input
          aria-label="Key label"
          placeholder="Where it will run, e.g. MacBook Claude Code"
          maxLength={60}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-72"
        />
        <Button type="submit" variant="outline" disabled={busy || label.trim() === ""}>
          {busy ? "Making…" : "Make key"}
        </Button>
      </form>
    </SettingsPanel>
  );
}
