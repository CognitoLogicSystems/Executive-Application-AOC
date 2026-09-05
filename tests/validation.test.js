import { describe, expect, it } from "vitest";
import {
  normalizeEmail,
  parseLaborCost,
  sanitizeText,
  validateApplicationInput,
} from "../src/validation.js";

describe("validation", () => {
  it("normalizes email", () => {
    expect(normalizeEmail("  USER@Example.COM ")).toBe("user@example.com");
  });

  it("parses labor cost with currency format", () => {
    expect(parseLaborCost("$65/hr")).toEqual({ amount: 65, formatted: "$65.00/hr" });
  });

  it("sanitizes text and strips control characters", () => {
    expect(sanitizeText("  Hello\n\tworld\u0000 ")).toBe("Hello world");
  });

  it("accepts a valid submission", () => {
    const result = validateApplicationInput({
      email: "founder@example.com",
      laborCost: "$75/hr",
      frictionPoint: "Manual reporting takes our ops team too long every day.",
      consentAccepted: true,
    });

    expect(result.ok).toBe(true);
    expect(result.value.email).toBe("founder@example.com");
    expect(result.value.laborCostHourly).toBe(75);
  });

  it("rejects invalid labor cost", () => {
    const result = validateApplicationInput({
      email: "founder@example.com",
      laborCost: "free",
      frictionPoint: "Manual reporting takes too long.",
      consentAccepted: true,
    });

    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("labor cost");
  });
});
