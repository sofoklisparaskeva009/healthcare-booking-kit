import { clinicConfig } from "@/config/clinicConfig";

export function Footer() {
  const { doctor, gesy } = clinicConfig;

  return (
    <footer className="border-t border-border bg-card/40 py-10 text-center text-sm text-muted-foreground">
      <div className="container mx-auto px-6 space-y-2">
        <p className="font-medium text-foreground">
          {doctor.name} · {doctor.specialty}
        </p>
        <p className="text-xs">
          © {new Date().getFullYear()} {doctor.name}. All rights reserved.
          {gesy.isProvider && ` · ${gesy.badgeText}`}
        </p>
      </div>
    </footer>
  );
}
