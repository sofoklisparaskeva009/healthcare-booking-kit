import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { ServicesSection } from "@/components/ServicesSection";
import { BookingFlow } from "@/components/BookingFlow";
import { AboutSection } from "@/components/AboutSection";
import { TestimonialsSection } from "@/components/TestimonialsSection";
import { FaqSection } from "@/components/FaqSection";
import { ContactSection } from "@/components/ContactSection";
import { Footer } from "@/components/Footer";
import { clinicConfig } from "@/config/clinicConfig";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${clinicConfig.doctor.name} — ${clinicConfig.doctor.specialty}` },
      { name: "description", content: clinicConfig.doctor.heroDescription },
      {
        property: "og:title",
        content: `${clinicConfig.doctor.name} — ${clinicConfig.doctor.specialty}`,
      },
      { property: "og:description", content: clinicConfig.doctor.heroDescription },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-12 max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{eyebrow}</p>
      <h2 className="mt-3 font-display text-4xl text-foreground md:text-5xl">{title}</h2>
    </div>
  );
}

function Index() {
  const scrollToBooking = () => {
    document.getElementById("book")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar onBookClick={scrollToBooking} />

      <main>
        <HeroSection onBookClick={scrollToBooking} />

        <section id="book" className="scroll-mt-16 bg-secondary py-24">
          <div className="container mx-auto max-w-5xl px-6">
            <SectionHeading eyebrow="Online Booking" title="Book your appointment" />
            <div className="rounded-3xl border border-border bg-background p-6 shadow-elegant md:p-10">
              <BookingFlow />
            </div>
          </div>
        </section>

        <ServicesSection />

        <AboutSection />

        <TestimonialsSection />

        <FaqSection />

        <ContactSection />
      </main>

      <Footer />
    </div>
  );
}
