import { Resend } from "resend";
import { clinicConfig } from "@/config/clinicConfig";
import { DEFAULT_LOCALE, intlLocaleTag, resolveLocale, type Locale } from "@/i18n/locales";
import { sendSms } from "./messaging.server";

export interface ReminderBookingRow {
  id: string;
  source_table: "booking_requests" | "bookings";
  full_name: string;
  phone: string;
  email: string | null;
  service_name: string;
  appointment_date: string; // YYYY-MM-DD
  appointment_time: string; // HH:mm
  preferred_language: string | null;
  status: string;
  reminder_sent: boolean | null;
  action_token?: string | null;
}

export interface CronReminderSummaryItem {
  bookingId: string;
  patientName: string;
  appointmentDate: string;
  appointmentTime: string;
  locale: Locale;
  smsSent: boolean;
  emailSent: boolean;
  emailSkipped: boolean;
  dbUpdated: boolean;
  error?: string;
}

export interface CronRemindersResult {
  ok: boolean;
  status: number;
  error?: string;
  window?: {
    targetDateStart: string;
    targetDateEnd: string;
  };
  processedCount?: number;
  results?: CronReminderSummaryItem[];
}

/**
 * Formats a Date object as YYYY-MM-DD in a given IANA timezone (defaults to Asia/Nicosia).
 */
export function formatDateInTimeZone(date: Date, timeZone = "Asia/Nicosia"): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    if (y && m && d) {
      return `${y}-${m}-${d}`;
    }
  } catch {
    // Fallback to UTC ISO string slice
  }
  return date.toISOString().split("T")[0]!;
}

/**
 * Formats YYYY-MM-DD + HH:mm into a human-friendly localized date/time string.
 */
export function formatReminderDateTime(
  dateStr: string,
  timeStr: string,
  locale: Locale,
): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (y && m && d) {
      const formattedDate = new Date(y, m - 1, d).toLocaleDateString(intlLocaleTag(locale), {
        weekday: "short",
        day: "numeric",
        month: "long",
      });
      return locale === "el"
        ? `${formattedDate} (${dateStr}) στις ${timeStr}`
        : `${formattedDate} (${dateStr}) at ${timeStr}`;
    }
  } catch {
    // Fall through
  }
  return locale === "el" ? `${dateStr} στις ${timeStr}` : `${dateStr} at ${timeStr}`;
}

/**
 * Builds the bilingual 48-hour reminder text with the unique actionUrl.
 *
 * (el): 'Υπενθύμιση ραντεβού: Έχετε κράτηση στις [Ημερομηνία/Ώρα]. Παρακαλούμε επιβεβαιώστε ή ακυρώστε την παρουσία σας εδώ: [actionUrl]'
 * (en): 'Appointment reminder for [Date/Time]. Please confirm or cancel your attendance here: [actionUrl]'
 */
export function buildReminderMessageText(
  dateStr: string,
  timeStr: string,
  actionUrl: string,
  locale: Locale,
): string {
  const dateTimeLabel = formatReminderDateTime(dateStr, timeStr, locale);
  if (locale === "el") {
    return `Υπενθύμιση ραντεβού: Έχετε κράτηση στις ${dateTimeLabel}. Παρακαλούμε επιβεβαιώστε ή ακυρώστε την παρουσία σας εδώ: ${actionUrl}`;
  }
  return `Appointment reminder for ${dateTimeLabel}. Please confirm or cancel your attendance here: ${actionUrl}`;
}

/**
 * Resolves the public base URL for action links, prioritizing NEXT_PUBLIC_BASE_URL.
 */
export function resolveBaseUrl(): string {
  const rawBase =
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    process.env["NEXT_PUBLIC_BASE_URL"]?.trim() ||
    process.env.PUBLIC_BASE_URL?.trim() ||
    process.env["PUBLIC_BASE_URL"]?.trim() ||
    process.env.VITE_PUBLIC_URL?.trim() ||
    process.env["VITE_PUBLIC_URL"]?.trim() ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL.trim().replace(/^https?:\/\//, "")}`
      : "");

  return rawBase.replace(/\/+$/, "");
}

/**
 * Sends the 48-hour reminder email via Resend if the patient provided a valid email address.
 */
