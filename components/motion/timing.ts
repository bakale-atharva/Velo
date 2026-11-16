// Velo motion timing. One grammar: short, exponential ease-out, starting from
// an already-visible state so nothing waits on animation to be readable.
export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

export const DURATION = {
  /** Hover, press, small state flips. */
  fast: 0.12,
  /** Entrances, list reorders, panels. */
  base: 0.2,
} as const;
