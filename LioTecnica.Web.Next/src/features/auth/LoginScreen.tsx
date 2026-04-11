"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, Mail, Lock, ArrowRight } from "lucide-react";
import { ApiAutoLoginResponseSchema } from "@/lib/schemas/api";
import { setAccessToken, setTenantId, getAccessToken, tryGetRolesFromJwt, tryGetTenantIdFromJwt } from "@/lib/session";
import { apiFetch } from "@/lib/api";

import { Button } from "@/components/ui/button";
import RenderRHLogo from "@/components/brand/RenderRHLogo";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/* ─── Types ─── */

type HealthStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

type HealthCheckResponse = {
  status?: unknown;
  checks?: Array<{
    name?: unknown;
    status?: unknown;
  }>;
};

function normalizeStatus(value: unknown): HealthStatus {
  const s = String(value ?? "").trim().toLowerCase();
  if (s === "healthy") return "healthy";
  if (s === "degraded") return "degraded";
  if (s === "unhealthy") return "unhealthy";
  return "unknown";
}

/* ─── Health Dot ─── */

function HealthDot({ status, label }: { status: HealthStatus; label: string }) {
  const colors: Record<HealthStatus, string> = {
    healthy: "bg-emerald-500 shadow-emerald-500/40",
    degraded: "bg-amber-500 shadow-amber-500/40",
    unhealthy: "bg-red-500 shadow-red-500/40",
    unknown: "bg-slate-400 shadow-slate-400/20",
  };

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          "inline-block size-2 rounded-full shadow-[0_0_6px]",
          "transition-colors duration-500",
          colors[status],
        )}
        title={`${label}: ${status}`}
      />
      <span className="text-[11px] font-medium text-blue-200/60">{label}</span>
    </div>
  );
}

/* ─── Main Component ─── */

