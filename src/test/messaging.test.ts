/**
 * Messaging Service — Unit & Integration Tests
 *
 * Tests the messaging module (messaging.server.ts) and webhook handler
 * (messagingWebhook.server.ts) independently from the Twilio API and Supabase.
 * All external I/O is mocked via vi.stubGlobal / vi.spyOn.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isMessagingConfigured,
  getMessagingCredentials,
  buildConfirmationUrls,
  renderBookingConfirmationMessage,
  renderReminderMessage,
  sendBookingConfirmation,
  sendBookingReminder,
  type MessagingBookingData,
} from "../lib/messaging.server";
import {
  validateTwilioSignature,
  handleMessagingWebhook,
} from "../lib/messagingWebhook.server";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const sampleBooking: MessagingBookingData = {
  bookingId: "550e8400-e29b-41d4-a716-446655440000",
  patientName: "Ανδρέας Νικολάου",
  patientPhone: "+35799123456",
  serviceName: "Αρχική Εκτίμηση & Μυοσκελετικός Έλεγχος",
  appointmentType: "gesy",
  appointmentDate: "2026-11-15",
  appointmentTime: "10:00",
  privateFee: null,
  locale: "el",
};

const privateBooking: MessagingBookingData = {
  ...sampleBooking,
  bookingId: "660e8400-e29b-41d4-a716-446655440001",
  appointmentType: "private",
  privateFee: 50,
  serviceName: "Ειδική Θεραπεία / Manual Therapy",
  locale: "el",
};

// ---------------------------------------------------------------------------
// 1. Configuration & credential detection
// ---------------------------------------------------------------------------

describe("Messaging Configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env["TWILIO_ACCOUNT_SID"];
    delete process.env["TWILIO_AUTH_TOKEN"];
    delete process.env["TWILIO_FROM_NUMBER"];
    delete process.env["TWILIO_WHATSAPP_NUMBER"];
    delete process.env["TWILIO_VIBER_SERVICE_SID"];
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("reports not configured when env vars are absent", () => {
    expect(isMessagingConfigured()).toBe(false);
    expect(getMessagingCredentials()).toBeNull();
  });

  it("reports configured when all required vars are present", () => {
    process.env["TWILIO_ACCOUNT_SID"] = "ACtest123";
    process.env["TWILIO_AUTH_TOKEN"] = "authtoken123";
    process.env["TWILIO_FROM_NUMBER"] = "+35725000000";
    expect(isMessagingConfigured()).toBe(true);
  });

  it("returns credentials with optional WhatsApp and Viber fields", () => {
    process.env["TWILIO_ACCOUNT_SID"] = "ACtest123";
    process.env["TWILIO_AUTH_TOKEN"] = "authtoken123";
    process.env["TWILIO_FROM_NUMBER"] = "+35725000000";
    process.env["TWILIO_WHATSAPP_NUMBER"] = "+14155238886";
    process.env["TWILIO_VIBER_SERVICE_SID"] = "VSviber123";

    const creds = getMessagingCredentials();
    expect(creds).not.toBeNull();
    expect(creds!.accountSid).toBe("ACtest123");
    expect(creds!.whatsappNumber).toBe("+14155238886");
    expect(creds!.viberServiceId).toBe("VSviber123");
  });

  it("returns null when only some required vars are set", () => {
    process.env["TWILIO_ACCOUNT_SID"] = "ACtest123";
    // Missing authToken and fromNumber
    expect(getMessagingCredentials()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. Confirmation URL builder
// ---------------------------------------------------------------------------

describe("buildConfirmationUrls", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env["PUBLIC_BASE_URL"];
    delete process.env["VITE_PUBLIC_URL"];
    delete process.env["CF_PAGES_URL"];
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("includes confirm and cancel URLs with correct bookingId", () => {
    process.env["PUBLIC_BASE_URL"] = "https://drstylianou.clinic";
    const { confirmUrl, cancelUrl } = buildConfirmationUrls("test-booking-abc");
    expect(confirmUrl).toContain("action=confirm");
    expect(confirmUrl).toContain("bookingId=test-booking-abc");
    expect(cancelUrl).toContain("action=cancel");
    expect(cancelUrl).toContain("bookingId=test-booking-abc");
  });

  it("points to /api/messaging/webhook", () => {
    process.env["PUBLIC_BASE_URL"] = "https://example.com";
    const { confirmUrl } = buildConfirmationUrls("x");
    expect(confirmUrl).toContain("/api/messaging/webhook");
  });
});

// ---------------------------------------------------------------------------
// 3. Message template rendering
// ---------------------------------------------------------------------------

describe("renderBookingConfirmationMessage", () => {
  it("includes doctor name from clinicConfig", () => {
    const { body } = renderBookingConfirmationMessage(sampleBooking);
    expect(body).toContain("Dr. Marinos Stylianou");
  });

  it("includes patient name", () => {
    const { body } = renderBookingConfirmationMessage(sampleBooking);
    expect(body).toContain("Ανδρέας Νικολάου");
  });

  it("includes service name", () => {
    const { body } = renderBookingConfirmationMessage(sampleBooking);
    expect(body).toContain("Αρχική Εκτίμηση");
  });

  it("includes appointment time", () => {
    const { body } = renderBookingConfirmationMessage(sampleBooking);
    expect(body).toContain("10:00");
  });

  it("includes GeSY coverage label for GeSY appointments", () => {
    const { body } = renderBookingConfirmationMessage(sampleBooking);
    expect(body).toContain("GeSY");
  });

  it("includes private fee for private appointments", () => {
    const { body } = renderBookingConfirmationMessage(privateBooking);
    expect(body).toContain("€50");
  });

  it("includes Accept and Cancel action labels in Greek", () => {
    const { actions } = renderBookingConfirmationMessage(sampleBooking);
    const labels = actions.map((a) => a.label);
    expect(labels.some((l) => l.includes("Επιβεβαίωση") || l.includes("Confirm"))).toBe(true);
    expect(labels.some((l) => l.includes("Ακύρωση") || l.includes("Cancel"))).toBe(true);
  });

  it("renders English locale when specified", () => {
    const { body } = renderBookingConfirmationMessage({ ...sampleBooking, locale: "en" });
    expect(body).toContain("Appointment Confirmation");
    expect(body).toContain("Confirm:");
  });

  it("includes shortened booking reference (first 8 chars)", () => {
    const { body } = renderBookingConfirmationMessage(sampleBooking);
    expect(body).toContain(sampleBooking.bookingId.slice(0, 8));
  });
});

describe("renderReminderMessage", () => {
  it("includes reminder header in Greek", () => {
    const { body } = renderReminderMessage(sampleBooking);
    expect(body).toContain("Υπενθύμιση");
  });

  it("includes appointment time", () => {
    const { body } = renderReminderMessage(sampleBooking);
    expect(body).toContain("10:00");
  });

  it("includes only Cancel action (not Confirm) for reminders", () => {
    const { actions } = renderReminderMessage(sampleBooking);
    expect(actions.length).toBe(1);
    expect(actions[0]!.action).toBe("cancel");
  });

  it("renders English reminder when locale is en", () => {
    const { body } = renderReminderMessage({ ...sampleBooking, locale: "en" });
    expect(body).toContain("Appointment Reminder");
  });
});

// ---------------------------------------------------------------------------
// 4. sendBookingConfirmation — graceful degradation without credentials
// ---------------------------------------------------------------------------

describe("sendBookingConfirmation — no credentials", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env["TWILIO_ACCOUNT_SID"];
    delete process.env["TWILIO_AUTH_TOKEN"];
    delete process.env["TWILIO_FROM_NUMBER"];
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns ok:true with skipped:true when credentials are absent", async () => {
    const result = await sendBookingConfirmation(sampleBooking);
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
  });
});

describe("sendBookingReminder — no credentials", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env["TWILIO_ACCOUNT_SID"];
    delete process.env["TWILIO_AUTH_TOKEN"];
    delete process.env["TWILIO_FROM_NUMBER"];
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns ok:true with skipped:true when credentials are absent", async () => {
    const result = await sendBookingReminder(sampleBooking);
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. sendBookingConfirmation — Twilio API call (mocked fetch)
// ---------------------------------------------------------------------------

describe("sendBookingConfirmation — SMS channel", () => {
  const originalEnv = process.env;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env["TWILIO_ACCOUNT_SID"] = "ACfake123";
    process.env["TWILIO_AUTH_TOKEN"] = "faketoken";
    process.env["TWILIO_FROM_NUMBER"] = "+35725000001";
    delete process.env["TWILIO_WHATSAPP_NUMBER"];
    delete process.env["TWILIO_VIBER_SERVICE_SID"];

    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ sid: "SMtest-sid-sms-001" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("sends via SMS when no WhatsApp or Viber number is configured", async () => {
    const result = await sendBookingConfirmation(sampleBooking);
    expect(result.ok).toBe(true);
    expect(result.channel).toBe("sms");
    expect(result.messageSid).toBe("SMtest-sid-sms-001");
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [calledUrl] = fetchSpy.mock.calls[0]!;
    expect(String(calledUrl)).toContain("twilio.com");
  });

  it("handles Twilio API error gracefully", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Invalid number" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const result = await sendBookingConfirmation(sampleBooking);
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe("sendBookingConfirmation — WhatsApp channel", () => {
  const originalEnv = process.env;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env["TWILIO_ACCOUNT_SID"] = "ACfake123";
    process.env["TWILIO_AUTH_TOKEN"] = "faketoken";
    process.env["TWILIO_FROM_NUMBER"] = "+35725000001";
    process.env["TWILIO_WHATSAPP_NUMBER"] = "+14155238886";

    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ sid: "SMtest-sid-wa-001" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("sends via WhatsApp when whatsappNumber is configured", async () => {
    const result = await sendBookingConfirmation(sampleBooking);
    expect(result.ok).toBe(true);
    expect(result.channel).toBe("whatsapp");
    expect(result.messageSid).toBe("SMtest-sid-wa-001");

    const callArgs = fetchSpy.mock.calls[0]!;
    const bodyStr = (callArgs[1] as RequestInit).body as string;
    expect(bodyStr).toContain("whatsapp%3A");
  });
});

// ---------------------------------------------------------------------------
// 6. Webhook handler — validation & business logic
// ---------------------------------------------------------------------------

describe("handleMessagingWebhook — GET confirm/cancel", () => {
  it("returns 400 when bookingId is missing", async () => {
    const req = new Request("https://example.com/api/messaging/webhook?action=confirm");
    const result = await handleMessagingWebhook(req);
    expect(result.status).toBe(400);
    expect(result.error).toMatch(/bookingId/i);
  });

  it("returns 400 when action is missing", async () => {
    const req = new Request(
      "https://example.com/api/messaging/webhook?bookingId=550e8400-e29b-41d4-a716-446655440000",
    );
    const result = await handleMessagingWebhook(req);
    expect(result.status).toBe(400);
    expect(result.error).toMatch(/action/i);
  });

  it("returns 400 when action is invalid", async () => {
    const req = new Request(
      "https://example.com/api/messaging/webhook?action=approve&bookingId=abc",
    );
    const result = await handleMessagingWebhook(req);
    expect(result.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// 7. Twilio HMAC signature validation
// ---------------------------------------------------------------------------

describe("validateTwilioSignature", () => {
  it("returns false when X-Twilio-Signature header is absent", async () => {
    const req = new Request("https://example.com/api/messaging/webhook", {
      method: "POST",
      body: "action=confirm&bookingId=test",
    });
    const result = await validateTwilioSignature(req, "authsecret");
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 8. POST webhook — reads action from body params
// ---------------------------------------------------------------------------

describe("handleMessagingWebhook — POST body parsing", () => {
  it("returns 400 when POST body has no action or bookingId", async () => {
    const req = new Request("https://example.com/api/messaging/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "foo=bar",
    });
    const result = await handleMessagingWebhook(req);
    expect(result.status).toBe(400);
  });

  it("parses SMS reply text 'confirm' as confirm action (no signature enforcement without secret)", async () => {
    // Without MESSAGING_WEBHOOK_SECRET, signature check is skipped
    const originalEnv = process.env;
    process.env = { ...originalEnv };
    delete process.env["MESSAGING_WEBHOOK_SECRET"];

    const req = new Request("https://example.com/api/messaging/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "Body=confirm",
    });
    const result = await handleMessagingWebhook(req);
    // Should fail at bookingId missing stage (400), not at action stage
    expect(result.status).toBe(400);
    expect(result.error).toMatch(/bookingId/i);

    process.env = originalEnv;
  });

  it("maps SMS digit '1' to confirm action", async () => {
    const req = new Request("https://example.com/api/messaging/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "Body=1",
    });
    const result = await handleMessagingWebhook(req);
    // Should fail at bookingId missing — meaning '1' was parsed as confirm correctly
    expect(result.status).toBe(400);
    expect(result.error).toMatch(/bookingId/i);
  });

  it("maps SMS digit '2' to cancel action", async () => {
    const req = new Request("https://example.com/api/messaging/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "Body=2",
    });
    const result = await handleMessagingWebhook(req);
    expect(result.status).toBe(400);
    expect(result.error).toMatch(/bookingId/i);
  });
});
