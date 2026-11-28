"use client";

import { SignOutButton, useOrganizationList, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/errors";

// Where people land after signing up when no workspace is active: join a
// workspace they were invited to, open one they belong to, or choose between
// waiting for an invite and creating their own. A workspace is never forced.

const CHECK_INVITES_MS = 10_000;

function Section({ label, count, children }: { label: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="border-t border-rule pt-4">
      <h2 className="signal-label">
        {label}
        {count !== undefined && <> / {String(count).padStart(2, "0")}</>}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Row({ name, action }: { name: string; action: React.ReactNode }) {
  return (
    <li className="flex h-12 items-center justify-between gap-4 border-b border-border">
      <span className="truncate text-[14px] font-medium">{name}</span>
      {action}
    </li>
  );
}

export function WorkspaceLanding() {
  const router = useRouter();
  const { user } = useUser();
  const { isLoaded, setActive, createOrganization, userMemberships, userInvitations } = useOrganizationList({
    userMemberships: { infinite: true },
    userInvitations: { infinite: true },
  });
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const memberships = userMemberships.data ?? [];
  const invitations = userInvitations.data ?? [];
  const ready = isLoaded && !userMemberships.isLoading && !userInvitations.isLoading;

  const open = async (organizationId: string, slug: string | null) => {
    if (!setActive) return;
    await setActive({ organization: organizationId });
    router.push(slug === null ? "/" : `/${slug}/my-issues`);
  };

  // One workspace and nothing pending: go straight in (an invited teammate's usual path).
  const only = ready && memberships.length === 1 && invitations.length === 0 ? memberships[0].organization : null;
  useEffect(() => {
    if (only !== null) void open(only.id, only.slug);
    // `open` is recreated each render; the target is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [only?.id]);

  // While waiting, new invitations appear without a reload.
  const revalidateInvites = userInvitations.revalidate;
  useEffect(() => {
    if (!ready || memberships.length > 0) return;
    const timer = setInterval(() => void revalidateInvites?.(), CHECK_INVITES_MS);
    return () => clearInterval(timer);
  }, [ready, memberships.length, revalidateInvites]);

  const run = async (key: string, task: () => Promise<void>) => {
    setBusy(key);
    try {
      await task();
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(null);
    }
  };

  const email = user?.primaryEmailAddress?.emailAddress ?? null;

  if (!ready || only !== null) {
    return (
      <p className="data text-[12px] tracking-[0.14em] text-muted-foreground uppercase" role="status">
        Loading workspaces…
      </p>
    );
  }

  return (
    <div className="grid w-full max-w-2xl gap-10">
      <div>
        <h1 className="text-[44px] leading-[0.95] font-semibold tracking-[-0.04em] md:text-[64px]">
          {memberships.length > 0 ? "Pick a workspace" : "Welcome to Velo"}
        </h1>
        <p className="mt-4 max-w-[56ch] text-[14px] leading-6 text-muted-foreground">
          {memberships.length > 0
            ? "Open one of your workspaces, or join one you were invited to."
            : "Velo work happens inside a workspace. Join your team’s when they invite you, or start your own."}
        </p>
      </div>

      {invitations.length > 0 && (
        <Section label="Invitations" count={invitations.length}>
          <ul>
            {invitations.map((invitation) => (
              <Row
                key={invitation.id}
                name={invitation.publicOrganizationData.name}
                action={
                  <Button
                    disabled={busy !== null}
                    onClick={() =>
                      void run(invitation.id, async () => {
                        await invitation.accept();
                        await open(invitation.publicOrganizationData.id, invitation.publicOrganizationData.slug);
                      })
                    }
                  >
                    {busy === invitation.id ? "Joining…" : "Join"}
                  </Button>
                }
              />
            ))}
          </ul>
        </Section>
      )}

      {memberships.length > 0 && (
        <Section label="Your workspaces" count={memberships.length}>
          <ul>
            {memberships.map(({ organization }) => (
              <Row
                key={organization.id}
                name={organization.name}
                action={
                  <Button
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => void run(organization.id, () => open(organization.id, organization.slug))}
                  >
                    {busy === organization.id ? "Opening…" : "Open"}
                  </Button>
                }
              />
            ))}
          </ul>
        </Section>
      )}

      <div className="grid border border-rule md:grid-cols-2">
        <section className="flex flex-col gap-4 border-b border-rule p-5 md:border-r md:border-b-0">
          <h2 className="signal-label">Wait for an invite</h2>
          <p className="text-[14px] leading-6">
            Ask a teammate to invite{" "}
            {email === null ? "you" : <span className="data text-[13px] break-all">{email}</span>}. Invitations show up on
            this page by themselves.
          </p>
          <div className="mt-auto">
            <Button
              variant="outline"
              disabled={busy !== null}
              onClick={() => void run("check", async () => {
                await userInvitations.revalidate?.();
                setBusy(null);
              })}
            >
              {busy === "check" ? "Checking…" : "Check now"}
            </Button>
          </div>
        </section>
        <form
          className="flex flex-col gap-4 p-5"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = name.trim();
            if (trimmed === "" || !createOrganization) return;
            void run("create", async () => {
              const organization = await createOrganization({ name: trimmed });
              await open(organization.id, organization.slug);
            });
          }}
        >
          <h2 className="signal-label">Create a workspace</h2>
          <p className="text-[14px] leading-6">Start a workspace for your own team. You can invite people once it exists.</p>
          <div className="mt-auto grid gap-2">
            <label htmlFor="workspace-name" className="sr-only">
              Workspace name
            </label>
            <Input
              id="workspace-name"
              placeholder="Workspace name"
              value={name}
              maxLength={64}
              onChange={(event) => setName(event.target.value)}
            />
            <Button type="submit" variant="outline" disabled={busy !== null || name.trim() === ""}>
              {busy === "create" ? "Creating…" : "Create workspace"}
            </Button>
          </div>
        </form>
      </div>

      <p className="text-[13px] text-muted-foreground">
        Wrong account?{" "}
        <SignOutButton redirectUrl="/">
          <button type="button" className="underline hover:text-foreground">
            Sign out
          </button>
        </SignOutButton>
      </p>
    </div>
  );
}
