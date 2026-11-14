import { z } from "zod";
import { clinicConfig } from "@/config/clinicConfig";
import { getLocalizedClinic } from "@/i18n/clinicContent";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/i18n/locales";

export type AppointmentType = "gesy" | "private";
export const APPOINTMENT_TYPES = [
  {
    id: "gesy",
    label: "ΓεΣΥ Appointment (GeSY)",
    labels: { el: "Ραντεβού ΓεΣΥ (GeSY)", en: "GeSY Appointment (ΓεΣΥ)" },
  },
  {
    id: "private",
    label: "Private Visit (Ιδιωτική Επίσκεψη)",
    labels: { el: "Ιδιωτική Επίσκεψη", en: "Private Visit" },
  },
] as const;

export function getAppointmentTypeLabel(type: AppointmentType, locale: Locale = DEFAULT_LOCALE): string {
  return APPOINTMENT_TYPES.find((option) => option.id === type)?.labels[locale] ?? type;
}

export type Service = {
  id: string;
  name: string;
  desc: string;
  privateFee?: number | undefined;
  duration?: number | undefined;
  isGesyCovered?: boolean | undefined;
};

/** Canonical (Greek) service list — used for validation, fees and DB persistence. */
export const SERVICES: readonly Service[] = clinicConfig.services.map((s) => ({
  id: s.id,
  name: s.title,
  desc: s.description,
  privateFee: s.privateFee,
  isGesyCovered: s.isGesyCovered,
}));

/** Display-only service list for a locale. Fees/ids are identical to `SERVICES`. */
export function getLocalizedServices(locale: Locale): Service[] {
  const localized = getLocalizedClinic(locale).services;
  return SERVICES.map((s) => {
    const l = localized.find((x) => x.id === s.id);
    return { ...s, name: l?.title ?? s.name, desc: l?.description ?? s.desc };
  });
}

export function getBookingFee(service: Service, type: AppointmentType): number | null {
  return type === "private" ? (service.privateFee ?? null) : null;
}

/** Human-readable coverage / fee label shared by the UI, emails and SMS. */
export function formatCoverageLabel(
  type: AppointmentType,
  fee: number | null | undefined,
  locale: Locale = DEFAULT_LOCALE,
): string {
  if (type === "gesy") {
    return (
      getLocalizedClinic(locale).gesy.referralNotice ||
      (locale === "el" ? "Καλύπτεται από ΓεΣΥ (με παραπεμπτικό)" : "Covered by GeSY (With Referral)")
    );
  }
  if (fee === null || fee === undefined) {
    return locale === "el" ? "Ιδιωτική χρέωση κατόπιν συνεννόησης" : "Private fee on request";
  }
  return locale === "el" ? `Ιδιωτική χρέωση · €${fee}` : `Private fee · €${fee}`;
}

export function getPricingLabel(
  service: Service,
  type: AppointmentType,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return formatCoverageLabel(type, getBookingFee(service, type), locale);
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
  email: z.preprocess(
    (val) => (typeof val === "string" ? val.trim() : val),
    z.union([z.string().email("Invalid email").max(255), z.literal(""), z.null(), z.undefined()]),
  ),
  notes: z.string().trim().max(1000).optional().default(""),
  /** Language for patient notifications (email + SMS). Persisted as `preferred_language`. */
  preferredLanguage: z.enum(LOCALES).optional().default(DEFAULT_LOCALE),
});
export type BookingInput = z.infer<typeof bookingSchema>;
