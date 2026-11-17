"use client";

import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { api } from "@/convex/_generated/api";

/** The team named in the URL (`/[orgSlug]/team/[teamKey]/...`) and its states. */
export function useTeamFromUrl() {
  const { orgSlug, teamKey } = useParams<{ orgSlug: string; teamKey: string }>();
  const team = useQuery(api.teams.get, { key: teamKey });
  const states = useQuery(api.workflowStates.list, team ? { teamId: team._id } : "skip");
  return { orgSlug, teamKey, team, states };
}
