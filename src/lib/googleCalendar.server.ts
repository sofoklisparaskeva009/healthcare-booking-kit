import { clinicConfig } from "@/config/clinicConfig";

export interface GoogleCalendarEventData {
  bookingId: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  serviceName: string;
  appointmentType: "gesy" | "private";
  appointmentDate: string; // YYYY-MM-DD
  appointmentTime: string; // HH:mm
  durationMinutes?: number | undefined;
  privateFee?: number | null | undefined;
  notes?: string | undefined;
}

export interface GoogleCalendarResult {
  ok: boolean;
  skipped?: boolean | undefined;
  eventId?: string | undefined;
  htmlLink?: string | undefined;
  error?: string | undefined;
}

export interface GoogleServiceAccountCredentials {
  clientEmail: string;
  privateKey: string;
  calendarId: string;
  timeZone: string;
  defaultDurationMinutes: number;
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

/**
 * Resets the cached access token (useful for testing or key rotation).
 */
export function resetCachedAccessToken(): void {
  cachedAccessToken = null;
}

/**
 * Checks whether Google Calendar credentials are configured in the environment.
 */
export function isGoogleCalendarConfigured(): boolean {
  if (process.env["GOOGLE_SERVICE_ACCOUNT_JSON"]) {
    return true;
  }
  return Boolean(process.env["GOOGLE_SERVICE_ACCOUNT_EMAIL"] && process.env["GOOGLE_PRIVATE_KEY"]);
}

/**
 * Parses and retrieves Google Calendar credentials from environment variables.
 */
export function getGoogleCalendarCredentials(): GoogleServiceAccountCredentials | null {
  const jsonEnv = process.env["GOOGLE_SERVICE_ACCOUNT_JSON"];
  let clientEmail = process.env["GOOGLE_SERVICE_ACCOUNT_EMAIL"] || "";
  let privateKey = process.env["GOOGLE_PRIVATE_KEY"] || "";
  let calendarId = process.env["GOOGLE_CALENDAR_ID"] || "primary";

  if (jsonEnv) {
    try {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(jsonEnv);
      } catch {
        const decoded = atob(jsonEnv);
        parsed = JSON.parse(decoded);
      }

      if (parsed && typeof parsed === "object") {
        if (typeof parsed["client_email"] === "string") {
          clientEmail = parsed["client_email"];
        }
        if (typeof parsed["private_key"] === "string") {
          privateKey = parsed["private_key"];
        }
        if (typeof parsed["calendar_id"] === "string") {
          calendarId = parsed["calendar_id"];
        }
      }
    } catch (parseErr) {
      console.error(
        "[Google Calendar Service] Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:",
        parseErr,
      );
    }
  }

  if (!clientEmail || !privateKey) {
    return null;
  }

  // Normalize private key formatting: handle literal \n and surrounding quotes
  const normalizedKey = privateKey
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n")
    .trim();

  const timeZone = process.env["GOOGLE_CALENDAR_TIMEZONE"] || "Asia/Nicosia";
  const rawDuration = Number(process.env["GOOGLE_CALENDAR_DEFAULT_DURATION_MINUTES"]);
  const defaultDurationMinutes = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 60;

  return {
    clientEmail,
    privateKey: normalizedKey,
    calendarId,
    timeZone,
    defaultDurationMinutes,
  };
}

/**
 * Formats the calendar event summary / title.
 * Format: "Appointment: [Patient Name] - [Service]"
 */
export function formatEventSummary(patientName: string, serviceName: string): string {
  return `Appointment: ${patientName} - ${serviceName}`;
}

/**
 * Formats the event description including patient details, phone, email, GeSY status, and notes.
 */
