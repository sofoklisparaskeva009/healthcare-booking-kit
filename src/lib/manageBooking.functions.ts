import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { clinicConfig } from "@/config/clinicConfig";
import { DEFAULT_LOCALE, resolveLocale, type Locale } from "@/i18n/locales";
import { getLocalizedServices, type AppointmentType } from "./booking";
import { formatDateInTimeZone } from "./remindersCron.server";

export interface ManagedBookingDetails {
  id: string;
  fullName: string;
  serviceName: string;
  appointmentDate: string; // YYYY-MM-DD
  appointmentTime: string; // HH:mm
  appointmentType: AppointmentType;
  privateFee: number | null;
  status: "pending" | "confirmed" | "cancelled" | string;
  preferredLanguage: Locale;
}

interface RawManagedRow {
  id: string;
  source_table: "booking_requests" | "bookings";
  full_name: string;
  phone: string;
  email: string | null;
  service_name: string;
  appointment_date: string;
  appointment_time: string;
  appointment_type: AppointmentType;
  private_fee_eur: number | null;
  status: string;
  preferred_language: Locale;
  calendar_event_id: string | null;
}

async function lookupBookingRowByToken(token: string): Promise<RawManagedRow | null> {
  const cleanToken = token.trim();
  if (!cleanToken) return null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const candidateTables = ["booking_requests", "bookings"] as const;

  for (const table of candidateTables) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rows, error } = await (supabaseAdmin.from(table as any) as any)
        .select("*")
        .eq("action_token", cleanToken)
        .limit(1);

      if (!error && Array.isArray(rows) && rows.length > 0) {
        const row = rows[0] as Record<string, unknown>;
        const id = row["id"] ? String(row["id"]) : "";
        if (!id) continue;

        const locale = resolveLocale(
          typeof row["preferred_language"] === "string"
            ? row["preferred_language"]
            : DEFAULT_LOCALE,
        );
        const rawService = String(row["service_name"] || row["service"] || "Ραντεβού");

        return {
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
          service_name: rawService,
          appointment_date: String(row["appointment_date"] || ""),
          appointment_time: String(row["appointment_time"] || ""),
          appointment_type: row["appointment_type"] === "gesy" ? "gesy" : "private",
          private_fee_eur:
            typeof row["private_fee_eur"] === "number" ? row["private_fee_eur"] : null,
          status: String(row["status"] || "pending"),
          preferred_language: locale,
          calendar_event_id:
            typeof row["calendar_event_id"] === "string" ? row["calendar_event_id"] : null,
        };
      }
    } catch (err) {
      console.warn(`[manageBooking] Lookup warning on table '${table}':`, err);
    }
  }

  return null;
}

function isBookingPastOrCancelled(row: RawManagedRow): boolean {
  if (row.status === "cancelled") {
    return true;
  }
  const todayInCyprus = formatDateInTimeZone(new Date(), "Asia/Nicosia");
  if (row.appointment_date && row.appointment_date < todayInCyprus) {
    return true;
  }
  return false;
}

function localizeServiceName(canonicalOrRawName: string, locale: Locale): string {
  const localizedList = getLocalizedServices(locale);
  const canonicalList = getLocalizedServices("el");
  const idx = canonicalList.findIndex(
    (s) => s.name.toLowerCase() === canonicalOrRawName.trim().toLowerCase(),
  );
  if (idx !== -1 && localizedList[idx]) {
    return localizedList[idx].name;
  }
  return canonicalOrRawName;
}

/**
 * Fetches booking details by `action_token` without requiring user authentication.
 * Returns `{ ok: false, expiredOrInvalid: true }` if the token is missing, not found,
 * already cancelled, or in the past.
 */
export const getBookingByActionToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: z.string().trim().optional().default(""),
      })
      .parse(d),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      ok: boolean;
      expiredOrInvalid?: boolean;
      booking?: ManagedBookingDetails;
    }> => {
      if (!data.token) {
        return { ok: false, expiredOrInvalid: true };
      }

      try {
        const row = await lookupBookingRowByToken(data.token);
        if (!row || isBookingPastOrCancelled(row)) {
          return { ok: false, expiredOrInvalid: true };
        }

        const localizedService = localizeServiceName(row.service_name, row.preferred_language);

        return {
          ok: true,
          booking: {
            id: row.id,
            fullName: row.full_name,
            serviceName: localizedService,
            appointmentDate: row.appointment_date,
            appointmentTime: row.appointment_time,
            appointmentType: row.appointment_type,
            privateFee: row.private_fee_eur,
            status: row.status,
            preferredLanguage: row.preferred_language,
          },
        };
      } catch (err) {
        console.error("[getBookingByActionToken] Error:", err);
        return { ok: false, expiredOrInvalid: true };
      }
    },
  );

/**
 * Sends an internal email notification to the Clinic/Admin when a patient cancels their appointment.
 */
