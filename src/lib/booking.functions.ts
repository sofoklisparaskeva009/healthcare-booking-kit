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
      const { data: rows } = await supabaseAdmin
        .from("booking_requests")
        .select("appointment_time")
        .eq("appointment_date", data.date);
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

    let row: { id: string };
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: inserted, error } = await supabaseAdmin
        .from("booking_requests")
        .insert({
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
        })
        .select("id")
        .single();
      if (error) {
        if (error.code === "23505")
          return {
            ok: false as const,
            error: "That time slot was just taken. Please choose another.",
          };
        console.error(error);
        return { ok: false as const, error: "Could not save your booking. Please try again." };
      }
      row = inserted;
    } catch (dbErr) {
      console.warn("[createBooking] Database credentials missing or unavailable:", dbErr);
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
      await sendBookingConfirmation({
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
    } catch (msgErr) {
      console.error("[createBooking] Messaging dispatch error:", msgErr);
    }

    return { ok: true as const, id: row.id };
  });
