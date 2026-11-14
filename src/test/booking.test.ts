import { describe, expect, it } from "vitest";
import { bookingSchema, getBookingFee, type Service } from "../lib/booking";

const service: Service = {
  id: "initial",
  name: "Initial Consultation",
  duration: 60,
  desc: "Assessment",
};
const input = {
  serviceId: "initial",
  date: "2026-10-20",
  time: "09:00",
  fullName: "Test Patient",
  phone: "+357 99123456",
  email: "patient@example.com",
};
describe("GeSY and private bookings", () => {
  it("accepts GeSY appointments and defaults preferredLanguage to 'el'", () => {
    const parsed = bookingSchema.parse({ ...input, appointmentType: "gesy" });
    expect(parsed.appointmentType).toBe("gesy");
    expect(parsed.preferredLanguage).toBe("el");
  });
  it("accepts private visits with explicit preferredLanguage ('el' or 'en')", () => {
    const parsedEn = bookingSchema.parse({
      ...input,
      appointmentType: "private",
      preferredLanguage: "en",
    });
    expect(parsedEn.appointmentType).toBe("private");
    expect(parsedEn.preferredLanguage).toBe("en");
  });
  it("rejects unsupported preferredLanguage values", () => {
    expect(
      bookingSchema.safeParse({ ...input, appointmentType: "gesy", preferredLanguage: "fr" })
        .success,
    ).toBe(false);
  });
  it("requires a supported appointment type", () => {
    expect(bookingSchema.safeParse(input).success).toBe(false);
    expect(bookingSchema.safeParse({ ...input, appointmentType: "insurance" }).success).toBe(false);
  });
  it("does not apply a private fee to GeSY bookings", () => {
    expect(getBookingFee({ ...service, privateFee: 60 }, "gesy")).toBeNull();
  });
  it("supports private appointments without a fixed rate", () => {
    expect(getBookingFee(service, "private")).toBeNull();
  });
  it("uses an optional configured private rate", () => {
    expect(getBookingFee({ ...service, privateFee: 60 }, "private")).toBe(60);
  });
  it("allows empty, whitespace, null, or omitted email while still requiring phone", () => {
    const withEmptyEmail = bookingSchema.safeParse({
      ...input,
      appointmentType: "gesy",
      email: "",
    });
    expect(withEmptyEmail.success).toBe(true);

    const withWhitespaceEmail = bookingSchema.safeParse({
      ...input,
      appointmentType: "gesy",
      email: "   ",
    });
    expect(withWhitespaceEmail.success).toBe(true);

    const withNullEmail = bookingSchema.safeParse({
      ...input,
      appointmentType: "gesy",
      email: null,
    });
    expect(withNullEmail.success).toBe(true);

    const withOmittedEmail = bookingSchema.safeParse({
      serviceId: "initial",
      date: "2026-10-20",
      time: "09:00",
      fullName: "Test Patient",
      phone: "+357 99123456",
      appointmentType: "gesy",
    });
    expect(withOmittedEmail.success).toBe(true);

    const withInvalidEmail = bookingSchema.safeParse({
      ...input,
      appointmentType: "gesy",
      email: "not-an-email",
    });
    expect(withInvalidEmail.success).toBe(false);
  });
});
