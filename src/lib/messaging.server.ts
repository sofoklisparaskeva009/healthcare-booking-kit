import { clinicConfig } from "@/config/clinicConfig";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MessagingChannel = "sms" | "whatsapp" | "viber";
export type PatientResponseAction = "confirm" | "cancel";
export type MessageLocale = "el" | "en";

export interface MessagingBookingData {
  bookingId: string;
  patientName: string;
  patientPhone: string;
  serviceName: string;
  appointmentType: "gesy" | "private";
  appointmentDate: string; // YYYY-MM-DD
  appointmentTime: string; // HH:mm
  privateFee?: number | null;
  locale?: MessageLocale;
}

export interface MessagingResult {
  ok: boolean;
  skipped?: boolean;
  channel?: MessagingChannel;
  messageSid?: string;
  error?: string;
}

export interface MessagingCredentials {
  accountSid: string;
  authToken: string;
  fromNumber: string; // E.164, e.g. +15551234567
  whatsappNumber?: string; // E.164 with whatsapp: prefix handled at call-site
  viberServiceId?: string;
}

// ---------------------------------------------------------------------------
// Credential helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if at least the minimum Twilio credentials are set.
 */
export function isMessagingConfigured(): boolean {
  return Boolean(
    process.env["TWILIO_ACCOUNT_SID"] &&
      process.env["TWILIO_AUTH_TOKEN"] &&
      process.env["TWILIO_FROM_NUMBER"],
  );
}

/**
 * Parses Twilio + optional channel credentials from env vars.
 * Returns null if required keys are absent.
 */
export function getMessagingCredentials(): MessagingCredentials | null {
  const accountSid = process.env["TWILIO_ACCOUNT_SID"];
  const authToken = process.env["TWILIO_AUTH_TOKEN"];
  const fromNumber = process.env["TWILIO_FROM_NUMBER"];

  if (!accountSid || !authToken || !fromNumber) return null;

  const creds: MessagingCredentials = { accountSid, authToken, fromNumber };
  const waNumber = process.env["TWILIO_WHATSAPP_NUMBER"];
  const viberSid = process.env["TWILIO_VIBER_SERVICE_SID"];
  if (waNumber) creds.whatsappNumber = waNumber;
  if (viberSid) creds.viberServiceId = viberSid;
  return creds;
}

// ---------------------------------------------------------------------------
// Confirmation URL builder
// ---------------------------------------------------------------------------

/**
 * Constructs the HTTPS action URLs that patients click/reply to when they
 * tap Accept or Cancel. The webhook handler at
 * /api/messaging/webhook processes the incoming POST.
 */
export function buildConfirmationUrls(
  bookingId: string,
): { confirmUrl: string; cancelUrl: string } {
  const base =
    process.env["PUBLIC_BASE_URL"] ||
    process.env["VITE_PUBLIC_URL"] ||
    `https://${process.env["CF_PAGES_URL"] || "localhost:3000"}`;
  return {
    confirmUrl: `${base}/api/messaging/webhook?action=confirm&bookingId=${encodeURIComponent(bookingId)}`,
    cancelUrl: `${base}/api/messaging/webhook?action=cancel&bookingId=${encodeURIComponent(bookingId)}`,
  };
}

// ---------------------------------------------------------------------------
// Message template rendering
// ---------------------------------------------------------------------------

function formatShortDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (y && m && d) {
      return new Date(y, m - 1, d).toLocaleDateString("el-CY", {
        weekday: "short",
        day: "numeric",
        month: "long",
      });
    }
  } catch {
    // fall through
  }
  return dateStr;
}

export interface RenderedMessage {
  body: string;
  /** Quick-reply / button labels for WhatsApp / Viber interactive flows */
  actions: Array<{ label: string; action: PatientResponseAction }>;
}

/**
 * Renders a localized booking confirmation message body with Accept / Cancel
 * interactive options. Greek is used by default (matching the clinic config).
 */
