"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { DURATION, EASE_OUT_EXPO } from "./timing";

type FadeInProps = HTMLMotionProps<"div"> & {
  /** Seconds before the fade starts. */
  delay?: number;
};

/**
 * Fades content in with a 4px rise. Starts at 60% opacity, never invisible,
 * so text is readable even if the animation never runs.
 */
export function FadeIn({ delay = 0, children, ...props }: FadeInProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0.6, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.base, ease: EASE_OUT_EXPO, delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