export function formatEventDescription(data: GoogleCalendarEventData): string {
  const gesyStatus =
    data.appointmentType === "gesy"
      ? "Covered by GeSY (With Referral / ΓεΣΥ)"
      : data.privateFee !== null && data.privateFee !== undefined
        ? `Private Visit (Ιδιωτική Επίσκεψη) · €${data.privateFee}`
        : "Private Visit (Ιδιωτική Επίσκεψη) · Fee on request";

  const notesContent = data.notes && data.notes.trim() ? data.notes.trim() : "None provided";

  return [
    `📅 CLINIC APPOINTMENT DETAILS`,
    `----------------------------------------`,
    `Patient Name: ${data.patientName}`,
    `Phone: ${data.patientPhone}`,
    `Email: ${data.patientEmail}`,
    `Service: ${data.serviceName}`,
    `Coverage / Type: ${gesyStatus}`,
    `Booking Reference: #${data.bookingId}`,
    ``,
    `📝 PATIENT NOTES:`,
    `${notesContent}`,
    ``,
    `📍 CLINIC LOCATION:`,
    `${clinicConfig.contact.address.full}`,
    `Contact Phone: ${clinicConfig.contact.phone}`,
  ].join("\n");
}

/**
 * Computes timezone offset string (+HH:mm or -HH:mm) for a specific date & timezone.
 */
export function getTimezoneOffsetString(date: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longOffset",
    }).formatToParts(date);
    const tzPart = parts.find((p) => p.type === "timeZoneName")?.value;
    if (!tzPart || tzPart === "GMT") return "Z";
    return tzPart.replace("GMT", "");
  } catch {
    return "+02:00"; // Fallback to Cyprus standard offset
  }
}

/**
 * Calculates RFC3339 formatted start and end datetime strings based on date, time, duration and timezone.
 */
