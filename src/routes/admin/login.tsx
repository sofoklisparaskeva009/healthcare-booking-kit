import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { adminLogin, verifyAdminSession } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Stethoscope, Lock, Mail, Loader2, ArrowLeft } from "lucide-react";
import { clinicConfig } from "@/config/clinicConfig";

export const ADMIN_TOKEN_KEY = "clinic.admin.access_token";
export const ADMIN_EMAIL_KEY = "clinic.admin.email";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: `Σύνδεση Διαχειριστή — ${clinicConfig.doctor.name}` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const existingToken = window.localStorage.getItem(ADMIN_TOKEN_KEY);
    if (!existingToken) {
      setCheckingAuth(false);
      return;
    }

    verifyAdminSession({ data: { accessToken: existingToken } })
      .then((res) => {
        if (res.ok) {
          navigate({ to: "/admin" });
        } else {
          window.localStorage.removeItem(ADMIN_TOKEN_KEY);
          window.localStorage.removeItem(ADMIN_EMAIL_KEY);
          setCheckingAuth(false);
        }
      })
      .catch(() => {
        setCheckingAuth(false);
      });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    try {
      const res = await adminLogin({
        data: {
          email: email.trim(),
          password,
        },
      });

      if (!res.ok) {
        setErrorMsg(res.error);
      } else {
        window.localStorage.setItem(ADMIN_TOKEN_KEY, res.accessToken);
        window.localStorage.setItem(ADMIN_EMAIL_KEY, res.user.email);
        navigate({ to: "/admin" });
      }
    } catch (err: any) {
      console.error("[AdminLogin] Server action error:", err);
      setErrorMsg("Προέκυψε σφάλμα κατά τη σύνδεση. Παρακαλώ δοκιμάστε ξανά.");
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Επιστροφή στην ιστοσελίδα
          </a>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
            <Stethoscope className="h-7 w-7" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Πίνακας Διαχείρισης
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {clinicConfig.doctor.name} · Σύνδεση με λογαριασμό διαχειριστή
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-elegant">
          <form onSubmit={handleSubmit} className="space-y-5">
            {errorMsg && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive font-medium">
                {errorMsg}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@clinic.com"
                  className="pl-9"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Κωδικός πρόσβασης</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-9"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Σύνδεση
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Προστατευμένη περιοχή μόνο για εξουσιοδοτημένο προσωπικό της κλινικής.
        </p>
      </div>
    </div>
  );
}
