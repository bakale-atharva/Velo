import { ConvexError } from "convex/values";

// Error codes thrown by the backend (convex/lib/errors.ts).
export type ErrorCode =
  | "UNAUTHENTICATED"
  | "NO_ACTIVE_ORG"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "FEATURE_NOT_IN_PLAN"
  | "LIMIT_REACHED"
  | "SEAT_LIMIT_REACHED"
  | "INVALID_INPUT";

const MESSAGES: Record<ErrorCode, string> = {
  UNAUTHENTICATED: "Your session ended. Sign in again to continue.",
  NO_ACTIVE_ORG: "Choose a workspace to continue.",
  FORBIDDEN: "You don’t have permission to do that. Ask a workspace admin.",
  NOT_FOUND: "This doesn’t exist, or you don’t have access to it.",
  FEATURE_NOT_IN_PLAN: "That’s not part of your workspace’s plan. Upgrade in Settings → Billing.",
  LIMIT_REACHED: "This workspace has reached a limit for that. Remove something or upgrade.",
  SEAT_LIMIT_REACHED: "Your workspace is over its seat limit. An admin needs to upgrade or remove members.",
  INVALID_INPUT: "Something in that isn’t valid. Check the fields and try again.",
};

/** The backend error code carried by a thrown ConvexError, or null. */
export function errorCode(error: unknown): ErrorCode | null {
  if (error instanceof ConvexError && typeof error.data === "string" && error.data in MESSAGES) {
    return error.data as ErrorCode;
  }
  return null;
}

/** A plain message for any error; pass overrides for messages specific to a form. */
export function errorMessage(
  error: unknown,
  overrides: Partial<Record<ErrorCode, string>> = {},
): string {
  const code = errorCode(error);
  if (code === null) {
    return "Something went wrong. Try again.";
  }
  return overrides[code] ?? MESSAGES[code];
}
