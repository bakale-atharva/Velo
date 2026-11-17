import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { WorkspaceShell } from "@/components/shell/workspace-shell";
import { ShellSkeleton } from "@/components/shell/shell-skeleton";

type Props = {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
};

/**
 * The URL slug must be the active organization. proxy.ts activates it when the
 * user is a member; otherwise the active org stays different and we 404.
 */
async function ActiveWorkspace({ children, params }: Props) {
  const [{ orgSlug }, session] = await Promise.all([params, auth()]);
  if (session.orgSlug !== orgSlug) {
    notFound();
  }
  return <WorkspaceShell orgSlug={orgSlug}>{children}</WorkspaceShell>;
}

export default function WorkspaceLayout(props: Props) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <ActiveWorkspace {...props} />
    </Suspense>
  );
}
