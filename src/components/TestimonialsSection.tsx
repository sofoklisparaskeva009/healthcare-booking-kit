import { Star } from "lucide-react";
import { clinicConfig } from "@/config/clinicConfig";

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-12 max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{eyebrow}</p>
      <h2 className="mt-3 font-display text-4xl text-foreground md:text-5xl">{title}</h2>
    </div>
  );
}

export function TestimonialsSection() {
  const { testimonials } = clinicConfig;

  return (
    <section id="testimonials" className="container mx-auto scroll-mt-16 px-6 py-24">
      <SectionHeading eyebrow="Testimonials" title="What patients say" />
      <div className="grid gap-6 md:grid-cols-3">
        {testimonials.map((t) => (
          <figure
            key={t.name}
            className="flex flex-col justify-between rounded-2xl border border-border bg-card p-8 shadow-xs"
          >
            <div>
              <div className="flex gap-1 text-gold">
                {Array.from({ length: t.rating || 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <blockquote className="mt-5 font-display text-xl leading-snug text-foreground">
                “{t.text}”
              </blockquote>
            </div>
            <figcaption className="mt-6 border-t border-border pt-4 text-sm text-muted-foreground flex items-center justify-between">
              <span className="font-medium text-foreground">— {t.name}</span>
              {t.treatment && <span className="text-xs text-muted-foreground">{t.treatment}</span>}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
