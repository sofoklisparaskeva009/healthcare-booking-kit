import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./locales";
import { getDictionary, type Dictionary } from "./translations";

const STORAGE_KEY = "clinic.locale";

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Dictionary;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readStoredLocale(): Locale | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isLocale(stored) ? stored : null;
  } catch {
    return null; // storage disabled (private mode, etc.)
  }
}

export function LanguageProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  // SSR always renders the default locale; the stored preference is applied
  // after hydration to avoid markup mismatches.
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    const stored = readStoredLocale();
    if (stored && stored !== locale) setLocaleState(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore persistence failures
    }
  }, []);

  const value = useMemo(
    () => ({ locale, setLocale, t: getDictionary(locale) }),
    [locale, setLocale],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/**
 * Access the active locale and dictionary. Falls back to the default locale
 * when rendered outside a provider (e.g. isolated component tests).
 */
export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (ctx) return ctx;
  return { locale: DEFAULT_LOCALE, setLocale: () => {}, t: getDictionary(DEFAULT_LOCALE) };
}

