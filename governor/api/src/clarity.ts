import type { DecisionReason } from "./types";

export const REASON_PLAIN_LANGUAGE: Record<DecisionReason, string> = {
  allowed: "Escalation allowed.",
  cooldown_active:
    "User recently dismissed or ignored this type. Try again after cooldown.",
  type_cap_reached:
    "Maximum allowed for this type in the last 24 hours.",
  global_cap_reached:
    "Maximum total escalations (4) in the last 24 hours.",
  recent_escalation:
    "Another escalation occurred in the last 10 minutes; avoid stacking."
};

export function formatExplanation(
  reason: DecisionReason,
  options?: { cooldownUntil?: string; actionType?: string }
): string {
  if (reason === "allowed") return REASON_PLAIN_LANGUAGE.allowed;
  if (reason === "cooldown_active" && options?.cooldownUntil) {
    return `User recently dismissed or ignored this type. Cooldown expires at ${options.cooldownUntil}.`;
  }
  return REASON_PLAIN_LANGUAGE[reason];
}
