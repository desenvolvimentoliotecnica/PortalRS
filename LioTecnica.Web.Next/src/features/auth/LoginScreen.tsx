"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, Building2, Mail, Lock, ArrowRight, Monitor } from "lucide-react";
import { ApiLoginResponseSchema, ApiOwnerLoginResponseSchema } from "@/lib/schemas/api";
import { setAccessToken, setTenantId, getAccessToken, tryGetRolesFromJwt, tryGetTenantIdFromJwt } from "@/lib/session";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
      <span className="text-[11px] font-medium text-muted-foreground/70">{label}</span>
    </div>
  );
}

/* ─── Main Component ─── */

export default function LoginScreen({
  returnUrl,
  error,
  tenantId,
}: {
  returnUrl?: string;
  error?: string;
  tenantId?: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const BASE = "/app"; // basePath for UI routes/assets

  /* ─── Entra ID ─── */
  const [entraEnabled, setEntraEnabled] = useState(false);
  const entraError = error || sp.get("error") || "";

  /* ─── Form State ─── */
  const [tenant, setTenant] = useState(tenantId ?? sp.get("tenantId") ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const resolvedReturnUrl = useMemo(() => {
    const t = (tenant || tenantId || sp.get("tenantId") || "").trim().toLowerCase();
    if (t === "owner") return returnUrl || sp.get("returnUrl") || "/Owner/Tenants";
    return returnUrl || sp.get("returnUrl") || "/dashboard";
  }, [returnUrl, sp, tenant, tenantId]);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  /* ─── Health ─── */
  const [apiStatus, setApiStatus] = useState<HealthStatus>("unknown");
  const [dbStatus, setDbStatus] = useState<HealthStatus>("unknown");

  useEffect(() => {
    let alive = true;
    apiFetch("/bff/auth/config", { cache: "no-store" })
      .then((res) => res.json().catch(() => null))
      .then((data) => {
        if (!alive) return;
        setEntraEnabled(Boolean(data?.entraEnabled));
      })
      .catch(() => {
        if (!alive) return;
        setEntraEnabled(false);
      });
    return () => {
      alive = false;
    };
  }, []);

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

  /* ─── Entra error message ─── */
  const entraMessage =
    entraError === "tenant"
      ? "Tenant inválido para login Microsoft."
      : entraError === "entra"
        ? "Login Microsoft indisponível. Configure o Entra ID."
        : entraError
          ? "Falha no login Microsoft."
          : "";

  /* ─── Submit ─── */
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const t = (tenant || "").trim();
      const isOwner = t.toLowerCase() === "owner";
      const res = await apiFetch(isOwner ? `/api/owner/auth/login` : `/api/auth/login`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Accept: "application/json",
          ...(isOwner ? {} : { "X-Tenant-Id": t }),
        },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setErrorMsg(json?.detail || json?.message || "Falha ao autenticar. Verifique suas credenciais.");
        return;
      }

      if (isOwner) {
        const parsed = ApiOwnerLoginResponseSchema.safeParse(json);
        if (!parsed.success) {
          setErrorMsg("Resposta inválida da API no login (owner).");
          return;
        }
        setAccessToken(parsed.data.accessToken);
        setTenantId("owner");
      } else {
        const parsed = ApiLoginResponseSchema.safeParse(json);
        if (!parsed.success) {
          setErrorMsg("Resposta inválida da API no login.");
          return;
        }
        setAccessToken(parsed.data.accessToken);
        setTenantId(parsed.data.tenantId);
      }

      // Determinar redirect com base no JWT recebido (não no campo digitado)
      const savedToken = getAccessToken();
      const isOwnerJwt = savedToken
        ? tryGetTenantIdFromJwt(savedToken)?.toLowerCase() === "owner" ||
          tryGetRolesFromJwt(savedToken).some((r) => r.toLowerCase() === "owner")
        : false;

      let redirectUrl: string = (isOwner || isOwnerJwt)
        ? (returnUrl || sp.get("returnUrl") || "/Owner/Tenants")
        : (resolvedReturnUrl || "/dashboard");
      if (redirectUrl.startsWith("/app/")) redirectUrl = redirectUrl.slice("/app".length);
      if (!redirectUrl.startsWith("/")) redirectUrl = `/${redirectUrl}`;
      router.replace(redirectUrl);
    } finally {
      setSubmitting(false);
    }
  }

  /* ─── Entra login ─── */
  function onEntra() {
    const t = (tenant || "").trim();
    if (!t) {
      toast.warning("Informe o tenant para entrar com Microsoft.");
      return;
    }
    if (t.toLowerCase() === "owner") {
      toast.warning("Login Microsoft não está disponível para o tenant owner.");
      return;
    }
    const qp = new URLSearchParams();
    qp.set("tenantId", t.toLowerCase());
    qp.set("returnUrl", resolvedReturnUrl || "/dashboard");
    window.location.href = `/bff/auth/entra-login?${qp.toString()}`;
  }

  /* ─── Render ─── */
  return (
    <div className="relative min-h-dvh overflow-hidden">
      {/* ── Background layer ── */}
      <div className="absolute inset-0 -z-10">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800" />
        {/* Subtle pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      {/* ── Content grid ── */}
      <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-2">
        {/* ── Left: Login Form ── */}
        <main className="flex items-center justify-center px-4 py-10 sm:px-8 lg:px-12">
          <div className="w-full max-w-[420px] animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Brand */}
            <div className="mb-8">
              <div className="mb-2 text-sm font-semibold tracking-[0.2em] text-white/60 uppercase">
                Bem-vindo ao
              </div>
              <h1 className="text-3xl font-bold tracking-[0.18em] text-white sm:text-4xl">
                PORTAL RH
              </h1>
            </div>

            {/* Card */}
            <Card className="border-white/10 bg-white/[0.07] shadow-2xl shadow-black/20 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-lg text-white">Entrar</CardTitle>
                <CardDescription className="text-white/50">
                  Acesse o portal de gestão de pessoas e recrutamento.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form className="space-y-4" onSubmit={onSubmit} id="loginForm">
                  {/* Tenant */}
                  <div className="space-y-2">
                    <label
                      className="flex items-center gap-1.5 text-sm font-medium text-white/80"
                      htmlFor="tenant"
                    >
                      <Building2 className="size-3.5" />
                      Tenant
                    </label>
                    <Input
                      id="tenant"
                      value={tenant}
                      onChange={(e) => setTenant(e.target.value)}
                      autoComplete="organization"
                      placeholder="nome do tenant"
                      disabled={submitting}
                      className="border-white/15 bg-white/10 text-white placeholder:text-white/30 focus-visible:border-white/30 focus-visible:ring-white/20"
                    />
                    <p className="text-xs text-white/40">
                      Use{" "}
                      <button
                        className="text-white/70 underline underline-offset-2 transition-colors hover:text-white"
                        type="button"
                        onClick={() => setTenant("owner")}
                        disabled={submitting}
                      >
                        Entrar como Owner
                      </button>{" "}
                      para acessar a área do proprietário.
                    </p>
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <label
                      className="flex items-center gap-1.5 text-sm font-medium text-white/80"
                      htmlFor="email"
                    >
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
                      className="border-white/15 bg-white/10 text-white placeholder:text-white/30 focus-visible:border-white/30 focus-visible:ring-white/20"
                    />
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <label
                      className="flex items-center gap-1.5 text-sm font-medium text-white/80"
                      htmlFor="password"
                    >
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
                        className="border-white/15 bg-white/10 pr-10 text-white placeholder:text-white/30 focus-visible:border-white/30 focus-visible:ring-white/20"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 transition-colors hover:text-white/70"
                        onClick={() => setShowPassword((p) => !p)}
                        tabIndex={-1}
                        aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
                      >
                        {showPassword ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Error */}
                  {errorMsg ? (
                    <div className="animate-in fade-in slide-in-from-top-1 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                      {errorMsg}
                    </div>
                  ) : null}

                  {/* Submit */}
                  <Button
                    type="submit"
                    className="w-full bg-white font-semibold text-[rgb(var(--lt-primary))] shadow-lg shadow-black/10 transition-all hover:bg-white/90 hover:shadow-xl disabled:opacity-60"
                    size="lg"
                    disabled={submitting}
                    id="loginSubmit"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Aguarde...
                      </>
                    ) : (
                      <>
                        Avançar
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>
                </form>

                {/* Entra ID */}
                {entraEnabled ? (
                  <>
                    <div className="my-5 flex items-center gap-3">
                      <div className="h-px flex-1 bg-white/10" />
                      <span className="text-xs font-medium text-white/30">ou</span>
                      <div className="h-px flex-1 bg-white/10" />
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                      onClick={onEntra}
                      disabled={submitting}
                      id="entraLoginBtn"
                    >
                      <Monitor className="size-4" />
                      Entrar com Microsoft
                    </Button>
                  </>
                ) : null}

                {/* Entra Error */}
                {entraMessage ? (
                  <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                    {entraMessage}
                  </div>
                ) : null}
              </CardContent>

              <CardFooter className="justify-between border-t border-white/8 pt-4">
                <div className="flex items-center gap-3">
                  <HealthDot status={apiStatus} label="API" />
                  <HealthDot status={dbStatus} label="DB" />
                </div>
                <div className="text-[10px] font-medium tracking-wider text-white/20 uppercase">
                  v2.1
                </div>
              </CardFooter>
            </Card>
          </div>
        </main>

        {/* ── Right: Hero (hidden on mobile) ── */}
        <aside className="relative hidden items-end justify-end p-8 lg:flex">
          {/* Content at bottom-right */}
          <div className="animate-in fade-in slide-in-from-right-4 duration-1000 delay-300">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-6 py-5 backdrop-blur-lg">
              <div className="mb-1 text-xs font-semibold tracking-[0.15em] text-white/40 uppercase">
                Plataforma
              </div>
              <div className="text-lg font-semibold tracking-wide text-white/90">
                Gestão de RH
              </div>
              <div className="mt-1 text-sm text-white/50">
                Recrutamento · Feedback · Desempenho
              </div>
            </div>

          </div>
        </aside>
      </div>
    </div>
  );
}
