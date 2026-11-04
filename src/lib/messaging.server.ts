import { clinicConfig } from "@/config/clinicConfig";
import { formatCoverageLabel } from "@/lib/booking";
import { intlLocaleTag, resolveLocale, type Locale } from "@/i18n/locales";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MessagingChannel = "sms" | "whatsapp" | "viber";
export type PatientResponseAction = "confirm" | "cancel";
export type MessageLocale = Locale;

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
  details?: Record<string, unknown>;
}

export interface SendSmsOptions {
  to: string;
  body: string;
  bookingId?: string;
  from?: string;
  messagingServiceSid?: string;
}

export interface MessagingCredentials {
  accountSid: string;
  authToken: string;
  fromNumber?: string; // E.164 (e.g. +35799123456) or Alphanumeric Sender ID
  messagingServiceSid?: string; // Twilio Messaging Service SID (MG...)
  whatsappNumber?: string; // E.164 with whatsapp: prefix handled at call-site
  viberServiceId?: string;
}

// ---------------------------------------------------------------------------
// Helper: Clean environment variable strings
// ---------------------------------------------------------------------------

function cleanEnv(val: string | undefined): string | undefined {
  if (!val) return undefined;
  const trimmed = val.trim().replace(/^["']|["']$/g, "").trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

// ---------------------------------------------------------------------------
// Helper: Phone number normalization (E.164 compliant)
// ---------------------------------------------------------------------------

/**
 * Normalizes phone numbers to standard E.164 format.
 * - Strips whitespace, dashes, dots, and parentheses.
 * - Converts leading '00' to '+'.
 * - If Cyprus 8-digit mobile/landline (e.g. 99xxxxxx), prepends +357 default country code.
 * - Ensures the final number starts with '+'.
 */
export function normalizePhoneNumber(rawPhone: string, defaultCountryCode = "+357"): string {
  if (!rawPhone) return "";
  let cleaned = rawPhone.trim().replace(/[\s\-()[\].]/g, "");

  if (cleaned.startsWith("00")) {
    cleaned = `+${cleaned.slice(2)}`;
  }

  if (!cleaned.startsWith("+")) {
    // 8-digit Cyprus number (starts with 9 for mobile, 2 for landline)
    if (/^\d{8}$/.test(cleaned)) {
      cleaned = `${defaultCountryCode}${cleaned}`;
    } else if (cleaned.startsWith("357") && cleaned.length === 11) {
      cleaned = `+${cleaned}`;
    } else {
      cleaned = `${defaultCountryCode}${cleaned}`;
    }
  }

  return cleaned;
}

/**
 * Normalizes the sender identifier (From number or alphanumeric sender).
 */
function normalizeSender(rawSender: string): string {
  const cleaned = rawSender.trim().replace(/^["']|["']$/g, "").trim();
  // If it's a Twilio Messaging Service SID (starts with MG), leave as-is
  if (cleaned.startsWith("MG")) return cleaned;
  // If it's an alphanumeric sender ID (letters only / alphanumeric without +)
  if (/^[A-Za-z0-9]{2,11}$/.test(cleaned) && !/^\d+$/.test(cleaned)) {
    return cleaned;
  }
  // If numeric or international phone number
  return normalizePhoneNumber(cleaned);
}

// ---------------------------------------------------------------------------
// Credential helpers
// ---------------------------------------------------------------------------

/**
 * Parses Twilio credentials from environment variables.
 * Supports multiple environment variable aliases commonly used across Vercel and Twilio:
 * - Account SID: TWILIO_ACCOUNT_SID, TWILIO_SID
 * - Auth Token:  TWILIO_AUTH_TOKEN, TWILIO_TOKEN
 * - From / SMS:  TWILIO_PHONE_NUMBER, TWILIO_FROM_NUMBER, TWILIO_NUMBER, TWILIO_FROM, TWILIO_CALLER_ID
 * - Messaging Service: TWILIO_MESSAGING_SERVICE_SID, TWILIO_SERVICE_SID
 */
export function getMessagingCredentials(): MessagingCredentials | null {
  const accountSid =
    cleanEnv(process.env["TWILIO_ACCOUNT_SID"]) ||
    cleanEnv(process.env["TWILIO_SID"]);

  const authToken =
    cleanEnv(process.env["TWILIO_AUTH_TOKEN"]) ||
    cleanEnv(process.env["TWILIO_TOKEN"]);

  const rawFromNumber =
    cleanEnv(process.env["TWILIO_PHONE_NUMBER"]) ||
    cleanEnv(process.env["TWILIO_FROM_NUMBER"]) ||
    cleanEnv(process.env["TWILIO_NUMBER"]) ||
    cleanEnv(process.env["TWILIO_FROM"]) ||
    cleanEnv(process.env["TWILIO_CALLER_ID"]) ||
    cleanEnv(process.env["TWILIO_SENDER_ID"]);

  const rawServiceSid =
    cleanEnv(process.env["TWILIO_MESSAGING_SERVICE_SID"]) ||
    cleanEnv(process.env["TWILIO_SERVICE_SID"]);

  // If sender starts with MG, it is a Messaging Service SID
  let messagingServiceSid = rawServiceSid;
  let fromNumber: string | undefined = undefined;

  if (rawFromNumber) {
    if (rawFromNumber.startsWith("MG")) {
      messagingServiceSid = messagingServiceSid || rawFromNumber;
    } else {
      fromNumber = normalizeSender(rawFromNumber);
    }
  }

  // Minimum required: accountSid, authToken, and (fromNumber OR messagingServiceSid)
  if (!accountSid || !authToken || (!fromNumber && !messagingServiceSid)) {
    return null;
  }

  const creds: MessagingCredentials = {
    accountSid,
    authToken,
    ...(fromNumber ? { fromNumber } : {}),
    ...(messagingServiceSid ? { messagingServiceSid } : {}),
  };

  const waNumber =
    cleanEnv(process.env["TWILIO_WHATSAPP_NUMBER"]) ||
    cleanEnv(process.env["TWILIO_WHATSAPP_FROM"]);
  const viberSid =
    cleanEnv(process.env["TWILIO_VIBER_SERVICE_SID"]) ||
    cleanEnv(process.env["TWILIO_VIBER_SERVICE_ID"]);

  if (waNumber) creds.whatsappNumber = normalizePhoneNumber(waNumber);
  if (viberSid) creds.viberServiceId = viberSid;

  return creds;
}

/**
 * Returns true if the minimum Twilio credentials are set.
 */
export function isMessagingConfigured(): boolean {
  return getMessagingCredentials() !== null;
}

/**
 * Logs diagnostic details when Twilio configuration is incomplete.
 */
function logConfigurationDiagnostics(context: string): void {
  const detectedKeys: string[] = [];
  const missingKeys: string[] = [];

  const sid = cleanEnv(process.env["TWILIO_ACCOUNT_SID"]) || cleanEnv(process.env["TWILIO_SID"]);
  if (sid) detectedKeys.push("Account SID (TWILIO_ACCOUNT_SID or TWILIO_SID)");
  else missingKeys.push("TWILIO_ACCOUNT_SID (or TWILIO_SID)");

  const token = cleanEnv(process.env["TWILIO_AUTH_TOKEN"]) || cleanEnv(process.env["TWILIO_TOKEN"]);
  if (token) detectedKeys.push("Auth Token (TWILIO_AUTH_TOKEN or TWILIO_TOKEN)");
  else missingKeys.push("TWILIO_AUTH_TOKEN (or TWILIO_TOKEN)");

  const sender =
    cleanEnv(process.env["TWILIO_PHONE_NUMBER"]) ||
    cleanEnv(process.env["TWILIO_FROM_NUMBER"]) ||
    cleanEnv(process.env["TWILIO_NUMBER"]) ||
    cleanEnv(process.env["TWILIO_FROM"]) ||
    cleanEnv(process.env["TWILIO_CALLER_ID"]) ||
    cleanEnv(process.env["TWILIO_MESSAGING_SERVICE_SID"]) ||
    cleanEnv(process.env["TWILIO_SERVICE_SID"]);

  if (sender) {
    detectedKeys.push("Sender Number/Service (TWILIO_PHONE_NUMBER / TWILIO_FROM_NUMBER / TWILIO_MESSAGING_SERVICE_SID)");
  } else {
    missingKeys.push("TWILIO_PHONE_NUMBER (or TWILIO_FROM_NUMBER / TWILIO_MESSAGING_SERVICE_SID)");
  }

  console.warn(
    `[Messaging Service] ⚠️ ${context}: Twilio credentials are not configured. SMS dispatch skipped.\n` +
      `  • Detected variables: [${detectedKeys.join(", ") || "none"}]\n` +
      `  • Missing required: [${missingKeys.join(", ")}]\n` +
      `  • Action: Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER (or TWILIO_FROM_NUMBER) in your Vercel Project Environment Variables.`,
  );
}

// ---------------------------------------------------------------------------
// Confirmation URL builder
// ---------------------------------------------------------------------------

/**
 * Constructs the HTTPS action URLs that patients click/reply to when they
 * tap Accept or Cancel. The webhook handler at
 * /api/messaging/webhook processes the incoming POST or GET.
 */
export function buildConfirmationUrls(
  bookingId: string,
  locale?: MessageLocale,
): { confirmUrl: string; cancelUrl: string } {
  const base =
    cleanEnv(process.env["PUBLIC_BASE_URL"]) ||
    cleanEnv(process.env["VITE_PUBLIC_URL"]) ||
    (process.env["VERCEL_URL"] ? `https://${process.env["VERCEL_URL"].replace(/^https?:\/\//, "")}` : undefined) ||
    `https://${cleanEnv(process.env["CF_PAGES_URL"]) || "localhost:3000"}`;

  // `lang` lets the webhook landing page answer in the patient's language.
  const langParam = locale ? `&lang=${locale}` : "";

  return {
    confirmUrl: `${base}/api/messaging/webhook?action=confirm&bookingId=${encodeURIComponent(bookingId)}${langParam}`,
    cancelUrl: `${base}/api/messaging/webhook?action=cancel&bookingId=${encodeURIComponent(bookingId)}${langParam}`,
  };
}

// ---------------------------------------------------------------------------
// Message template rendering
// ---------------------------------------------------------------------------

function formatShortDate(dateStr: string, locale: MessageLocale): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (y && m && d) {
      return new Date(y, m - 1, d).toLocaleDateString(intlLocaleTag(locale), {
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
  const locale: MessageLocale = resolveLocale(data.locale);
  const { doctor } = clinicConfig;
  const shortDate = formatShortDate(data.appointmentDate, locale);
  const coverageLabel = formatCoverageLabel(data.appointmentType, data.privateFee, locale);

  const urls = buildConfirmationUrls(data.bookingId, locale);

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
  const locale: MessageLocale = resolveLocale(data.locale);
  const { doctor } = clinicConfig;
  const shortDate = formatShortDate(data.appointmentDate, locale);
  const urls = buildConfirmationUrls(data.bookingId, locale);

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
// Twilio REST API helper (Zero SDK dependencies — Edge & Serverless friendly)
// ---------------------------------------------------------------------------

/**
 * Sends a message via the official Twilio REST API.
 * Handles SMS, WhatsApp, and Viber via form-encoded POST.
 */
async function sendViaTwilio(
  credentials: MessagingCredentials,
  to: string,
  from?: string,
  body?: string,
  messagingServiceSid?: string,
): Promise<{ sid: string }> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/Messages.json`;

  const formData = new URLSearchParams();
  formData.append("To", to);
  formData.append("Body", body || "");

  const activeServiceSid = messagingServiceSid || credentials.messagingServiceSid;
  const activeFrom = from || credentials.fromNumber;

  if (activeServiceSid) {
    formData.append("MessagingServiceSid", activeServiceSid);
  } else if (activeFrom) {
    formData.append("From", activeFrom);
  } else {
    const errorMsg = "Neither 'From' phone number nor 'MessagingServiceSid' was provided for Twilio dispatch.";
    console.error(`[Messaging Service] ❌ Configuration Error: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const basicAuth =
    typeof Buffer !== "undefined"
      ? Buffer.from(`${credentials.accountSid}:${credentials.authToken}`).toString("base64")
      : btoa(`${credentials.accountSid}:${credentials.authToken}`);

  console.info(
    `[Messaging Service] 📤 Dispatched Twilio request:\n` +
      `  • Account SID: ${credentials.accountSid.slice(0, 6)}...${credentials.accountSid.slice(-4)}\n` +
      `  • To: ${to}\n` +
      `  • ${activeServiceSid ? `MessagingServiceSid: ${activeServiceSid}` : `From: ${activeFrom}`}\n` +
      `  • Body Length: ${(body || "").length} chars`,
  );

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });
  } catch (networkErr) {
    console.error("[Messaging Service] ❌ Network connection error contacting Twilio API:", networkErr);
    throw networkErr;
  }

  if (!response.ok) {
    const errorText = await response.text();
    let errorJson: Record<string, unknown> | null = null;
    try {
      errorJson = JSON.parse(errorText);
    } catch {
      // Body was not JSON
    }

    const twilioCode = errorJson?.code as number | undefined;
    const twilioMessage = (errorJson?.message as string) || errorText;
    const twilioMoreInfo = (errorJson?.more_info as string) || "";

    console.error(
      `[Messaging Service] ❌ Twilio API Error Response (${response.status}):\n` +
        `  • Error Code: ${twilioCode ?? "N/A"}\n` +
        `  • Message: ${twilioMessage}\n` +
        `  • More Info: ${twilioMoreInfo || "None"}\n` +
        `  • Target Recipient: ${to}\n` +
        `  • Sender: ${activeServiceSid ? `MessagingServiceSid (${activeServiceSid})` : activeFrom}\n` +
        `  • Raw Twilio Response: ${errorText}`,
    );

    // Provide immediate actionable diagnostic guidance in Vercel logs:
    if (twilioCode === 21608) {
      console.error(
        "[Messaging Service] 💡 Diagnosing Twilio Error 21608: Your Twilio account is in Trial mode. Trial accounts can ONLY send SMS to verified caller IDs. " +
          `Verify '${to}' in your Twilio Console (https://twilio.com/console/phone-numbers/verified) or upgrade your Twilio account to send to all patients.`,
      );
    } else if (twilioCode === 21211) {
      console.error(
        `[Messaging Service] 💡 Diagnosing Twilio Error 21211: The recipient phone number '${to}' is invalid. Ensure it is in E.164 format (e.g. +35799123456).`,
      );
    } else if (twilioCode === 21606) {
      console.error(
        `[Messaging Service] 💡 Diagnosing Twilio Error 21606: The 'From' number '${activeFrom}' is not a valid Twilio phone number or is not SMS capable.`,
      );
    } else if (twilioCode === 20003) {
      console.error(
        "[Messaging Service] 💡 Diagnosing Twilio Error 20003: Twilio Authentication failed. Please verify TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in Vercel.",
      );
    } else if (twilioCode === 20005) {
      console.error(
        "[Messaging Service] 💡 Diagnosing Twilio Error 20005: Account not authorized to send to this destination. " +
          "For Cyprus (+357) numbers, your Twilio account must complete Trust Hub KYC registration. " +
          "Go to: https://console.twilio.com/us1/trusthub and submit your business profile.",
      );
    } else if (twilioCode === 21408) {
      console.error(
        `[Messaging Service] 💡 Diagnosing Twilio Error 21408: Geographic permission not enabled for recipient country. ` +
          `Enable messaging to Cyprus (CY) at: https://console.twilio.com/us1/develop/sms/settings/geo-permissions`,
      );
    } else if (twilioCode === 30034) {
      console.error(
        "[Messaging Service] 💡 Diagnosing Twilio Error 30034: Message blocked by Twilio's risk engine (STOP filter or carrier block). " +
          "The recipient may have previously replied STOP. Check Twilio Console → Messaging → Logs for opt-out status.",
      );
    } else if (twilioCode === 63016 || twilioCode === 21617) {
      console.error(
        "[Messaging Service] 💡 Diagnosing Twilio WhatsApp Error: WhatsApp requires pre-approved templates for business-initiated conversations outside the 24h window.",
      );
    }

    throw new Error(
      `Twilio API error (${response.status}${twilioCode ? ` - Code ${twilioCode}` : ""}): ${twilioMessage}`,
    );
  }

  const result = (await response.json()) as { sid: string };
  console.info(`[Messaging Service] ✅ Twilio message sent successfully (SID: ${result.sid}) to ${to}`);
  return result;
}

// ---------------------------------------------------------------------------
// Dedicated SMS Sender Function
// ---------------------------------------------------------------------------

/**
 * Direct SMS sending function.
 * Validates credentials, normalizes the recipient's phone number to E.164,
 * and calls the Twilio REST API with full error logging.
 */
export async function sendSms(options: SendSmsOptions): Promise<MessagingResult> {
  if (!isMessagingConfigured()) {
    logConfigurationDiagnostics("sendSms");
    return { ok: true, skipped: true };
  }

  const credentials = getMessagingCredentials();
  if (!credentials) return { ok: true, skipped: true };

  const phone = normalizePhoneNumber(options.to);
  const activeFrom = options.from || credentials.fromNumber;
  const activeServiceSid = options.messagingServiceSid || credentials.messagingServiceSid;

  try {
    const result = await sendViaTwilio(
      credentials,
      phone,
      activeFrom,
      options.body,
      activeServiceSid,
    );

    return {
      ok: true,
      channel: "sms",
      messageSid: result.sid,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[Messaging Service] ❌ sendSms failed for recipient ${phone}${options.bookingId ? ` (Booking #${options.bookingId})` : ""}:`,
      err,
    );
    return {
      ok: false,
      channel: "sms",
      error: message,
    };
  }
}

// ---------------------------------------------------------------------------
// Public dispatch functions
// ---------------------------------------------------------------------------

/**
 * Determines the best available channel from env config and sends the
 * booking confirmation message to the patient.
 *
 * Resilient multi-channel routing:
 * 1. If WhatsApp is configured, attempts WhatsApp first.
 *    If WhatsApp fails (e.g. template required or unverified), it logs a warning
 *    and automatically FALLS BACK to plain SMS so notifications are not lost.
 * 2. If Viber is configured, attempts Viber.
 * 3. Sends via standard SMS.
 */
export async function sendBookingConfirmation(
  data: MessagingBookingData,
): Promise<MessagingResult> {
  if (!isMessagingConfigured()) {
    logConfigurationDiagnostics(`sendBookingConfirmation (Booking #${data.bookingId})`);
    return { ok: true, skipped: true };
  }

  const credentials = getMessagingCredentials();
  if (!credentials) return { ok: true, skipped: true };

  const { body } = renderBookingConfirmationMessage(data);
  const phone = normalizePhoneNumber(data.patientPhone);

  console.info(`[Messaging Service] 🚀 Processing booking confirmation for #${data.bookingId} (Recipient: ${phone})`);

  // 1. Try WhatsApp if configured
  if (credentials.whatsappNumber) {
    try {
      const result = await sendViaTwilio(
        credentials,
        `whatsapp:${phone}`,
        `whatsapp:${credentials.whatsappNumber}`,
        body,
      );
      console.info(
        `[Messaging Service] ✅ WhatsApp confirmation sent (SID: ${result.sid}) for booking #${data.bookingId}`,
      );
      return { ok: true, channel: "whatsapp", messageSid: result.sid };
    } catch (waErr) {
      console.warn(
        `[Messaging Service] ⚠️ WhatsApp delivery failed for #${data.bookingId}. Falling back to standard SMS:`,
        waErr instanceof Error ? waErr.message : waErr,
      );
      // Fall through to SMS fallback below!
    }
  }

  // 2. Try Viber if service SID configured
  if (credentials.viberServiceId) {
    try {
      const result = await sendViaTwilio(
        credentials,
        phone,
        credentials.fromNumber,
        body,
        credentials.viberServiceId,
      );
      console.info(
        `[Messaging Service] ✅ Viber confirmation sent (SID: ${result.sid}) for booking #${data.bookingId}`,
      );
      return { ok: true, channel: "viber", messageSid: result.sid };
    } catch (viberErr) {
      console.warn(
        `[Messaging Service] ⚠️ Viber delivery failed for #${data.bookingId}. Falling back to standard SMS:`,
        viberErr instanceof Error ? viberErr.message : viberErr,
      );
      // Fall through to SMS fallback below!
    }
  }

  // 3. Primary / Fallback: Plain SMS
  try {
    const result = await sendViaTwilio(
      credentials,
      phone,
      credentials.fromNumber,
      body,
      credentials.messagingServiceSid,
    );
    console.info(
      `[Messaging Service] ✅ SMS confirmation sent (SID: ${result.sid}) for booking #${data.bookingId}`,
    );
    return { ok: true, channel: "sms", messageSid: result.sid };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[Messaging Service] ❌ Failed to send booking confirmation for #${data.bookingId} to ${phone}:`,
      err,
    );
    return { ok: false, channel: "sms", error: message };
  }
}

/**
 * Sends a 24-hour reminder message to the patient with automatic SMS fallback.
 */
export async function sendBookingReminder(
  data: MessagingBookingData,
): Promise<MessagingResult> {
  if (!isMessagingConfigured()) {
    logConfigurationDiagnostics(`sendBookingReminder (Booking #${data.bookingId})`);
    return { ok: true, skipped: true };
  }

  const credentials = getMessagingCredentials();
  if (!credentials) return { ok: true, skipped: true };

  const { body } = renderReminderMessage(data);
  const phone = normalizePhoneNumber(data.patientPhone);

  if (credentials.whatsappNumber) {
    try {
      const result = await sendViaTwilio(
        credentials,
        `whatsapp:${phone}`,
        `whatsapp:${credentials.whatsappNumber}`,
        body,
      );
      console.info(
        `[Messaging Service] ✅ WhatsApp reminder sent (SID: ${result.sid}) for booking #${data.bookingId}`,
      );
      return { ok: true, channel: "whatsapp", messageSid: result.sid };
    } catch (waErr) {
      console.warn(
        `[Messaging Service] ⚠️ WhatsApp reminder failed for #${data.bookingId}. Falling back to SMS:`,
        waErr instanceof Error ? waErr.message : waErr,
      );
    }
  }

  if (credentials.viberServiceId) {
    try {
      const result = await sendViaTwilio(
        credentials,
        phone,
        credentials.fromNumber,
        body,
        credentials.viberServiceId,
      );
      console.info(
        `[Messaging Service] ✅ Viber reminder sent (SID: ${result.sid}) for booking #${data.bookingId}`,
      );
      return { ok: true, channel: "viber", messageSid: result.sid };
    } catch (viberErr) {
      console.warn(
        `[Messaging Service] ⚠️ Viber reminder failed for #${data.bookingId}. Falling back to SMS:`,
        viberErr instanceof Error ? viberErr.message : viberErr,
      );
    }
  }

  try {
    const result = await sendViaTwilio(
      credentials,
      phone,
      credentials.fromNumber,
      body,
      credentials.messagingServiceSid,
    );
    console.info(
      `[Messaging Service] ✅ SMS reminder sent (SID: ${result.sid}) for booking #${data.bookingId}`,
    );
    return { ok: true, channel: "sms", messageSid: result.sid };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[Messaging Service] ❌ Failed to send reminder for #${data.bookingId} to ${phone}:`,
      err,
    );
    return { ok: false, channel: "sms", error: message };
  }
}
