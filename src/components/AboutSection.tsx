import { clinicConfig } from "@/config/clinicConfig";

export function AboutSection() {
  const { doctor } = clinicConfig;

  return (
    <section id="about" className="scroll-mt-16 bg-primary py-24 text-primary-foreground">
      <div className="container mx-auto grid gap-12 px-6 md:grid-cols-[1fr_1.4fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            About the Specialist
          </p>
          <h2 className="mt-3 font-display text-4xl md:text-5xl">Care that listens first.</h2>
          <p className="mt-4 text-sm text-primary-foreground/70">
            {doctor.name} · {doctor.specialty}
          </p>
        </div>
        <div className="space-y-5 text-lg text-primary-foreground/80">
          {doctor.bioParagraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
          <div className="grid grid-cols-3 gap-6 border-t border-primary-foreground/20 pt-8">
            {doctor.stats.statCards.map((stat) => (
              <div key={stat.label}>
                <p className="font-display text-3xl text-gold">{stat.value}</p>
                <p className="mt-1 text-sm text-primary-foreground/90">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
