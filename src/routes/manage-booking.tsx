import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Stethoscope,
  User,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { clinic, getClinicDoctorName } from "@/config/clinic";
import { intlLocaleTag, type Locale } from "@/i18n/locales";
import {
  getBookingByActionToken,
  submitBookingTokenAction,
  type ManagedBookingDetails,
} from "@/lib/manageBooking.functions";

export const Route = createFileRoute("/manage-booking")({
  component: ManageBookingPage,
});

const STRINGS: Record<
  Locale,
  {
    pageTitle: string;
    subtitle: string;
    patientLabel: string;
    serviceLabel: string;
    dateLabel: string;
    timeLabel: string;
    statusConfirmedBadge: string;
    confirmBtn: string;
    cancelBtn: string;
    confirmedHeading: string;
    confirmedMessage: string;
    cancelledHeading: string;
    cancelledMessage: string;
    contactPrompt: string;
    backHome: string;
  }
> = {
  el: {
    pageTitle: "Διαχείριση Ραντεβού",
    subtitle: "Παρακαλούμε επιβεβαιώστε ή ακυρώστε την παρουσία σας στο προγραμματισμένο ραντεβού.",
    patientLabel: "Ασθενής",
    serviceLabel: "Υπηρεσία",
    dateLabel: "Ημερομηνία",
    timeLabel: "Ώρα",
    statusConfirmedBadge: "Επιβεβαιωμένο",
    confirmBtn: "Επιβεβαίωση",
    cancelBtn: "Ακύρωση",
    confirmedHeading: "Το ραντεβού επιβεβαιώθηκε!",
    confirmedMessage:
      "Σας ευχαριστούμε! Το ραντεβού σας έχει επιβεβαιωθεί επιτυχώς. Σας περιμένουμε στην κλινική.",
    cancelledHeading: "Το ραντεβού ακυρώθηκε επιτυχώς",
    cancelledMessage:
      "Το ραντεβού σας ακυρώθηκε και η ώρα αποδεσμεύτηκε. Αν επιθυμείτε νέο ραντεβού, μπορείτε να κάνετε νέα κράτηση.",
    contactPrompt: "Για οποιαδήποτε διευκρίνιση, καλέστε μας στο",
    backHome: "Επιστροφή στην Αρχική Σελίδα",
  },
  en: {
    pageTitle: "Manage Appointment",
    subtitle: "Please confirm or cancel your attendance for your scheduled appointment.",
    patientLabel: "Patient",
    serviceLabel: "Service",
    dateLabel: "Date",
    timeLabel: "Time",
    statusConfirmedBadge: "Confirmed",
    confirmBtn: "Confirm",
    cancelBtn: "Cancel",
    confirmedHeading: "Appointment Confirmed!",
    confirmedMessage:
      "Thank you! Your appointment has been successfully confirmed. We look forward to seeing you at the clinic.",
    cancelledHeading: "Appointment successfully cancelled",
    cancelledMessage:
      "Your appointment has been cancelled and the time slot has been released. If you would like to reschedule, you may book a new appointment.",
    contactPrompt: "If you need any assistance, please call us at",
    backHome: "Return to Home Page",
  },
};

