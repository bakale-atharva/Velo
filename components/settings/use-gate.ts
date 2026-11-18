"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { GatedFeature } from "@/components/states/upgrade-prompt";

export type Gate = "loading" | "admins-only" | "upgrade" | "open";

/**
 * Whether an admin-only, plan-gated page can load, checked before calling
 * queries that would refuse. The backend still enforces both itself.
 */
export function useAdminGate(feature: GatedFeature): Gate {
  const me = useQuery(api.members.me, {});
  const plan = useQuery(api.billing.currentPlan, {});
  if (me === undefined || plan === undefined) return "loading";
  if (me.role !== "admin") return "admins-only";
  if (!plan.features.includes(feature)) return "upgrade";
  return "open";
}
