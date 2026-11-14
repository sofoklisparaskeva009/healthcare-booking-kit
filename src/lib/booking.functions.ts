import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { bookingSchema, SERVICES, getBookingFee } from "./booking";
import { getLocalizedServiceName } from "@/i18n/clinicContent";

export const getBookedSlots = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const candidateTables = ["booking_requests", "bookings"] as const;
      let rows: { appointment_time?: string; time?: string }[] | null = null;
      let queryError: { code?: string; message?: string; details?: string; hint?: string } | null = null;

      for (const tableName of candidateTables) {
        // 1. Try standard column appointment_time
        let res = await supabaseAdmin
          .from(tableName as any)
          .select("appointment_time")
          .eq("appointment_date", data.date);

        // 2. If appointment_time or appointment_date is missing in older schema (PGRST204), try time / date
        if (res.error?.code === "PGRST204") {
          res = await supabaseAdmin
            .from(tableName as any)
            .select("time")
            .eq("date", data.date);
        }

        if (!res.error && res.data) {
          rows = res.data;
          queryError = null;
          break;
        }

        queryError = res.error;
        if (res.error?.code === "PGRST125") {
          continue; // Try next candidate table
        }
      }

      if (queryError) {
        console.error("[getBookedSlots] Database query failed:", {
          message: queryError.message,
          code: queryError.code,
          details: queryError.details,
          hint: queryError.hint,
        });
        return [];
      }
      return (rows ?? [])
        .map((r) => r.appointment_time || r.time)
        .filter(Boolean) as string[];
    } catch (err) {
      console.warn("[getBookedSlots] Database unavailable, returning empty booked slots:", err);
      return [];
    }
  });

export type CreateBookingErrorCode = "invalid_service" | "slot_taken" | "save_failed";

