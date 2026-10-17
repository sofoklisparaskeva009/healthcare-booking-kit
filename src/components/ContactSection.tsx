import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { clinicConfig } from "@/config/clinicConfig";

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-12 max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{eyebrow}</p>
      <h2 className="mt-3 font-display text-4xl text-foreground md:text-5xl">{title}</h2>
    </div>
  );
}

export function ContactSection() {
  const { contact, workingHours } = clinicConfig;

  return (
    <section id="contact" className="container mx-auto scroll-mt-16 px-6 py-24">
      <SectionHeading eyebrow="Visit" title="Contact & location" />
      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-6 rounded-2xl border border-border bg-card p-8">
          <div className="flex gap-4">
            <MapPin className="mt-1 h-5 w-5 shrink-0 text-gold" />
            <div>
              <p className="text-sm text-muted-foreground">Address</p>
              <p className="font-medium text-foreground">{contact.address.full}</p>
            </div>
          </div>

          <div className="flex gap-4">
            <Phone className="mt-1 h-5 w-5 shrink-0 text-gold" />
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <a
                href={contact.phoneHref}
                className="font-medium text-foreground transition-colors hover:text-primary"
              >
                {contact.phone}
              </a>
            </div>
          </div>

          <div className="flex gap-4">
            <Mail className="mt-1 h-5 w-5 shrink-0 text-gold" />
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <a
                href={contact.emailHref}
                className="font-medium text-foreground transition-colors hover:text-primary"
              >
                {contact.email}
              </a>
            </div>
          </div>

          <div className="border-t border-border pt-6">
            <p className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 text-gold" /> Working hours
            </p>
            {workingHours.map((wh) => (
              <div key={wh.days} className="flex justify-between py-1 text-sm">
                <span className="text-foreground">{wh.days}</span>
                <span
                  className={
                    wh.isOpen ? "text-muted-foreground" : "text-muted-foreground/60 italic"
                  }
                >
                  {wh.hours}
                </span>
              </div>
            ))}
          </div>

          {contact.location.accessibilityNote && (
            <p className="border-t border-border pt-4 text-xs text-muted-foreground">
              {contact.location.accessibilityNote}
            </p>
          )}
        </div>

        <div className="min-h-80 overflow-hidden rounded-2xl border border-border shadow-xs">
          <iframe
            title="Clinic location map"
            className="h-full min-h-80 w-full grayscale"
            src={contact.location.mapEmbedUrl}
            loading="lazy"
          />
        </div>
      </div>
    </section>
  );
}
