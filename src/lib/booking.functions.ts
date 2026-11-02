import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { bookingSchema, SERVICES, getBookingFee } from "./booking";

export const getBookedSlots = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // 1. Try primary table `booking_requests`
      let { data: rows, error } = await supabaseAdmin
        .from("booking_requests")
        .select("appointment_time")
        .eq("appointment_date", data.date);

      // 2. Fallback to `bookings` if PostgREST reports PGRST125 (table path not found)
      if (error && error.code === "PGRST125") {
        console.warn(
          "[getBookedSlots] Table 'booking_requests' returned PGRST125 (invalid path). Retrying with table 'bookings'...",
        );
        const retry = await supabaseAdmin
          .from("bookings")
          .select("appointment_time")
          .eq("appointment_date", data.date);
        rows = retry.data;
        error = retry.error;
      }

      if (error) {
        console.error("[getBookedSlots] Database query failed:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        return [];
      }
      return (rows ?? []).map((r) => r.appointment_time);
    } catch (err) {
      console.warn("[getBookedSlots] Database unavailable, returning empty booked slots:", err);
      return [];
    }
  });

export const createBooking = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => bookingSchema.parse(d))
  .handler(async ({ data }) => {
    const service = SERVICES.find((s) => s.id === data.serviceId);
    if (!service) return { ok: false as const, error: "Please choose a valid service." };
    const privateFee = getBookingFee(service, data.appointmentType);

    const bookingPayload = {
      service: service.name,
      appointment_type: data.appointmentType,
      private_fee_eur: privateFee,
      price_eur: privateFee ?? 0,
      appointment_date: data.date,
      appointment_time: data.time,
      full_name: data.fullName,
      phone: data.phone,
      email: data.email,
      notes: data.notes || null,
    };

    let row: { id: string };
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // 1. Try primary table `booking_requests`
      let { data: inserted, error } = await supabaseAdmin
        .from("booking_requests")
        .insert(bookingPayload)
        .select("id")
        .single();

      // 2. Fallback to `bookings` if PostgREST reports PGRST125 (table path not found in schema)
      if (error && error.code === "PGRST125") {
        console.warn(
          "[createBooking] Table 'booking_requests' returned PGRST125 (invalid path). Retrying with table 'bookings'...",
        );
        const retry = await supabaseAdmin
          .from("bookings")
          .insert(bookingPayload)
          .select("id")
          .single();
        inserted = retry.data;
        error = retry.error;
      }

      if (error) {
        console.error("[createBooking] Database insert failed:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          table: "booking_requests / bookings",
          slot: `${data.date} ${data.time}`,
          service: service.name,
        });

        if (error.code === "PGRST125") {
          console.error(
            "[createBooking] PGRST125: PostgREST could not find the target table in schema 'public'. " +
              "Please run the SQL schema in supabase/schema.sql and reload the PostgREST cache via: NOTIFY pgrst, 'reload schema';",
          );
        }

        if (error.code === "23505") {
          return {
            ok: false as const,
            error: "That time slot was just taken. Please choose another.",
          };
        }
        return { ok: false as const, error: "Could not save your booking. Please try again." };
      }
      row = inserted!;
    } catch (dbErr) {
      console.error("[createBooking] Database credentials missing or execution error:", dbErr);
      // Fallback for live preview demo before database is connected
      row = { id: `preview-${Date.now()}` };
    }

    try {
      const { sendBookingEmails } = await import("./email.server");
      await sendBookingEmails({
        bookingId: row.id,
        patientName: data.fullName,
        patientEmail: data.email,
        patientPhone: data.phone,
        serviceName: service.name,
        appointmentType: data.appointmentType,
        appointmentDate: data.date,
        appointmentTime: data.time,
        privateFee,
        notes: data.notes || undefined,
      });
    } catch (emailErr) {
      console.error("[createBooking] Email dispatch error:", emailErr);
    }

    try {
      const { createGoogleCalendarEvent } = await import("./googleCalendar.server");
      await createGoogleCalendarEvent({
        bookingId: row.id,
        patientName: data.fullName,
        patientEmail: data.email,
        patientPhone: data.phone,
        serviceName: service.name,
        appointmentType: data.appointmentType,
        appointmentDate: data.date,
        appointmentTime: data.time,
        durationMinutes: service.duration ?? 60,
        privateFee,
        notes: data.notes || undefined,
      });
    } catch (calErr) {
      console.error("[createBooking] Google Calendar dispatch error:", calErr);
    }

    try {
      const { sendBookingConfirmation } = await import("./messaging.server");
      const msgResult = await sendBookingConfirmation({
        bookingId: row.id,
        patientName: data.fullName,
        patientPhone: data.phone,
        serviceName: service.name,
        appointmentType: data.appointmentType,
        appointmentDate: data.date,
        appointmentTime: data.time,
        privateFee,
        locale: "el",
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