export function calculateEventTimes(
  dateStr: string,
  timeStr: string,
  durationMinutes: number = 60,
  timeZone: string = "Asia/Nicosia",
) {
  const [hours, minutes] = timeStr.split(":").map((v) => Number.parseInt(v, 10));
  const totalStartMinutes = (hours || 0) * 60 + (minutes || 0);
  const totalEndMinutes = totalStartMinutes + durationMinutes;

  const endHours = Math.floor(totalEndMinutes / 60) % 24;
  const endMins = totalEndMinutes % 60;

  const pad = (n: number) => String(n).padStart(2, "0");
  const startTimeFormatted = `${pad(hours || 0)}:${pad(minutes || 0)}:00`;
  const endTimeFormatted = `${pad(endHours)}:${pad(endMins)}:00`;

  const daysOverflow = Math.floor(totalEndMinutes / (24 * 60));
  let endDateStr = dateStr;
  if (daysOverflow > 0) {
    const d = new Date(`${dateStr}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + daysOverflow);
    endDateStr = d.toISOString().split("T")[0]!;
  }

  // Determine timezone offset for the given appointment date
  const approximateDate = new Date(`${dateStr}T12:00:00Z`);
  const offset = getTimezoneOffsetString(approximateDate, timeZone);

  return {
    startDateTime: `${dateStr}T${startTimeFormatted}${offset}`,
    endDateTime: `${endDateStr}T${endTimeFormatted}${offset}`,
    timeZone,
  };
}

/**
 * Universal RS256 signing using node:crypto if present, or Web Crypto API (crypto.subtle).
 */
export async function signRS256(dataToSign: string, privateKeyPem: string): Promise<string> {
  const cleanPem = privateKeyPem.replace(/\\n/g, "\n");

  // Node.js runtime / Vitest fast path
  try {
    const nodeCrypto = await import("node:crypto");
    if (typeof nodeCrypto.createSign === "function") {
      const signer = nodeCrypto.createSign("RSA-SHA256");
      signer.update(dataToSign);
      return signer.sign(cleanPem, "base64url");
    }
  } catch {
    // Continue to Web Crypto API
  }

  // Web Crypto API path (Cloudflare Workers, Deno, modern browser / edge runtimes)
  const pemBody = cleanPem
    .replace(/-----BEGIN [A-Z ]+-----/g, "")
    .replace(/-----END [A-Z ]+-----/g, "")
    .replace(/\s+/g, "");

  const binaryDer = base64ToUint8Array(pemBody);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer.slice(
      binaryDer.byteOffset,
      binaryDer.byteOffset + binaryDer.byteLength,
    ) as ArrayBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(dataToSign),
  );

  return uint8ArrayToBase64Url(new Uint8Array(signature));
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function stringToBase64Url(str: string): string {
  return uint8ArrayToBase64Url(new TextEncoder().encode(str));
}

/**
 * Obtains an OAuth2 bearer token from Google's token endpoint using the Service Account credentials.
 */
export async function getGoogleAccessToken(
  clientEmail: string,
  privateKey: string,
): Promise<string> {
  const nowInSeconds = Math.floor(Date.now() / 1000);

  if (cachedAccessToken && cachedAccessToken.expiresAt > nowInSeconds + 60) {
    return cachedAccessToken.token;
  }

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const claimSet = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/calendar.events",
    aud: "https://oauth2.googleapis.com/token",
    exp: nowInSeconds + 3600,
    iat: nowInSeconds,
  };

  const unsignedToken = `${stringToBase64Url(JSON.stringify(header))}.${stringToBase64Url(
    JSON.stringify(claimSet),
  )}`;
  const signature = await signRS256(unsignedToken, privateKey);
  const assertion = `${unsignedToken}.${signature}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(
      `Google OAuth2 token request failed with status ${tokenResponse.status}: ${errorText}`,
    );
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token: string;
    token_type: string;
    expires_in?: number | undefined;
  };

  cachedAccessToken = {
    token: tokenData.access_token,
    expiresAt: nowInSeconds + (tokenData.expires_in ?? 3600),
  };

  return tokenData.access_token;
}

/**
 * Main Google Calendar integration function.
 * Creates an event on the clinic's Google Calendar for the completed booking.
 */
export async function createGoogleCalendarEvent(
  data: GoogleCalendarEventData,
): Promise<GoogleCalendarResult> {
  if (!isGoogleCalendarConfigured()) {
    console.info(
      "[Google Calendar Service] Google Calendar credentials not configured. Calendar sync skipped. " +
        "Define GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY (or GOOGLE_SERVICE_ACCOUNT_JSON), and GOOGLE_CALENDAR_ID in .env to enable automated Google Calendar syncing.",
    );
    return { ok: true, skipped: true };
  }

  const credentials = getGoogleCalendarCredentials();
  if (!credentials) {
    console.warn(
      "[Google Calendar Service] Incomplete Google Calendar credentials. Calendar sync skipped.",
    );
    return { ok: true, skipped: true };
  }

  try {
    const duration = data.durationMinutes || credentials.defaultDurationMinutes;
    const times = calculateEventTimes(
      data.appointmentDate,
      data.appointmentTime,
      duration,
      credentials.timeZone,
    );

    const summary = formatEventSummary(data.patientName, data.serviceName);
    const description = formatEventDescription(data);

    const eventPayload: Record<string, unknown> = {
      summary,
      description,
      location: clinicConfig.contact.address.full,
      start: {
        dateTime: times.startDateTime,
        timeZone: times.timeZone,
      },
      end: {
        dateTime: times.endDateTime,
        timeZone: times.timeZone,
      },
      attendees: [
        {
          email: data.patientEmail,
          displayName: data.patientName,
        },
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 24 * 60 },
          { method: "popup", minutes: 30 },
        ],
      },
    };

    const accessToken = await getGoogleAccessToken(credentials.clientEmail, credentials.privateKey);

    const calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      credentials.calendarId,
    )}/events`;

    let response = await fetch(calendarUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventPayload),
    });

    // If attendees cannot be added due to permission/domain constraints, retry without attendees
    if (!response.ok && (response.status === 400 || response.status === 403)) {
      const errBody = await response.clone().text();
      if (errBody.toLowerCase().includes("attendee") || errBody.toLowerCase().includes("guest")) {
        console.warn(
          "[Google Calendar Service] Retrying event creation without external attendees list:",
          errBody,
        );
        delete eventPayload["attendees"];
        response = await fetch(calendarUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventPayload),
        });
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[Google Calendar Service] Google Calendar API error (${response.status}):`,
        errorText,
      );
      return {
        ok: false,
        error: `Google Calendar API error (${response.status}): ${errorText}`,
      };
    }

    const createdEvent = (await response.json()) as { id?: string; htmlLink?: string };
    console.info(
      `[Google Calendar Service] Successfully created calendar event #${createdEvent.id || "unknown"} for booking #${data.bookingId}`,
    );

    return {
      ok: true,
      eventId: createdEvent.id,
      htmlLink: createdEvent.htmlLink,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Google Calendar Service] Failed to create Google Calendar event:", message);
    return {
      ok: false,
      error: message,
    };
  }
}
