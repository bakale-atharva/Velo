"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Permission } from "@/convex/lib/permissions";

/**
 * Whether the caller has a Velo permission; `undefined` while loading. For
 * hiding controls only: the backend enforces every permission itself.
 */
export function usePermission(permission: Permission): boolean | undefined {
  const permissions = useQuery(api.members.permissions, {});
  return permissions === undefined ? undefined : permissions.includes(permission);
}