async function sendReminderEmail(options: {
  bookingId: string;
  patientName: string;
  patientEmail: string;
  serviceName: string;
  appointmentDate: string;
  appointmentTime: string;
  actionUrl: string;
  locale: Locale;
}): Promise<{ sent: boolean; skipped: boolean; error?: string }> {
  const rawEmail = typeof options.patientEmail === "string" ? options.patientEmail.trim() : "";
  if (!rawEmail || rawEmail.toLowerCase() === "no-email@provided.com") {
    return { sent: false, skipped: true };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim() || process.env["RESEND_API_KEY"]?.trim();
  if (!apiKey) {
    console.info(
      `[Cron Reminders] RESEND_API_KEY not configured; skipping reminder email for booking #${options.bookingId}.`,
    );
    return { sent: false, skipped: true };
  }

  const resend = new Resend(apiKey);
  const { doctor, contact } = clinicConfig;
  const defaultFrom = `${doctor.name} <onboarding@resend.dev>`;
  const fromEmail =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    process.env["RESEND_FROM_EMAIL"]?.trim() ||
    defaultFrom;

  const messageText = buildReminderMessageText(
    options.appointmentDate,
    options.appointmentTime,
    options.actionUrl,
    options.locale,
  );

  const isEl = options.locale === "el";
  const subject = isEl
    ? `Υπενθύμιση Ραντεβού — ${doctor.name}`
    : `Appointment Reminder — ${doctor.name}`;
  const greeting = isEl
    ? `Αγαπητέ/ή ${options.patientName},`
    : `Dear ${options.patientName},`;
  const ctaLabel = isEl
    ? "Επιβεβαίωση ή Ακύρωση Ραντεβού"
    : "Confirm or Cancel Appointment";

  const text = `${greeting}\n\n${messageText}\n\n${doctor.name}\n${contact.phone}`;

  const html = `
<!DOCTYPE html>
<html lang="${options.locale}">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f8faf9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;line-height:1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8faf9;padding:40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:600px;background-color:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
          <tr>
            <td style="background-color:#1e4338;padding:28px 32px;text-align:center;">
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">${doctor.name}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:15px;color:#0f172a;font-weight:600;">${greeting}</p>
              <p style="margin:0 0 24px;font-size:15px;color:#475569;">${messageText}</p>
              <div style="text-align:center;margin:28px 0;">
                <a href="${options.actionUrl}" style="display:inline-block;background-color:#1e4338;color:#ffffff;font-weight:600;font-size:15px;padding:12px 24px;border-radius:8px;text-decoration:none;">
                  ${ctaLabel}
                </a>
              </div>
              <p style="margin:24px 0 0;font-size:13px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:16px;">
                ${doctor.name} · ${contact.phone}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  try {
    const res = await resend.emails.send({
      from: fromEmail,
      to: [rawEmail],
      subject,
      text,
      html,
    });
    if (res.error) {
      console.error(
        `[Cron Reminders] ❌ Resend API error for booking #${options.bookingId}:`,
        res.error,
      );
      return { sent: false, skipped: false, error: res.error.message };
    }
    return { sent: true, skipped: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[Cron Reminders] ❌ Unexpected error sending reminder email for #${options.bookingId}:`,
      msg,
    );
    return { sent: false, skipped: false, error: msg };
  }
}

/**
 * Main handler for `/api/cron/reminders`.
 * 1. Verifies `Authorization: Bearer ${process.env.CRON_SECRET}`
 * 2. Finds bookings within the next 48 to 72 hours (μεθαύριο) where `reminder_sent` is false
 * 3. Generates `action_token` via `crypto.randomUUID()` and builds `actionUrl`
 * 4. Sends bilingual Twilio SMS and (if email provided) Resend Email
 * 5. Updates `action_token` and `reminder_sent = true` in Supabase via the Admin client
 */
