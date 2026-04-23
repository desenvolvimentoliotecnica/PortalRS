"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, Mail, Lock, ArrowRight, Building2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { ApiAutoLoginResponseSchema } from "@/lib/schemas/api";
import {
  setAccessToken,
  setTenantId,
  getAccessToken,
  tryGetRolesFromJwt,
  tryGetTenantIdFromJwt,
  getLastTenantSlug,
  setLastTenantSlug,
} from "@/lib/session";
import { apiFetch } from "@/lib/api";
import {
  applyBrandingDefaults,
  fetchPublicBranding,
  renderFooterText,
  type TenantBrandingPublic,
} from "@/lib/tenant-branding";

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

  /* ─── Branding / white-label (Sessão 29) ───
   * Resolvemos o slug do tenant primeiro por ?tenant= (usado em links compartilhados
   * tipo liotecnica.render-rh.com/app/login?tenant=liotecnica), e caímos para
   * localStorage.lastTenantSlug (persistido após login anterior). Se nada disso
   * existir, a tela renderiza com os defaults da plataforma.
   */
  const [branding, setBranding] = useState<TenantBrandingPublic | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fromQuery = sp.get("tenant")?.trim().toLowerCase() || null;
    const fromStorage = getLastTenantSlug();
    const slug = fromQuery || fromStorage;
    if (!slug) return;
    void fetchPublicBranding(slug).then((b) => setBranding(b));
  }, [sp]);

  const ui = useMemo(() => applyBrandingDefaults(branding), [branding]);
  const footerText = useMemo(() => renderFooterText(ui.rodapeTexto), [ui.rodapeTexto]);
  const cardGradient = useMemo(
    () => `linear-gradient(160deg, ${ui.corPrimariaHex} 0%, ${ui.corSecundariaHex} 100%)`,
    [ui.corPrimariaHex, ui.corSecundariaHex],
  );
  const logoGradient = useMemo(
    () => `linear-gradient(to bottom right, ${ui.corPrimariaHex}, ${ui.corSecundariaHex})`,
    [ui.corPrimariaHex, ui.corSecundariaHex],
  );

  /* ─── Entra ID (SSO Microsoft) — Fase 13.2 ─── */
  const [entraOpen, setEntraOpen] = useState(false);
  const [entraTenant, setEntraTenant] = useState("");
  const [entraEnabled, setEntraEnabled] = useState(false);
  const [entraClientId, setEntraClientId] = useState<string | null>(null);
  const [entraChecking, setEntraChecking] = useState(false);
  const entraDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ─── Entra ID callback: processa #entra_token=...&tenant=...&return=... ─── */
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Erros vindos da query string do callback (?entra_error=...).
    const err = sp.get("entra_error");
    if (err) {
      const msgs: Record<string, string> = {
        nao_configurado: "SSO Microsoft não configurado para este tenant.",
        state_invalido: "Sessão de SSO expirou. Tente novamente.",
        troca_de_code_falhou: "Falha ao trocar o código com a Microsoft.",
        usuario_nao_autenticado: "Usuário do Microsoft não está cadastrado neste tenant.",
        parametros_invalidos: "Parâmetros inválidos no retorno do SSO.",
      };
      setErrorMsg(msgs[err] ?? `Falha no SSO (${err}).`);
    }

    const hash = window.location.hash;
    if (!hash.startsWith("#")) return;
    const params = new URLSearchParams(hash.substring(1));
    const tk = params.get("entra_token");
    const tid = params.get("tenant");
    const rtn = params.get("return");
    if (!tk || !tid) return;

    // Aplica sessão e redireciona. O fragmento é limpo pelo router.replace.
    setAccessToken(tk);
    setTenantId(tid);
    let redirect = rtn && rtn.startsWith("/") ? rtn : "/dashboard";
    if (redirect.startsWith("/app/")) redirect = redirect.slice("/app".length);
    router.replace(redirect);
  }, [router, sp]);

  /* ─── Entra ID: checa se o tenant digitado tem SSO habilitado (debounced) ─── */
  useEffect(() => {
    const t = entraTenant.trim();
    if (entraDebounce.current) clearTimeout(entraDebounce.current);
    if (!t) {
      setEntraEnabled(false);
      setEntraClientId(null);
      setEntraChecking(false);
      return;
    }
    setEntraChecking(true);
    entraDebounce.current = setTimeout(async () => {
      try {
        const res = await apiFetch(
          `/api/auth/entra/enabled?tenantId=${encodeURIComponent(t)}`,
          { cache: "no-store" },
        );
        const json = await res.json().catch(() => null);
        if (json && typeof json === "object") {
          setEntraEnabled(Boolean((json as { enabled?: unknown }).enabled));
          const cid = (json as { clientId?: unknown }).clientId;
          setEntraClientId(typeof cid === "string" ? cid : null);
        } else {
          setEntraEnabled(false);
          setEntraClientId(null);
        }
      } catch {
        setEntraEnabled(false);
        setEntraClientId(null);
      } finally {
        setEntraChecking(false);
      }
    }, 350);
    return () => {
      if (entraDebounce.current) clearTimeout(entraDebounce.current);
    };
  }, [entraTenant]);

  function onEntraClick() {
    const t = entraTenant.trim();
    if (!t || !entraEnabled) return;
    // Static export: precisamos ir direto para o host da API, não passa por basePath /app.
    // O apiFetch já resolve NEXT_PUBLIC_API_BASE; aqui o navegador precisa seguir o Redirect.
    const url =
      `/api/auth/entra/challenge` +
      `?tenantId=${encodeURIComponent(t)}` +
      `&returnUrl=${encodeURIComponent(resolvedReturnUrl || "/dashboard")}`;
    window.location.assign(url);
  }

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
      // Persiste o slug do tenant para que a próxima visita à tela de login
      // já carregue o branding correto (sem depender de ?tenant= na URL).
      if (parsed.data.tenantId && parsed.data.tenantId.toLowerCase() !== "owner") {
        setLastTenantSlug(parsed.data.tenantId);
      }

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
            {/* Header — anima de baixo para cima */}
            <div
              className="mb-8 animate-in fade-in slide-in-from-bottom-6 duration-700"
              style={{ animationFillMode: "both" }}
            >
              <div className="mb-3 text-[11px] font-semibold tracking-[0.28em] text-slate-500 uppercase">
                Acesso ao sistema
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="flex size-12 items-center justify-center rounded-xl shadow-lg shadow-blue-900/20 overflow-hidden"
                  style={{ background: logoGradient }}
                >
                  {ui.logoUrl ? (
                    // Logo customizada do tenant. `unoptimized` pra permitir
                    // URLs externas sem ter que configurar next.config.images.domains.
                    <Image
                      src={ui.logoUrl}
                      alt={ui.nomePortal}
                      width={48}
                      height={48}
                      unoptimized
                      className="size-full object-contain"
                    />
                  ) : (
                    <Building2 className="size-6 text-white" strokeWidth={2.25} />
                  )}
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-800">
                    {ui.nomePortal}
                  </h1>
                  <p className="text-xs text-slate-500">
                    {ui.subtitulo}
                  </p>
                </div>
              </div>
            </div>

            {/* Card — anima ligeiramente depois */}
            <div
              className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150"
              style={{ animationFillMode: "both" }}
            >
              <Card className="border-white/10 shadow-2xl shadow-black/30 backdrop-blur-sm" style={{ background: cardGradient }}>
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
                      className="w-full bg-white font-semibold shadow-md hover:bg-white/90 transition-colors disabled:opacity-60"
                      size="lg"
                      disabled={submitting}
                      id="loginSubmit"
                      style={{ color: ui.corPrimariaHex }}
                    >
                      {submitting ? (
                        <><Loader2 className="size-4 animate-spin" />Aguarde...</>
                      ) : (
                        <>Avançar<ArrowRight className="size-4" /></>
                      )}
                    </Button>
                  </form>

                  {/* ── SSO Microsoft (Entra ID) — Fase 13.2 ── */}
                  <div className="mt-5 border-t border-white/10 pt-4">
                    {!entraOpen ? (
                      <button
                        type="button"
                        className="text-xs font-medium text-blue-200/70 underline-offset-2 hover:text-white hover:underline"
                        onClick={() => setEntraOpen(true)}
                      >
                        Entrar com Microsoft (SSO)
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <label
                          htmlFor="entraTenant"
                          className="flex items-center justify-between text-xs font-medium text-blue-100/80"
                        >
                          <span>Tenant para SSO</span>
                          <button
                            type="button"
                            className="text-[10px] font-normal text-blue-200/60 hover:text-white"
                            onClick={() => {
                              setEntraOpen(false);
                              setEntraTenant("");
                            }}
                          >
                            fechar
                          </button>
                        </label>
                        <Input
                          id="entraTenant"
                          value={entraTenant}
                          onChange={(e) => setEntraTenant(e.target.value)}
                          placeholder="ex.: liotecnica"
                          autoCapitalize="none"
                          autoCorrect="off"
                          disabled={submitting}
                          className="border-white/15 bg-white/10 text-white placeholder:text-white/30 focus-visible:border-white/40 focus-visible:ring-white/10"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full border-white/25 bg-white/5 font-medium text-white hover:bg-white/15 disabled:opacity-50"
                          disabled={submitting || entraChecking || !entraEnabled}
                          onClick={onEntraClick}
                        >
                          {entraChecking ? (
                            <><Loader2 className="size-4 animate-spin" /> Verificando tenant…</>
                          ) : entraEnabled ? (
                            <>Entrar com Microsoft</>
                          ) : entraTenant.trim() ? (
                            <>SSO não habilitado para este tenant</>
                          ) : (
                            <>Informe o tenant</>
                          )}
                        </Button>
                        {entraEnabled && entraClientId ? (
                          <p className="text-[10px] text-blue-200/40">
                            Client ID: <span className="font-mono">{entraClientId}</span>
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>
                </CardContent>

                <CardFooter className="justify-between border-t border-white/10 pt-4">
                  <div className="flex items-center gap-3">
                    <HealthDot status={apiStatus} label="API" />
                    <HealthDot status={dbStatus} label="DB" />
                  </div>
                  <div className="text-[10px] font-medium tracking-wider text-white/25 uppercase">
                    {ui.versaoExibida}
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
        <footer className="col-span-1 lg:col-span-2 flex flex-col items-center gap-1 py-4 text-center text-[11px] text-slate-500/70 select-none tracking-wide">
          <div>{footerText}</div>
          <Link
            href={`${BASE}/privacidade`}
            className="text-slate-500/80 underline-offset-2 hover:text-slate-700 hover:underline"
          >
            Política de Privacidade (LGPD)
          </Link>
        </footer>
      </div>
    </div>
  );
}
