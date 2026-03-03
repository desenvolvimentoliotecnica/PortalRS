"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiLoginResponseSchema } from "@/lib/schemas/api";
import { setAccessToken, setTenantId } from "@/lib/session";
import { apiFetch } from "@/lib/api";

type HealthStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

type HealthCheckResponse = {
  status?: unknown;
  checks?: Array<{
    name?: unknown;
    status?: unknown;
  }>;
};

function normalizeStatus(value: unknown): HealthStatus {
  const s = String(value ?? "")
    .trim()
    .toLowerCase();
  if (s === "healthy") return "healthy";
  if (s === "degraded") return "degraded";
  if (s === "unhealthy") return "unhealthy";
  return "unknown";
}

export default function LoginScreenRazor({
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

  // While Next runs with `basePath: "/app"`, browser requests must be prefixed with `/app`.
  // This keeps the login functional when accessing Next directly at :3000.
  const BASE = "/app";

  const [entraEnabled] = useState(false);
  const entraError = error || sp.get("error") || "";

  const [tenant, setTenant] = useState(tenantId ?? sp.get("tenantId") ?? "liotecnica");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const resolvedReturnUrl = useMemo(() => {
    const t = (tenant || tenantId || sp.get("tenantId") || "").trim().toLowerCase();
    if (t === "owner") return returnUrl || sp.get("returnUrl") || "/Owner/Tenants";
    return returnUrl || sp.get("returnUrl") || "/dashboard";
  }, [returnUrl, sp, tenant, tenantId]);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [apiStatus, setApiStatus] = useState<HealthStatus>("unknown");
  const [dbStatus, setDbStatus] = useState<HealthStatus>("unknown");

  useEffect(() => {
    // Entra ID config é privado no RHPortal.Api; mantém oculto aqui.
  }, [BASE]);

  async function updateHealth() {
    const endpoints = ["/api/health", "/health"];
    for (const endpoint of endpoints) {
      try {
        const res = await apiFetch(endpoint, { headers: { Accept: "application/json" }, cache: "no-store" });
        const data = (await res.json().catch(() => null)) as HealthCheckResponse | null;
        if (!data) continue;

        // API "up" = endpoint respondeu (mesmo se algum health check específico estiver degradado).
        setApiStatus("healthy");
        const checks = Array.isArray(data.checks) ? data.checks : [];
        const dbCheck = checks.find((c) => String(c?.name ?? "").toLowerCase() === "database_master")
          ?? checks.find((c) => String(c?.name ?? "").toLowerCase() === "database");
        setDbStatus(normalizeStatus(dbCheck?.status));
        return;
      } catch {
        // tenta próximo endpoint
      }
    }
    setApiStatus("unknown");
    setDbStatus("unknown");
  }

  useEffect(() => {
    updateHealth();
    const t = window.setInterval(updateHealth, 30_000);
    return () => window.clearInterval(t);
  }, []);

  function dotClass(status: HealthStatus) {
    return status === "healthy"
      ? "status-ok"
      : status === "degraded"
        ? "status-warn"
        : status === "unhealthy"
          ? "status-down"
          : "status-unknown";
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const t = (tenant || "").trim();
      const res = await apiFetch(`/api/auth/login`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Accept: "application/json",
          "X-Tenant-Id": t || "liotecnica",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setErrorMsg(json?.message || "Login failed. Check your credentials.");
        return;
      }

      const parsed = ApiLoginResponseSchema.safeParse(json);
      if (!parsed.success) {
        setErrorMsg("Resposta inválida da API no login.");
        return;
      }

      setAccessToken(parsed.data.accessToken);
      setTenantId(parsed.data.tenantId);

      let redirectUrl: string = resolvedReturnUrl || "/dashboard";
      if (redirectUrl.startsWith("/app/")) redirectUrl = redirectUrl.slice("/app".length);
      if (!redirectUrl.startsWith("/")) redirectUrl = `/${redirectUrl}`;
      router.replace(redirectUrl);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function onEntra() {
    const t = (tenant || "").trim();
    if (!t) {
      window.alert("Informe o tenant para entrar com Microsoft.");
      return;
    }
    window.alert("Login Microsoft (Entra ID) ainda não configurado nesta versão.");
  }

  const entraMessage =
    entraError === "tenant"
      ? "Tenant invalido para login Microsoft."
      : entraError === "entra"
        ? "Login Microsoft indisponivel. Configure o Entra ID."
        : entraError
          ? "Falha no login Microsoft."
          : "";

  return (
    <div className="login-shell">
      <section className="login-left">
        <div className="login-card">
          <div className="brand-mark">PORTAL RH</div>

          <form method="post" action="/Account/Login" id="loginForm" onSubmit={onSubmit}>
            <input type="hidden" name="ReturnUrl" value={resolvedReturnUrl} />

            <div className="mb-3">
              <label className="form-label" htmlFor="tenantIdInput">
                Tenant
              </label>
              <input
                className="form-control"
                id="tenantIdInput"
                name="TenantId"
                autoComplete="organization"
                value={tenant}
                placeholder="liotecnica ou owner"
                readOnly={submitting}
                onChange={(e) => setTenant(e.target.value)}
              />
              <div className="form-text">
                Use{" "}
                <button
                  type="button"
                  className="btn-link"
                  id="ownerLoginBtn"
                  onClick={() => setTenant("owner")}
                  disabled={submitting}
                >
                  Entrar como Owner
                </button>{" "}
                para acessar a área do proprietário.
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label" htmlFor="emailInput">
                Email
              </label>
              <input
                className="form-control"
                id="emailInput"
                name="Email"
                autoComplete="username"
                value={email}
                readOnly={submitting}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="mb-3">
              <label className="form-label" htmlFor="passwordInput">
                Password
              </label>
              <input
                className="form-control"
                id="passwordInput"
                name="Password"
                type="password"
                autoComplete="current-password"
                value={password}
                readOnly={submitting}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {errorMsg ? <div className="alert alert-danger py-2">{errorMsg}</div> : null}

            <button type="submit" className="btn-primary" id="loginSubmit" disabled={submitting}>
              {submitting ? (
                <span className="btn-loading">
                  <span className="spinner" aria-hidden="true" /> Aguarde...
                </span>
              ) : (
                "Avançar"
              )}
            </button>
          </form>

          {entraEnabled ? (
            <>
              <div className="divider">ou</div>
              <button
                type="button"
                className="btn-outline-secondary"
                id="entraLoginBtn"
                onClick={onEntra}
                disabled={submitting}
              >
                Entrar com Microsoft
              </button>
            </>
          ) : null}

          {entraMessage ? <div className="alert alert-warning py-2 mt-3">{entraMessage}</div> : null}

          <div className="d-flex align-items-center gap-2 mt-3 health-row" id="loginHealth" aria-live="polite">
            <span className="fw-semibold">API</span>
            <span className={`health-dot ${dotClass(apiStatus)}`} data-health="api" title={`API: ${apiStatus}`} />
            <span className="fw-semibold">DB</span>
            <span className={`health-dot ${dotClass(dbStatus)}`} data-health="db" title={`DB: ${dbStatus}`} />
          </div>
        </div>
      </section>

      <section className="login-right">
        <div className="login-hero" />
        <div className="hero-badge">LOGÍSTICA &amp; ALIMENTOS LIOFILIZADOS</div>
      </section>
    </div>
  );
}

