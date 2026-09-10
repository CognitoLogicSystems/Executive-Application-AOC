const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LABOR_COST_REGEX = /^\$?\s*\d{1,6}(?:,\d{3})*(?:\.\d{1,2})?\s*(?:\/?\s*(?:hr|hour))?$/i;

export const EMAIL_MAX_LENGTH = 254;
export const FRICTION_POINT_MIN_LENGTH = 10;
export const FRICTION_POINT_MAX_LENGTH = 1000;

export function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

export function sanitizeText(input, maxLength = FRICTION_POINT_MAX_LENGTH) {
  const cleaned = String(input ?? "")
    .replace(/[\p{Cc}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.slice(0, maxLength);
}

export function parseLaborCost(input) {
  const raw = String(input ?? "").trim();
  if (!LABOR_COST_REGEX.test(raw)) {
    return null;
  }

  const numeric = Number(raw.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0 || numeric > 1000000) {
    return null;
  }

  const rounded = Math.round(numeric * 100) / 100;
  return {
    amount: rounded,
    formatted: `$${rounded.toFixed(2)}/hr`,
  };
}

export function validateApplicationInput({ email, laborCost, frictionPoint, consentAccepted }) {
  const errors = [];
  const normalizedEmail = normalizeEmail(email);
  const sanitizedFrictionPoint = sanitizeText(frictionPoint);
  const parsedLaborCost = parseLaborCost(laborCost);

  if (!normalizedEmail || normalizedEmail.length > EMAIL_MAX_LENGTH || !EMAIL_REGEX.test(normalizedEmail)) {
    errors.push("Enter a valid email address.");
  }

  if (!parsedLaborCost) {
    errors.push("Enter labor cost as a positive hourly value (example: $65/hr).");
  }

  if (
    sanitizedFrictionPoint.length < FRICTION_POINT_MIN_LENGTH ||
    sanitizedFrictionPoint.length > FRICTION_POINT_MAX_LENGTH
  ) {
    errors.push("Describe the waste vector using 10 to 1000 characters.");
  }

  if (consentAccepted !== true) {
    errors.push("You must consent to data storage before submitting.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      email: normalizedEmail,
      laborCostHourly: parsedLaborCost.amount,
      laborCostEstimate: parsedLaborCost.formatted,
      frictionPointDescription: sanitizedFrictionPoint,
      consentAccepted: true,
    },
  };
}
