"use client";

import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type HTMLMotionProps,
} from "motion/react";
import { DURATION, EASE_OUT_EXPO } from "./timing";

/**
 * A row that slides to its new place when the list reorders (an issue moves
 * state, a teammate re-ranks). Wrap the list in `ListPresence` so rows that
 * leave fade out instead of vanishing.
 */
export function ListItem({ children, ...props }: HTMLMotionProps<"li">) {
  const reduce = useReducedMotion();
  return (
    <motion.li
      layout={reduce ? false : "position"}
      initial={reduce ? false : { opacity: 0.6 }}
      animate={{ opacity: 1 }}
      exit={reduce ? undefined : { opacity: 0 }}
      transition={{ duration: DURATION.base, ease: EASE_OUT_EXPO }}
      {...props}
    >
      {children}
    </motion.li>
  );
}

export function ListPresence({ children }: { children: React.ReactNode }) {
  return <AnimatePresence initial={false}>{children}</AnimatePresence>;
}
