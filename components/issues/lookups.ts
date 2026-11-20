"use client";

import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";

export type Member = {
  userId: string;
  role: string;
  name: string | null;
  email: string | null;
  imageUrl: string | null;
  // Agent members connect over MCP; they show a square avatar and an AGENT tag.
  isAgent: boolean;
};

/** Labels and members of the active workspace, keyed for row rendering. */
export function useWorkspaceLookups() {
  const labels = useQuery(api.labels.list, {});
  const members = useQuery(api.members.list, {});
  return useMemo(() => {
    // People first, then agents; each in the server's order.
    const sorted = [...(members ?? [])].sort((a, b) => Number(a.isAgent) - Number(b.isAgent));
    return {
      labels: labels ?? [],
      members: sorted,
      labelById: new Map<Id<"labels">, Doc<"labels">>((labels ?? []).map((l) => [l._id, l])),
      memberById: new Map<string, Member>(sorted.map((m) => [m.userId, m])),
      loading: labels === undefined || members === undefined,
    };
  }, [labels, members]);
}

/** "Ada Lovelace" → "AL"; falls back to the email's first letter. */
export function initials(member: Member | undefined): string {
  if (member === undefined) return "?";
  const source = member.name ?? member.email ?? "?";
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]!.toUpperCase()).join("") || "?";
}

export function displayName(member: Member | undefined): string {
  return member?.name ?? member?.email ?? "Unknown member";
}

export const PRIORITY_LABELS = ["No priority", "Urgent", "High", "Medium", "Low"] as const;
