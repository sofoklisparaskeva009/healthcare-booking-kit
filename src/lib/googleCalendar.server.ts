import { clinicConfig } from "@/config/clinicConfig";

export interface GoogleCalendarEventData {
  bookingId: string;
  patientName: string;
  patientEmail?: string | null | undefined;
  patientPhone: string;
  serviceName: string;
  appointmentType: "gesy" | "private";
  appointmentDate: string; // YYYY-MM-DD
  appointmentTime: string; // HH:mm
  durationMinutes?: number | undefined;
  privateFee?: number | null | undefined;
  notes?: string | undefined;
  preferredLanguage?: "el" | "en" | string | undefined;
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

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
];

/**
 * Sanitizes a Google Calendar ID:
 * - Applies .trim() to remove leading/trailing whitespace and newlines
 * - Removes literal escaped `\n` / `\r`, zero-width characters, and accidental surrounding quotes/commas
 * - Normalizes `%40` to `@` so `encodeURIComponent` never double-encodes `%40` into `%2540`
 */
export function sanitizeCalendarId(rawCalendarId: string | undefined): string {
  if (!rawCalendarId) return "";
  return rawCalendarId
    .trim()
    .replace(/\\n|\\r/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/^[\s"',]+|[\s"',]+$/g, "")
    .replace(/%40/gi, "@")
    .trim();
}

/**
 * Sanitizes a Google Service Account client_email:
 * - Applies .trim() and strips accidental quotes, commas, or literal `\n`/`\r`
 */
export function sanitizeClientEmail(rawEmail: string | undefined): string {
  if (!rawEmail) return "";
  return rawEmail
    .trim()
    .replace(/\\n|\\r/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/^[\s"',]+|[\s"',]+$/g, "")
    .trim();
}

/**
 * Normalizes a PEM private key string:
 * - Converts escaped `\n` (`\\n`) and double-escaped `\\\\n` into actual newlines `\n`
 * - Strips accidental surrounding quotes (`"..."` or `'...'`) and trailing commas `,` from JSON copy-paste
 * - Reconstructs clean 64-char PEM lines if a standard `BEGIN ... PRIVATE KEY` header is present
 */
export function normalizePrivateKey(rawInput: string | undefined): string {
  if (!rawInput) return "";
  let key = rawInput
    .replace(/\\n/g, "\n")
    .replace(/\\\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .trim();

  // Strip surrounding quotes and trailing commas often copied from JSON files
  key = key.replace(/^[\s"',]+|[\s"',]+$/g, "").replace(/\\n/g, "\n").trim();

  const pemMatch = key.match(
    /-----BEGIN ([A-Z0-9 ]*PRIVATE KEY)-----([\s\S]*?)-----END [A-Z0-9 ]*PRIVATE KEY-----/,
  );
  if (pemMatch && pemMatch[1] && pemMatch[2]) {
    const label = pemMatch[1].trim();
    const base64Body = pemMatch[2].replace(/\\n/g, "").replace(/[^A-Za-z0-9+/=]/g, "");
    const lines = base64Body.match(/.{1,64}/g) || [base64Body];
    return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
  }

  return key;
}

/**
 * Checks whether Google Calendar credentials are configured in the environment.
 * Supports GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, and GOOGLE_CALENDAR_ID.
 */
export function isGoogleCalendarConfigured(): boolean {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env["GOOGLE_SERVICE_ACCOUNT_JSON"]) {
    return true;
  }
  const clientEmail = sanitizeClientEmail(
    process.env.GOOGLE_CLIENT_EMAIL ||
      process.env["GOOGLE_CLIENT_EMAIL"] ||
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
      process.env["GOOGLE_SERVICE_ACCOUNT_EMAIL"],
  );
  const privateKey =
    process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n") ||
    process.env["GOOGLE_PRIVATE_KEY"]?.replace(/\\n/g, "\n");
  return Boolean(clientEmail && privateKey);
}

/**
 * Parses and retrieves Google Calendar credentials from server environment variables:
 * - process.env.GOOGLE_CLIENT_EMAIL
 * - process.env.GOOGLE_PRIVATE_KEY (with .replace(/\\n/g, '\n'))
 * - process.env.GOOGLE_CALENDAR_ID (with .trim())
 */
export function getGoogleCalendarCredentials(): GoogleServiceAccountCredentials | null {
  const jsonEnv =
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env["GOOGLE_SERVICE_ACCOUNT_JSON"];
  let rawClientEmail =
    process.env.GOOGLE_CLIENT_EMAIL?.trim() ||
    process.env["GOOGLE_CLIENT_EMAIL"]?.trim() ||
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() ||
    process.env["GOOGLE_SERVICE_ACCOUNT_EMAIL"]?.trim() ||
    "";
  const envPrivateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  let privateKey =
    envPrivateKey || process.env["GOOGLE_PRIVATE_KEY"]?.replace(/\\n/g, "\n") || "";
  let rawCalendarId =
    process.env.GOOGLE_CALENDAR_ID?.trim() ||
    process.env["GOOGLE_CALENDAR_ID"]?.trim() ||
    "";

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
          rawClientEmail = parsed["client_email"].trim();
        }
        if (typeof parsed["private_key"] === "string") {
          privateKey = parsed["private_key"].replace(/\\n/g, "\n");
        }
        if (typeof parsed["calendar_id"] === "string") {
          rawCalendarId = parsed["calendar_id"].trim();
        }
      }
    } catch (parseErr) {
      console.error("GOOGLE CALENDAR ERROR:", parseErr);
    }
  }

  const clientEmail = sanitizeClientEmail(rawClientEmail);
  const calendarId = sanitizeCalendarId(rawCalendarId);

  if (!clientEmail || !privateKey) {
    return null;
  }

  const normalizedKey = normalizePrivateKey(privateKey);

  const timeZone = process.env.GOOGLE_CALENDAR_TIMEZONE?.trim() || "Asia/Nicosia";
  const rawDuration = Number(process.env.GOOGLE_CALENDAR_DEFAULT_DURATION_MINUTES);
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
 * Format: 'Ραντεβού: [Όνομα Ασθενούς] - [Υπηρεσία]'
 */
export function formatEventSummary(patientName: string, serviceName: string): string {
  return `Ραντεβού: ${patientName} - ${serviceName}`;
}

/**
 * Formats the event description including Phone, Email, Preferred Language, and Comments/Notes.
 */
export function formatEventDescription(data: GoogleCalendarEventData): string {
  const langLabel =
    data.preferredLanguage === "en" ? "English (EN)" : "Ελληνικά (GR)";

  const gesyStatus =
    data.appointmentType === "gesy"
      ? "ΓεΣΥ (Covered by GeSY)"
      : data.privateFee !== null && data.privateFee !== undefined
        ? `Ιδιωτική Επίσκεψη (Private Visit) · €${data.privateFee}`
        : "Ιδιωτική Επίσκεψη (Private Visit)";

  const notesContent = data.notes && data.notes.trim() ? data.notes.trim() : "Κανένα σχόλιο";
  const emailContent =
    data.patientEmail && data.patientEmail.trim() ? data.patientEmail.trim() : "Δεν δηλώθηκε";

  return [
    `Τηλέφωνο: ${data.patientPhone}`,
    `Email: ${emailContent}`,
    `Γλώσσα προτίμησης: ${langLabel}`,
    `Σχόλια: ${notesContent}`,
    ``,
    `----------------------------------------`,
    `Ασθενής: ${data.patientName}`,
    `Υπηρεσία: ${data.serviceName}`,
    `Κατηγορία: ${gesyStatus}`,
    `Κωδικός Κράτησης: #${data.bookingId}`,
    `Τοποθεσία: ${clinicConfig.contact.address.full}`,
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
  const cleanPem = normalizePrivateKey(privateKeyPem.replace(/\\n/g, "\n"));

  // Node.js runtime / Vitest fast path
  try {
    const nodeCrypto = await import("node:crypto");
    if (typeof nodeCrypto.createSign === "function") {
      const signer = nodeCrypto.createSign("RSA-SHA256");
      signer.update(dataToSign);
      return signer.sign(cleanPem, "base64url");
    }
  } catch (nodeSignErr) {
    console.warn("[Google Calendar Service] node:crypto sign fallback to WebCrypto:", nodeSignErr);
  }

  // Web Crypto API path (Cloudflare Workers, Deno, modern browser / edge runtimes)
  const pemBody = cleanPem
    .replace(/-----BEGIN [A-Z0-9 ]+-----/g, "")
    .replace(/-----END [A-Z0-9 ]+-----/g, "")
    .replace(/\\n/g, "")
    .replace(/[^A-Za-z0-9+/=]/g, "");

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
 * Uses scopes: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events']
 */
export async function getGoogleAccessToken(
  clientEmail: string,
  privateKey: string,
  scopes: string[] = GOOGLE_CALENDAR_SCOPES,
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
    iss: sanitizeClientEmail(clientEmail),
    scope: scopes.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    exp: nowInSeconds + 3600,
    iat: nowInSeconds,
  };

  const unsignedToken = `${stringToBase64Url(JSON.stringify(header))}.${stringToBase64Url(
    JSON.stringify(claimSet),
  )}`;
  const signature = await signRS256(unsignedToken, privateKey.replace(/\\n/g, "\n"));
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
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const rawCalendarIdEnv =
    process.env.GOOGLE_CALENDAR_ID?.trim() || process.env["GOOGLE_CALENDAR_ID"]?.trim();

  if (!isGoogleCalendarConfigured()) {
    const missingVars = [
      ...(!process.env.GOOGLE_CLIENT_EMAIL && !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
        ? ["GOOGLE_CLIENT_EMAIL"]
        : []),
      ...(!privateKey ? ["GOOGLE_PRIVATE_KEY"] : []),
      ...(!rawCalendarIdEnv ? ["GOOGLE_CALENDAR_ID"] : []),
    ];
    console.info(
      "[Google Calendar Service] Google Calendar credentials not configured. Calendar sync skipped. " +
        "Define GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, and GOOGLE_CALENDAR_ID in .env to enable automated Google Calendar syncing.",
    );
    console.error(
      "GOOGLE CALENDAR ERROR:",
      `Missing environment variables: ${missingVars.join(", ") || "GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY"}`,
    );
    return { ok: true, skipped: true };
  }

  const credentials = getGoogleCalendarCredentials();
  if (!credentials) {
    console.error(
      "GOOGLE CALENDAR ERROR:",
      "Incomplete Google Calendar credentials after parsing environment variables.",
    );
    return { ok: true, skipped: true };
  }

  try {
    // 1. Sanitization: .trim() and clean any hidden whitespace/newlines/quotes
    const calendarId = sanitizeCalendarId(
      process.env.GOOGLE_CALENDAR_ID?.trim() || credentials.calendarId?.trim(),
    );

    // 2. Pre-flight Validation: stop execution and throw error if calendarId is undefined or empty
    if (!calendarId) {
      throw new Error(
        "Google Calendar Pre-flight Validation Failed: calendarId (process.env.GOOGLE_CALENDAR_ID) is undefined or empty.",
      );
    }

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
      ...(data.patientEmail && data.patientEmail.trim()
        ? { attendees: [{ email: data.patientEmail.trim(), displayName: data.patientName }] }
        : {}),
    };

    const resolvedPrivateKey = (privateKey || credentials.privateKey).replace(/\\n/g, "\n");

    const accessToken = await getGoogleAccessToken(
      credentials.clientEmail,
      resolvedPrivateKey,
      GOOGLE_CALENDAR_SCOPES,
    );

    const calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId,
    )}/events`;

    // calendar.events.insert helper
    const calendar = {
      events: {
        insert: async ({
          calendarId: targetCalendarId,
          requestBody,
        }: {
          calendarId: string;
          requestBody: Record<string, unknown>;
        }) => {
          const targetUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
            targetCalendarId,
          )}/events`;
          return fetch(targetUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          });
        },
      },
    };

    // 3. Targeted Debugging right before calendar.events.insert
    console.log("--- GOOGLE CALENDAR DEBUG --- ID:", `[${calendarId}]`);

    let response = await calendar.events.insert({
      calendarId,
      requestBody: eventPayload,
    });

    // Fallback if attendees were supplied and rejected by service account policy (400 or 403)
    if (
      !response.ok &&
      (response.status === 400 || response.status === 403) &&
      eventPayload["attendees"]
    ) {
      const errBody = await response.clone().text();
      console.warn(
        "[Google Calendar Service] Retrying calendar.events.insert without external attendees list:",
        errBody,
      );
      delete eventPayload["attendees"];
      response = await calendar.events.insert({
        calendarId,
        requestBody: eventPayload,
      });
    }

    // Recovery & Diagnostics if Google Calendar API returns 404 Not Found:
    // 1) Try adding calendarId to the Service Account's calendarList (accepts pending share)
    // 2) Inspect users/me/calendarList to log all calendars visible to the Service Account
    if (!response.ok && response.status === 404) {
      delete eventPayload["attendees"];

      try {
        const subscribeRes = await fetch(
          "https://www.googleapis.com/calendar/v3/users/me/calendarList",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ id: calendarId }),
          },
        );

        if (subscribeRes.ok) {
          console.log(
            "--- GOOGLE CALENDAR DEBUG --- Subscribed service account to shared calendar:",
            `[${calendarId}]`,
          );
          response = await calendar.events.insert({
            calendarId,
            requestBody: eventPayload,
          });
        } else {
          const subErrText = await subscribeRes.text();
          console.warn(
            `--- GOOGLE CALENDAR DEBUG --- Could not subscribe to [${calendarId}] (${subscribeRes.status}):`,
            subErrText,
          );
        }
      } catch (subErr) {
        console.warn("--- GOOGLE CALENDAR DEBUG --- calendarList.insert failed:", subErr);
      }

      if (!response.ok && response.status === 404) {
        try {
          const listRes = await fetch(
            "https://www.googleapis.com/calendar/v3/users/me/calendarList",
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            },
          );
          if (listRes.ok) {
            const listData = (await listRes.json()) as {
              items?: Array<{ id?: string; summary?: string; accessRole?: string }>;
            };
            const items = listData.items || [];
            console.log(
              "--- GOOGLE CALENDAR DEBUG --- Calendars visible to Service Account:",
              JSON.stringify(
                items.map((c) => ({ id: c.id, summary: c.summary, accessRole: c.accessRole })),
              ),
            );

            // If user shared a sub-calendar (e.g. *@group.calendar.google.com) with writer/owner access, use it
            const sharedWritableCalendar = items.find(
              (c) =>
                c.id &&
                c.id !== credentials.clientEmail &&
                (c.accessRole === "writer" || c.accessRole === "owner"),
            );
            if (sharedWritableCalendar?.id) {
              console.log(
                "--- GOOGLE CALENDAR DEBUG --- Retrying with discovered shared calendar ID:",
                `[${sharedWritableCalendar.id}]`,
              );
              response = await calendar.events.insert({
                calendarId: sharedWritableCalendar.id,
                requestBody: eventPayload,
              });
            }
          }
        } catch (listErr) {
          console.warn("--- GOOGLE CALENDAR DEBUG --- calendarList.list failed:", listErr);
        }
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      const apiError = new Error(
        `Google Calendar API error (${response.status}) for calendar [${calendarId}] with service account [${credentials.clientEmail}] (URL: ${calendarUrl}): ${errorText}`,
      );
      console.error("GOOGLE CALENDAR ERROR:", apiError);
      return {
        ok: false,
        error: apiError.message,
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
  } catch (error) {
    console.error("GOOGLE CALENDAR ERROR:", error);
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: message,
    };
  }
}
