import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { VeloMark } from "@/components/shell/velo-mark";

/** Signed-in visitors go straight to their workspace (or to pick one). */
async function RedirectSignedIn() {
  const { userId, orgSlug } = await auth();
  if (userId !== null) {
    redirect(orgSlug ? `/${orgSlug}/my-issues` : "/onboarding");
  }
  return null;
}

const FEATURES = [
  ["Live", "Every change appears for everyone the moment it happens."],
  ["Keyboard", "Create, move and assign without leaving the keys."],
  ["Workspaces", "Each organization’s data stays its own."],
] as const;

export default function Home() {
  return (
    <main className="grid min-h-dvh grid-cols-1 gap-3 p-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <Suspense>
        <RedirectSignedIn />
      </Suspense>
      <section className="chip-dark flex min-h-[40dvh] flex-col justify-between rounded-[28px] p-8 lg:min-h-0 lg:p-12">
        <VeloMark size={44} />
        <h1 className="text-[clamp(88px,13vw,176px)] leading-[0.85] font-semibold tracking-[-0.04em]">Velo</h1>
      </section>
      <section className="panel flex flex-col justify-end gap-10 rounded-[28px] p-8 lg:p-14">
        <p className="max-w-[24ch] text-[clamp(30px,3.4vw,48px)] leading-[1.08] font-semibold tracking-[-0.02em]">
          Your team&rsquo;s work on one board, moving as fast as you type.
        </p>
        <ul className="grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
          {FEATURES.map(([title, body]) => (
            <li key={title} className="rounded-[18px] bg-tile p-5">
              <h2 className="text-[15px] font-semibold">{title}</h2>
              <p className="mt-1.5 text-[14px] leading-5 text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-3">
          <Link href="/sign-up" className={`${buttonVariants({ size: "lg" })} h-12 px-6 text-[15px]`}>
            Create a workspace
          </Link>
          <Link
            href="/sign-in"
            className={`${buttonVariants({ size: "lg", variant: "outline" })} h-12 rounded-full px-6 text-[15px]`}
          >
            Sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
