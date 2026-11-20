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

// A decorative signal field: seeded, so server and client draw the same bars.
// It illustrates the in-app activity barcode; it is not real data.
const FIELD = (() => {
  let seed = 7;
  const next = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  return Array.from({ length: 220 }, (_, index) => {
    const wave = 0.5 + 0.5 * Math.sin(index / 9);
    return { x: index * 5 + next() * 2, w: next() < 0.25 ? 2.4 : 1, h: 20 + wave * 60 + next() * 20, o: next() < 0.15 ? 1 : 0.55 };
  });
})();

export default function Home() {
  return (
    <main className="dark flex min-h-dvh flex-col bg-black text-white">
      <Suspense>
        <RedirectSignedIn />
      </Suspense>
      <header className="flex h-14 items-center justify-between border-b border-white/20 px-4 md:px-8">
        <span className="flex items-center gap-2.5">
          <VeloMark size={18} />
          <span className="text-[17px] font-semibold tracking-[-0.03em]">Velo</span>
        </span>
        <Link href="/sign-in" className="data text-[12px] tracking-[0.14em] uppercase hover:underline">
          Sign in
        </Link>
      </header>

      <section className="flex flex-1 flex-col justify-end px-4 pt-16 pb-10 md:px-8">
        <h1 className="max-w-[16ch] text-[clamp(44px,7.4vw,112px)] leading-[0.92] font-semibold tracking-[-0.045em]">
          Your team&rsquo;s work, moving as fast as you type.
        </h1>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link href="/sign-up" className={`${buttonVariants()} h-11 bg-white px-5 text-[14px] text-black hover:bg-white/85`}>
            Create a workspace
          </Link>
          <Link
            href="/sign-in"
            className={`${buttonVariants({ variant: "outline" })} h-11 border-white/40 px-5 text-[14px] text-white hover:border-white`}
          >
            Sign in
          </Link>
        </div>
      </section>

      <svg
        aria-hidden
        viewBox="0 0 1100 100"
        preserveAspectRatio="none"
        className="h-[22vh] min-h-32 w-full border-y border-white/20"
      >
        {FIELD.map((bar, index) => (
          <rect key={index} x={bar.x} y={100 - bar.h} width={bar.w} height={bar.h} fill="#fff" opacity={bar.o} />
        ))}
      </svg>

      <ul className="grid grid-cols-1 md:grid-cols-3">
        {FEATURES.map(([title, body]) => (
          <li key={title} className="border-b border-white/20 px-4 py-6 md:border-r md:border-b-0 md:px-8 md:last:border-r-0">
            <h2 className="data text-[12px] tracking-[0.18em] uppercase">{title}</h2>
            <p className="mt-2 max-w-[34ch] text-[15px] leading-6 text-white/70">{body}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
