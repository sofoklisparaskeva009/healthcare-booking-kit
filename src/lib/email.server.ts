import { Resend } from "resend";
import { clinicConfig } from "@/config/clinicConfig";
import {
  renderClinicNotificationEmail,
  renderPatientConfirmationEmail,
  type BookingEmailData,
} from "./emailTemplates";

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export async function sendBookingEmails(data: BookingEmailData) {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    console.info(
      "[Resend Email Service] RESEND_API_KEY is not configured. Email dispatch skipped. " +
        "Define RESEND_API_KEY in .env to enable automated email notifications.",
    );
    return { ok: true, skipped: true };
  }

  const resend = getResendClient();
  if (!resend) {
    return { ok: true, skipped: true };
  }

  const defaultFrom = `${clinicConfig.doctor.name} <onboarding@resend.dev>`;
  const fromEmail = process.env["RESEND_FROM_EMAIL"] || defaultFrom;
  const clinicRecipient = process.env["CLINIC_NOTIFICATION_EMAIL"] || clinicConfig.contact.email;

  const patientTemplate = renderPatientConfirmationEmail(data);
  const clinicTemplate = renderClinicNotificationEmail(data);

  // Send both emails independently — a failure in one must not block the other.
  let patientEmailStatus: "sent" | "failed" = "failed";
  let clinicEmailStatus: "sent" | "failed" = "failed";

  try {
    const patientResult = await resend.emails.send({
      from: fromEmail,
      to: [data.patientEmail],
      subject: patientTemplate.subject,
      text: patientTemplate.text,
      html: patientTemplate.html,
    });
    if (patientResult.error) {
      console.error(
        `[Resend Email Service] ❌ Patient confirmation email rejected by Resend API (booking #${data.bookingId}):`,
        patientResult.error,
      );
    } else {
      console.info(
        `[Resend Email Service] ✅ Patient confirmation email sent (id: ${patientResult.data?.id}) to ${data.patientEmail}`,
      );
      patientEmailStatus = "sent";
    }
  } catch (err) {
    console.error(
      `[Resend Email Service] ❌ Unexpected error sending patient confirmation email (booking #${data.bookingId}):`,
      err instanceof Error ? err.message : err,
    );
  }

  try {
    const clinicResult = await resend.emails.send({
      from: fromEmail,
      to: [clinicRecipient],
      subject: clinicTemplate.subject,
      text: clinicTemplate.text,
      html: clinicTemplate.html,
    });
    if (clinicResult.error) {
      console.error(
        `[Resend Email Service] ❌ Clinic notification email rejected by Resend API (booking #${data.bookingId}):`,
        clinicResult.error,
      );
    } else {
      console.info(
        `[Resend Email Service] ✅ Clinic notification email sent (id: ${clinicResult.data?.id}) to ${clinicRecipient}`,
      );
      clinicEmailStatus = "sent";
    }
  } catch (err) {
    console.error(
      `[Resend Email Service] ❌ Unexpected error sending clinic notification email (booking #${data.bookingId}):`,
      err instanceof Error ? err.message : err,
    );
  }

  return {
    ok: true,
    patientEmailStatus,
    clinicEmailStatus,
  };
}
