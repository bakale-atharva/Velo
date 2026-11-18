"use client";

import { useMutation, useQuery } from "convex/react";
import { Trash2 } from "lucide-react";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { Permission } from "@/convex/lib/permissions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { AssigneeAvatar } from "@/components/issues/assignee-avatar";
import { displayName, useWorkspaceLookups } from "@/components/issues/lookups";
import { ALL_PERMISSIONS, permissionName } from "@/components/settings/plans";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { useAdminGate } from "@/components/settings/use-gate";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorBoundary } from "@/components/states/error-boundary";
import { PageSkeleton } from "@/components/states/page-skeleton";
import { UpgradePrompt } from "@/components/states/upgrade-prompt";
import { errorMessage } from "@/lib/errors";

const MESSAGES = {
  INVALID_INPUT: "A role with that name already exists, or the name is empty.",
  LIMIT_REACHED: "This workspace has the most roles it can have.",
};

function PermissionChecks({
  value,
  onChange,
  idPrefix,
}: {
  value: Permission[];
  onChange: (value: Permission[]) => void;
  idPrefix: string;
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-2">
      {ALL_PERMISSIONS.map((permission) => (
        <label key={permission} htmlFor={`${idPrefix}-${permission}`} className="inline-flex items-center gap-2 py-1 text-[14px]">
          <Checkbox
            id={`${idPrefix}-${permission}`}
            checked={value.includes(permission)}
            onCheckedChange={(checked) =>
              onChange(checked ? [...value, permission] : value.filter((p) => p !== permission))
            }
          />
          {permissionName(permission)}
        </label>
      ))}
    </div>
  );
}

function RoleCard({ role }: { role: Doc<"customRoles"> }) {
  const update = useMutation(api.roles.update);
  const remove = useMutation(api.roles.remove);
  const fail = (error: unknown) => toast.error(errorMessage(error, MESSAGES));
  return (
    <li className="rounded-[20px] bg-tile p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[16px] font-medium">{role.name}</h3>
        <button
          type="button"
          aria-label={`Delete role ${role.name}`}
          onClick={() =>
            remove({ roleId: role._id })
              .then(() => toast.success(`Deleted ${role.name}. Its members are back on the defaults.`))
              .catch(fail)
          }
          className="grid size-8 place-items-center rounded-[10px] text-muted-foreground hover:bg-muted hover:text-destructive focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="mt-2">
        <PermissionChecks
          idPrefix={role._id}
          value={role.permissions}
          onChange={(permissions) => update({ roleId: role._id, permissions }).catch(fail)}
        />
      </div>
    </li>
  );
}

function NewRole() {
  const create = useMutation(api.roles.create);
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState<Permission[]>([]);
  return (
    <form
      className="mt-4 grid gap-3 border-t border-border px-1 pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim() === "") return;
        create({ name, permissions })
          .then(() => {
            setName("");
            setPermissions([]);
          })
          .catch((error: unknown) => toast.error(errorMessage(error, MESSAGES)));
      }}
    >
      <Input
        aria-label="New role name"
        placeholder="New role, e.g. Triager"
        maxLength={40}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-64"
      />
      <PermissionChecks idPrefix="new-role" value={permissions} onChange={setPermissions} />
      <div>
        <Button type="submit" variant="outline" disabled={name.trim() === ""}>
          Create role
        </Button>
      </div>
    </form>
  );
}

function Assignments({ roles }: { roles: Doc<"customRoles">[] }) {
  const assignments = useQuery(api.roles.assignments, {});
  const assign = useMutation(api.roles.assign);
  const { members } = useWorkspaceLookups();
  if (assignments === undefined) return <PageSkeleton rows={3} />;
  const roleOf = new Map(assignments.map((a) => [a.userId, a.roleId]));
  return (
    <ul className="flex flex-col gap-0.5">
      {members.map((member) => (
        <li key={member.userId} className="flex items-center gap-3 rounded-[14px] px-3 py-2 hover:bg-tile/60">
          <AssigneeAvatar member={member} size={24} />
          <span className="min-w-0 flex-1 truncate text-[15px]">{displayName(member)}</span>
          {member.role === "admin" ? (
            <span className="text-[13px] text-muted-foreground">Admin, every permission</span>
          ) : (
            <select
              aria-label={`Role for ${displayName(member)}`}
              value={roleOf.get(member.userId) ?? ""}
              onChange={(e) =>
                assign({
                  userId: member.userId,
                  roleId: e.target.value === "" ? null : (e.target.value as Id<"customRoles">),
                }).catch((error: unknown) => toast.error(errorMessage(error)))
              }
              className="h-9 w-56 rounded-[10px] border border-input bg-popover px-2 text-[14px] focus-visible:outline-2 focus-visible:outline-ring"
            >
              <option value="">Member defaults</option>
              {roles.map((role) => (
                <option key={role._id} value={role._id}>
                  {role.name}
                </option>
              ))}
            </select>
          )}
        </li>
      ))}
    </ul>
  );
}

function RolesBody() {
  const roles = useQuery(api.roles.list, {});
  if (roles === undefined) return <PageSkeleton rows={5} />;
  return (
    <div className="grid gap-5">
      <SettingsPanel
        title="Roles"
        description="A role replaces the member defaults (manage projects and cycles, share views) with exactly the permissions you tick. Admins always have every permission."
      >
        {roles.length === 0 ? (
          <p className="px-1 text-[15px] text-muted-foreground">No custom roles yet.</p>
        ) : (
          <ul className="grid gap-3">
            {roles.map((role) => (
              <RoleCard key={role._id} role={role} />
            ))}
          </ul>
        )}
        <NewRole />
      </SettingsPanel>
      <SettingsPanel title="Who has which role" description="Changes apply on the member’s next action.">
        <Assignments roles={roles} />
      </SettingsPanel>
    </div>
  );
}

function Roles() {
  const gate = useAdminGate("custom_roles");
  if (gate === "loading") return <PageSkeleton rows={5} />;
  if (gate === "admins-only") {
    return <EmptyState title="Roles are managed by admins">Ask a workspace admin to change your permissions.</EmptyState>;
  }
  if (gate === "upgrade") return <UpgradePrompt feature="custom_roles" />;
  return <RolesBody />;
}

export default function RolesSettingsPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSkeleton rows={5} />}>
        <Roles />
      </Suspense>
    </ErrorBoundary>
  );
}
