import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";

/** Signed-in visitors go straight to their workspace (or to pick one). */
async function RedirectSignedIn() {
  const { userId, orgSlug } = await auth();
  if (userId !== null) {
    redirect(orgSlug ? `/${orgSlug}/my-issues` : "/onboarding");
  }
  return null;
}

export default function Home() {
  return (
    <main className="grid min-h-dvh grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <Suspense>
        <RedirectSignedIn />
      </Suspense>
      <section className="flex min-h-[40dvh] flex-col justify-end bg-brand px-8 py-8 text-brand-foreground lg:min-h-0 lg:px-12 lg:py-12">
        <h1 className="font-display text-[clamp(96px,16vw,224px)] leading-[0.82] font-extrabold tracking-[-0.04em] [font-stretch:75%]">
          Velo
        </h1>
      </section>
      <section className="flex flex-col justify-end gap-8 border-rule px-8 py-12 lg:border-l lg:px-16 lg:py-12">
        <p className="max-w-[28ch] text-[clamp(28px,3.2vw,44px)] leading-[1.05] font-semibold tracking-[-0.02em]">
          Your team&rsquo;s work on one board, moving as fast as you type.
        </p>
        <ul className="grid max-w-xl grid-cols-1 border-t border-rule sm:grid-cols-3">
          {[
            ["Live", "Every change appears for everyone the moment it happens."],
            ["Keyboard", "Create, move and assign without leaving the keys."],
            ["Workspaces", "Each organization’s data stays its own."],
          ].map(([title, body]) => (
            <li key={title} className="border-b border-border py-3 sm:border-b-0 sm:pr-4">
              <h2 className="text-[13px] font-semibold">{title}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Link href="/sign-up" className={buttonVariants({ size: "lg" })}>
            Create a workspace
          </Link>
          <Link href="/sign-in" className={buttonVariants({ size: "lg", variant: "outline" })}>
            Sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
