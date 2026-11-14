import { ConvexError } from "convex/values";

export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "NO_ACTIVE_ORG",
  "FORBIDDEN",
  "NOT_FOUND",
  "FEATURE_NOT_IN_PLAN",
  "LIMIT_REACHED",
  "INVALID_INPUT",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export function appError(code: ErrorCode): ConvexError<ErrorCode> {
  return new ConvexError(code);
}
