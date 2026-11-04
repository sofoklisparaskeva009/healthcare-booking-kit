import {
  clinicConfig,
  type ClinicService,
  type FAQ,
  type Testimonial,
  type TrustBadge,
  type WorkingHours,
} from "@/config/clinicConfig";
import type { Locale } from "./locales";

/** Clinic content resolved for a single locale (Greek base + locale overrides). */
export interface LocalizedClinic {
  specialty: string;
  tagline: string;
  heroHeading: { regular: string; highlight: string };
  heroDescription: string;
  bioParagraphs: string[];
  avatarAlt: string;
  statCards: Array<{ value: string; label: string }>;
  trustBadges: TrustBadge[];
  gesy: { badgeText: string; subText: string; description: string; referralNotice: string };
  services: ClinicService[];
  workingHours: WorkingHours[];
  emergencyNote: string | undefined;
  accessibilityNote: string | undefined;
  testimonials: Testimonial[];
  faqs: FAQ[];
}

const cache = new Map<Locale, LocalizedClinic>();

function build(locale: Locale): LocalizedClinic {
  const { doctor, gesy, services, workingHours, contact, testimonials, faqs } = clinicConfig;
  const o = locale === "el" ? undefined : clinicConfig.translations?.[locale];

  return {
    specialty: o?.specialty ?? doctor.specialty,
    tagline: o?.tagline ?? doctor.tagline,
    heroHeading: o?.heroHeading ?? doctor.heroHeading,
    heroDescription: o?.heroDescription ?? doctor.heroDescription,
    bioParagraphs: o?.bioParagraphs ?? doctor.bioParagraphs,
    avatarAlt: o?.avatarAlt ?? doctor.avatarAlt,
    statCards: o?.statCards ?? doctor.stats.statCards,
    trustBadges: o?.trustBadges ?? doctor.trustBadges,
    gesy: {
      badgeText: o?.gesy?.badgeText ?? gesy.badgeText,
      subText: o?.gesy?.subText ?? gesy.subText,
      description: o?.gesy?.description ?? gesy.description,
      referralNotice: o?.gesy?.referralNotice ?? gesy.referralNotice,
    },
    services: services.map((s) => ({ ...s, ...(o?.services?.[s.id] ?? {}) })),
    workingHours: o?.workingHours ?? workingHours,
    emergencyNote: o?.emergencyNote ?? contact.emergencyNote,
    accessibilityNote: o?.accessibilityNote ?? contact.location.accessibilityNote,
    testimonials: o?.testimonials ?? testimonials,
    faqs: o?.faqs ?? faqs,
  };
}

export function getLocalizedClinic(locale: Locale): LocalizedClinic {
  let value = cache.get(locale);
  if (!value) {
    value = build(locale);
    cache.set(locale, value);
  }
  return value;
}

/** Localized service title; falls back to the Greek base title, then the id. */
export function getLocalizedServiceName(serviceId: string, locale: Locale): string {
  return getLocalizedClinic(locale).services.find((s) => s.id === serviceId)?.title ?? serviceId;
}

