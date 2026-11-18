import { errorCode, errorMessage } from "@/lib/errors";

/**
 * Plain messages for assistant failures: a thrown error, or the
 * "MODEL_UNAVAILABLE" reason the AI actions return instead of throwing.
 */
export function aiErrorMessage(error: unknown): string {
  if (error === "MODEL_UNAVAILABLE") {
    return "The assistant’s models are busy right now. Try again in a minute.";
  }
  if (errorCode(error) === "LIMIT_REACHED") {
    return "Your workspace has used today’s assistant requests. They reset within 24 hours, or upgrade for more.";
  }
  return errorMessage(error, {
    FEATURE_NOT_IN_PLAN: "The assistant isn’t part of your workspace’s plan. Upgrade in Settings → Billing.",
  });
}
