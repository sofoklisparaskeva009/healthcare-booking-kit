/**
 * Messaging Webhook API Route
 * Path: /api/messaging/webhook
 *
 * Handles patient Accept / Cancel responses for appointment bookings via:
 *   GET  -- patient taps a link from their SMS/WhatsApp/Viber message
 *   POST -- Twilio platform status callback (with HMAC-SHA1 signature validation)
 *
 * The core logic lives in messagingWebhook.server.ts (framework-agnostic).
 * This file is the TanStack Start file-based route adapter.
 */

import { createFileRoute } from "@tanstack/react-router";
import { handleMessagingWebhook } from "@/lib/messagingWebhook.server";
import { resolveLocale, type Locale } from "@/i18n/locales";

export const Route = createFileRoute("/api/messaging/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const result = await handleMessagingWebhook(request);
        // Links in SMS carry `lang=el|en` (the booking's preferred_language).
        const locale = resolveLocale(new URL(request.url).searchParams.get("lang"));

        if (!result.ok) {
          return new Response(buildHtmlResponse(locale, false, result.action), {
            status: result.status,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }

        return new Response(
          buildHtmlResponse(locale, true, result.action, result.alreadyProcessed),
          {
            status: result.status,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          },
        );
      },

      POST: async ({ request }) => {
        const result = await handleMessagingWebhook(request);

        const statusCode = result.status ?? (result.ok ? 200 : 500);
        const responseBody = result.ok
          ? result.alreadyProcessed
            ? "Already processed -- no change."
            : result.action === "confirm"
              ? "Appointment confirmed. Thank you!"
              : "Appointment cancelled. We hope to see you soon."
          : `Error: ${result.error ?? "Unknown error"}`;

        return new Response(responseBody, {
          status: statusCode,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      },
    },
  },
});

const LANDING_STRINGS = {
  el: {
    titleConfirmed: "Το ραντεβού επιβεβαιώθηκε",
    titleCancelled: "Το ραντεβού ακυρώθηκε",
    titleProcessed: "Το αίτημα ολοκληρώθηκε",
    titleFailed: "Το αίτημα απέτυχε",
    headingConfirmed: "Το ραντεβού επιβεβαιώθηκε!",
    headingFailed: "Κάτι πήγε στραβά",
    alreadyProcessed: "Η κατάσταση του ραντεβού σας είχε ήδη ενημερωθεί. Δεν απαιτείται άλλη ενέργεια.",
    confirmed: "Σας ευχαριστούμε που επιβεβαιώσατε το ραντεβού σας. Ανυπομονούμε να σας δούμε!",
    cancelled:
      "Το ραντεβού σας ακυρώθηκε με επιτυχία. Αν θέλετε να κλείσετε νέο ραντεβού, επικοινωνήστε με την κλινική.",
    failed: "Δεν ήταν δυνατή η επεξεργασία του αιτήματός σας. Παρακαλούμε επικοινωνήστε απευθείας με την κλινική.",
    footer: "Για οποιαδήποτε απορία, επικοινωνήστε απευθείας με την κλινική.",
  },
  en: {
    titleConfirmed: "Appointment Confirmed",
    titleCancelled: "Appointment Cancelled",
    titleProcessed: "Request Processed",
    titleFailed: "Request Failed",
    headingConfirmed: "Appointment Confirmed!",
    headingFailed: "Something Went Wrong",
    alreadyProcessed: "Your appointment status was already updated. No further action is needed.",
    confirmed: "Thank you for confirming your appointment. We look forward to seeing you!",
    cancelled:
      "Your appointment has been successfully cancelled. If you would like to reschedule, please contact the clinic.",
    failed: "We could not process your request. Please contact the clinic directly.",
    footer: "If you have any questions, please contact the clinic directly.",
  },
} as const satisfies Record<Locale, unknown>;

function buildHtmlResponse(
  locale: Locale,
  success: boolean,
  action?: "confirm" | "cancel",
  alreadyProcessed?: boolean,
): string {
  const s = LANDING_STRINGS[locale];

  const title = success
    ? action === "confirm"
      ? s.titleConfirmed
      : action === "cancel"
        ? s.titleCancelled
        : s.titleProcessed
    : s.titleFailed;

  const heading = success
    ? action === "confirm"
      ? s.headingConfirmed
      : action === "cancel"
        ? s.titleCancelled
        : s.titleProcessed
    : s.headingFailed;

  // Technical error details are logged server-side; patients get a localized message.
  const bodyText = success
    ? alreadyProcessed
      ? s.alreadyProcessed
      : action === "confirm"
        ? s.confirmed
        : s.cancelled
    : s.failed;

  const accentColor =
    success && action === "confirm"
      ? "#2d6a4f"
      : success && action === "cancel"
        ? "#c0392b"
        : "#7f8c8d";

  const iconEmoji =
    success && action === "confirm"
      ? "&#x2705;"
      : success && action === "cancel"
        ? "&#x274C;"
        : "&#x26A0;&#xFE0F;";

  return [
    "<!DOCTYPE html>",
    `<html lang="${locale}">`,
    "<head>",
    "  <meta charset=\"utf-8\" />",
    "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
    `  <title>${title}</title>`,
    "  <style>",
    "    *{box-sizing:border-box;margin:0;padding:0}",
    "    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:1.5rem}",
    "    .card{background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.10);max-width:420px;width:100%;padding:2.5rem 2rem;text-align:center}",
    "    .icon{font-size:3rem;margin-bottom:1rem}",
    `    h1{font-size:1.5rem;font-weight:700;color:${accentColor};margin-bottom:.75rem}`,
    "    p{color:#555;line-height:1.6;font-size:.95rem}",
    "    .footer{margin-top:2rem;font-size:.8rem;color:#aaa}",
    "  </style>",
    "</head>",
    "<body>",
    "  <div class=\"card\">",
    `    <div class="icon">${iconEmoji}</div>`,
    `    <h1>${heading}</h1>`,
    `    <p>${bodyText}</p>`,
    `    <div class="footer">${s.footer}</div>`,
    "  </div>",
    "</body>",
    "</html>",
  ].join("\n");
}
