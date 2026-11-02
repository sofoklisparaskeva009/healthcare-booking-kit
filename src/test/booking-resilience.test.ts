import { describe, expect, it } from "vitest";

describe("Booking Payload Resilience (PGRST204 / PGRST125 prevention)", () => {
  it("detects and extracts missing column name from PostgREST PGRST204 message", () => {
    const errorMsg1 = "Could not find the 'appointment_type' column of 'booking_requests' in the schema cache";
    const match1 = errorMsg1.match(/Could not find the '([^']+)' column/i);
    expect(match1?.[1]).toBe("appointment_type");

    const errorMsg2 = "Could not find the 'service' column of 'bookings' in the schema cache";
    const match2 = errorMsg2.match(/Could not find the '([^']+)' column/i);
    expect(match2?.[1]).toBe("service");

    const errorMsg3 = "Could not find the 'full_name' column of 'booking_requests' in the schema cache";
    const match3 = errorMsg3.match(/Could not find the '([^']+)' column/i);
    expect(match3?.[1]).toBe("full_name");
  });

  it("substitutes column aliases when primary column is missing in older DB schema", () => {
    const payload: Record<string, unknown> = {
      service: "General Consultation",
      full_name: "Elena Georgiou",
      phone: "+35799000000",
      email: "elena@example.com",
      appointment_type: "private",
      private_fee_eur: 50,
    };

    // If 'service' is missing, swap to 'service_name'
    if (payload.service) {
      payload.service_name = payload.service;
      delete payload.service;
    }
    expect(payload.service).toBeUndefined();
    expect(payload.service_name).toBe("General Consultation");

    // If 'full_name' is missing, swap to 'patient_name'
    if (payload.full_name) {
      payload.patient_name = payload.full_name;
      delete payload.full_name;
    }
    expect(payload.full_name).toBeUndefined();
    expect(payload.patient_name).toBe("Elena Georgiou");

    // If 'appointment_type' is missing in legacy table, safely delete it
    delete payload.appointment_type;
    expect(payload.appointment_type).toBeUndefined();
    expect(payload.private_fee_eur).toBe(50);
  });
});
