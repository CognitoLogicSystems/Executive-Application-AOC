import { validateApplicationInput } from "./validation.js";

export async function hashEmail(normalizedEmail) {
  const data = new TextEncoder().encode(normalizedEmail);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function prepareSubmission(formValues) {
  const validation = validateApplicationInput(formValues);
  if (!validation.ok) {
    return validation;
  }

  const emailHash = await hashEmail(validation.value.email);

  return {
    ok: true,
    value: {
      ...validation.value,
      emailHash,
    },
  };
}

export function buildApplicationRecord({ preparedValue, userId, submittedAtIso }) {
  return {
    email: preparedValue.email,
    email_hash: preparedValue.emailHash,
    labor_cost_estimate: preparedValue.laborCostEstimate,
    labor_cost_hourly: preparedValue.laborCostHourly,
    friction_point_description: preparedValue.frictionPointDescription,
    submission_timestamp: submittedAtIso,
    user_id: userId,
    consent_accepted: true,
    consent_timestamp: submittedAtIso,
  };
}

export function buildApplicantIndexRecord({ preparedValue, userId, submittedAtIso }) {
  return {
    email_hash: preparedValue.emailHash,
    user_id: userId,
    submission_timestamp: submittedAtIso,
  };
}
