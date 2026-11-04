/**
 * Locale primitives shared by the UI (React) and the server (notifications).
 * Kept dependency-free so it can be imported from any runtime.
 */

export const LOCALES = ["el", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/** Greek is the primary language of the clinic. */
export const DEFAULT_LOCALE: Locale = "el";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Coerces any input (DB value, query param, header) into a supported locale. */
export function resolveLocale(value: unknown): Locale {
  if (isLocale(value)) return value;
  if (typeof value === "string") {
    const short = value.trim().toLowerCase().slice(0, 2);
    if (isLocale(short)) return short;
  }
  return DEFAULT_LOCALE;
}

/** BCP-47 tag used for Intl date formatting. */
export function intlLocaleTag(locale: Locale): string {
  return locale === "el" ? "el-CY" : "en-GB";
}

