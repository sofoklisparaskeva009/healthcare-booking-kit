import { clinicConfig } from "@/config/clinicConfig";
import { useLanguage } from "@/i18n/LanguageContext";
import { getLocalizedClinic } from "@/i18n/clinicContent";

export function Footer() {
  const { doctor, gesy } = clinicConfig;
  const { locale, t } = useLanguage();
  const c = getLocalizedClinic(locale);

  return (
    <footer className="border-t border-border bg-card/40 py-10 text-center text-sm text-muted-foreground">
      <div className="container mx-auto px-6 space-y-2">
        <p className="font-medium text-foreground">
          {doctor.name} · {c.specialty}
        </p>
        <p className="text-xs">
          © {new Date().getFullYear()} {doctor.name}. {t.footer.rights}
          {gesy.isProvider && ` · ${c.gesy.badgeText}`}
        </p>
      </div>
    </footer>
  );
}
