import { Award, CalendarCheck, ShieldCheck, Star, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clinicConfig } from "@/config/clinicConfig";

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

  return (
    <section
      id="top"
      className="container mx-auto grid items-center gap-12 px-6 py-20 md:grid-cols-2 md:py-28"
    >
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          {doctor.specialty}
        </p>
        <h1 className="mt-4 font-display text-5xl leading-[1.05] text-foreground md:text-7xl">
          {doctor.heroHeading.regular}{" "}
          <em className="text-primary not-italic">{doctor.heroHeading.highlight}</em>
        </h1>
        <p className="mt-6 max-w-lg text-lg text-muted-foreground">{doctor.heroDescription}</p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" onClick={onBookClick}>
            <CalendarCheck className="h-4 w-4 mr-1.5" /> Book Appointment
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href="#services">View services</a>
          </Button>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          {doctor.trustBadges.map((badge) => {
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
            <img
              src={gesy.logoUrl}
              alt="GeSY Logo"
              width={56}
              height={56}
              className="h-12 w-12 shrink-0 object-contain"
            />
            <div>
              <p className="text-sm font-semibold text-primary">{gesy.badgeText}</p>
              <p className="text-xs text-muted-foreground">{gesy.subText}</p>
            </div>
          </div>
        )}
      </div>

      <div className="relative animate-in fade-in duration-1000">
        <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-secondary" />
        <img
          src={doctor.avatarUrl}
          alt={doctor.avatarAlt}
          width={896}
          height={1120}
          className="aspect-[4/5] w-full rounded-3xl object-cover shadow-elegant"
        />
        <div className="absolute -bottom-6 -left-6 rounded-2xl border border-border bg-card p-5 shadow-elegant">
          <p className="font-display text-3xl text-primary">{doctor.stats.patientsTreated}</p>
          <p className="text-sm text-muted-foreground">patients treated</p>
        </div>
      </div>
    </section>
  );
}
