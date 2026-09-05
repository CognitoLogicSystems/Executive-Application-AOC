import { describe, expect, it } from "vitest";
import {
  buildApplicantIndexRecord,
  buildApplicationRecord,
  hashEmail,
  prepareSubmission,
} from "../src/submission.js";

describe("submission", () => {
  it("generates deterministic applicant hash", async () => {
    const first = await hashEmail("founder@example.com");
    const second = await hashEmail("founder@example.com");

    expect(first).toHaveLength(64);
    expect(first).toBe(second);
  });

  it("prepares validated submission payload", async () => {
    const prepared = await prepareSubmission({
      email: "Founder@Example.com",
      laborCost: "$120/hr",
      frictionPoint: "Our finance team manually reconciles invoices every week.",
      consentAccepted: true,
    });

    expect(prepared.ok).toBe(true);
    expect(prepared.value.email).toBe("founder@example.com");
    expect(prepared.value.emailHash).toHaveLength(64);
  });

  it("builds firestore records", () => {
    const preparedValue = {
      email: "founder@example.com",
      emailHash: "a".repeat(64),
      laborCostEstimate: "$85.00/hr",
      laborCostHourly: 85,
      frictionPointDescription: "Manual churn analysis is slow.",
      consentAccepted: true,
    };

    const submittedAtIso = "2026-09-05T22:00:00.000Z";
    const application = buildApplicationRecord({
      preparedValue,
      userId: "user-123",
      submittedAtIso,
    });
    const applicant = buildApplicantIndexRecord({
      preparedValue,
      userId: "user-123",
      submittedAtIso,
    });

    expect(application.email_hash).toBe(preparedValue.emailHash);
    expect(application.consent_accepted).toBe(true);
    expect(applicant.user_id).toBe("user-123");
  });
});
