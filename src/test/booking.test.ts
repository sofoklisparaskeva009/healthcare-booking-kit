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
  it("accepts GeSY appointments", () => {
    expect(bookingSchema.parse({ ...input, appointmentType: "gesy" }).appointmentType).toBe("gesy");
  });
  it("accepts private visits", () => {
    expect(bookingSchema.parse({ ...input, appointmentType: "private" }).appointmentType).toBe(
      "private",
    );
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
});
