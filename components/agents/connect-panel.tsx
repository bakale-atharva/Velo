"use client";

import { Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { copy } from "./agent-keys";
import type { Runtime } from "./agent-format";

// Copy-ready setup for each MCP client, filled with this deployment's
// endpoint. The key itself is never placed here: snippets read it from an
// environment variable (or show a placeholder) so they're safe to share.

/** The MCP endpoint lives on the Convex *site* host, not the cloud host. */
export function mcpUrl(): string {
  const site =
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL ??
    process.env.NEXT_PUBLIC_CONVEX_URL?.replace(/\.convex\.cloud\b/, ".convex.site") ??
    "https://<your-deployment>.convex.site";
  return `${site.replace(/\/$/, "")}/mcp`;
}

type Client = "claude-code" | "claude-desktop" | "openclaw";

const CLIENTS: { value: Client; label: string }[] = [
  { value: "claude-code", label: "Claude Code" },
  { value: "claude-desktop", label: "Claude Desktop" },
  { value: "openclaw", label: "OpenClaw" },
];

function steps(client: Client, url: string): { note: string; code: string }[] {
  switch (client) {
    case "claude-code":
      return [
        { note: "Put the key in your shell profile:", code: "export VELO_API_KEY='velo_…'" },
        {
          note: "Add Velo as an MCP server (add --scope user to use it in every project):",
          code: `claude mcp add --transport http velo ${url} --header "Authorization: Bearer $VELO_API_KEY"`,
        },
        {
          note: "Or commit this to a repo's .mcp.json; Claude Code fills in the key from the environment:",
          code: JSON.stringify(
            { mcpServers: { velo: { type: "http", url, headers: { Authorization: "Bearer ${VELO_API_KEY}" } } } },
            null,
            2,
          ),
        },
        { note: "Check it inside Claude Code:", code: "/mcp" },
      ];
    case "claude-desktop":
      return [
        {
          note: "Add this to claude_desktop_config.json (Settings → Developer → Edit Config), then restart. The mcp-remote bridge is fetched by npx; Desktop's built-in connectors need OAuth, which Velo doesn't offer yet.",
          code: JSON.stringify(
            {
              mcpServers: {
                velo: {
                  command: "npx",
                  args: ["-y", "mcp-remote", url, "--header", "Authorization:${VELO_AUTH}"],
                  env: { VELO_AUTH: "Bearer velo_…" },
                },
              },
            },
            null,
            2,
          ),
        },
      ];
    case "openclaw":
      return [
        {
          note: "Save the server with its key (OpenClaw stores header values as written, so keep its config private):",
          code: `openclaw mcp set velo '${JSON.stringify({
            url,
            transport: "streamable-http",
            headers: { Authorization: "Bearer velo_…" },
          })}'`,
        },
        { note: "Check that it connects and lists Velo's tools:", code: "openclaw mcp doctor velo --probe" },
        {
          note: "Optional: run read tools without asking; Velo marks deletes so they still ask:",
          code: "openclaw mcp configure velo --approval auto",
        },
      ];
  }
}

function Snippet({ code, prose = false }: { code: string; prose?: boolean }) {
  return (
    <div className="group relative border border-rule">
      {prose ? (
        <p className="max-w-[72ch] p-3 pr-12 text-[14px] leading-6">{code}</p>
      ) : (
        <pre className="overflow-x-auto p-3 pr-12 font-mono text-[12.5px] leading-5 whitespace-pre">{code}</pre>
      )}
      <button
        type="button"
        aria-label="Copy"
        onClick={() => void copy(code, "the command")}
        className="absolute top-2 right-2 grid size-7 place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Copy className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

/** What a master can ask its client to do once connected. */
const TEAM_PROMPT =
  "Use Velo. Create an agent called Reviewer running claude-opus-5-5 that reviews pull requests, " +
  "add it to the ENG team, give it its own API key, and assign it every open ENG issue labelled needs-review.";

/**
 * How to connect this agent from Claude Code, Claude Desktop or OpenClaw.
 * A master also gets the step that lets it build its own team.
 */
export function ConnectPanel({ runtime, isMaster }: { runtime: Runtime; isMaster: boolean }) {
  const [client, setClient] = useState<Client>(runtime === "openclaw" ? "openclaw" : "claude-code");
  const url = mcpUrl();
  const extra = isMaster
    ? {
        note: "Then let it build its team. It creates agents with create_agent, gives each its own key with create_agent_key, adds them to teams with add_team_member and hands them work with update_issue. Its agents are regular members and can’t create agents. Try:",
        code: TEAM_PROMPT,
        prose: true,
      }
    : null;
  return (
    <SettingsPanel
      title="Connect"
      description={
        isMaster
          ? "Make a key above, then point the agent at Velo’s MCP server. Replace velo_… with the key."
          : "This agent was created by its master agent. Connect it with its own key (from above, or one its master made), the same way."
      }
    >
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <div role="radiogroup" aria-label="Client" className="flex max-w-full overflow-x-auto border border-rule">
            {CLIENTS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={client === option.value}
                onClick={() => setClient(option.value)}
                className={`data h-8 shrink-0 px-3 text-[12px] whitespace-nowrap uppercase ${
                  client === option.value ? "inverted" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <Button type="button" variant="ghost" size="sm" className="min-w-0 max-w-full" onClick={() => void copy(url, "the endpoint")}>
            <span className="data min-w-0 truncate text-[12px]">{url}</span>
            <Copy className="size-3.5" aria-hidden />
          </Button>
        </div>
        <ol className="grid gap-4">
          {[...steps(client, url).map((s) => ({ ...s, prose: false })), ...(extra === null ? [] : [extra])].map((step, index) => (
            <li key={`${client}-${index}`} className="grid gap-2">
              <p className="text-[14px] leading-6 text-muted-foreground">{step.note}</p>
              <Snippet code={step.code} prose={step.prose} />
            </li>
          ))}
        </ol>
      </div>
    </SettingsPanel>
  );
}
