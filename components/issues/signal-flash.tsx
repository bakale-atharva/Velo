"use client";

import { useState } from "react";

/**
 * The live-change signal: when `signature` differs from what this element
 * first rendered with, a difference-blend layer inverts it for two frames.
 * Place inside a `relative` parent. Remounting on each new signature replays
 * the flash; reduced motion shortens it to nothing.
 */
export function SignalFlash({ signature }: { signature: string }) {
  const [initial] = useState(signature);
  if (signature === initial) return null;
  return (
    <span
      key={signature}
      aria-hidden
      className="pointer-events-none absolute inset-0 animate-signal bg-white opacity-0 mix-blend-difference"
    />
  );
}
