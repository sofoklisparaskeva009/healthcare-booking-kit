import { clinicConfig } from "@/config/clinicConfig";

export interface BookingEmailData {
  bookingId: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  serviceName: string;
  appointmentType: "gesy" | "private";
  appointmentDate: string;
  appointmentTime: string;
  privateFee?: number | null;
  notes?: string | undefined;
}

function formatDate(dateStr: string): string {
  try {
    const parts = dateStr.split("-").map(Number);
    const year = parts[0];
    const month = parts[1];
    const day = parts[2];
    if (year !== undefined && month !== undefined && day !== undefined) {
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString("en-GB", {
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

export function renderPatientConfirmationEmail(data: BookingEmailData) {
  const { doctor, contact, gesy } = clinicConfig;
  const formattedDate = formatDate(data.appointmentDate);
  const isGesy = data.appointmentType === "gesy";
  const feeLabel = isGesy
    ? gesy.referralNotice || "Covered by GeSY (With Referral)"
    : data.privateFee !== null && data.privateFee !== undefined
      ? `Private fee · €${data.privateFee}`
      : "Private fee on request";

  const subject = `Appointment Confirmation — ${doctor.name}`;

  const text = `
Dear ${data.patientName},

Thank you for booking with ${doctor.name}. Your appointment request has been successfully received.

APPOINTMENT SUMMARY
-------------------
Doctor: ${doctor.name} (${doctor.specialty})
Service: ${data.serviceName}
Category: ${isGesy ? "GeSY Appointment (ΓεΣΥ)" : "Private Visit"}
Date: ${formattedDate}
Time: ${data.appointmentTime}
Coverage / Fee: ${feeLabel}
Booking Reference: #${data.bookingId.slice(0, 8)}

CLINIC LOCATION
---------------
Address: ${contact.address.full}
Phone: ${contact.phone}
Email: ${contact.email}

${
  isGesy
    ? `IMPORTANT GeSY NOTE:
Please ensure you bring your valid ID or GeSY beneficiary card and any active referral paperwork from your physician.`
    : `PREPARATION:
Please arrive 5-10 minutes before your scheduled appointment time.`
}

If you need to reschedule or cancel, please contact us at least 24 hours in advance.

Warm regards,
${doctor.name}
${contact.phone} | ${contact.email}
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
            <td style="background-color:#1e4338;padding:36px 32px;text-align:center;">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">${doctor.name}</h1>
              <p style="margin:6px 0 0;font-size:14px;color:#d4af37;text-transform:uppercase;letter-spacing:0.12em;font-weight:600;">${doctor.specialty}</p>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding:36px 32px;">
              <h2 style="margin:0 0 16px;font-size:20px;color:#0f172a;font-weight:600;">Appointment Confirmation</h2>
              <p style="margin:0 0 24px;font-size:15px;color:#475569;">
                Dear <strong>${data.patientName}</strong>,<br>
                Your appointment with <strong>${doctor.name}</strong> has been successfully booked. Below are the details of your visit:
              </p>

              <!-- Appointment Card -->
              <table role="presentation" width="100%" style="background-color:#f8faf9;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#64748b;width:35%;">Service</td>
                        <td style="padding:6px 0;font-size:14px;font-weight:600;color:#0f172a;">${data.serviceName}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#64748b;">Date</td>
                        <td style="padding:6px 0;font-size:14px;font-weight:600;color:#0f172a;">${formattedDate}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#64748b;">Time</td>
                        <td style="padding:6px 0;font-size:14px;font-weight:600;color:#1e4338;">${data.appointmentTime}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#64748b;">Category</td>
                        <td style="padding:6px 0;font-size:14px;font-weight:600;color:#0f172a;">
                          ${isGesy ? "ΓεΣΥ / GeSY Covered" : "Private Visit"}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#64748b;">Rate / Coverage</td>
                        <td style="padding:6px 0;font-size:14px;font-weight:600;color:#1e4338;">${feeLabel}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#64748b;">Reference ID</td>
                        <td style="padding:6px 0;font-size:12px;font-family:monospace;color:#64748b;">#${data.bookingId.slice(0, 8)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${
                isGesy
                  ? `
              <div style="background-color:#f0fdf4;border-left:4px solid #16a34a;padding:14px 16px;border-radius:0 8px 8px 0;margin-bottom:28px;">
                <p style="margin:0;font-size:13px;color:#15803d;font-weight:600;">GeSY Beneficiary Reminder</p>
                <p style="margin:4px 0 0;font-size:13px;color:#166534;">
                  Please remember to bring your valid ID / GeSY beneficiary card and any valid referral document from your doctor to your appointment.
                </p>
              </div>`
                  : ""
              }

              <!-- Clinic Info -->
              <h3 style="margin:0 0 12px;font-size:15px;color:#0f172a;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Clinic Location & Contact</h3>
              <p style="margin:0 0 6px;font-size:14px;color:#475569;">
                <strong>Address:</strong> ${contact.address.full}
              </p>
              <p style="margin:0 0 6px;font-size:14px;color:#475569;">
                <strong>Telephone:</strong> <a href="${contact.phoneHref}" style="color:#1e4338;text-decoration:none;font-weight:600;">${contact.phone}</a>
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#475569;">
                <strong>Email:</strong> <a href="${contact.emailHref}" style="color:#1e4338;text-decoration:none;">${contact.email}</a>
              </p>

              <p style="margin:0;font-size:13px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:20px;">
                Need to reschedule or cancel? Please contact our clinic at least 24 hours in advance so we can assist other patients.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f1f5f9;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;color:#64748b;">
                © ${new Date().getFullYear()} ${doctor.name}. All rights reserved.
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

  const subject = `[New Booking] ${data.patientName} — ${data.serviceName} (${formattedDate})`;

  const text = `
NEW PATIENT BOOKING RECEIVED
----------------------------
Doctor/Clinic: ${doctor.name}
Reference: #${data.bookingId}

PATIENT DETAILS:
- Name: ${data.patientName}
- Phone: ${data.patientPhone}
- Email: ${data.patientEmail}

APPOINTMENT DETAILS:
- Service: ${data.serviceName}
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
                        <td style="padding:4px 0;font-size:14px;font-weight:600;color:#0f172a;">${data.patientName}</td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:14px;color:#64748b;">Phone</td>
                        <td style="padding:4px 0;font-size:14px;font-weight:600;">
                          <a href="tel:${data.patientPhone}" style="color:#1e4338;text-decoration:none;">${data.patientPhone}</a>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:14px;color:#64748b;">Email</td>
                        <td style="padding:4px 0;font-size:14px;">
                          <a href="mailto:${data.patientEmail}" style="color:#1e4338;text-decoration:none;">${data.patientEmail}</a>
                        </td>
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
                        <td style="padding:4px 0;font-size:14px;font-weight:600;color:#0f172a;">${data.serviceName}</td>
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
                <p style="margin:0;font-size:14px;color:#1e293b;font-style:italic;">"${data.notes}"</p>
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
