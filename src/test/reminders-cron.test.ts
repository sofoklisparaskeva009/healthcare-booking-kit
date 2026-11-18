import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  buildReminderMessageText,
  handleRemindersCron,
  resolveBaseUrl,
} from "../lib/remindersCron.server";

describe("48-Hour Automated Reminders Cron (Phase 2)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env["CRON_SECRET"];
    delete process.env["NEXT_PUBLIC_BASE_URL"];
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns 401 Unauthorized when Authorization header does not match Bearer CRON_SECRET", async () => {
    process.env["CRON_SECRET"] = "super-secret-cron-token";

    const unauthorizedReq = new Request("https://example.com/api/cron/reminders", {
      method: "GET",
      headers: {
        Authorization: "Bearer wrong-token",
      },
    });
    const res1 = await handleRemindersCron(unauthorizedReq);
    expect(res1.ok).toBe(false);
    expect(res1.status).toBe(401);

    const missingHeaderReq = new Request("https://example.com/api/cron/reminders", {
      method: "GET",
    });
    const res2 = await handleRemindersCron(missingHeaderReq);
    expect(res2.ok).toBe(false);
    expect(res2.status).toBe(401);
  });

  it("resolves NEXT_PUBLIC_BASE_URL without trailing slash", () => {
    process.env["NEXT_PUBLIC_BASE_URL"] = "https://clinic.example.com/";
    expect(resolveBaseUrl()).toBe("https://clinic.example.com");
  });

  it("builds bilingual Greek (el) and English (en) reminder text with actionUrl", () => {
    const token = "123e4567-e89b-12d3-a456-426614174000";
    const actionUrl = `https://clinic.example.com/manage-booking?token=${token}`;

    const elText = buildReminderMessageText("2026-11-20", "10:30", actionUrl, "el");
    expect(elText).toContain("Υπενθύμιση ραντεβού: Έχετε κράτηση στις");
    expect(elText).toContain("10:30");
    expect(elText).toContain(
      `Παρακαλούμε επιβεβαιώστε ή ακυρώστε την παρουσία σας εδώ: ${actionUrl}`,
    );

    const enText = buildReminderMessageText("2026-11-20", "10:30", actionUrl, "en");
    expect(enText).toContain("Appointment reminder for");
    expect(enText).toContain("10:30");
    expect(enText).toContain(`Please confirm or cancel your attendance here: ${actionUrl}`);
  });
});
