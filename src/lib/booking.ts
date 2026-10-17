import { z } from "zod";
import { clinicConfig } from "@/config/clinicConfig";

export type AppointmentType = "gesy" | "private";
export const APPOINTMENT_TYPES = [
  { id: "gesy", label: "ΓεΣΥ Appointment (GeSY)" },
  { id: "private", label: "Private Visit (Ιδιωτική Επίσκεψη)" },
] as const;

export type Service = {
  id: string;
  name: string;
  desc: string;
  privateFee?: number | undefined;
  duration?: number | undefined;
  isGesyCovered?: boolean | undefined;
};

export const SERVICES: readonly Service[] = clinicConfig.services.map((s) => ({
  id: s.id,
  name: s.title,
  desc: s.description,
  privateFee: s.privateFee,
  isGesyCovered: s.isGesyCovered,
}));

export function getBookingFee(service: Service, type: AppointmentType): number | null {
  return type === "private" ? (service.privateFee ?? null) : null;
}

export function getPricingLabel(service: Service, type: AppointmentType): string {
  if (type === "gesy") {
    return clinicConfig.gesy.referralNotice || "Covered by GeSY (With Referral)";
  }
  const fee = getBookingFee(service, type);
  return fee === null ? "Private fee on request" : `Private fee · €${fee}`;
}

export const TIME_SLOTS: readonly string[] = clinicConfig.timeSlots;

export const bookingSchema = z.object({
  appointmentType: z.enum(["gesy", "private"]),
  serviceId: z
    .string()
    .refine((id) => SERVICES.some((s) => s.id === id), "Please choose a valid service"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().refine((t) => TIME_SLOTS.includes(t), "Invalid time"),
  fullName: z.string().trim().min(2, "Please enter your full name").max(100),
  phone: z
    .string()
    .trim()
    .min(6, "Please enter a valid phone")
    .max(30)
    .regex(/^[+\d\s()-]+$/, "Invalid phone number"),
  email: z.string().trim().email("Invalid email").max(255),
  notes: z.string().trim().max(1000).optional().default(""),
});
export type BookingInput = z.infer<typeof bookingSchema>;
