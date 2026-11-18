/**
 * Automated 48-Hour Appointment Reminders Cron API Route
 * Path: /api/cron/reminders
 *
 * Triggered daily by Vercel Cron (`"0 8 * * *"`).
 * Protected by `Authorization: Bearer ${process.env.CRON_SECRET}`.
 */

import { createFileRoute } from "@tanstack/react-router";
import { handleRemindersCron } from "@/lib/remindersCron.server";

export const Route = createFileRoute("/api/cron/reminders")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const result = await handleRemindersCron(request);
        return new Response(JSON.stringify(result), {
          status: result.status,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        });
      },

      POST: async ({ request }) => {
        const result = await handleRemindersCron(request);
        return new Response(JSON.stringify(result), {
          status: result.status,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        });
      },
    },
  },
});
