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

  const results = await Promise.allSettled([
    resend.emails.send({
      from: fromEmail,
      to: [data.patientEmail],
      subject: patientTemplate.subject,
      text: patientTemplate.text,
      html: patientTemplate.html,
    }),
    resend.emails.send({
      from: fromEmail,
      to: [clinicRecipient],
      subject: clinicTemplate.subject,
      text: clinicTemplate.text,
      html: clinicTemplate.html,
    }),
  ]);

  const [patientResult, clinicResult] = results;

  if (patientResult.status === "rejected") {
    console.error(
      "[Resend Email Service] Failed to send patient confirmation email:",
      patientResult.reason,
    );
  } else if (patientResult.value.error) {
    console.error(
      "[Resend Email Service] Resend error for patient email:",
      patientResult.value.error,
    );
  }

  if (clinicResult.status === "rejected") {
    console.error(
      "[Resend Email Service] Failed to send clinic notification email:",
      clinicResult.reason,
    );
  } else if (clinicResult.value.error) {
    console.error(
      "[Resend Email Service] Resend error for clinic email:",
      clinicResult.value.error,
    );
  }

  return {
    ok: true,
    patientEmailStatus:
      patientResult.status === "fulfilled" && !patientResult.value.error ? "sent" : "failed",
    clinicEmailStatus:
      clinicResult.status === "fulfilled" && !clinicResult.value.error ? "sent" : "failed",
  };
}
