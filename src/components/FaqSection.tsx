import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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

export function FaqSection() {
  const { locale, t } = useLanguage();
  const { faqs } = getLocalizedClinic(locale);

  return (
    <section id="faq" className="scroll-mt-16 bg-secondary py-24">
      <div className="container mx-auto max-w-3xl px-6">
        <SectionHeading eyebrow={t.sections.faqEyebrow} title={t.sections.faqTitle} />
        <Accordion
          type="single"
          collapsible
          className="rounded-2xl border border-border bg-background px-6"
        >
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-left text-base font-medium">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
