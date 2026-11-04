import { describe, expect, it } from "vitest";
import { clinicConfig } from "../config/clinicConfig";
import {
  renderClinicNotificationEmail,
  renderPatientConfirmationEmail,
  type BookingEmailData,
} from "../lib/emailTemplates";

describe("Email Templates", () => {
  const sampleData: BookingEmailData = {
    bookingId: "test-booking-id-12345",
    patientName: "Andreas Dimitriou",
    patientEmail: "andreas@example.com",
    patientPhone: "+357 99 887766",
    serviceName: "Initial Consultation",
    appointmentType: "gesy",
    appointmentDate: "2026-11-15",
    appointmentTime: "10:00",
    privateFee: null,
    notes: "Persistent knee pain after running.",
  };

  it("renders Greek patient confirmation email by default (locale: el)", () => {
    const email = renderPatientConfirmationEmail(sampleData);
    expect(email.subject).toContain("Επιβεβαίωση Ραντεβού");
    expect(email.subject).toContain(clinicConfig.doctor.name);
    expect(email.text).toContain("Αγαπητέ/ή Andreas Dimitriou");
    expect(email.text).toContain("Initial Consultation");
    expect(email.text).toContain("10:00");
    expect(email.text).toContain(clinicConfig.contact.address.full);
    expect(email.html).toContain('lang="el"');
    expect(email.html).toContain(clinicConfig.doctor.name);
    expect(email.html).toContain("ΓεΣΥ");
  });

  it("renders English patient confirmation email when locale is 'en'", () => {
    const email = renderPatientConfirmationEmail({ ...sampleData, locale: "en" });
    expect(email.subject).toContain("Appointment Confirmation");
    expect(email.subject).toContain(clinicConfig.doctor.name);
    expect(email.text).toContain("Dear Andreas Dimitriou");
    expect(email.text).toContain("Initial Consultation");
    expect(email.text).toContain("10:00");
    expect(email.html).toContain('lang="en"');
    expect(email.html).toContain("GeSY");
  });

  it("renders clinic notification email with patient details, notes, and preferred language", () => {
    const email = renderClinicNotificationEmail({ ...sampleData, locale: "en" });
    expect(email.subject).toContain("Andreas Dimitriou");
    expect(email.subject).toContain("Initial Consultation");
    expect(email.text).toContain("Andreas Dimitriou");
    expect(email.text).toContain("+357 99 887766");
    expect(email.text).toContain("andreas@example.com");
    expect(email.text).toContain("Preferred language: English");
    expect(email.text).toContain("Persistent knee pain after running.");
    expect(email.html).toContain("Andreas Dimitriou");
    expect(email.html).toContain("Persistent knee pain after running.");
  });

  it("renders private appointment details correctly in both Greek and English when private fee is supplied", () => {
    const privateDataEl: BookingEmailData = {
      ...sampleData,
      appointmentType: "private",
      privateFee: 60,
      locale: "el",
    };

    const patientEmailEl = renderPatientConfirmationEmail(privateDataEl);
    expect(patientEmailEl.text).toContain("Ιδιωτική Επίσκεψη");
    expect(patientEmailEl.text).toContain("€60");
    expect(patientEmailEl.html).toContain("€60");

    const privateDataEn: BookingEmailData = {
      ...privateDataEl,
      locale: "en",
    };

    const patientEmailEn = renderPatientConfirmationEmail(privateDataEn);
    expect(patientEmailEn.text).toContain("Private Visit");
    expect(patientEmailEn.text).toContain("€60");
    expect(patientEmailEn.html).toContain("€60");

    const clinicEmail = renderClinicNotificationEmail(privateDataEn);
    expect(clinicEmail.text).toContain("Private Visit");
    expect(clinicEmail.text).toContain("€60");
    expect(clinicEmail.html).toContain("€60");
  });
});