export async function handleRemindersCron(request: Request): Promise<CronRemindersResult> {
  const authHeader =
    request.headers.get("authorization") || request.headers.get("Authorization") || "";
  const cronSecret = (
    process.env.CRON_SECRET ||
    process.env["CRON_SECRET"] ||
    ""
  ).trim();

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized",
    };
  }

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const in72h = new Date(now.getTime() + 72 * 60 * 60 * 1000);

    // Target dates in Cyprus timezone for the 48h to 72h ("μεθαύριο") window
    const targetDateStart = formatDateInTimeZone(in48h, "Asia/Nicosia");
    const targetDateEnd = formatDateInTimeZone(in72h, "Asia/Nicosia");

    const candidateTables = ["booking_requests", "bookings"] as const;
    const seenIds = new Set<string>();
    const pendingBookings: ReminderBookingRow[] = [];

    for (const table of candidateTables) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: rows, error } = await (supabaseAdmin.from(table as any) as any)
          .select("*")
          .gte("appointment_date", targetDateStart)
          .lte("appointment_date", targetDateEnd)
          .eq("reminder_sent", false)
          .neq("status", "cancelled");

        if (error) {
          console.warn(`[Cron Reminders] Query warning on table '${table}':`, error.message);
          continue;
        }

        if (Array.isArray(rows)) {
          for (const row of rows as Record<string, unknown>[]) {
            const id = row["id"] ? String(row["id"]) : "";
            if (!id || seenIds.has(id)) continue;

            // Ensure reminder_sent is strictly false
            if (row["reminder_sent"] === true) continue;

            seenIds.add(id);
            pendingBookings.push({
              id,
              source_table: table,
              full_name: String(row["full_name"] || row["patient_name"] || "Ασθενής"),
              phone: String(row["phone"] || row["patient_phone"] || ""),
              email:
                typeof row["email"] === "string"
                  ? row["email"]
                  : typeof row["patient_email"] === "string"
                    ? row["patient_email"]
                    : null,
              service_name: String(row["service_name"] || row["service"] || "Ραντεβού"),
              appointment_date: String(row["appointment_date"] || ""),
              appointment_time: String(row["appointment_time"] || ""),
              preferred_language:
                typeof row["preferred_language"] === "string"
                  ? row["preferred_language"]
                  : DEFAULT_LOCALE,
              status: String(row["status"] || "pending"),
              reminder_sent: Boolean(row["reminder_sent"]),
            });
          }
        }
      } catch (tableErr) {
        console.warn(`[Cron Reminders] Error querying table '${table}':`, tableErr);
      }
    }

    const baseUrl = resolveBaseUrl();
    const results: CronReminderSummaryItem[] = [];

    for (const booking of pendingBookings) {
      const token = crypto.randomUUID();
      const actionUrl = `${baseUrl}/manage-booking?token=${token}`;
      const locale = resolveLocale(booking.preferred_language ?? DEFAULT_LOCALE);

      const smsBody = buildReminderMessageText(
        booking.appointment_date,
        booking.appointment_time,
        actionUrl,
        locale,
      );

      // 1. Send Twilio SMS
      let smsSent = false;
      if (booking.phone) {
        const smsRes = await sendSms({
          to: booking.phone,
          body: smsBody,
          bookingId: booking.id,
        });
        smsSent = smsRes.ok && !smsRes.skipped;
      }

      // 2. Send Resend Email (only if patient provided a real email)
      const emailRes = await sendReminderEmail({
        bookingId: booking.id,
        patientName: booking.full_name,
        patientEmail: booking.email || "",
        serviceName: booking.service_name,
        appointmentDate: booking.appointment_date,
        appointmentTime: booking.appointment_time,
        actionUrl,
        locale,
      });

      // 3. Update Supabase row: set action_token and reminder_sent = true
      let dbUpdated = false;
      for (const table of candidateTables) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: updateErr } = await (supabaseAdmin.from(table as any) as any)
            .update({
              action_token: token,
              reminder_sent: true,
            })
            .eq("id", booking.id);

          if (!updateErr) {
            dbUpdated = true;
          }
        } catch (uErr) {
          console.warn(
            `[Cron Reminders] Failed updating table '${table}' for booking #${booking.id}:`,
            uErr,
          );
        }
      }

      results.push({
        bookingId: booking.id,
        patientName: booking.full_name,
        appointmentDate: booking.appointment_date,
        appointmentTime: booking.appointment_time,
        locale,
        smsSent,
        emailSent: emailRes.sent,
        emailSkipped: emailRes.skipped,
        dbUpdated,
      });
    }

    return {
      ok: true,
      status: 200,
      window: {
        targetDateStart,
        targetDateEnd,
      },
      processedCount: results.length,
      results,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Cron Reminders] ❌ Unexpected cron execution error:", err);
    return {
      ok: false,
      status: 500,
      error: message,
    };
  }
}