async function sendAdminCancellationEmail(row: RawManagedRow): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim() || process.env["RESEND_API_KEY"]?.trim();
  if (!apiKey) return;

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const { doctor, contact } = clinicConfig;
    const defaultFrom = `${doctor.name} <onboarding@resend.dev>`;
    const fromEmail =
      process.env.RESEND_FROM_EMAIL?.trim() ||
      process.env["RESEND_FROM_EMAIL"]?.trim() ||
      defaultFrom;
    const clinicRecipient =
      process.env.CLINIC_NOTIFICATION_EMAIL?.trim() ||
      process.env["CLINIC_NOTIFICATION_EMAIL"]?.trim() ||
      contact.email;

    const displayEmail =
      row.email && row.email.trim() && row.email.trim().toLowerCase() !== "no-email@provided.com"
        ? row.email.trim()
        : "Δεν δηλώθηκε";

    await resend.emails.send({
      from: fromEmail,
      to: [clinicRecipient],
      subject: `[Ακύρωση Ραντεβού] ${row.full_name} — ${row.appointment_date} (${row.appointment_time})`,
      text: [
        `ΑΚΥΡΩΣΗ ΡΑΝΤΕΒΟΥ ΑΠΟ ΑΣΘΕΝΗ`,
        `---------------------------`,
        `Ο ασθενής ακύρωσε το ραντεβού του μέσω του συνδέσμου υπενθύμισης (/manage-booking):`,
        ``,
        `• Ασθενής: ${row.full_name}`,
        `• Τηλέφωνο: ${row.phone}`,
        `• Email: ${displayEmail}`,
        `• Υπηρεσία: ${row.service_name}`,
        `• Ημερομηνία: ${row.appointment_date}`,
        `• Ώρα: ${row.appointment_time}`,
        `• Κωδικός Κράτησης: #${row.id}`,
        ``,
        `Το αντίστοιχο event διαγράφηκε αυτόματα από το Google Calendar ώστε να ελευθερωθεί η ώρα.`,
      ].join("\n"),
    });
  } catch (err) {
    console.warn("[manageBooking] Could not send admin cancellation notification email:", err);
  }
}

/**
 * Executes patient Confirm or Cancel action using their unique `action_token`.
 * - Confirm: Sets status = 'confirmed' in Supabase & updates Google Calendar summary to `[ΕΠΙΒΕΒΑΙΩΜΕΝΟ] Ραντεβού: ...`
 * - Cancel:  Sets status = 'cancelled' in Supabase, DELETES the Google Calendar event, & notifies Admin
 */
export const submitBookingTokenAction = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: z.string().trim().min(1),
        action: z.enum(["confirm", "cancel"]),
      })
      .parse(d),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      ok: boolean;
      expiredOrInvalid?: boolean;
      action?: "confirm" | "cancel";
      status?: "confirmed" | "cancelled";
      error?: string;
    }> => {
      try {
        const row = await lookupBookingRowByToken(data.token);
        if (!row || isBookingPastOrCancelled(row)) {
          return { ok: false, expiredOrInvalid: true };
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const newStatus = data.action === "confirm" ? "confirmed" : "cancelled";
        const nowIso = new Date().toISOString();

        const updatePayload: Record<string, unknown> = {
          status: newStatus,
          updated_at: nowIso,
          ...(newStatus === "confirmed"
            ? { patient_confirmed_at: nowIso }
            : { patient_cancelled_at: nowIso }),
        };

        const candidateTables = ["booking_requests", "bookings"] as const;
        for (const table of candidateTables) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let res = await (supabaseAdmin.from(table as any).update(updatePayload as any) as any).eq(
              "id",
              row.id,
            );
            if (res.error?.code === "PGRST204") {
              res = await (
                supabaseAdmin.from(table as any).update({ status: newStatus } as any) as any
              ).eq("id", row.id);
            }
          } catch (uErr) {
            console.warn(`[submitBookingTokenAction] Update warning on '${table}':`, uErr);
          }
        }

        const localizedService = localizeServiceName(row.service_name, row.preferred_language);

        if (data.action === "confirm") {
          try {
            const { confirmGoogleCalendarEvent } = await import("./googleCalendar.server");
            await confirmGoogleCalendarEvent({
              bookingId: row.id,
              patientName: row.full_name,
              serviceName: localizedService,
              appointmentDate: row.appointment_date,
              appointmentTime: row.appointment_time,
              patientEmail: row.email,
              patientPhone: row.phone,
              calendarEventId: row.calendar_event_id,
            });
          } catch (calErr) {
            console.error("GOOGLE CALENDAR ERROR:", calErr);
          }

          return {
            ok: true,
            action: "confirm",
            status: "confirmed",
          };
        }

        // action === "cancel"
        try {
          const { deleteGoogleCalendarEvent } = await import("./googleCalendar.server");
          await deleteGoogleCalendarEvent({
            bookingId: row.id,
            patientName: row.full_name,
            serviceName: localizedService,
            appointmentDate: row.appointment_date,
            appointmentTime: row.appointment_time,
            patientEmail: row.email,
            patientPhone: row.phone,
            calendarEventId: row.calendar_event_id,
          });
        } catch (calErr) {
          console.error("GOOGLE CALENDAR ERROR:", calErr);
        }

        await sendAdminCancellationEmail(row);

        return {
          ok: true,
          action: "cancel",
          status: "cancelled",
        };
      } catch (err) {
        console.error("[submitBookingTokenAction] Unexpected error:", err);
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Unexpected error",
        };
      }
    },
  );
