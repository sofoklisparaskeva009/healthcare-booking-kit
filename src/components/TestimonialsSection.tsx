import { Star } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { getLocalizedClinic } from "@/i18n/clinicContent";

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-12 max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{eyebrow}</p>
      <h2 className="mt-3 font-display text-4xl text-foreground md:text-5xl">{title}</h2>
    </div>
  );
}

export function TestimonialsSection() {
  const { locale, t } = useLanguage();
  const { testimonials } = getLocalizedClinic(locale);

  return (
    <section id="testimonials" className="container mx-auto scroll-mt-16 px-6 py-24">
      <SectionHeading
        eyebrow={t.sections.testimonialsEyebrow}
        title={t.sections.testimonialsTitle}
      />
      <div className="grid gap-6 md:grid-cols-3">
        {testimonials.map((item) => (
          <figure
            key={item.name}
            className="flex flex-col justify-between rounded-2xl border border-border bg-card p-8 shadow-xs"
          >
            <div>
              <div className="flex gap-1 text-gold">
                {Array.from({ length: item.rating || 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <blockquote className="mt-5 font-display text-xl leading-snug text-foreground">
                “{item.text}”
              </blockquote>
            </div>
            <figcaption className="mt-6 border-t border-border pt-4 text-sm text-muted-foreground flex items-center justify-between">
              <span className="font-medium text-foreground">— {item.name}</span>
              {item.treatment && (
                <span className="text-xs text-muted-foreground">{item.treatment}</span>
              )}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
