import { Globe, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clinicConfig } from "@/config/clinicConfig";
import { useLanguage } from "@/i18n/LanguageContext";
import { LOCALES } from "@/i18n/locales";
import { cn } from "@/lib/utils";

interface NavbarProps {
  onBookClick: () => void;
}

export function Navbar({ onBookClick }: NavbarProps) {
  const { doctor } = clinicConfig;
  const { locale, setLocale, t } = useLanguage();
  const brandName = doctor.logoTitle || doctor.name.replace(/^(Dr\.|Δρ\.)\s*/i, "");

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-6">
        <a href="#top" className="flex items-center gap-2 font-display text-xl text-foreground">
          <Stethoscope className="h-5 w-5 text-primary" />
          <span>{brandName}</span>
        </a>

        <nav className="hidden gap-8 text-sm text-muted-foreground md:flex">
          <a href="#services" className="transition-colors hover:text-foreground">
            {t.nav.services}
          </a>
          <a href="#about" className="transition-colors hover:text-foreground">
            {t.nav.about}
          </a>
          <a href="#testimonials" className="transition-colors hover:text-foreground">
            {t.nav.testimonials}
          </a>
          <a href="#faq" className="transition-colors hover:text-foreground">
            {t.nav.faq}
          </a>
          <a href="#contact" className="transition-colors hover:text-foreground">
            {t.nav.contact}
          </a>
        </nav>

        <div className="flex items-center gap-2.5">
          <div
            role="group"
            aria-label={t.language.switchTo}
            className="inline-flex items-center rounded-full border border-border bg-secondary/70 p-0.5 text-xs font-semibold shadow-2xs"
          >
            <Globe className="ml-2 mr-1 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            {LOCALES.map((lang) => {
              const active = locale === lang;
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLocale(lang)}
                  aria-pressed={active}
                  title={t.language.names[lang]}
                  className={cn(
                    "rounded-full px-2.5 py-1 transition-all",
                    active
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.language.short[lang]}
                </button>
              );
            })}
          </div>

          <Button size="sm" onClick={onBookClick}>
            {t.nav.book}
          </Button>
        </div>
      </div>
    </header>
  );
}