export function renderBookingConfirmationMessage(
  data: MessagingBookingData,
): RenderedMessage {
  const locale: MessageLocale = data.locale ?? "el";
  const { doctor, gesy } = clinicConfig;
  const shortDate = formatShortDate(data.appointmentDate);
  const coverageLabel =
    data.appointmentType === "gesy"
      ? gesy.referralNotice || "Covered by GeSY (With Referral)"
      : data.privateFee != null
        ? `Ιδιωτική · €${data.privateFee}`
        : "Ιδιωτική (κατ' αίτηση)";

  const urls = buildConfirmationUrls(data.bookingId);

  if (locale === "el") {
    const body = [
      `📋 *Επιβεβαίωση Ραντεβού — ${doctor.name}*`,
      ``,
      `Αγαπητέ/ή ${data.patientName},`,
      ``,
      `Το ραντεβού σας καταγράφηκε με επιτυχία:`,
      `• Υπηρεσία: ${data.serviceName}`,
      `• Ημερομηνία: ${shortDate} στις ${data.appointmentTime}`,
      `• Κάλυψη: ${coverageLabel}`,
      `• Κωδικός: #${data.bookingId.slice(0, 8)}`,
      ``,
      `✅ Επιβεβαιώστε: ${urls.confirmUrl}`,
      `❌ Ακύρωση: ${urls.cancelUrl}`,
      ``,
      `Επικοινωνία: ${clinicConfig.contact.phone}`,
    ].join("\n");

    return {
      body,
      actions: [
        { label: "✅ Επιβεβαίωση", action: "confirm" },
        { label: "❌ Ακύρωση", action: "cancel" },
      ],
    };
  }

  // English fallback
  const body = [
    `📋 *Appointment Confirmation — ${doctor.name}*`,
    ``,
    `Dear ${data.patientName},`,
    ``,
    `Your appointment has been successfully registered:`,
    `• Service: ${data.serviceName}`,
    `• Date: ${shortDate} at ${data.appointmentTime}`,
    `• Coverage: ${coverageLabel}`,
    `• Reference: #${data.bookingId.slice(0, 8)}`,
    ``,
    `✅ Confirm: ${urls.confirmUrl}`,
    `❌ Cancel: ${urls.cancelUrl}`,
    ``,
    `Contact: ${clinicConfig.contact.phone}`,
  ].join("\n");

  return {
    body,
    actions: [
      { label: "✅ Confirm", action: "confirm" },
      { label: "❌ Cancel", action: "cancel" },
    ],
  };
}

/**
 * Renders a localized 24-hour reminder message.
 */
export function renderReminderMessage(
  data: MessagingBookingData,
): RenderedMessage {
  const locale: MessageLocale = data.locale ?? "el";
  const { doctor } = clinicConfig;
  const shortDate = formatShortDate(data.appointmentDate);
  const urls = buildConfirmationUrls(data.bookingId);

  if (locale === "el") {
    const body = [
      `⏰ *Υπενθύμιση Ραντεβού — ${doctor.name}*`,
      ``,
      `Αγαπητέ/ή ${data.patientName},`,
      `Σας υπενθυμίζουμε το αυριανό σας ραντεβού:`,
      `• ${data.serviceName} — ${shortDate} στις ${data.appointmentTime}`,
      ``,
      `Αν χρειαστεί να ακυρώσετε: ${urls.cancelUrl}`,
    ].join("\n");

    return {
      body,
      actions: [{ label: "❌ Ακύρωση", action: "cancel" }],
    };
  }

  const body = [
    `⏰ *Appointment Reminder — ${doctor.name}*`,
    ``,
    `Dear ${data.patientName},`,
    `This is a reminder for your appointment tomorrow:`,
    `• ${data.serviceName} — ${shortDate} at ${data.appointmentTime}`,
    ``,
    `To cancel: ${urls.cancelUrl}`,
  ].join("\n");

  return {
    body,
    actions: [{ label: "❌ Cancel", action: "cancel" }],
  };
}

// ---------------------------------------------------------------------------
// Twilio REST API helper (no SDK — avoids heavy Node-only dependencies)
// ---------------------------------------------------------------------------

/**
 * Sends a message via Twilio Messaging REST API.
 * Handles SMS, WhatsApp (whatsapp: prefix), and Viber (via Twilio Viber service).
 */
