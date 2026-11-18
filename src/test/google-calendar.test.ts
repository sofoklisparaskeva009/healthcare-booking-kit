import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isGoogleCalendarConfigured,
  getGoogleCalendarCredentials,
  formatEventSummary,
  formatEventDescription,
  calculateEventTimes,
  createGoogleCalendarEvent,
  confirmGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  resetCachedAccessToken,
  sanitizeCalendarId,
  GOOGLE_CALENDAR_SCOPES,
  type GoogleCalendarEventData,
} from "../lib/googleCalendar.server";

describe("Google Calendar Integration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    resetCachedAccessToken();
    process.env = { ...originalEnv };
    delete process.env["GOOGLE_CLIENT_EMAIL"];
    delete process.env["GOOGLE_SERVICE_ACCOUNT_EMAIL"];
    delete process.env["GOOGLE_PRIVATE_KEY"];
    delete process.env["GOOGLE_CALENDAR_ID"];
    delete process.env["GOOGLE_SERVICE_ACCOUNT_JSON"];
    delete process.env["GOOGLE_CALENDAR_TIMEZONE"];
    delete process.env["GOOGLE_CALENDAR_DEFAULT_DURATION_MINUTES"];
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  const mockBookingData: GoogleCalendarEventData = {
    bookingId: "test-booking-id-12345",
    patientName: "Andreas Ioannou",
    patientEmail: "andreas@example.com",
    patientPhone: "+357 99 876543",
    serviceName: "Initial Consultation",
    appointmentType: "gesy",
    appointmentDate: "2026-11-10",
    appointmentTime: "10:00",
    durationMinutes: 60,
    privateFee: null,
    notes: "Suffering from acute lower back pain.",
    preferredLanguage: "el",
  };

  describe("Configuration & Environment Detection", () => {
    it("reports not configured when environment variables are missing", () => {
      expect(isGoogleCalendarConfigured()).toBe(false);
      expect(getGoogleCalendarCredentials()).toBeNull();
    });

    it("reports configured when GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, and GOOGLE_CALENDAR_ID are present", () => {
      process.env["GOOGLE_CLIENT_EMAIL"] = "bot@example.iam.gserviceaccount.com";
      process.env["GOOGLE_PRIVATE_KEY"] =
        "-----BEGIN PRIVATE KEY-----\\nMIIEvgIBADAN...\\n-----END PRIVATE KEY-----";
      process.env["GOOGLE_CALENDAR_ID"] = "clinic@group.calendar.google.com";

      expect(isGoogleCalendarConfigured()).toBe(true);
      const creds = getGoogleCalendarCredentials();
      expect(creds).not.toBeNull();
      expect(creds?.clientEmail).toBe("bot@example.iam.gserviceaccount.com");
      expect(creds?.privateKey).toContain("\n");
      expect(creds?.calendarId).toBe("clinic@group.calendar.google.com");
      expect(creds?.timeZone).toBe("Asia/Nicosia");
      expect(creds?.defaultDurationMinutes).toBe(60);
    });

    it("parses configuration from GOOGLE_SERVICE_ACCOUNT_JSON", () => {
      const saJson = JSON.stringify({
        client_email: "json-sa@example.iam.gserviceaccount.com",
        private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvg==\n-----END PRIVATE KEY-----",
        calendar_id: "clinic-cal@group.calendar.google.com",
      });
      process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = saJson;

      expect(isGoogleCalendarConfigured()).toBe(true);
      const creds = getGoogleCalendarCredentials();
      expect(creds?.clientEmail).toBe("json-sa@example.iam.gserviceaccount.com");
      expect(creds?.calendarId).toBe("clinic-cal@group.calendar.google.com");
    });

    it("parses base64-encoded GOOGLE_SERVICE_ACCOUNT_JSON", () => {
      const saJson = JSON.stringify({
        client_email: "b64-sa@example.iam.gserviceaccount.com",
        private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvg==\n-----END PRIVATE KEY-----",
      });
      process.env["GOOGLE_SERVICE_ACCOUNT_JSON"] = btoa(saJson);

      expect(isGoogleCalendarConfigured()).toBe(true);
      const creds = getGoogleCalendarCredentials();
      expect(creds?.clientEmail).toBe("b64-sa@example.iam.gserviceaccount.com");
    });
  });

  describe("Event Formatting", () => {
    it("formats event title as 'Ραντεβού: [Όνομα Ασθενούς] - [Υπηρεσία]'", () => {
      const title = formatEventSummary("Andreas Ioannou", "Initial Consultation");
      expect(title).toBe("Ραντεβού: Andreas Ioannou - Initial Consultation");
    });

    it("formats event description with all required patient and clinic details for GeSY", () => {
      const description = formatEventDescription(mockBookingData);

      expect(description).toContain("Andreas Ioannou");
      expect(description).toContain("Τηλέφωνο: +357 99 876543");
      expect(description).toContain("Email: andreas@example.com");
      expect(description).toContain("Γλώσσα προτίμησης: Ελληνικά (GR)");
      expect(description).toContain("Σχόλια: Suffering from acute lower back pain.");
      expect(description).toContain("Initial Consultation");
      expect(description).toContain("ΓεΣΥ (Covered by GeSY)");
      expect(description).toContain("Κωδικός Κράτησης: #test-booking-id-12345");
    });

    it("formats event description correctly for Private visits with fee", () => {
      const privateData: GoogleCalendarEventData = {
        ...mockBookingData,
        appointmentType: "private",
        privateFee: 60,
        notes: "",
        preferredLanguage: "en",
      };
      const description = formatEventDescription(privateData);

      expect(description).toContain("Ιδιωτική Επίσκεψη (Private Visit) · €60");
      expect(description).toContain("Γλώσσα προτίμησης: English (EN)");
      expect(description).toContain("Σχόλια: Κανένα σχόλιο");
    });

    it("formats event description with 'Email: Δεν δηλώθηκε' when patientEmail is omitted or empty", () => {
      const description = formatEventDescription({
        ...mockBookingData,
        patientEmail: "",
      });
      expect(description).toContain("Email: Δεν δηλώθηκε");
    });
  });

  describe("Slot Times and Duration Calculation", () => {
    it("calculates correct start and end times for 60-minute duration", () => {
      const { startDateTime, endDateTime, timeZone } = calculateEventTimes(
        "2026-11-10",
        "10:00",
        60,
        "Asia/Nicosia",
      );

      expect(startDateTime).toContain("2026-11-10T10:00:00");
      expect(endDateTime).toContain("2026-11-10T11:00:00");
      expect(timeZone).toBe("Asia/Nicosia");
    });

    it("calculates custom duration correctly (e.g. 45 minutes)", () => {
      const { startDateTime, endDateTime } = calculateEventTimes(
        "2026-11-10",
        "14:30",
        45,
        "Asia/Nicosia",
      );

      expect(startDateTime).toContain("2026-11-10T14:30:00");
      expect(endDateTime).toContain("2026-11-10T15:15:00");
    });
  });

  describe("Graceful Degradation and API Execution", () => {
    it("gracefully degrades when credentials are missing without throwing", async () => {
      const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

      const result = await createGoogleCalendarEvent(mockBookingData);

      expect(result.ok).toBe(true);
      expect(result.skipped).toBe(true);
      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining("Google Calendar credentials not configured"),
      );
    });

    it("creates event successfully when API responds with 200 OK", async () => {
      const { generateKeyPairSync } = await import("node:crypto");
      const { privateKey } = generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });

      process.env["GOOGLE_SERVICE_ACCOUNT_EMAIL"] = "bot@example.iam.gserviceaccount.com";
      process.env["GOOGLE_PRIVATE_KEY"] = privateKey;
      process.env["GOOGLE_CALENDAR_ID"] = "primary";

      // Mock fetch for token exchange and event creation
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes("oauth2.googleapis.com/token")) {
          return new Response(
            JSON.stringify({
              access_token: "mock-google-token",
              token_type: "Bearer",
              expires_in: 3600,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (urlStr.includes("googleapis.com/calendar/v3/calendars")) {
          return new Response(
            JSON.stringify({
              id: "google-event-id-999",
              htmlLink: "https://calendar.google.com/event?eid=999",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response("Not found", { status: 404 });
      });

      const result = await createGoogleCalendarEvent(mockBookingData);

      expect(result.ok).toBe(true);
      expect(result.eventId).toBe("google-event-id-999");
      expect(result.htmlLink).toBe("https://calendar.google.com/event?eid=999");
      expect(fetchSpy).toHaveBeenCalled();
    });

    it("catches and logs Google Calendar API failures gracefully without throwing", async () => {
      const { generateKeyPairSync } = await import("node:crypto");
      const { privateKey } = generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });

      process.env["GOOGLE_SERVICE_ACCOUNT_EMAIL"] = "bot@example.iam.gserviceaccount.com";
      process.env["GOOGLE_PRIVATE_KEY"] = privateKey;
      process.env["GOOGLE_CALENDAR_ID"] = "clinic@group.calendar.google.com";

      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes("oauth2.googleapis.com/token")) {
          return new Response(JSON.stringify({ access_token: "mock-token", expires_in: 3600 }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("Calendar quota exceeded or calendar not found", { status: 403 });
      });

      const result = await createGoogleCalendarEvent(mockBookingData);

      expect(result.ok).toBe(false);
      expect(result.error).toContain("Google Calendar API error (403)");
      expect(errSpy).toHaveBeenCalled();
    });

    it("fails pre-flight validation when calendarId is undefined or empty", async () => {
      const { generateKeyPairSync } = await import("node:crypto");
      const { privateKey } = generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });

      process.env["GOOGLE_CLIENT_EMAIL"] = "bot@example.iam.gserviceaccount.com";
      process.env["GOOGLE_PRIVATE_KEY"] = privateKey;
      process.env["GOOGLE_CALENDAR_ID"] = "   ";

      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await createGoogleCalendarEvent(mockBookingData);

      expect(result.ok).toBe(false);
      expect(result.error).toContain("Pre-flight Validation Failed");
      expect(errSpy).toHaveBeenCalledWith("GOOGLE CALENDAR ERROR:", expect.any(Error));
    });

    it("sanitizes calendarId with .trim() and logs debug output before calendar.events.insert", () => {
      expect(sanitizeCalendarId("  doctor@gmail.com \n ")).toBe("doctor@gmail.com");
      expect(sanitizeCalendarId('"doctor%40gmail.com\\n"')).toBe("doctor@gmail.com");
      expect(GOOGLE_CALENDAR_SCOPES).toContain("https://www.googleapis.com/auth/calendar");
      expect(GOOGLE_CALENDAR_SCOPES).toContain("https://www.googleapis.com/auth/calendar.events");
    });

    it("retries event creation without attendees if Google API returns attendee/guest error", async () => {
      const { generateKeyPairSync } = await import("node:crypto");
      const { privateKey } = generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });

      process.env["GOOGLE_SERVICE_ACCOUNT_EMAIL"] = "bot@example.iam.gserviceaccount.com";
      process.env["GOOGLE_PRIVATE_KEY"] = privateKey;
      process.env["GOOGLE_CALENDAR_ID"] = "clinic@group.calendar.google.com";

      let callCount = 0;
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
        const urlStr = String(url);
        if (urlStr.includes("oauth2.googleapis.com/token")) {
          return new Response(JSON.stringify({ access_token: "mock-token", expires_in: 3600 }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (urlStr.includes("googleapis.com/calendar/v3/calendars")) {
          callCount++;
          if (callCount === 1) {
            // First attempt with attendees fails
            return new Response(
              JSON.stringify({ error: { message: "Service accounts cannot invite attendees." } }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }
          // Second attempt without attendees succeeds
          const body = JSON.parse(String(init?.body || "{}"));
          expect(body.attendees).toBeUndefined();
          return new Response(
            JSON.stringify({
              id: "fallback-event-123",
              htmlLink: "https://calendar.google.com/123",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response("Not found", { status: 404 });
      });

      const result = await createGoogleCalendarEvent(mockBookingData);

      expect(result.ok).toBe(true);
      expect(result.eventId).toBe("fallback-event-123");
      expect(callCount).toBe(2);
    });

    it("updates event summary to '[ΕΠΙΒΕΒΑΙΩΜΕΝΟ] Ραντεβού: ...' on confirmGoogleCalendarEvent", async () => {
      const { generateKeyPairSync } = await import("node:crypto");
      const { privateKey } = generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });

      process.env["GOOGLE_CLIENT_EMAIL"] = "bot@example.iam.gserviceaccount.com";
      process.env["GOOGLE_PRIVATE_KEY"] = privateKey;
      process.env["GOOGLE_CALENDAR_ID"] = "clinic@group.calendar.google.com";

      let patchedSummary = "";
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
        const urlStr = String(url);
        if (urlStr.includes("oauth2.googleapis.com/token")) {
          return new Response(JSON.stringify({ access_token: "mock-token", expires_in: 3600 }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (urlStr.includes("/events?timeMin=")) {
          return new Response(
            JSON.stringify({
              items: [
                {
                  id: "matched-ev-101",
                  summary: "Ραντεβού: Andreas Ioannou - Initial Consultation",
                  description: "Κωδικός Κράτησης: #test-booking-id-12345",
                  start: { dateTime: "2026-11-10T10:00:00+02:00" },
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (urlStr.includes("/events/matched-ev-101") && init?.method === "PATCH") {
          const body = JSON.parse(String(init.body || "{}"));
          patchedSummary = body.summary;
          return new Response(JSON.stringify({ id: "matched-ev-101" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("Not found", { status: 404 });
      });

      const res = await confirmGoogleCalendarEvent({
        bookingId: "test-booking-id-12345",
        patientName: "Andreas Ioannou",
        serviceName: "Initial Consultation",
        appointmentDate: "2026-11-10",
      });

      expect(res.ok).toBe(true);
      expect(res.eventId).toBe("matched-ev-101");
      expect(patchedSummary).toBe(
        "[ΕΠΙΒΕΒΑΙΩΜΕΝΟ] Ραντεβού: Andreas Ioannou - Initial Consultation",
      );
    });

    it("deletes calendar event on deleteGoogleCalendarEvent", async () => {
      const { generateKeyPairSync } = await import("node:crypto");
      const { privateKey } = generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });

      process.env["GOOGLE_CLIENT_EMAIL"] = "bot@example.iam.gserviceaccount.com";
      process.env["GOOGLE_PRIVATE_KEY"] = privateKey;
      process.env["GOOGLE_CALENDAR_ID"] = "clinic@group.calendar.google.com";

      let deleteCalled = false;
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
        const urlStr = String(url);
        if (urlStr.includes("oauth2.googleapis.com/token")) {
          return new Response(JSON.stringify({ access_token: "mock-token", expires_in: 3600 }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (urlStr.includes("/events/explicit-ev-202") && init?.method === "DELETE") {
          deleteCalled = true;
          return new Response(null, { status: 204 });
        }
        return new Response("Not found", { status: 404 });
      });

      const res = await deleteGoogleCalendarEvent({
        bookingId: "test-booking-id-12345",
        patientName: "Andreas Ioannou",
        serviceName: "Initial Consultation",
        appointmentDate: "2026-11-10",
        calendarEventId: "explicit-ev-202",
      });

      expect(res.ok).toBe(true);
      expect(deleteCalled).toBe(true);
    });
  });
});
