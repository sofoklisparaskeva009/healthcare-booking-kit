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

  it("renders patient confirmation email with dynamic clinic config data", () => {
    const email = renderPatientConfirmationEmail(sampleData);
    expect(email.subject).toContain(clinicConfig.doctor.name);
    expect(email.text).toContain(clinicConfig.doctor.name);
    expect(email.text).toContain("Andreas Dimitriou");
    expect(email.text).toContain("Initial Consultation");
    expect(email.text).toContain("10:00");
    expect(email.text).toContain(clinicConfig.contact.address.full);
    expect(email.html).toContain(clinicConfig.doctor.name);
    expect(email.html).toContain(clinicConfig.doctor.specialty);
    expect(email.html).toContain("GeSY");
  });

  it("renders clinic notification email with patient details and notes", () => {
    const email = renderClinicNotificationEmail(sampleData);
    expect(email.subject).toContain("Andreas Dimitriou");
    expect(email.subject).toContain("Initial Consultation");
    expect(email.text).toContain("Andreas Dimitriou");
    expect(email.text).toContain("+357 99 887766");
    expect(email.text).toContain("andreas@example.com");
    expect(email.text).toContain("Persistent knee pain after running.");
    expect(email.html).toContain("Andreas Dimitriou");
    expect(email.html).toContain("Persistent knee pain after running.");
  });

  it("renders private appointment details correctly when private fee is supplied", () => {
    const privateData: BookingEmailData = {
      ...sampleData,
      appointmentType: "private",
      privateFee: 60,
    };

    const patientEmail = renderPatientConfirmationEmail(privateData);
    expect(patientEmail.text).toContain("Private Visit");
    expect(patientEmail.text).toContain("€60");
    expect(patientEmail.html).toContain("€60");

    const clinicEmail = renderClinicNotificationEmail(privateData);
    expect(clinicEmail.text).toContain("Private Visit");
    expect(clinicEmail.text).toContain("€60");
    expect(clinicEmail.html).toContain("€60");
  });
});
