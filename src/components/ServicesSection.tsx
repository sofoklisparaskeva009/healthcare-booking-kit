import { Stethoscope, CheckCircle2 } from "lucide-react";
import { clinicConfig } from "@/config/clinicConfig";

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-12 max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{eyebrow}</p>
      <h2 className="mt-3 font-display text-4xl text-foreground md:text-5xl">{title}</h2>
    </div>
  );
}

export function ServicesSection() {
  const { services, gesy } = clinicConfig;

  return (
    <section id="services" className="container mx-auto scroll-mt-16 px-6 py-24">
      <SectionHeading eyebrow="Treatments" title="Services & coverage" />
      <div className="grid gap-6 md:grid-cols-3">
        {services.map((service) => (
          <div
            key={service.id}
            className="group relative flex flex-col rounded-2xl border border-border bg-card p-8 transition-all duration-300 hover:border-primary hover:shadow-elegant"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold/10 text-gold transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <Stethoscope className="h-6 w-6" />
            </div>

            <h3 className="mt-6 font-display text-2xl text-foreground">{service.title}</h3>
            <p className="mt-3 text-muted-foreground leading-relaxed">{service.description}</p>

            <div className="mt-auto pt-8">
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                {service.isGesyCovered && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-primary">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {service.gesyCoverageNote || gesy.referralNotice}
                  </span>
                )}
                {service.privateFee !== undefined && (
                  <span className="text-xs font-medium text-muted-foreground px-2 py-1">
                    Private fee · €{service.privateFee}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
