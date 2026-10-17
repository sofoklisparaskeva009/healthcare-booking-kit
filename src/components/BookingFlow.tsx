import { useEffect, useState } from "react";
import { format, isBefore, startOfDay, isSunday } from "date-fns";
import { Check, ChevronLeft, Loader2, Info } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  APPOINTMENT_TYPES,
  SERVICES,
  TIME_SLOTS,
  bookingSchema,
  getPricingLabel,
  type AppointmentType,
} from "@/lib/booking";
import { createBooking, getBookedSlots } from "@/lib/booking.functions";
import { clinicConfig } from "@/config/clinicConfig";

const STEPS = ["Service", "Date & Time", "Your Details", "Confirm"];

export function BookingFlow() {
  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState<string>("");
  const [appointmentType, setAppointmentType] = useState<AppointmentType>("gesy");
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("");
  const [booked, setBooked] = useState<string[]>([]);
  const [form, setForm] = useState({ fullName: "", phone: "", email: "", notes: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const service = SERVICES.find((s) => s.id === serviceId);
  const dateStr = date ? format(date, "yyyy-MM-dd") : "";

  useEffect(() => {
    if (!dateStr) return;
    getBookedSlots({ data: { date: dateStr } })
      .then(setBooked)
      .catch(() => setBooked([]));
  }, [dateStr]);

  const validateDetails = () => {
    const r = bookingSchema
      .pick({ fullName: true, phone: true, email: true, notes: true })
      .safeParse(form);
    if (r.success) {
      setErrors({});
      return true;
    }
    const e: Record<string, string> = {};
    r.error.issues.forEach((i) => (e[String(i.path[0])] = i.message));
    setErrors(e);
    return false;
  };

  const submit = async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      if (!service) return;
      const res = await createBooking({
        data: { appointmentType, serviceId: service.id, date: dateStr, time, ...form },
      });
      if (res.ok) {
        setDone(true);
      } else {
        setSubmitError(res.error);
      }
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    }
    setSubmitting(false);
  };

  const reset = () => {
    setStep(0);
    setServiceId("");
    setAppointmentType("gesy");
    setDate(undefined);
    setTime("");
    setForm({ fullName: "", phone: "", email: "", notes: "" });
    setDone(false);
  };

  if (done) {
    return (
      <div className="animate-in fade-in zoom-in-95 duration-500 py-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-8 w-8" />
        </div>
        <h3 className="mt-6 font-display text-3xl text-foreground">Appointment requested</h3>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">
          Thank you, {form.fullName.split(" ")[0]}. Your appointment with {clinicConfig.doctor.name}{" "}
          for <strong className="text-foreground">{service?.name}</strong> (
          {appointmentType === "gesy" ? "GeSY Covered" : "Private Visit"}) on{" "}
          <span className="text-foreground font-medium">
            {date && format(date, "EEEE, d MMMM")}
          </span>{" "}
          at <span className="text-foreground font-medium">{time}</span> has been received.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          A confirmation has been recorded and our clinic will reach out if any scheduling
          adjustment is needed.
        </p>
        <Button variant="outline" className="mt-8" onClick={reset}>
          Book another appointment
        </Button>
      </div>
    );
  }

  return (
    <div>
      <ol className="mb-10 grid grid-cols-4 gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-col gap-2">
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
              <div className="mb-3 flex items-center justify-between">
                <legend className="text-sm font-medium text-foreground">
                  Choose Appointment Category
                </legend>
                {clinicConfig.gesy.isProvider && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info className="h-3.5 w-3.5 text-primary" /> {clinicConfig.gesy.subText}
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
                    {option.label}
                  </Button>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 md:grid-cols-3">
              {SERVICES.map((s) => (
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
                      {getPricingLabel(s, appointmentType)}
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
                {date ? format(date, "EEEE, d MMMM yyyy") : "Select a date"}
              </h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Available time slots for clinic visits
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {TIME_SLOTS.map((t) => {
                  const taken = booked.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      disabled={!date || taken}
                      onClick={() => setTime(t)}
                      className={cn(
                        "rounded-lg border px-3 py-3 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40",
                        time === t
                          ? "border-primary bg-primary text-primary-foreground font-semibold"
                          : "border-border bg-card text-foreground hover:border-primary",
                        taken && "line-through opacity-40",
                      )}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-5 md:grid-cols-2">
            {(
              [
                ["fullName", "Full Name", "text", "e.g. Maria Georgiou"],
                ["phone", "Phone Number", "tel", "e.g. +357 99 123456"],
                ["email", "Email Address", "email", "e.g. maria@example.com"],
              ] as const
            ).map(([k, l, type, placeholder]) => (
              <div key={k} className={k === "email" ? "md:col-span-2" : ""}>
                <Label htmlFor={k}>{l}</Label>
                <Input
                  id={k}
                  type={type}
                  placeholder={placeholder}
                  className="mt-2"
                  value={form[k]}
                  maxLength={k === "email" ? 255 : 100}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                />
                {errors[k] && <p className="mt-1 text-sm text-destructive">{errors[k]}</p>}
              </div>
            ))}
            <div className="md:col-span-2">
              <Label htmlFor="notes">Notes / Reason for Visit (Optional)</Label>
              <Textarea
                id="notes"
                rows={4}
                className="mt-2"
                placeholder="Mention any symptoms, recent injury, or referral details..."
                maxLength={1000}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
        )}

        {step === 3 && service && date && (
          <div className="rounded-xl border border-border bg-card p-6 md:p-8">
            <h4 className="font-display text-2xl text-foreground">Booking Summary</h4>
            <dl className="mt-6 divide-y divide-border">
              {[
                ["Doctor / Clinic", clinicConfig.doctor.name],
                [
                  "Appointment Category",
                  APPOINTMENT_TYPES.find((option) => option.id === appointmentType)?.label ?? "",
                ],
                ["Service", service.name],
                ["Date", format(date, "EEEE, d MMMM yyyy")],
                ["Time", time],
                ["Patient Name", form.fullName],
                ["Phone", form.phone],
                ["Email", form.email],
                ...(form.notes ? [["Notes", form.notes]] : []),
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-6 py-3 text-sm">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right font-medium text-foreground">{v}</dd>
                </div>
              ))}
              <div className="flex justify-between py-4">
                <dt className="font-medium text-foreground">
                  {appointmentType === "gesy" ? "Coverage" : "Private Fee"}
                </dt>
                <dd className="ml-4 text-right text-sm font-semibold text-primary">
                  {getPricingLabel(service, appointmentType)}
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
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        {step === 1 && (
          <Button type="button" disabled={!date || !time} onClick={() => setStep(2)}>
            Continue
          </Button>
        )}
        {step === 2 && (
          <Button type="button" onClick={() => validateDetails() && setStep(3)}>
            Review booking
          </Button>
        )}
        {step === 3 && (
          <Button type="button" onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirm appointment
          </Button>
        )}
      </div>
    </div>
  );
}