function formatDisplayDate(dateStr: string, locale: Locale): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (y && m && d) {
      return new Date(y, m - 1, d).toLocaleDateString(intlLocaleTag(locale), {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
  } catch {
    // Fallback
  }
  return dateStr;
}

function ManageBookingPage() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expiredOrInvalid, setExpiredOrInvalid] = useState(false);
  const [booking, setBooking] = useState<ManagedBookingDetails | null>(null);
  const [submittingAction, setSubmittingAction] = useState<"confirm" | "cancel" | null>(null);
  const [completedAction, setCompletedAction] = useState<"confirm" | "cancel" | null>(null);
  const [actionError, setActionError] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token")?.trim() || "";
    setToken(urlToken);

    if (!urlToken) {
      setExpiredOrInvalid(true);
      setLoading(false);
      return;
    }

    getBookingByActionToken({ data: { token: urlToken } })
      .then((res) => {
        if (!res.ok || res.expiredOrInvalid || !res.booking) {
          setExpiredOrInvalid(true);
        } else {
          setBooking(res.booking);
        }
      })
      .catch(() => {
        setExpiredOrInvalid(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleAction = async (action: "confirm" | "cancel") => {
    if (!token) return;
    setSubmittingAction(action);
    setActionError("");

    try {
      const res = await submitBookingTokenAction({
        data: { token, action },
      });

      if (!res.ok) {
        if (res.expiredOrInvalid) {
          setExpiredOrInvalid(true);
        } else {
          setActionError(res.error || "Παρουσιάστηκε σφάλμα / Something went wrong.");
        }
        return;
      }

      setCompletedAction(action);
      if (booking) {
        setBooking({
          ...booking,
          status: action === "confirm" ? "confirmed" : "cancelled",
        });
      }
    } catch {
      setActionError("Παρουσιάστηκε σφάλμα / Something went wrong.");
    } finally {
      setSubmittingAction(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/30 p-6">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (expiredOrInvalid || !booking) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/30 px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-elegant">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Μη έγκυρος ή ληγμένος σύνδεσμος
          </h1>
          <p className="mt-1 font-display text-lg font-medium text-muted-foreground">
            Invalid or expired link
          </p>
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
            Ο σύνδεσμος διαχείρισης ραντεβού δεν είναι έγκυρος, το ραντεβού έχει ήδη ακυρωθεί ή έχει
            παρέλθει. / This appointment management link is invalid, or the appointment has already
            been cancelled or passed.
          </p>
          <div className="mt-6 border-t border-border pt-5 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">{clinic.doctor.name}</p>
            <a
              href={clinic.contact.phoneHref}
              className="mt-1 inline-flex items-center gap-1.5 text-primary font-semibold hover:underline"
            >
              <Phone className="h-3.5 w-3.5" /> {clinic.contact.phone}
            </a>
          </div>
          <Button asChild variant="outline" className="mt-6 w-full h-11">
            <a href="/">Αρχική Σελίδα / Home</a>
          </Button>
        </div>
      </div>
    );
  }

  const locale: Locale = booking.preferredLanguage || "el";
  const t = STRINGS[locale];
  const formattedDate = formatDisplayDate(booking.appointmentDate, locale);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/30 px-4 py-10">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-elegant">
        {/* Clinic Header */}
        <div className="bg-primary px-6 py-6 text-center text-primary-foreground">
          <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
            <Stethoscope className="h-6 w-6" />
          </div>
          <h1 className="font-display text-xl font-bold">{getClinicDoctorName(locale)}</h1>
          <p className="mt-1 text-xs uppercase tracking-widest text-gold font-semibold">
            {t.pageTitle}
          </p>
        </div>

        <div className="p-6 sm:p-8">
          {completedAction === "confirm" ? (
            <div className="py-4 text-center animate-in fade-in zoom-in-95 duration-300">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h2 className="font-display text-2xl font-bold text-foreground">
                {t.confirmedHeading}
              </h2>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                {t.confirmedMessage}
              </p>

              <div className="mt-6 rounded-xl border border-border bg-secondary/40 p-4 text-left text-sm">
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">{t.serviceLabel}:</span>
                  <span className="font-semibold text-foreground">{booking.serviceName}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">{t.dateLabel}:</span>
                  <span className="font-semibold text-foreground">{formattedDate}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">{t.timeLabel}:</span>
                  <span className="font-semibold text-primary">{booking.appointmentTime}</span>
                </div>
              </div>

              <Button asChild variant="outline" className="mt-6 w-full h-11">
                <a href="/">{t.backHome}</a>
              </Button>
            </div>
          ) : completedAction === "cancel" ? (
            <div className="py-4 text-center animate-in fade-in zoom-in-95 duration-300">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/15 text-rose-600">
                <XCircle className="h-10 w-10" />
              </div>
              <h2 className="font-display text-2xl font-bold text-foreground">
                {t.cancelledHeading}
              </h2>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                {t.cancelledMessage}
              </p>

              <Button asChild variant="outline" className="mt-6 w-full h-11">
                <a href="/">{t.backHome}</a>
              </Button>
            </div>
          ) : (
            <>
              <p className="text-center text-sm text-muted-foreground">{t.subtitle}</p>

              {/* Appointment Details Card */}
              <div className="mt-6 rounded-xl border border-border bg-secondary/30 p-5 space-y-3.5">
                <div className="flex items-start justify-between gap-4 border-b border-border pb-3">
                  <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <User className="h-4 w-4 text-primary" /> {t.patientLabel}
                  </span>
                  <span className="text-right text-sm font-semibold text-foreground">
                    {booking.fullName}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-4 border-b border-border pb-3">
                  <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <Stethoscope className="h-4 w-4 text-primary" /> {t.serviceLabel}
                  </span>
                  <span className="text-right text-sm font-semibold text-foreground">
                    {booking.serviceName}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-4 border-b border-border pb-3">
                  <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <Calendar className="h-4 w-4 text-primary" /> {t.dateLabel}
                  </span>
                  <span className="text-right text-sm font-semibold text-foreground">
                    {formattedDate}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <Clock className="h-4 w-4 text-primary" /> {t.timeLabel}
                  </span>
                  <span className="text-right text-base font-bold text-primary">
                    {booking.appointmentTime}
                  </span>
                </div>
              </div>

              {actionError && (
                <p className="mt-4 text-center text-sm text-destructive">{actionError}</p>
              )}

              {/* Large Mobile-Friendly Action Buttons */}
              <div className="mt-7 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <Button
                  type="button"
                  size="lg"
                  disabled={submittingAction !== null}
                  onClick={() => handleAction("confirm")}
                  className="h-14 w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-base font-semibold shadow-sm"
                >
                  {submittingAction === "confirm" ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5" />
                  )}
                  {t.confirmBtn}
                </Button>

                <Button
                  type="button"
                  size="lg"
                  variant="destructive"
                  disabled={submittingAction !== null}
                  onClick={() => handleAction("cancel")}
                  className="h-14 w-full gap-2 text-base font-semibold shadow-sm"
                >
                  {submittingAction === "cancel" ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <XCircle className="h-5 w-5" />
                  )}
                  {t.cancelBtn}
                </Button>
              </div>

              <div className="mt-6 border-t border-border pt-4 text-center text-xs text-muted-foreground">
                {t.contactPrompt}{" "}
                <a
                  href={clinic.contact.phoneHref}
                  className="font-semibold text-primary hover:underline"
                >
                  {clinic.contact.phone}
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
