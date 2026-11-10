import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface AdminBooking {
  id: string;
  source_table: "booking_requests" | "bookings";
  service_name: string;
  appointment_type: "gesy" | "private" | string;
  price_eur: number;
  private_fee_eur: number | null;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  full_name: string;
  phone: string;
  email: string;
  notes: string | null;
  status: "pending" | "confirmed" | "cancelled" | string;
  preferred_language: string | null;
  created_at: string;
}

/**
 * Helper: Verifies the Supabase Auth access token on the server using the same
 * server-side Supabase client (`client.server.ts`) that bookings use.
 */
async function verifyServerToken(accessToken: string | undefined): Promise<{
  valid: boolean;
  email?: string;
}> {
  if (!accessToken || typeof accessToken !== "string") {
    return { valid: false };
  }
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
    if (error || !data?.user) {
      return { valid: false };
    }
    return { valid: true, email: data.user.email };
  } catch (err) {
    console.error("[verifyServerToken] Error verifying token on server:", err);
    return { valid: false };
  }
}

/**
 * Server-side Login via Supabase Auth.
 * Uses the exact same server environment variables (`SUPABASE_URL`, etc.)
 * as `createBooking` in `booking.functions.ts`, completely avoiding browser-side
 * `VITE_SUPABASE_URL` / CORS / DNS issues.
 */
export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z.string().trim().email("Παρακαλώ εισάγετε έγκυρο email."),
        password: z.string().min(1, "Παρακαλώ εισάγετε τον κωδικό πρόσβασης."),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: authData, error } = await supabaseAdmin.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error || !authData?.session) {
        const msg =
          error?.message === "Invalid login credentials"
            ? "Λανθασμένο email ή κωδικός πρόσβασης."
            : error?.message || "Αποτυχία σύνδεσης. Ελέγξτε τα στοιχεία σας.";
        return {
          ok: false as const,
          error: msg,
        };
      }

      return {
        ok: true as const,
        accessToken: authData.session.access_token,
        user: {
          id: authData.user.id,
          email: authData.user.email ?? data.email,
        },
      };
    } catch (err: any) {
      console.error("[adminLogin] Server login error:", err);
      return {
        ok: false as const,
        error: "Προέκυψε σφάλμα επικοινωνίας με τον διακομιστή κατά τη σύνδεση.",
      };
    }
  });

/**
 * Server-side Session Check
 */
export const verifyAdminSession = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        accessToken: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const res = await verifyServerToken(data.accessToken);
    return {
      ok: res.valid,
      email: res.email ?? null,
    };
  });

/**
 * Fetch all bookings from `booking_requests` and `bookings` on the server.
 */
export const getAdminBookings = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        accessToken: z.string().min(1),
      })
      .parse(d),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      ok: boolean;
      unauthorized?: boolean;
      bookings: AdminBooking[];
    }> => {
      const auth = await verifyServerToken(data.accessToken);
      if (!auth.valid) {
        return { ok: false, unauthorized: true, bookings: [] };
      }

      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const candidateTables = ["booking_requests", "bookings"] as const;
        const seenIds = new Set<string>();
        const combined: AdminBooking[] = [];

        for (const table of candidateTables) {
          try {
            const { data: rows, error } = await supabaseAdmin
              .from(table as any)
              .select("*")
              .order("created_at", { ascending: false });

            if (!error && Array.isArray(rows)) {
              for (const row of rows as any[]) {
                if (row.id && !seenIds.has(row.id)) {
                  seenIds.add(row.id);
                  combined.push({
                    id: String(row.id),
                    source_table: table,
                    service_name: row.service_name || row.service || "Υπηρεσία",
                    appointment_type: row.appointment_type || "private",
                    price_eur: typeof row.price_eur === "number" ? row.price_eur : 0,
                    private_fee_eur:
                      typeof row.private_fee_eur === "number" ? row.private_fee_eur : null,
                    appointment_date: row.appointment_date || row.date || "",
                    appointment_time: row.appointment_time || row.time || "",
                    duration_minutes:
                      typeof row.duration_minutes === "number" ? row.duration_minutes : 60,
                    full_name: row.full_name || row.patient_name || "Ανώνυμος",
                    phone: row.phone || row.patient_phone || "",
                    email: row.email || row.patient_email || "",
                    notes: row.notes || null,
                    status: row.status || "pending",
                    preferred_language: row.preferred_language || "el",
                    created_at: row.created_at || new Date().toISOString(),
                  });
                }
              }
            }
          } catch (e) {
            console.warn(`[getAdminBookings] Could not query table ${table}:`, e);
          }
        }

        // Sort by date & time descending
        combined.sort((a, b) => {
          const keyA = `${a.appointment_date} ${a.appointment_time}`;
          const keyB = `${b.appointment_date} ${b.appointment_time}`;
          return keyB.localeCompare(keyA);
        });

        return { ok: true, bookings: combined };
      } catch (err) {
        console.error("[getAdminBookings] Unexpected error:", err);
        return { ok: false, bookings: [] };
      }
    },
  );

export const updateBookingStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        accessToken: z.string().min(1),
        bookingId: z.string().min(1),
        newStatus: z.enum(["confirmed", "cancelled", "pending"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const auth = await verifyServerToken(data.accessToken);
    if (!auth.valid) {
      return { ok: false, unauthorized: true, error: "Μη εξουσιοδοτημένη πρόσβαση." };
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { bookingId, newStatus } = data;

      const updatePayload: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };
      if (newStatus === "confirmed") {
        updatePayload.patient_confirmed_at = new Date().toISOString();
      } else if (newStatus === "cancelled") {
        updatePayload.patient_cancelled_at = new Date().toISOString();
      }

      const candidateTables = ["booking_requests", "bookings"] as const;
      let updated = false;

      for (const table of candidateTables) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let res = await (supabaseAdmin.from(table as any).update(updatePayload as any) as any).eq(
          "id",
          bookingId,
        );

        // Fallback if timestamp columns are missing in schema cache (PGRST204)
        if (res.error?.code === "PGRST204") {
          res = await (
            supabaseAdmin.from(table as any).update({ status: newStatus } as any) as any
          ).eq("id", bookingId);
        }

        if (!res.error) {
          updated = true;
        }
      }

      return { ok: updated };
    } catch (err) {
      console.error("[updateBookingStatus] Error:", err);
      return { ok: false, error: "Αποτυχία ενημέρωσης κατάστασης ραντεβού." };
    }
  });

export const deleteBooking = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        accessToken: z.string().min(1),
        bookingId: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const auth = await verifyServerToken(data.accessToken);
    if (!auth.valid) {
      return { ok: false, unauthorized: true, error: "Μη εξουσιοδοτημένη πρόσβαση." };
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { bookingId } = data;

      const candidateTables = ["booking_requests", "bookings"] as const;
      let deleted = false;

      for (const table of candidateTables) {
        const res = await supabaseAdmin.from(table as any).delete().eq("id", bookingId);
        if (!res.error) {
          deleted = true;
        }
      }

      return { ok: deleted };
    } catch (err) {
      console.error("[deleteBooking] Error:", err);
      return { ok: false, error: "Αποτυχία διαγραφής ραντεβού." };
    }
  });
