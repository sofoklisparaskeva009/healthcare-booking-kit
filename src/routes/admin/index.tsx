import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  getAdminBookings,
  updateBookingStatus,
  deleteBooking,
  type AdminBooking,
} from "@/lib/admin.functions";
import { ADMIN_TOKEN_KEY, ADMIN_EMAIL_KEY } from "./login";
import { clinicConfig } from "@/config/clinicConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Calendar,
  Clock,
  Phone,
  Mail,
  Search,
  CheckCircle2,
  XCircle,
  Trash2,
  LogOut,
  Loader2,
  ArrowUpDown,
  Stethoscope,
  Filter,
  FileText,
  ExternalLink,
  Euro,
} from "lucide-react";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: `Διαχείριση Ραντεβού — ${clinicConfig.doctor.name}` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const navigate = useNavigate();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const handleLogout = useCallback(() => {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    window.localStorage.removeItem(ADMIN_EMAIL_KEY);
    navigate({ to: "/admin/login" });
  }, [navigate]);

  const loadData = useCallback(
    async (tokenArg?: string) => {
      const token = tokenArg ?? accessToken ?? window.localStorage.getItem(ADMIN_TOKEN_KEY);
      if (!token) {
        handleLogout();
        return;
      }

      setLoading(true);
      try {
        const res = await getAdminBookings({ data: { accessToken: token } });
        if (res.unauthorized) {
          handleLogout();
          return;
        }
        if (res.ok) {
          setBookings(res.bookings);
        }
      } catch (err) {
        console.error("Failed to load admin bookings:", err);
      } finally {
        setLoading(false);
        setCheckingAuth(false);
      }
    },
    [accessToken, handleLogout],
  );

  useEffect(() => {
    const storedToken = window.localStorage.getItem(ADMIN_TOKEN_KEY);
    if (!storedToken) {
      navigate({ to: "/admin/login" });
      return;
    }
    setAccessToken(storedToken);
    loadData(storedToken);
  }, [navigate, loadData]);

  const handleStatusChange = async (
    bookingId: string,
    newStatus: "confirmed" | "cancelled" | "pending",
  ) => {
    if (!accessToken) return;
    setActionId(bookingId);
    try {
      const res = await updateBookingStatus({
        data: { accessToken, bookingId, newStatus },
      });
      if ((res as { unauthorized?: boolean }).unauthorized) {
        handleLogout();
        return;
      }
      if (res.ok) {
        setBookings((prev) =>
          prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b)),
        );
      }
    } catch (err) {
      console.error("Status update error:", err);
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (bookingId: string) => {
    if (!accessToken) return;
    if (!window.confirm("Είστε βέβαιοι ότι θέλετε να διαγράψετε οριστικά αυτή την κράτηση;")) {
      return;
    }
    setActionId(bookingId);
    try {
      const res = await deleteBooking({ data: { accessToken, bookingId } });
      if ((res as { unauthorized?: boolean }).unauthorized) {
        handleLogout();
        return;
      }
      if (res.ok) {
        setBookings((prev) => prev.filter((b) => b.id !== bookingId));
      }
    } catch (err) {
      console.error("Delete error:", err);
    } finally {
      setActionId(null);
    }
  };

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const query = search.toLowerCase().trim();
      const matchesSearch =
        !query ||
        b.full_name.toLowerCase().includes(query) ||
        b.phone.includes(query) ||
        b.email.toLowerCase().includes(query) ||
        b.service_name.toLowerCase().includes(query) ||
        b.appointment_date.includes(query);

      const matchesStatus = statusFilter === "all" || b.status === statusFilter;
      const matchesType = typeFilter === "all" || b.appointment_type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [bookings, search, statusFilter, typeFilter]);

  const stats = useMemo(() => {
    return {
      total: bookings.length,
      pending: bookings.filter((b) => b.status === "pending").length,
      confirmed: bookings.filter((b) => b.status === "confirmed").length,
      cancelled: bookings.filter((b) => b.status === "cancelled").length,
    };
  }, [bookings]);

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-lg font-bold text-foreground">
                  Διαχείριση Ραντεβού
                </h1>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                  Admin
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{clinicConfig.doctor.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Προβολή Ιστοσελίδας <ExternalLink className="h-3 w-3" />
            </a>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="gap-1.5 text-xs h-9"
            >
              <LogOut className="h-3.5 w-3.5" />
              Αποσύνδεση
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 sm:px-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 mb-6">
          <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
            <p className="text-xs font-medium text-muted-foreground">Σύνολο Ραντεβού</p>
            <p className="mt-1 font-display text-2xl font-bold text-foreground">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-2xs">
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Εκκρεμή</p>
            <p className="mt-1 font-display text-2xl font-bold text-amber-600 dark:text-amber-400">
              {stats.pending}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-2xs">
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Επιβεβαιωμένα
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats.confirmed}
            </p>
          </div>
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 shadow-2xs">
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400">Ακυρωμένα</p>
            <p className="mt-1 font-display text-2xl font-bold text-rose-600 dark:text-rose-400">
              {stats.cancelled}
            </p>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Αναζήτηση με όνομα, τηλέφωνο, email, υπηρεσία..."
              className="pl-9 h-9 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
              <Filter className="h-3.5 w-3.5" /> Φίλτρα:
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            >
              <option value="all">Όλες οι καταστάσεις</option>
              <option value="pending">Εκκρεμή</option>
              <option value="confirmed">Επιβεβαιωμένα</option>
              <option value="cancelled">Ακυρωμένα</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            >
              <option value="all">Όλοι οι τύποι</option>
              <option value="gesy">ΓεΣΥ</option>
              <option value="private">Ιδιωτικά</option>
            </select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData()}
              disabled={loading}
              className="h-9 text-xs"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowUpDown className="h-3.5 w-3.5" />
              )}
              Ανανέωση
            </Button>
          </div>
        </div>

        {/* Bookings Table / Cards */}
        {loading && bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <p className="text-sm text-muted-foreground">Φόρτωση κρατήσεων...</p>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <Calendar className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="font-display text-base font-semibold text-foreground">
              Δεν βρέθηκαν ραντεβού
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              {search || statusFilter !== "all" || typeFilter !== "all"
                ? "Δεν υπάρχουν εγγραφές που να ταιριάζουν με τα συγκεκριμένα κριτήρια αναζήτησης."
                : "Δεν έχουν καταχωρηθεί ακόμη κρατήσεις στο σύστημα."}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="py-3 px-4">Ασθενής</th>
                    <th className="py-3 px-4">Υπηρεσία</th>
                    <th className="py-3 px-4">Ημερομηνία & Ώρα</th>
                    <th className="py-3 px-4">Κατηγορία</th>
                    <th className="py-3 px-4">Κατάσταση</th>
                    <th className="py-3 px-4 text-right">Ενέργειες</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredBookings.map((b) => {
                    const isProcessing = actionId === b.id;
                    const isGesy = b.appointment_type === "gesy";
                    return (
                      <tr
                        key={b.id}
                        className="hover:bg-secondary/20 transition-colors duration-150"
                      >
                        {/* Patient info */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="font-semibold text-foreground">{b.full_name}</div>
                          <div className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
                            {b.phone && (
                              <a
                                href={`tel:${b.phone}`}
                                className="inline-flex items-center gap-1 hover:text-primary transition-colors"
                              >
                                <Phone className="h-3 w-3" /> {b.phone}
                              </a>
                            )}
                            {b.email && (
                              <a
                                href={`mailto:${b.email}`}
                                className="inline-flex items-center gap-1 hover:text-primary transition-colors truncate max-w-[200px]"
                              >
                                <Mail className="h-3 w-3" /> {b.email}
                              </a>
                            )}
                          </div>
                          {b.notes && (
                            <div className="mt-2 text-xs italic text-muted-foreground/90 bg-secondary/50 rounded-md p-1.5 flex gap-1 items-start">
                              <FileText className="h-3 w-3 shrink-0 mt-0.5 text-primary" />
                              <span className="line-clamp-2">{b.notes}</span>
                            </div>
                          )}
                        </td>

                        {/* Service */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="font-medium text-foreground">{b.service_name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {b.duration_minutes} λεπτά
                          </div>
                        </td>

                        {/* Date & Time */}
                        <td className="py-3.5 px-4 align-top whitespace-nowrap">
                          <div className="flex items-center gap-1.5 font-medium text-foreground">
                            <Calendar className="h-3.5 w-3.5 text-primary" />
                            {b.appointment_date}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            {b.appointment_time}
                          </div>
                        </td>

                        {/* Category & Fee */}
                        <td className="py-3.5 px-4 align-top whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              isGesy
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-primary/10 text-primary"
                            }`}
                          >
                            {isGesy ? "ΓεΣΥ" : "Ιδιωτικό"}
                          </span>
                          {!isGesy && b.private_fee_eur !== null && (
                            <div className="mt-1 text-xs font-semibold text-foreground flex items-center gap-0.5">
                              <Euro className="h-3 w-3" /> {b.private_fee_eur}
                            </div>
                          )}
                        </td>

                        {/* Status badge */}
                        <td className="py-3.5 px-4 align-top whitespace-nowrap">
                          {b.status === "confirmed" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Επιβεβαιωμένο
                            </span>
                          )}
                          {b.status === "pending" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                              <Clock className="h-3.5 w-3.5" /> Εκκρεμές
                            </span>
                          )}
                          {b.status === "cancelled" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-1 text-xs font-medium text-rose-700 dark:text-rose-300">
                              <XCircle className="h-3.5 w-3.5" /> Ακυρωμένο
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            {b.status !== "confirmed" && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isProcessing}
                                onClick={() => handleStatusChange(b.id, "confirmed")}
                                className="h-8 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 border-emerald-500/30"
                                title="Αποδοχή / Επιβεβαίωση"
                              >
                                {isProcessing ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                )}
                                Αποδοχή
                              </Button>
                            )}

                            {b.status !== "cancelled" && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isProcessing}
                                onClick={() => handleStatusChange(b.id, "cancelled")}
                                className="h-8 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 border-amber-500/30"
                                title="Ακύρωση ραντεβού"
                              >
                                {isProcessing ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <XCircle className="h-3.5 w-3.5 mr-1" />
                                )}
                                Ακύρωση
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={isProcessing}
                              onClick={() => handleDelete(b.id)}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10"
                              title="Οριστική Διαγραφή"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
