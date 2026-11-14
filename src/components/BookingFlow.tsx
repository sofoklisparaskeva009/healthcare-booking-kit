import { useEffect, useState } from "react";
import { format, isBefore, startOfDay, isSunday } from "date-fns";
import { el as elDateLocale, enGB as enDateLocale } from "date-fns/locale";
import { Check, ChevronLeft, Loader2, Info, Globe } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  APPOINTMENT_TYPES,
  TIME_SLOTS,
  bookingSchema,
  getAppointmentTypeLabel,
  getLocalizedServices,
  getPricingLabel,
  type AppointmentType,
} from "@/lib/booking";
import { createBooking, getBookedSlots, type CreateBookingErrorCode } from "@/lib/booking.functions";
import { clinicConfig } from "@/config/clinicConfig";
import { useLanguage } from "@/i18n/LanguageContext";
import { getLocalizedClinic } from "@/i18n/clinicContent";
import { LOCALES, type Locale } from "@/i18n/locales";

export function BookingFlow() {
  const { locale, t } = useLanguage();
  const dateLocale = locale === "el" ? elDateLocale : enDateLocale;
  const localizedClinic = getLocalizedClinic(locale);
  const services = getLocalizedServices(locale);

  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState<string>("");
  const [appointmentType, setAppointmentType] = useState<AppointmentType>("gesy");
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("");
  const [booked, setBooked] = useState<string[]>([]);
  const [form, setForm] = useState<{
    fullName: string;
    phone: string;
    email: string;
    notes: string;
    preferredLanguage: Locale;
  }>({
    fullName: "",
    phone: "",
    email: "",
    notes: "",
    preferredLanguage: locale,
  });
  const [languageTouched, setLanguageTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Keep notification language in sync with the UI language unless manually overridden
  useEffect(() => {
    if (!languageTouched) {
      setForm((prev) => ({ ...prev, preferredLanguage: locale }));
    }
  }, [locale, languageTouched]);

  const service = services.find((s) => s.id === serviceId);
  const dateStr = date ? format(date, "yyyy-MM-dd") : "";

  useEffect(() => {
    if (!dateStr) return;
    getBookedSlots({ data: { date: dateStr } })
      .then(setBooked)
      .catch(() => setBooked([]));
  }, [dateStr]);

  const validateDetails = () => {
    const normalizedForm = {
      ...form,
      email: form.email.trim(),
    };
    const r = bookingSchema
      .pick({ fullName: true, phone: true, email: true, notes: true, preferredLanguage: true })
      .safeParse(normalizedForm);
    if (r.success) {
      setErrors({});
      return true;
    }
    const e: Record<string, string> = {};
    r.error.issues.forEach((i) => {
      const key = String(i.path[0]);
      if (key === "fullName") e[key] = t.booking.errors.fullName;
      else if (key === "phone") e[key] = t.booking.errors.phone;
      else if (key === "email") e[key] = t.booking.errors.email;
      else if (key === "notes") e[key] = t.booking.errors.notes;
      else e[key] = i.message;
    });
    setErrors(e);
    return false;
  };

  const submit = async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      if (!service) return;
      const res = await createBooking({
        data: {
          appointmentType,
          serviceId: service.id,
          date: dateStr,
          time,
          fullName: form.fullName,
          phone: form.phone,
          email: form.email,
          notes: form.notes,
          preferredLanguage: form.preferredLanguage,
        },
      });
      if (res.ok) {
        setDone(true);
      } else {
        const code = (res as { code?: CreateBookingErrorCode }).code;
        if (code && code in t.booking.errors) {
          setSubmitError(t.booking.errors[code]);
        } else {
          setSubmitError(res.error || t.booking.errors.save_failed);
        }
      }
    } catch {
      setSubmitError(t.booking.errors.generic);
    }
    setSubmitting(false);
  };

  const reset = () => {
    setStep(0);
    setServiceId("");
    setAppointmentType("gesy");
    setDate(undefined);
    setTime("");
    setForm({
      fullName: "",
      phone: "",
      email: "",
      notes: "",
      preferredLanguage: locale,
    });
    setLanguageTouched(false);
    setErrors({});
    setSubmitError("");
    setDone(false);
  };

  if (done && service && date) {
    const firstName = form.fullName.trim().split(/\s+/)[0] || form.fullName;
    const formattedDate = format(date, "EEEE, d MMMM", { locale: dateLocale });
    const categoryLabel = getAppointmentTypeLabel(appointmentType, locale);

    return (
      <div className="animate-in fade-in zoom-in-95 duration-500 py-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-8 w-8" />
        </div>
        <h3 className="mt-6 font-display text-3xl text-foreground">{t.booking.success.title}</h3>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">
          {t.booking.success.body({
            firstName,
            doctor: clinicConfig.doctor.name,
            service: service.name,
            category: categoryLabel,
            date: formattedDate,
            time,
          })}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">{t.booking.success.note}</p>
        <Button variant="outline" className="mt-8" onClick={reset}>
          {t.booking.actions.bookAnother}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <ol className="mb-10 grid grid-cols-4 gap-2">
        {t.booking.steps.map((s, i) => (
          <li key={i} className="flex flex-col gap-2">
            <div
              className={cn(
                "h-1 rounded-full transition-colors duration-500",
                i <= step ? "bg-primary" : "bg-border",
              )}
            />
            <span
              className={cn(
                "text-xs font-medium uppercase tracking-wider",
                i === step ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span className="text-gold">0{i + 1}</span>{" "}
              <span className="hidden sm:inline">{s}</span>
            </span>
          </li>
        ))}
      </ol>

      <div key={step} className="animate-in fade-in slide-in-from-right-6 duration-500">
        {step === 0 && (
          <div>
            <fieldset className="mb-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <legend className="text-sm font-medium text-foreground">
                  {t.booking.categoryLegend}
                </legend>
                {clinicConfig.gesy.isProvider && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info className="h-3.5 w-3.5 text-primary" /> {localizedClinic.gesy.subText}
                  </span>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {APPOINTMENT_TYPES.map((option) => (
                  <Button
                    key={option.id}
                    type="button"
                    variant={appointmentType === option.id ? "default" : "outline"}
                    aria-pressed={appointmentType === option.id}
                    onClick={() => setAppointmentType(option.id)}
                    className="h-auto min-h-12 whitespace-normal py-3 text-center"
                  >
                    {appointmentType === option.id && <Check className="shrink-0 mr-1.5 h-4 w-4" />}
                    {option.labels[locale]}
                  </Button>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 md:grid-cols-3">
              {services.map((s) => (
                <Button
                  key={s.id}
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setServiceId(s.id);
                    setStep(1);
                  }}
                  className={cn(
                    "flex h-full flex-col items-start gap-0 whitespace-normal rounded-xl border bg-card p-6 text-left transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-elegant",
                    serviceId === s.id ? "border-primary ring-1 ring-primary" : "border-border",
                  )}
                >
                  <div className="flex w-full items-baseline justify-between">
                    <h4 className="font-display text-xl text-foreground">{s.name}</h4>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                  <div className="mt-auto flex w-full flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                      {getPricingLabel(s, appointmentType, locale)}
                    </span>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-8 md:grid-cols-[auto_1fr]">
            <div className="rounded-xl border border-border bg-card p-2 shadow-xs">
              <Calendar
                mode="single"
                locale={dateLocale}
                selected={date}
                onSelect={(d) => {
                  setDate(d);
                  setTime("");
                }}
                disabled={(d) => isBefore(d, startOfDay(new Date())) || isSunday(d)}
                className="pointer-events-auto p-3"
              />
            </div>
            <div>
              <h4 className="font-display text-xl text-foreground">
                {date
                  ? format(date, "EEEE, d MMMM yyyy", { locale: dateLocale })
                  : t.booking.selectDate}
              </h4>
              <p className="mt-1 text-sm text-muted-foreground">{t.booking.availableSlots}</p>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {TIME_SLOTS.map((tSlot) => {
                  const taken = booked.includes(tSlot);
                  return (
                    <button
                      key={tSlot}
                      type="button"
                      disabled={!date || taken}
                      onClick={() => setTime(tSlot)}
                      className={cn(
                        "rounded-lg border px-3 py-3 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40",
                        time === tSlot
                          ? "border-primary bg-primary text-primary-foreground font-semibold"
                          : "border-border bg-card text-foreground hover:border-primary",
                        taken && "line-through opacity-40",
                      )}
                    >
                      {tSlot}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <Label htmlFor="fullName">{t.booking.fields.fullName.label}</Label>
              <Input
                id="fullName"
                type="text"
                placeholder={t.booking.fields.fullName.placeholder}
                className="mt-2"
                value={form.fullName}
                maxLength={100}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
              {errors["fullName"] && (
                <p className="mt-1 text-sm text-destructive">{errors["fullName"]}</p>
              )}
            </div>

            <div>
              <Label htmlFor="phone">{t.booking.fields.phone.label}</Label>
              <Input
                id="phone"
                type="tel"
                placeholder={t.booking.fields.phone.placeholder}
                className="mt-2"
                value={form.phone}
                maxLength={30}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              {errors["phone"] && (
                <p className="mt-1 text-sm text-destructive">{errors["phone"]}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="email">{t.booking.fields.email.label}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t.booking.fields.email.placeholder}
                className="mt-2"
                value={form.email}
                maxLength={255}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              {errors["email"] && (
                <p className="mt-1 text-sm text-destructive">{errors["email"]}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <Label id="preferredLanguage-label" className="flex items-center gap-1.5">
                <Globe className="h-4 w-4 text-primary" />
                {t.booking.fields.preferredLanguage.label}
              </Label>
              <div
                role="radiogroup"
                aria-labelledby="preferredLanguage-label"
                className="mt-2 grid grid-cols-2 gap-3"
              >
                {LOCALES.map((lang) => {
                  const selected = form.preferredLanguage === lang;
                  return (
                    <Button
                      key={lang}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      variant={selected ? "default" : "outline"}
                      onClick={() => {
                        setLanguageTouched(true);
                        setForm({ ...form, preferredLanguage: lang });
                      }}
                      className="h-11 justify-center gap-2"
                    >
                      {selected && <Check className="h-4 w-4 shrink-0" />}
                      <span>
                        {t.language.names[lang]} ({t.language.short[lang]})
                      </span>
                    </Button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {t.booking.fields.preferredLanguage.help}
              </p>
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="notes">{t.booking.fields.notes.label}</Label>
              <Textarea
                id="notes"
                rows={4}
                className="mt-2"
                placeholder={t.booking.fields.notes.placeholder}
                maxLength={1000}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
              {errors["notes"] && (
                <p className="mt-1 text-sm text-destructive">{errors["notes"]}</p>
              )}
            </div>
          </div>
        )}

        {step === 3 && service && date && (
          <div className="rounded-xl border border-border bg-card p-6 md:p-8">
            <h4 className="font-display text-2xl text-foreground">{t.booking.summary.title}</h4>
            <dl className="mt-6 divide-y divide-border">
              {[
                [t.booking.summary.doctor, clinicConfig.doctor.name],
                [t.booking.summary.category, getAppointmentTypeLabel(appointmentType, locale)],
                [t.booking.summary.service, service.name],
                [t.booking.summary.date, format(date, "EEEE, d MMMM yyyy", { locale: dateLocale })],
                [t.booking.summary.time, time],
                [t.booking.summary.patientName, form.fullName],
                [t.booking.summary.phone, form.phone],
                [
                  t.booking.summary.email,
                  form.email.trim() || (locale === "el" ? "Δεν δηλώθηκε" : "Not provided"),
                ],
                [
                  t.booking.summary.notificationLanguage,
                  `${t.language.names[form.preferredLanguage]} (${t.language.short[form.preferredLanguage]})`,
                ],
                ...(form.notes ? [[t.booking.summary.notes, form.notes]] : []),
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-6 py-3 text-sm">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right font-medium text-foreground">{v}</dd>
                </div>
              ))}
              <div className="flex justify-between py-4">
                <dt className="font-medium text-foreground">
                  {appointmentType === "gesy"
                    ? t.booking.summary.coverage
                    : t.booking.summary.privateFee}
                </dt>
                <dd className="ml-4 text-right text-sm font-semibold text-primary">
                  {getPricingLabel(service, appointmentType, locale)}
                </dd>
              </div>
            </dl>
            {submitError && <p className="mt-4 text-sm text-destructive">{submitError}</p>}
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          disabled={step === 0}
          onClick={() => setStep(step - 1)}
          className={step === 0 ? "invisible" : ""}
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> {t.booking.actions.back}
        </Button>
        {step === 1 && (
          <Button type="button" disabled={!date || !time} onClick={() => setStep(2)}>
            {t.booking.actions.continue}
          </Button>
        )}
        {step === 2 && (
          <Button type="button" onClick={() => validateDetails() && setStep(3)}>
            {t.booking.actions.review}
          </Button>
        )}
        {step === 3 && (
          <Button type="button" onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t.booking.actions.confirm}
          </Button>
        )}
      </div>
    </div>
  );
}
