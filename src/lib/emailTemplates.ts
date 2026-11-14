import { clinicConfig } from "@/config/clinicConfig";
import { formatCoverageLabel, getAppointmentTypeLabel } from "@/lib/booking";
import { getLocalizedClinic } from "@/i18n/clinicContent";
import { DEFAULT_LOCALE, intlLocaleTag, resolveLocale, type Locale } from "@/i18n/locales";

export interface BookingEmailData {
  bookingId: string;
  patientName: string;
  patientEmail?: string | null | undefined;
  patientPhone: string;
  serviceName: string;
  appointmentType: "gesy" | "private";
  appointmentDate: string;
  appointmentTime: string;
  privateFee?: number | null;
  notes?: string | undefined;
  /** Canonical (clinic-language) service name for the internal clinic notification. */
  canonicalServiceName?: string | undefined;
  /** Patient's preferred notification language (defaults to Greek). */
  locale?: Locale | undefined;
}

/** Escapes user-supplied values before interpolating them into HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(dateStr: string, locale: Locale = "en"): string {
  try {
    const parts = dateStr.split("-").map(Number);
    const year = parts[0];
    const month = parts[1];
    const day = parts[2];
    if (year !== undefined && month !== undefined && day !== undefined) {
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString(intlLocaleTag(locale), {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

const PATIENT_EMAIL_STRINGS = {
  el: {
    subject: (doctor: string) => `Καταχώρηση Ραντεβού — ${doctor}`,
    heading: "Καταχώρηση Ραντεβού",
    greeting: (name: string) => `Αγαπητέ/ή ${name},`,
    introText: (dateTime: string) =>
      `Το ραντεβού σας καταχωρήθηκε επιτυχώς για τις ${dateTime}. Θα λάβετε νέο μήνυμα υπενθύμισης 48 ώρες πριν το ραντεβού.`,
    introHtml: (doctor: string, dateTime: string) =>
      `Το ραντεβού σας με <strong>${doctor}</strong> καταχωρήθηκε επιτυχώς για τις <strong>${dateTime}</strong>. Θα λάβετε νέο μήνυμα υπενθύμισης 48 ώρες πριν το ραντεβού.`,
    summaryHeading: "ΣΥΝΟΨΗ ΡΑΝΤΕΒΟΥ",
    doctor: "Θεραπευτής",
    service: "Υπηρεσία",
    category: "Κατηγορία",
    date: "Ημερομηνία",
    time: "Ώρα",
    coverage: "Κάλυψη / Χρέωση",
    reference: "Κωδικός κράτησης",
    locationHeading: "Τοποθεσία & Επικοινωνία",
    address: "Διεύθυνση",
    phone: "Τηλέφωνο",
    email: "Email",
    gesyNoteTitle: "Υπενθύμιση για δικαιούχους ΓεΣΥ",
    gesyNote:
      "Παρακαλούμε να έχετε μαζί σας την ταυτότητα / κάρτα δικαιούχου ΓεΣΥ και το έγκυρο παραπεμπτικό του ιατρού σας.",
    prepTitle: "ΠΡΟΕΤΟΙΜΑΣΙΑ",
    prepNote: "Παρακαλούμε να προσέλθετε 5-10 λεπτά πριν από την ώρα του ραντεβού σας.",
    signOff: "Με εκτίμηση,",
    rights: "Με την επιφύλαξη παντός δικαιώματος.",
  },
  en: {
    subject: (doctor: string) => `Appointment Booked — ${doctor}`,
    heading: "Appointment Booked",
    greeting: (name: string) => `Dear ${name},`,
    introText: (dateTime: string) =>
      `Your appointment has been successfully booked for ${dateTime}. You will receive a reminder message 48 hours prior.`,
    introHtml: (doctor: string, dateTime: string) =>
      `Your appointment with <strong>${doctor}</strong> has been successfully booked for <strong>${dateTime}</strong>. You will receive a reminder message 48 hours prior.`,
    summaryHeading: "APPOINTMENT SUMMARY",
    doctor: "Doctor",
    service: "Service",
    category: "Category",
    date: "Date",
    time: "Time",
    coverage: "Coverage / Fee",
    reference: "Booking Reference",
    locationHeading: "Clinic Location & Contact",
    address: "Address",
    phone: "Telephone",
    email: "Email",
    gesyNoteTitle: "GeSY Beneficiary Reminder",
    gesyNote:
      "Please remember to bring your valid ID / GeSY beneficiary card and any valid referral document from your doctor to your appointment.",
    prepTitle: "PREPARATION",
    prepNote: "Please arrive 5-10 minutes before your scheduled appointment time.",
    signOff: "Warm regards,",
    rights: "All rights reserved.",
  },
} as const satisfies Record<Locale, unknown>;

export function renderPatientConfirmationEmail(data: BookingEmailData) {
  const locale = resolveLocale(data.locale ?? DEFAULT_LOCALE);
  const s = PATIENT_EMAIL_STRINGS[locale];
  const { doctor, contact } = clinicConfig;
  const specialty = getLocalizedClinic(locale).specialty;
  const formattedDate = formatDate(data.appointmentDate, locale);
  const dateTimeLabel =
    locale === "el"
      ? `${formattedDate} στις ${data.appointmentTime}`
      : `${formattedDate} at ${data.appointmentTime}`;
  const isGesy = data.appointmentType === "gesy";
  const feeLabel = formatCoverageLabel(data.appointmentType, data.privateFee, locale);
  const categoryLabel = getAppointmentTypeLabel(data.appointmentType, locale);
  const ref = data.bookingId.slice(0, 8);

  const subject = s.subject(doctor.name);

  const text = `
${s.greeting(data.patientName)}

${s.introText(dateTimeLabel)}

${s.summaryHeading}
-------------------
${s.doctor}: ${doctor.name} (${specialty})
${s.service}: ${data.serviceName}
${s.category}: ${categoryLabel}
${s.date}: ${formattedDate}
${s.time}: ${data.appointmentTime}
${s.coverage}: ${feeLabel}
${s.reference}: #${ref}

${s.locationHeading.toUpperCase()}
---------------
${s.address}: ${contact.address.full}
${s.phone}: ${contact.phone}
${s.email}: ${contact.email}

${isGesy ? `${s.gesyNoteTitle.toUpperCase()}:\n${s.gesyNote}` : `${s.prepTitle}:\n${s.prepNote}`}

${s.signOff}
${doctor.name}
${contact.phone} | ${contact.email}
`.trim();

  const row = (label: string, value: string, color = "#0f172a") => `
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#64748b;width:35%;">${label}</td>
                        <td style="padding:6px 0;font-size:14px;font-weight:600;color:${color};">${value}</td>
                      </tr>`;

  const html = `
<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(subject)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f8faf9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;line-height:1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8faf9;padding:40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:600px;background-color:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.03);">
          <!-- Header -->
          <tr>
            <td style="background-color:#1e4338;padding:36px 32px;text-align:center;">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">${doctor.name}</h1>
              <p style="margin:6px 0 0;font-size:14px;color:#d4af37;text-transform:uppercase;letter-spacing:0.12em;font-weight:600;">${specialty}</p>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding:36px 32px;">
              <h2 style="margin:0 0 16px;font-size:20px;color:#0f172a;font-weight:600;">${s.heading}</h2>
              <p style="margin:0 0 24px;font-size:15px;color:#475569;">
                ${s.greeting(`<strong>${escapeHtml(data.patientName)}</strong>`)}<br>
                ${s.introHtml(doctor.name, escapeHtml(dateTimeLabel))}
              </p>

              <!-- Appointment Card -->
              <table role="presentation" width="100%" style="background-color:#f8faf9;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      ${row(s.service, escapeHtml(data.serviceName))}
                      ${row(s.date, formattedDate)}
                      ${row(s.time, data.appointmentTime, "#1e4338")}
                      ${row(s.category, categoryLabel)}
                      ${row(s.coverage, feeLabel, "#1e4338")}
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#64748b;">${s.reference}</td>
                        <td style="padding:6px 0;font-size:12px;font-family:monospace;color:#64748b;">#${ref}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${
                isGesy
                  ? `
              <div style="background-color:#f0fdf4;border-left:4px solid #16a34a;padding:14px 16px;border-radius:0 8px 8px 0;margin-bottom:28px;">
                <p style="margin:0;font-size:13px;color:#15803d;font-weight:600;">${s.gesyNoteTitle}</p>
                <p style="margin:4px 0 0;font-size:13px;color:#166534;">${s.gesyNote}</p>
              </div>`
                  : ""
              }

              <!-- Clinic Info -->
              <h3 style="margin:0 0 12px;font-size:15px;color:#0f172a;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">${s.locationHeading}</h3>
              <p style="margin:0 0 6px;font-size:14px;color:#475569;">
                <strong>${s.address}:</strong> ${contact.address.full}
              </p>
              <p style="margin:0 0 6px;font-size:14px;color:#475569;">
                <strong>${s.phone}:</strong> <a href="${contact.phoneHref}" style="color:#1e4338;text-decoration:none;font-weight:600;">${contact.phone}</a>
              </p>
              <p style="margin:0;font-size:14px;color:#475569;">
                <strong>${s.email}:</strong> <a href="${contact.emailHref}" style="color:#1e4338;text-decoration:none;">${contact.email}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f1f5f9;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;color:#64748b;">
                © ${new Date().getFullYear()} ${doctor.name}. ${s.rights}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  return { subject, text, html };
}

export function renderClinicNotificationEmail(data: BookingEmailData) {
  const { doctor, contact } = clinicConfig;
  const formattedDate = formatDate(data.appointmentDate);
  const isGesy = data.appointmentType === "gesy";
  const serviceName = data.canonicalServiceName ?? data.serviceName;
  const preferredLanguage = resolveLocale(data.locale ?? DEFAULT_LOCALE) === "en" ? "English" : "Ελληνικά (Greek)";
  const trimmedEmail = data.patientEmail?.trim() || "";
  const displayPatientEmail = trimmedEmail || "Δεν δηλώθηκε";

  const subject = `[New Booking] ${data.patientName} — ${serviceName} (${formattedDate})`;

  const text = `
NEW PATIENT BOOKING RECEIVED
----------------------------
Doctor/Clinic: ${doctor.name}
Reference: #${data.bookingId}

PATIENT DETAILS:
- Name: ${data.patientName}
- Phone: ${data.patientPhone}
- Email: ${displayPatientEmail}
- Preferred language: ${preferredLanguage}

APPOINTMENT DETAILS:
- Service: ${serviceName}
- Category: ${isGesy ? "GeSY (With Referral)" : "Private Visit"}
- Date: ${formattedDate}
- Time: ${data.appointmentTime}
- Private Fee: ${data.privateFee !== null && data.privateFee !== undefined ? `€${data.privateFee}` : isGesy ? "Covered by GeSY" : "On request"}
- Notes / Reason for visit: ${data.notes || "None provided"}

Please log into your clinic dashboard or contact the patient if any adjustments are needed.
`.trim();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f8faf9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;line-height:1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8faf9;padding:40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:600px;background-color:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.03);">
          <!-- Header -->
          <tr>
            <td style="background-color:#0f172a;padding:28px 32px;text-align:left;">
              <span style="background-color:#1e4338;color:#ffffff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:0.08em;">
                New Booking Alert
              </span>
              <h1 style="margin:12px 0 0;font-size:20px;font-weight:700;color:#ffffff;">${doctor.name}</h1>
              <p style="margin:4px 0 0;font-size:13px;color:#94a3b8;">${contact.address.city}, ${contact.address.country}</p>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px;font-size:18px;color:#0f172a;font-weight:600;">Patient Booking Summary</h2>

              <!-- Patient Details -->
              <table role="presentation" width="100%" style="background-color:#f8faf9;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:24px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0 0 10px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;">Patient Information</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding:4px 0;font-size:14px;color:#64748b;width:35%;">Full Name</td>
                        <td style="padding:4px 0;font-size:14px;font-weight:600;color:#0f172a;">${escapeHtml(data.patientName)}</td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:14px;color:#64748b;">Phone</td>
                        <td style="padding:4px 0;font-size:14px;font-weight:600;">
                          <a href="tel:${escapeHtml(data.patientPhone)}" style="color:#1e4338;text-decoration:none;">${escapeHtml(data.patientPhone)}</a>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:14px;color:#64748b;">Email</td>
                        <td style="padding:4px 0;font-size:14px;">
                          ${
                            trimmedEmail
                              ? `<a href="mailto:${escapeHtml(trimmedEmail)}" style="color:#1e4338;text-decoration:none;">${escapeHtml(trimmedEmail)}</a>`
                              : `<span style="color:#64748b;">Δεν δηλώθηκε</span>`
                          }
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:14px;color:#64748b;">Preferred language</td>
                        <td style="padding:4px 0;font-size:14px;font-weight:600;color:#0f172a;">${preferredLanguage}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Appointment Details -->
              <table role="presentation" width="100%" style="background-color:#ffffff;border-radius:12px;border:1px solid #cbd5e1;margin-bottom:24px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0 0 10px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;">Requested Slot</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding:4px 0;font-size:14px;color:#64748b;width:35%;">Service</td>
                        <td style="padding:4px 0;font-size:14px;font-weight:600;color:#0f172a;">${serviceName}</td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:14px;color:#64748b;">Date & Time</td>
                        <td style="padding:4px 0;font-size:14px;font-weight:600;color:#1e4338;">${formattedDate} at ${data.appointmentTime}</td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:14px;color:#64748b;">Category</td>
                        <td style="padding:4px 0;font-size:14px;font-weight:600;color:#0f172a;">
                          ${isGesy ? "ΓεΣΥ (GeSY Referral)" : "Private Visit"}
                        </td>
                      </tr>
                      ${
                        !isGesy && data.privateFee !== null && data.privateFee !== undefined
                          ? `
                      <tr>
                        <td style="padding:4px 0;font-size:14px;color:#64748b;">Private Fee</td>
                        <td style="padding:4px 0;font-size:14px;font-weight:600;color:#0f172a;">€${data.privateFee}</td>
                      </tr>`
                          : ""
                      }
                      <tr>
                        <td style="padding:4px 0;font-size:14px;color:#64748b;">Reference</td>
                        <td style="padding:4px 0;font-size:12px;font-family:monospace;color:#64748b;">${data.bookingId}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Notes -->
              ${
                data.notes
                  ? `
              <div style="background-color:#f1f5f9;border-radius:8px;padding:14px 16px;margin-bottom:24px;">
                <p style="margin:0 0 4px;font-size:12px;font-weight:600;text-transform:uppercase;color:#475569;">Patient Notes / Symptoms:</p>
                <p style="margin:0;font-size:14px;color:#1e293b;font-style:italic;">"${escapeHtml(data.notes)}"</p>
              </div>`
                  : ""
              }

              <!-- Quick action buttons -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:16px;">
                <tr>
                  <td style="border-radius:8px;background-color:#1e4338;margin-right:12px;">
                    <a href="tel:${data.patientPhone}" style="display:inline-block;padding:10px 18px;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;">
                      Call Patient
                    </a>
                  </td>
                  <td style="width:12px;"></td>
                  <td style="border-radius:8px;border:1px solid #cbd5e1;background-color:#ffffff;">
                    <a href="mailto:${data.patientEmail}" style="display:inline-block;padding:10px 18px;color:#0f172a;text-decoration:none;font-size:13px;font-weight:600;">
                      Email Patient
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8faf9;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:11px;color:#94a3b8;">
                Automated notification sent via Resend · Healthcare Booking Starter Kit
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  return { subject, text, html };
}
