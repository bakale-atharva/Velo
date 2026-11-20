import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";
import type { Member } from "@/components/issues/lookups";

export type AgentView = FunctionReturnType<typeof api.agents.list>[number];

export const RUNTIMES = [
  { value: "claude", label: "Claude" },
  { value: "openclaw", label: "OpenClaw" },
  { value: "other", label: "Other" },
] as const;

export type Runtime = (typeof RUNTIMES)[number]["value"];

export function runtimeLabel(runtime: Runtime): string {
  return RUNTIMES.find((r) => r.value === runtime)?.label ?? runtime;
}

/** An agent shaped as a member, for the shared avatar. */
export function agentAsMember(agent: AgentView): Member {
  return {
    userId: agent.userId,
    role: agent.role,
    name: agent.name,
    email: null,
    imageUrl: agent.imageUrl,
    isAgent: true,
  };
}

/** "now", "4m", "3h", "2d", or a date; null for never. */
export function sinceLabel(ms: number | null, now: number): string | null {
  if (ms === null) return null;
  const minutes = Math.max(0, Math.round((now - ms) / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export const AGENT_MESSAGES = {
  FORBIDDEN: "You can’t manage this agent. Ask a workspace admin, or an agent above it.",
  INVALID_INPUT:
    "Check the fields: the name can’t be empty, the photo must be an https link or an image under 2 MB, and metadata keys start with a letter.",
  LIMIT_REACHED: "That’s the limit here: agents nest at most 5 deep, and an agent has at most 20 active keys.",
  NOT_FOUND: "This agent no longer exists.",
};
