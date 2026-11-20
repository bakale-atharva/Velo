import Link from "next/link";
import { VeloMark } from "./velo-mark";

/**
 * The frame around sign-in, sign-up and workspace choice: the mark in a
 * ruled header, the content centred below, and the empty signal band (the
 * barcode with no events yet) closing the page.
 */
export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center border-b border-rule px-4 md:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <VeloMark size={18} />
          <span className="text-[17px] font-semibold tracking-[-0.03em]">Velo</span>
        </Link>
      </header>
      <main className="grid flex-1 place-items-center px-4 py-12">{children}</main>
      <div
        aria-hidden
        className="h-10 border-t border-rule opacity-60"
        style={{ background: "repeating-linear-gradient(90deg, var(--border) 0 1px, transparent 1px 6px)" }}
      />
    </div>
  );
}
