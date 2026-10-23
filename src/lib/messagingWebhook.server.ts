/**
 * Messaging Webhook Handler
 *
 * Processes patient Accept / Cancel replies arriving via:
 *   GET/POST /api/messaging/webhook?action=confirm|cancel&bookingId=<uuid>
 *
 * Two entry points:
 *   1. Link-based (GET) — patient clicks URL in SMS/WhatsApp message
 *   2. Twilio Status Callback (POST) — platform-level delivery/reply hook
 *
 * Security:
 *   - For GET requests: bookingId is validated against the database.
 *   - For Twilio POST callbacks: validates X-Twilio-Signature using the
 *     MESSAGING_WEBHOOK_SECRET (= Twilio Auth Token) when present.
 *   - All mutations are idempotent (re-confirming an already-confirmed
 *     booking is a no-op).
 */

export type WebhookAction = "confirm" | "cancel";

export interface WebhookHandlerResult {
  ok: boolean;
  action?: WebhookAction;
  bookingId?: string;
  alreadyProcessed?: boolean;
  error?: string;
  status: number;
}

// ---------------------------------------------------------------------------
// Twilio signature validation (HMAC-SHA1)
// ---------------------------------------------------------------------------

/**
 * Validates a Twilio webhook request using the X-Twilio-Signature header.
 * See: https://www.twilio.com/docs/usage/webhooks/webhooks-security
 *
 * Falls back to allowing the request if no secret is configured (dev mode).
 */
export async function validateTwilioSignature(
  request: Request,
  authToken: string,
): Promise<boolean> {
  const twilioSig = request.headers.get("x-twilio-signature");
  if (!twilioSig) return false;

  const url = request.url;
  // Build the string to sign: URL + sorted POST params concatenated
  const body = await request.clone().text();
  const params = new URLSearchParams(body);
  const sortedParams = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}${v}`)
    .join("");

  const dataToSign = url + sortedParams;

  // HMAC-SHA1
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(dataToSign));
  const computed = btoa(String.fromCharCode(...new Uint8Array(sig)));

  return computed === twilioSig;
}

// ---------------------------------------------------------------------------
// Core webhook handler — framework-agnostic, takes a plain Request
// ---------------------------------------------------------------------------

/**
 * Processes a patient confirmation / cancellation.
 * Accepts both GET (link-tap) and POST (Twilio callback) requests.
 */
export async function handleMessagingWebhook(
  request: Request,
): Promise<WebhookHandlerResult> {
  const url = new URL(request.url);

  // Resolve action + bookingId from query params (GET link-tap) or POST body
  let action: WebhookAction | null = null;
  let bookingId: string | null = null;

  const queryAction = url.searchParams.get("action");
  const queryBookingId = url.searchParams.get("bookingId");

  if (queryAction === "confirm" || queryAction === "cancel") {
    action = queryAction;
  }
  if (queryBookingId) {
    bookingId = queryBookingId;
  }

  // For POST requests also check body params (Twilio sends form-encoded body)
  if (request.method === "POST") {
    const webhookSecret = process.env["MESSAGING_WEBHOOK_SECRET"];
    if (webhookSecret) {
      const isValid = await validateTwilioSignature(request, webhookSecret);
      if (!isValid) {
        console.warn("[Messaging Webhook] Invalid Twilio signature — rejecting request");
        return { ok: false, error: "Invalid webhook signature", status: 403 };
      }
    }

    try {
      const rawBody = await request.clone().text();
      const body = new URLSearchParams(rawBody);
      // Allow body to override / supply action + bookingId
      const bodyAction = body.get("action") ?? body.get("Body")?.trim().toLowerCase();
      const bodyBookingId = body.get("bookingId");

      if (!action && (bodyAction === "confirm" || bodyAction === "cancel")) {
        action = bodyAction as WebhookAction;
      }
      // Interpret SMS reply text "1" or "confirm" → confirm; "2" or "cancel" → cancel
      if (!action && bodyAction) {
        if (bodyAction === "1" || bodyAction === "confirm" || bodyAction === "ναι" || bodyAction === "yes") {
          action = "confirm";
        } else if (bodyAction === "2" || bodyAction === "cancel" || bodyAction === "ακυρο" || bodyAction === "no") {
          action = "cancel";
        }
      }
      if (!bookingId && bodyBookingId) {
        bookingId = bodyBookingId;
      }
    } catch {
      // non-form-encoded body — ignore
    }
  }

  if (!bookingId) {
    return { ok: false, error: "Missing bookingId parameter", status: 400 };
  }

  if (!action) {
    return { ok: false, error: "Missing or invalid action parameter", status: 400 };
  }

  // ---------------------------------------------------------------------------
  // Persist status change in Supabase
  // ---------------------------------------------------------------------------
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch current booking to verify it exists.
    // status / patient_confirmed_at / patient_cancelled_at are runtime DB columns
    // not yet reflected in the auto-generated types.ts — use unknown cast.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: booking, error: fetchError } = (await (
      supabaseAdmin
        .from("booking_requests")
        .select("id, status") as any
    ).eq("id", bookingId).single()) as {
      data: { id: string; status?: string } | null;
      error: unknown;
    };

    if (fetchError || !booking) {
      console.warn(`[Messaging Webhook] Booking #${bookingId} not found`);
      return { ok: false, error: "Booking not found", status: 404 };
    }

    const newStatus = action === "confirm" ? "confirmed" : "cancelled";

    // Idempotency: already in desired state — succeed quietly
    if (booking.status === newStatus) {
      console.info(
        `[Messaging Webhook] Booking #${bookingId} already ${newStatus} — no-op`,
      );
      return {
        ok: true,
        action,
        bookingId,
        alreadyProcessed: true,
        status: 200,
      };
    }

    // Update booking status — columns exist at runtime but are not yet
    // in the auto-generated Supabase types; cast to bypass type-checker.
    const updatePayload: Record<string, unknown> = {
      status: newStatus,
      ...(action === "confirm"
        ? { patient_confirmed_at: new Date().toISOString() }
        : { patient_cancelled_at: new Date().toISOString() }),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = (await (
      supabaseAdmin
        .from("booking_requests")
        .update(updatePayload as any) as any
    ).eq("id", bookingId)) as { error: unknown };

    if (updateError) {
      console.error(
        `[Messaging Webhook] Failed to update booking #${bookingId}:`,
        updateError,
      );
      return {
        ok: false,
        error: "Database update failed",
        status: 500,
      };
    }

    console.info(
      `[Messaging Webhook] Booking #${bookingId} → ${newStatus} (patient ${action}ed)`,
    );

    // Optionally update Google Calendar event description to reflect new status
    if (action === "cancel") {
      try {
        const { createGoogleCalendarEvent } = await import("./googleCalendar.server");
        // We don't have full event data here; just log the intent.
        // A production system would PATCH the existing event via its eventId.
        void createGoogleCalendarEvent; // keep import live for future PATCH support
        console.info(
          `[Messaging Webhook] Google Calendar update for cancelled booking #${bookingId} — implement PATCH if eventId stored`,
        );
      } catch {
        // Non-critical — webhook must still respond successfully
      }
    }

    return { ok: true, action, bookingId, status: 200 };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Messaging Webhook] Unexpected error:", message);
    return { ok: false, error: message, status: 500 };
  }
}