export const createBooking = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => bookingSchema.parse(d))
  .handler(async ({ data }) => {
    const service = SERVICES.find((s) => s.id === data.serviceId);
    if (!service) {
      return {
        ok: false as const,
        code: "invalid_service" as CreateBookingErrorCode,
        error: "Please choose a valid service.",
      };
    }
    const privateFee = getBookingFee(service, data.appointmentType);
    // Validated by bookingSchema (z.enum(LOCALES)); drives email + SMS templates.
    const preferredLanguage = data.preferredLanguage;
    const localizedServiceName = getLocalizedServiceName(service.id, preferredLanguage);

    const rawEmail = typeof data.email === "string" ? data.email.trim() : "";
    const safeEmail = rawEmail || "no-email@provided.com";
    const hasRealEmail =
      Boolean(rawEmail) && rawEmail.toLowerCase() !== "no-email@provided.com";

    let row: { id: string };
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const candidateTables = ["booking_requests", "bookings"] as const;
      let insertedRow: { id: string } | null = null;
      let lastError: { code?: string; message?: string; details?: string; hint?: string } | null = null;

      tableLoop: for (const tableName of candidateTables) {
        const payloadToTry: Record<string, unknown> = {
          service: service.name,
          appointment_type: data.appointmentType,
          private_fee_eur: privateFee,
          price_eur: privateFee ?? 0,
          appointment_date: data.date,
          appointment_time: data.time,
          full_name: data.fullName,
          phone: data.phone,
          email: safeEmail,
          notes: data.notes || null,
          preferred_language: preferredLanguage,
        };
        const triedMissingCols = new Set<string>();

        // Allow up to 6 adaptive retries if columns are missing from current DB schema cache (PGRST204)
        for (let attempt = 0; attempt < 6; attempt++) {
          const { data: inserted, error } = await supabaseAdmin
            .from(tableName as any)
            .insert(payloadToTry as any)
            .select("id")
            .single();

          if (!error && inserted) {
            insertedRow = inserted as { id: string };
            break tableLoop;
          }

          lastError = error;

          // Table does not exist in PostgREST schema cache (PGRST125) -> try next candidate table
          if (error?.code === "PGRST125") {
            console.warn(
              `[createBooking] Table '${tableName}' returned PGRST125 (invalid path). Trying next candidate table...`,
            );
            break;
          }

          // Column not found in PostgREST schema cache (PGRST204) -> adapt payload & retry on same table
          if (error?.code === "PGRST204") {
            const match = error.message?.match(/Could not find the '([^']+)' column/i);
            const missingCol = match ? match[1] : null;

            if (missingCol && !triedMissingCols.has(missingCol)) {
              triedMissingCols.add(missingCol);
              console.warn(
                `[createBooking] Column '${missingCol}' missing in table '${tableName}' (PGRST204). Adapting payload and retrying...`,
              );

              // Alias substitutions
              if (missingCol === "service" && payloadToTry.service) {
                payloadToTry.service_name = service.name;
                delete payloadToTry.service;
              } else if (missingCol === "service_name" && payloadToTry.service_name) {
                payloadToTry.service = service.name;
                delete payloadToTry.service_name;
              } else if (missingCol === "full_name" && payloadToTry.full_name) {
                payloadToTry.patient_name = data.fullName;
                delete payloadToTry.full_name;
              } else if (missingCol === "patient_name" && payloadToTry.patient_name) {
                payloadToTry.full_name = data.fullName;
                delete payloadToTry.patient_name;
              } else if (missingCol === "phone" && payloadToTry.phone) {
                payloadToTry.patient_phone = data.phone;
                delete payloadToTry.phone;
              } else if (missingCol === "patient_phone" && payloadToTry.patient_phone) {
                payloadToTry.phone = data.phone;
                delete payloadToTry.patient_phone;
              } else if (missingCol === "email" && "email" in payloadToTry) {
                payloadToTry.patient_email = safeEmail;
                delete payloadToTry.email;
              } else if (missingCol in payloadToTry) {
                delete payloadToTry[missingCol];
              } else {
                break;
              }
              continue;
            }
          }

          // Any other error (e.g. 23505 unique conflict), break adaptation loop
          break;
        }
      }

      if (!insertedRow) {
        console.error("[createBooking] Database insert failed across candidate tables:", {
          message: lastError?.message,
          code: lastError?.code,
          details: lastError?.details,
          hint: lastError?.hint,
          slot: `${data.date} ${data.time}`,
          service: service.name,
        });

        if (lastError?.code === "PGRST204" || lastError?.code === "PGRST125") {
          console.error(
            `[createBooking] Supabase Schema Error (${lastError.code}): ` +
              "Database schema columns or relations do not match. " +
              "Please run supabase/schema.sql in the Supabase SQL Editor and execute: NOTIFY pgrst, 'reload schema';",
          );
        }

        if (lastError?.code === "23505") {
          return {
            ok: false as const,
            code: "slot_taken" as CreateBookingErrorCode,
            error: "That time slot was just taken. Please choose another.",
          };
        }
        return {
          ok: false as const,
          code: "save_failed" as CreateBookingErrorCode,
          error: "Could not save your booking. Please try again.",
        };
      }
      row = insertedRow;
    } catch (dbErr) {
      console.error("[createBooking] Database credentials missing or execution error:", dbErr);
      // Fallback for live preview demo before database is connected
      row = { id: `preview-${Date.now()}` };
    }

    const normalizedEmail = hasRealEmail ? rawEmail : null;

    // 1. Immediately create the Google Calendar event right after saving the booking in Supabase
    try {
      const { createGoogleCalendarEvent } = await import("./googleCalendar.server");
      const calResult = await createGoogleCalendarEvent({
        bookingId: row.id,
        patientName: data.fullName,
        patientEmail: normalizedEmail,
        patientPhone: data.phone,
        serviceName: localizedServiceName,
        appointmentType: data.appointmentType,
        appointmentDate: data.date,
        appointmentTime: data.time,
        durationMinutes: service.duration ?? 60,
        privateFee,
        notes: data.notes || undefined,
        preferredLanguage,
      });

      if (!calResult.ok) {
        console.error("GOOGLE CALENDAR ERROR:", calResult.error);
      } else if (calResult.skipped) {
        console.info(
          `[createBooking] ℹ️ Google Calendar sync skipped for booking #${row.id} (credentials not configured).`,
        );
      } else {
        console.info(
          `[createBooking] ✅ Google Calendar event created for booking #${row.id} (Event ID: ${calResult.eventId})`,
        );
      }
    } catch (error) {
      console.error("GOOGLE CALENDAR ERROR:", error);
    }

    // 2. Send informational booking email via Resend (skips patient email if not provided, still notifies clinic)
    try {
      const { sendBookingEmails } = await import("./email.server");
      await sendBookingEmails({
        bookingId: row.id,
        patientName: data.fullName,
        patientEmail: normalizedEmail,
        patientPhone: data.phone,
        serviceName: localizedServiceName,
        canonicalServiceName: service.name,
        appointmentType: data.appointmentType,
        appointmentDate: data.date,
        appointmentTime: data.time,
        privateFee,
        notes: data.notes || undefined,
        locale: preferredLanguage,
      });
    } catch (emailErr) {
      console.error("[createBooking] Email dispatch error:", emailErr);
    }

    try {
      const { sendBookingConfirmation } = await import("./messaging.server");
      const msgResult = await sendBookingConfirmation({
        bookingId: row.id,
        patientName: data.fullName,
        patientPhone: data.phone,
        serviceName: localizedServiceName,
        appointmentType: data.appointmentType,
        appointmentDate: data.date,
        appointmentTime: data.time,
        privateFee,
        locale: preferredLanguage,
      });

      if (!msgResult.ok) {
        console.error(
          `[createBooking] ⚠️ Twilio SMS / messaging confirmation failed for booking #${row.id}:`,
          msgResult.error,
        );
      } else if (msgResult.skipped) {
        console.info(
          `[createBooking] ℹ️ Twilio SMS skipped for booking #${row.id} (credentials not configured in environment).`,
        );
      } else {
        console.info(
          `[createBooking] ✅ Twilio ${msgResult.channel?.toUpperCase() || "SMS"} confirmation dispatched for booking #${row.id} (SID: ${msgResult.messageSid})`,
        );
      }
    } catch (msgErr) {
      console.error("[createBooking] Unexpected messaging dispatch error:", msgErr);
    }

    return { ok: true as const, id: row.id };
  });
