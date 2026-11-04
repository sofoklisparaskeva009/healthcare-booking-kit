import { Award, CalendarCheck, ShieldCheck, Star, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clinicConfig } from "@/config/clinicConfig";
import { GesyLogo } from "@/components/GesyLogo";
import { useLanguage } from "@/i18n/LanguageContext";
import { getLocalizedClinic } from "@/i18n/clinicContent";

interface HeroSectionProps {
  onBookClick: () => void;
}

const BADGE_ICONS = {
  Award,
  ShieldCheck,
  Star,
  Stethoscope,
};

export function HeroSection({ onBookClick }: HeroSectionProps) {
  const { doctor, gesy } = clinicConfig;
  const { locale, t } = useLanguage();
  const c = getLocalizedClinic(locale);

  return (
    <section
      id="top"
      className="container mx-auto grid items-center gap-12 px-6 py-20 md:grid-cols-2 md:py-28"
    >
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{c.specialty}</p>
        <h1 className="mt-4 font-display text-5xl leading-[1.05] text-foreground md:text-7xl">
          {c.heroHeading.regular}{" "}
          <em className="text-primary not-italic">{c.heroHeading.highlight}</em>
        </h1>
        <p className="mt-6 max-w-lg text-lg text-muted-foreground">{c.heroDescription}</p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" onClick={onBookClick}>
            <CalendarCheck className="h-4 w-4 mr-1.5" /> {t.hero.book}
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href="#services">{t.hero.viewServices}</a>
          </Button>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          {c.trustBadges.map((badge) => {
            const IconComponent = BADGE_ICONS[badge.iconName] || Award;
            return (
              <span
                key={badge.label}
                className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-medium text-foreground"
              >
                <IconComponent className="h-4 w-4 text-gold" />
                {badge.label}
              </span>
            );
          })}
        </div>

        {gesy.isProvider && (
          <div className="mt-5 inline-flex max-w-full items-center gap-3.5 rounded-xl border border-primary/25 bg-card px-4 py-3 shadow-xs">
            <GesyLogo
              src={gesy.logoUrl}
              alt={t.hero.gesyLogoAlt}
              className="h-12 w-12 shrink-0"
            />
            <div>
              <p className="text-sm font-semibold text-primary">{c.gesy.badgeText}</p>
              <p className="text-xs text-muted-foreground">{c.gesy.subText}</p>
            </div>
          </div>
        )}
      </div>

      <div className="relative animate-in fade-in duration-1000">
        <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-secondary" />
        <img
          src={doctor.avatarUrl}
          alt={c.avatarAlt}
          width={896}
          height={1120}
          className="aspect-[4/5] w-full rounded-3xl object-cover shadow-elegant"
        />
        <div className="absolute -bottom-6 -left-6 rounded-2xl border border-border bg-card p-5 shadow-elegant">
          <p className="font-display text-3xl text-primary">{doctor.stats.patientsTreated}</p>
          <p className="text-sm text-muted-foreground">{t.hero.patientsTreated}</p>
        </div>
      </div>
    </section>
  );
}
