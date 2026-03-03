"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { clearPortalCandidateSession, portalAuthFetch, savePortalCandidateSession } from "@/features/portalvagas/publicApi";
import { toast } from "sonner";

type Mode = "login" | "register";
type Locale = "pt-BR" | "en-US";

const HELP_STEPS: Record<Locale, string[]> = {
  "pt-BR": ["Cadastro rápido e perfil único.", "Triagem e retorno em até 5 dias.", "Entrevista com gestor.", "Proposta e onboarding."],
  "en-US": ["Quick registration and unique profile.", "Screening and feedback within 5 days.", "Interview with manager.", "Offer and onboarding."],
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const UF_LIST = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"];

export default function PortalVagasAccessScreen() {
  const searchParams = useSearchParams();
  const tenantId = (searchParams.get("tenantId") || "").trim();

  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [locale, setLocale] = useState<Locale>("pt-BR");

  const [login, setLogin] = useState({ email: "", password: "" });
  const [register, setRegister] = useState({
    nome: "",
    email: "",
    fone: "",
    uf: "",
    cidade: "",
    password: "",
    passwordConfirm: "",
  });

  async function doLogin() {
    if (!tenantId) {
      toast.error("Tenant não informado. Use o link enviado pelo RH.");
      return;
    }
    if (!EMAIL_REGEX.test(login.email)) {
      toast.error("E-mail inválido.");
      return;
    }
    if (!login.password) {
      toast.error("Informe a senha.");
      return;
    }
    setLoading(true);
    try {
      const res = await portalAuthFetch(tenantId, "/api/public/portal-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: login.email.trim(),
          password: login.password,
        }),
      });
      const data = await res.json().catch(() => null) as { id?: string; nome?: string; email?: string; redirectUrl?: string; message?: string } | null;
      if (!res.ok) {
        clearPortalCandidateSession(tenantId);
        toast.error(data?.message || "Falha ao entrar.");
        return;
      }
      if (!data?.id) {
        toast.error("Resposta inválida de autenticação.");
        return;
      }
      savePortalCandidateSession({ tenantId, id: String(data.id), nome: data.nome, email: data.email });
      window.location.href = data?.redirectUrl || `/app/PortalVagas?tenantId=${encodeURIComponent(tenantId)}`;
    } catch {
      toast.error("Falha ao entrar.");
    } finally {
      setLoading(false);
    }
  }

  async function doRegister() {
    if (!tenantId) {
      toast.error("Tenant não informado. Use o link enviado pelo RH.");
      return;
    }
    if (!register.nome.trim()) {
      toast.error("Informe o nome completo.");
      return;
    }
    if (!EMAIL_REGEX.test(register.email)) {
      toast.error("E-mail inválido.");
      return;
    }
    if (!register.uf || !register.cidade) {
      toast.error("Selecione UF e cidade.");
      return;
    }
    if (!PASSWORD_REGEX.test(register.password)) {
      toast.error("Senha fora do padrão (mín. 8, 1 maiúscula, 1 número e 1 especial).");
      return;
    }
    if (register.password !== register.passwordConfirm) {
      toast.error("As senhas não conferem.");
      return;
    }

    setLoading(true);
    try {
      const res = await portalAuthFetch(tenantId, "/api/public/portal-auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: register.nome.trim(),
          email: register.email.trim(),
          fone: register.fone.trim(),
          cidade: register.cidade,
          uf: register.uf,
          password: register.password,
        }),
      });
      const data = await res.json().catch(() => null) as { id?: string; nome?: string; email?: string; redirectUrl?: string; message?: string } | null;
      if (!res.ok) {
        toast.error(data?.message || "Falha ao criar acesso.");
        return;
      }
      if (!data?.id) {
        toast.error("Resposta inválida de autenticação.");
        return;
      }
      savePortalCandidateSession({ tenantId, id: String(data.id), nome: data.nome, email: data.email });
      window.location.href = data?.redirectUrl || `/app/PortalVagas?tenantId=${encodeURIComponent(tenantId)}`;
    } catch {
      toast.error("Falha ao criar acesso.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl space-y-4 py-8 relative">
      <div className="absolute top-4 right-4">
        <button type="button" className="btn-ghost text-sm" onClick={() => setHelpOpen(true)}>
          Precisa de ajuda?
        </button>
      </div>

      <div className="card-soft p-6">
        <div className="text-center">
          <div className="text-xl font-extrabold">Portal de Vagas - Acesso</div>
          <div className="text-muted-foreground mt-1 text-sm">
            Faça login ou crie sua conta para acompanhar candidaturas.
          </div>
        </div>

        {!tenantId ? (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            Tenant não informado. Abra o link enviado pelo RH (com <code>tenantId</code>).
          </div>
        ) : null}

        <div className="mt-4 flex gap-2">
          <button className={`btn-ghost flex-1 ${mode === "login" ? "bg-[rgba(16,82,144,.12)]" : ""}`} onClick={() => setMode("login")} type="button">
            Entrar
          </button>
          <button className={`btn-ghost flex-1 ${mode === "register" ? "bg-[rgba(16,82,144,.12)]" : ""}`} onClick={() => setMode("register")} type="button">
            Criar acesso
          </button>
        </div>

        {mode === "login" ? (
          <div className="mt-4 space-y-3">
            <div>
              <label className="mini-title mb-1 block">E-mail</label>
              <input className="form-control" type="email" value={login.email} onChange={(e) => setLogin((s) => ({ ...s, email: e.target.value }))} />
            </div>
            <div>
              <label className="mini-title mb-1 block">Senha</label>
              <input className="form-control" type="password" value={login.password} onChange={(e) => setLogin((s) => ({ ...s, password: e.target.value }))} />
            </div>
            <button className="btn-brand w-full" type="button" onClick={() => void doLogin()} disabled={loading || !tenantId}>
              {loading ? "Entrando..." : "Entrar no portal"}
            </button>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="md:col-span-12">
              <label className="mini-title mb-1 block">Nome completo</label>
              <input className="form-control" value={register.nome} onChange={(e) => setRegister((s) => ({ ...s, nome: e.target.value }))} />
            </div>
            <div className="md:col-span-6">
              <label className="mini-title mb-1 block">E-mail</label>
              <input className="form-control" type="email" value={register.email} onChange={(e) => setRegister((s) => ({ ...s, email: e.target.value }))} />
            </div>
            <div className="md:col-span-6">
              <label className="mini-title mb-1 block">Telefone</label>
              <input className="form-control" value={register.fone} onChange={(e) => setRegister((s) => ({ ...s, fone: e.target.value }))} />
            </div>
            <div className="md:col-span-3">
              <label className="mini-title mb-1 block">UF</label>
              <select className="form-select" value={register.uf} onChange={(e) => setRegister((s) => ({ ...s, uf: e.target.value.toUpperCase() }))}>
                <option value="">Selecione</option>
                {UF_LIST.map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-9">
              <label className="mini-title mb-1 block">Cidade</label>
              <input className="form-control" value={register.cidade} onChange={(e) => setRegister((s) => ({ ...s, cidade: e.target.value }))} />
            </div>
            <div className="md:col-span-6">
              <label className="mini-title mb-1 block">Senha</label>
              <input className="form-control" type="password" value={register.password} onChange={(e) => setRegister((s) => ({ ...s, password: e.target.value }))} />
            </div>
            <div className="md:col-span-6">
              <label className="mini-title mb-1 block">Confirmar senha</label>
              <input className="form-control" type="password" value={register.passwordConfirm} onChange={(e) => setRegister((s) => ({ ...s, passwordConfirm: e.target.value }))} />
            </div>
            <div className="md:col-span-12">
              <button className="btn-brand w-full" type="button" onClick={() => void doRegister()} disabled={loading || !tenantId}>
                {loading ? "Criando..." : "Criar acesso"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Idioma:</span>
          <button type="button" className={`px-2 py-1 rounded text-sm ${locale === "pt-BR" ? "bg-[rgba(16,82,144,.2)] font-semibold" : "btn-ghost"}`} onClick={() => setLocale("pt-BR")} title="Português">PT</button>
          <button type="button" className={`px-2 py-1 rounded text-sm ${locale === "en-US" ? "bg-[rgba(16,82,144,.2)] font-semibold" : "btn-ghost"}`} onClick={() => setLocale("en-US")} title="English">EN</button>
        </div>
        <Link className="btn-ghost" href={`/app/PortalVagas${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ""}`}>
          Voltar para o portal
        </Link>
      </div>

      {helpOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="helpModalLabel">
          <div className="card-soft w-full max-w-sm p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 id="helpModalLabel" className="text-base font-extrabold">Como funciona o processo</h2>
                <p className="text-sm text-muted-foreground">Etapas para acompanhar sua candidatura.</p>
              </div>
              <button type="button" className="btn-ghost px-2 py-1" onClick={() => setHelpOpen(false)} aria-label="Fechar">Fechar</button>
            </div>
            <div className="mt-4 space-y-3">
              {HELP_STEPS[locale].map((step, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--lt-primary)]" />
                  <span className="text-sm">{step}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button type="button" className="btn-brand" onClick={() => setHelpOpen(false)}>Fechar</button>
            </div>
          </div>
        </div>
      ) : null}

      <Script
        src="https://vlibras.gov.br/app/vlibras-plugin.js"
        strategy="lazyOnload"
        onLoad={() => {
          const w = (window as unknown as { VLibras?: { Widget?: new (u: string) => unknown; default?: { Widget?: new (u: string) => unknown } } }).VLibras;
          const ctor = w?.Widget ?? w?.default?.Widget ?? (typeof w?.default === "function" ? w.default : null);
          if (ctor) try { new (ctor as new (u: string) => unknown)("https://vlibras.gov.br/app"); } catch {}
        }}
      />
    </section>
  );
}

