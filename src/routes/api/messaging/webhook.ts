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

export const Route = createFileRoute("/api/messaging/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const result = await handleMessagingWebhook(request);

        if (!result.ok) {
          return new Response(buildHtmlResponse(false, result.error, result.action), {
            status: result.status,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }

        return new Response(
          buildHtmlResponse(true, undefined, result.action, result.alreadyProcessed),
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

function buildHtmlResponse(
  success: boolean,
  errorMessage?: string,
  action?: "confirm" | "cancel",
  alreadyProcessed?: boolean,
): string {
  const title = success
    ? action === "confirm"
      ? "Appointment Confirmed"
      : action === "cancel"
        ? "Appointment Cancelled"
        : "Request Processed"
    : "Request Failed";

  const heading = success
    ? action === "confirm"
      ? "Appointment Confirmed!"
      : action === "cancel"
        ? "Appointment Cancelled"
        : "Request Processed"
    : "Something Went Wrong";

  const bodyText = success
    ? alreadyProcessed
      ? "Your appointment status was already updated. No further action is needed."
      : action === "confirm"
        ? "Thank you for confirming your appointment. We look forward to seeing you!"
        : "Your appointment has been successfully cancelled. If you would like to reschedule, please contact the clinic."
    : errorMessage ?? "An unexpected error occurred. Please contact the clinic directly.";

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
    "<html lang=\"en\">",
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
    "    <div class=\"footer\">If you have any questions, please contact the clinic directly.</div>",
    "  </div>",
    "</body>",
    "</html>",
  ].join("\n");
}