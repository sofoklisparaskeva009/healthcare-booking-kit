import { Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clinicConfig } from "@/config/clinicConfig";

interface NavbarProps {
  onBookClick: () => void;
}

export function Navbar({ onBookClick }: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between px-6">
        <a href="#top" className="flex items-center gap-2 font-display text-xl text-foreground">
          <Stethoscope className="h-5 w-5 text-primary" />
          <span>{clinicConfig.doctor.name}</span>
        </a>
        <nav className="hidden gap-8 text-sm text-muted-foreground md:flex">
          <a href="#services" className="transition-colors hover:text-foreground">
            Services
          </a>
          <a href="#about" className="transition-colors hover:text-foreground">
            About
          </a>
          <a href="#testimonials" className="transition-colors hover:text-foreground">
            Testimonials
          </a>
          <a href="#faq" className="transition-colors hover:text-foreground">
            FAQ
          </a>
          <a href="#contact" className="transition-colors hover:text-foreground">
            Contact
          </a>
        </nav>
        <Button size="sm" onClick={onBookClick}>
          Book Appointment
        </Button>
      </div>
    </header>
  );
}