export default function LoginScreen({
  returnUrl,
}: {
  returnUrl?: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const BASE = "/app"; // basePath for UI routes/assets

  /* ─── Form State ─── */
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const resolvedReturnUrl = useMemo(
    () => returnUrl || sp.get("returnUrl") || "/dashboard",
    [returnUrl, sp],
  );

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  /* ─── Health ─── */
  const [apiStatus, setApiStatus] = useState<HealthStatus>("unknown");
  const [dbStatus, setDbStatus] = useState<HealthStatus>("unknown");

  useEffect(() => {
    async function updateHealth() {
      const endpoints = ["/api/health", "/health"];
      let fallbackStatus: { api: HealthStatus; db: HealthStatus } | null = null;
      for (const endpoint of endpoints) {
        try {
          const res = await apiFetch(endpoint, { headers: { Accept: "application/json" }, cache: "no-store" });
          const data = (await res.json().catch(() => null)) as HealthCheckResponse | null;
          if (!data) continue;

          const overall = normalizeStatus(data.status);
          const checks = Array.isArray(data.checks) ? data.checks : [];
          const dbCheck = checks.find((c) => {
            const name = String(c?.name ?? "").toLowerCase();
            return name === "database_master";
          }) ?? checks.find((c) => String(c?.name ?? "").toLowerCase() === "database");
          const db = dbCheck
            ? normalizeStatus(dbCheck.status)
            : (overall !== "unknown" ? overall : "unknown");

          if (res.ok) {
            // API "up" = endpoint respondeu com sucesso.
            setApiStatus("healthy");
            setDbStatus(db);
            return;
          }

          // Guarda status de fallback e tenta o próximo endpoint antes de concluir.
          fallbackStatus = {
            api: overall === "unknown" ? "unhealthy" : overall,
            db,
          };
        } catch {
          // tenta o próximo endpoint
        }
      }

      if (fallbackStatus) {
        setApiStatus(fallbackStatus.api);
        setDbStatus(fallbackStatus.db);
        return;
      }

      // Evita falso "vermelho" quando o endpoint de health não está exposto neste ambiente.
      setApiStatus("unknown");
      setDbStatus("unknown");
    }
    updateHealth();
    const t = window.setInterval(updateHealth, 30_000);
    return () => window.clearInterval(t);
  }, []);

  /* ─── Submit ─── */
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/auth/auto-login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setErrorMsg(json?.detail || json?.message || "Falha ao autenticar. Verifique suas credenciais.");
        return;
      }

      const parsed = ApiAutoLoginResponseSchema.safeParse(json);
      if (!parsed.success) {
        setErrorMsg("Resposta inválida da API.");
        return;
      }

      setAccessToken(parsed.data.accessToken);
      setTenantId(parsed.data.tenantId);

      // Redirect baseado no JWT (owner → /Owner/Tenants, tenant → /dashboard)
      const savedToken = getAccessToken();
      const isOwnerJwt = savedToken
        ? tryGetTenantIdFromJwt(savedToken)?.toLowerCase() === "owner" ||
          tryGetRolesFromJwt(savedToken).some((r) => r.toLowerCase() === "owner")
        : false;

      // Owners always go to /Owner/Tenants — ignore returnUrl, which is often
      // /dashboard (set by AuthGuard when an unauthenticated visit is intercepted).
      let redirectUrl = isOwnerJwt
        ? "/Owner/Tenants"
        : (resolvedReturnUrl || "/dashboard");
      if (redirectUrl.startsWith("/app/")) redirectUrl = redirectUrl.slice("/app".length);
      if (!redirectUrl.startsWith("/")) redirectUrl = `/${redirectUrl}`;
      router.replace(redirectUrl);
    } finally {
      setSubmitting(false);
    }
  }

  /* ─── Render ─── */
  return (
    <div className="relative min-h-dvh overflow-hidden">
      {/* ── Background layer ── */}
      <div className="absolute inset-0 -z-10 bg-[#f0f2f5]" />

      {/* ── Content grid ── */}
      <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-2" style={{ gridTemplateRows: "1fr auto" }}>
        {/* ── Left: Login Form ── */}
        <main className="flex items-center justify-center px-4 py-10 sm:px-8 lg:px-12">
          <div className="w-full max-w-[420px]">
            {/* Brand — anima de baixo para cima */}
            <div
              className="mb-8 animate-in fade-in slide-in-from-bottom-6 duration-700"
              style={{ animationFillMode: "both" }}
            >
              <div className="mb-4 text-xs font-semibold tracking-[0.25em] text-slate-500 uppercase">
                Bem-vindo ao
              </div>
              <div className="flex items-center gap-4">
                <RenderRHLogo variant="on-light" size={56} />
                <h1 className="text-4xl font-bold tracking-[0.22em] text-[#0C3A64] uppercase">
                  Render
                </h1>
              </div>
            </div>

            {/* Card — anima ligeiramente depois */}
            <div
              className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150"
              style={{ animationFillMode: "both" }}
            >
              <Card className="border-white/10 shadow-2xl shadow-black/30 backdrop-blur-sm" style={{ background: "linear-gradient(160deg, #0C3A64 0%, #105291 100%)" }}>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-bold text-white">Entrar</CardTitle>
                  <CardDescription className="text-blue-200/60">
                    Acesse o portal de gestão de pessoas e recrutamento.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <form className="space-y-4" onSubmit={onSubmit} id="loginForm">
                    {/* Email */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-1.5 text-sm font-medium text-blue-100/80" htmlFor="email">
                        <Mail className="size-3.5" />
                        Email
                      </label>
                      <Input
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="username"
                        inputMode="email"
                        placeholder="seu@email.com"
                        disabled={submitting}
                        className="border-white/15 bg-white/10 text-white placeholder:text-white/30 focus-visible:border-white/40 focus-visible:ring-white/10"
                      />
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-1.5 text-sm font-medium text-blue-100/80" htmlFor="password">
                        <Lock className="size-3.5" />
                        Senha
                      </label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          autoComplete="current-password"
                          placeholder="••••••••"
                          disabled={submitting}
                          className="border-white/15 bg-white/10 pr-10 text-white placeholder:text-white/30 focus-visible:border-white/40 focus-visible:ring-white/10"
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 transition-colors hover:text-white/70"
                          onClick={() => setShowPassword((p) => !p)}
                          tabIndex={-1}
                          aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
                        >
                          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Error */}
                    {errorMsg ? (
                      <div className="animate-in fade-in slide-in-from-top-1 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                        {errorMsg}
                      </div>
                    ) : null}

                    {/* Submit */}
                    <Button
                      type="submit"
                      className="w-full bg-white font-semibold text-[#0C3A64] shadow-md hover:bg-white/90 transition-colors disabled:opacity-60"
                      size="lg"
                      disabled={submitting}
                      id="loginSubmit"
                    >
                      {submitting ? (
                        <><Loader2 className="size-4 animate-spin" />Aguarde...</>
                      ) : (
                        <>Avançar<ArrowRight className="size-4" /></>
                      )}
                    </Button>
                  </form>
                </CardContent>

                <CardFooter className="justify-between border-t border-white/10 pt-4">
                  <div className="flex items-center gap-3">
                    <HealthDot status={apiStatus} label="API" />
                    <HealthDot status={dbStatus} label="DB" />
                  </div>
                  <div className="text-[10px] font-medium tracking-wider text-white/25 uppercase">
                    v2.5
                  </div>
                </CardFooter>
              </Card>
            </div>
          </div>
        </main>

        {/* ── Right: Hero (hidden on mobile) ── */}
        <aside className="relative hidden items-end justify-end p-8 lg:flex">
          <div
            className="animate-in fade-in slide-in-from-right-6 duration-1000 delay-300"
            style={{ animationFillMode: "both" }}
          >
            <div className="rounded-2xl border border-blue-200/60 bg-white/50 px-6 py-5 backdrop-blur-xl shadow-lg shadow-blue-200/30">
              <div className="mb-1 text-xs font-semibold tracking-[0.15em] text-blue-600/70 uppercase">
                Plataforma
              </div>
              <div className="text-lg font-semibold tracking-wide text-blue-900">
                Gestão de RH
              </div>
              <div className="mt-1 text-sm text-blue-700/60">
                Recrutamento · Feedback · Desempenho
              </div>
            </div>
          </div>
        </aside>

        {/* ── Footer ── */}
        <footer className="col-span-1 lg:col-span-2 py-4 text-center text-[11px] text-blue-800/40 select-none tracking-wide">
          © {new Date().getFullYear()} QUALIIT SOLUÇÕES EM TECNOLOGIA
        </footer>
      </div>
    </div>
  );
}