async function sendViaTwilio(
  credentials: MessagingCredentials,
  to: string,
  from: string,
  body: string,
  messagingServiceSid?: string,
): Promise<{ sid: string }> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/Messages.json`;

  const formData = new URLSearchParams({ To: to, Body: body });
  if (messagingServiceSid) {
    formData.append("MessagingServiceSid", messagingServiceSid);
  } else {
    formData.append("From", from);
  }

  const basicAuth = btoa(`${credentials.accountSid}:${credentials.authToken}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Twilio API error (${response.status}): ${errorText}`,
    );
  }

  const result = (await response.json()) as { sid: string };
  return result;
}

// ---------------------------------------------------------------------------
// Public dispatch functions
// ---------------------------------------------------------------------------

/**
 * Determines the best available channel from env config and sends the
 * booking confirmation message to the patient.
 * Priority: WhatsApp → SMS (Viber requires a separate Twilio Viber service).
 */
export async function sendBookingConfirmation(
  data: MessagingBookingData,
): Promise<MessagingResult> {
  if (!isMessagingConfigured()) {
    console.info(
      "[Messaging Service] Twilio credentials not configured. " +
        "Messaging dispatch skipped. Define TWILIO_ACCOUNT_SID, " +
        "TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER in .env to enable notifications.",
    );
    return { ok: true, skipped: true };
  }

  const credentials = getMessagingCredentials();
  if (!credentials) return { ok: true, skipped: true };

  const { body } = renderBookingConfirmationMessage(data);

  // Normalize phone to E.164 (basic best-effort)
  const phone = data.patientPhone.replace(/\s+/g, "");

  try {
    // 1. Try WhatsApp if configured
    if (credentials.whatsappNumber) {
      const result = await sendViaTwilio(
        credentials,
        `whatsapp:${phone}`,
        `whatsapp:${credentials.whatsappNumber}`,
        body,
      );
      console.info(
        `[Messaging Service] WhatsApp confirmation sent (SID: ${result.sid}) for booking #${data.bookingId}`,
      );
      return { ok: true, channel: "whatsapp", messageSid: result.sid };
    }

    // 2. Try Viber if service SID configured
    if (credentials.viberServiceId) {
      const result = await sendViaTwilio(
        credentials,
        phone,
        credentials.fromNumber,
        body,
        credentials.viberServiceId,
      );
      console.info(
        `[Messaging Service] Viber confirmation sent (SID: ${result.sid}) for booking #${data.bookingId}`,
      );
      return { ok: true, channel: "viber", messageSid: result.sid };
    }

    // 3. Fallback to plain SMS
    const result = await sendViaTwilio(
      credentials,
      phone,
      credentials.fromNumber,
      body,
    );
    console.info(
      `[Messaging Service] SMS confirmation sent (SID: ${result.sid}) for booking #${data.bookingId}`,
    );
    return { ok: true, channel: "sms", messageSid: result.sid };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[Messaging Service] Failed to send booking confirmation for #${data.bookingId}:`,
      message,
    );
    return { ok: false, error: message };
  }
}

/**
 * Sends a 24-hour reminder message to the patient.
 */
export async function sendBookingReminder(
  data: MessagingBookingData,
): Promise<MessagingResult> {
  if (!isMessagingConfigured()) {
    console.info(
      "[Messaging Service] Twilio credentials not configured. Reminder skipped.",
    );
    return { ok: true, skipped: true };
  }

  const credentials = getMessagingCredentials();
  if (!credentials) return { ok: true, skipped: true };

  const { body } = renderReminderMessage(data);
  const phone = data.patientPhone.replace(/\s+/g, "");

  try {
    if (credentials.whatsappNumber) {
      const result = await sendViaTwilio(
        credentials,
        `whatsapp:${phone}`,
        `whatsapp:${credentials.whatsappNumber}`,
        body,
      );
      console.info(
        `[Messaging Service] WhatsApp reminder sent (SID: ${result.sid}) for booking #${data.bookingId}`,
      );
      return { ok: true, channel: "whatsapp", messageSid: result.sid };
    }

    if (credentials.viberServiceId) {
      const result = await sendViaTwilio(
        credentials,
        phone,
        credentials.fromNumber,
        body,
        credentials.viberServiceId,
      );
      console.info(
        `[Messaging Service] Viber reminder sent (SID: ${result.sid}) for booking #${data.bookingId}`,
      );
      return { ok: true, channel: "viber", messageSid: result.sid };
    }

    const result = await sendViaTwilio(
      credentials,
      phone,
      credentials.fromNumber,
      body,
    );
    console.info(
      `[Messaging Service] SMS reminder sent (SID: ${result.sid}) for booking #${data.bookingId}`,
    );
    return { ok: true, channel: "sms", messageSid: result.sid };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[Messaging Service] Failed to send reminder for #${data.bookingId}:`,
      message,
    );
    return { ok: false, error: message };
  }
}
