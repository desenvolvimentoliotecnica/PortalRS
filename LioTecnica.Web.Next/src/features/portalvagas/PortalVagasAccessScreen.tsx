"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { clearPortalCandidateSession, portalAuthFetch, savePortalCandidateSession } from "@/features/portalvagas/publicApi";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import DocumentacaoBasicaFields, { validateDocumentacaoBasica } from "@/features/portalvagas/DocumentacaoBasicaFields";

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
    cpf: "",
    rg: "",
    dataNascimento: "",
    nomeMae: "",
    nomePai: "",
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
    const docErr = validateDocumentacaoBasica({
      cpf: register.cpf,
      rg: register.rg,
      dataNascimento: register.dataNascimento,
      nomeMae: register.nomeMae,
      nomePai: register.nomePai,
    });
    if (docErr) {
      toast.error(docErr);
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
          cpf: register.cpf.trim(),
          rg: register.rg.trim(),
          dataNascimento: register.dataNascimento,
          nomeMae: register.nomeMae.trim(),
          nomePai: register.nomePai.trim() || null,
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
        <Button variant="outline" size="sm" onClick={() => setHelpOpen(true)}>
          Precisa de ajuda?
        </Button>
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
          <Button className="flex-1" size="sm" variant={mode === "login" ? "default" : "outline"} onClick={() => setMode("login")}>
            Entrar
          </Button>
          <Button className="flex-1" size="sm" variant={mode === "register" ? "default" : "outline"} onClick={() => setMode("register")}>
            Criar acesso
          </Button>
        </div>

        {mode === "login" ? (
          <div className="mt-4 space-y-3">
            <div>
              <label className="mini-title mb-1 block">E-mail</label>
              <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" type="email" value={login.email} onChange={(e) => setLogin((s) => ({ ...s, email: e.target.value }))} />
            </div>
            <div>
              <label className="mini-title mb-1 block">Senha</label>
              <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" type="password" value={login.password} onChange={(e) => setLogin((s) => ({ ...s, password: e.target.value }))} />
            </div>
            <Button className="w-full" size="sm" onClick={() => void doLogin()} disabled={loading || !tenantId}>
              {loading ? "Entrando..." : "Entrar no portal"}
            </Button>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="md:col-span-12">
              <label className="mini-title mb-1 block">Nome completo</label>
              <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={register.nome} onChange={(e) => setRegister((s) => ({ ...s, nome: e.target.value }))} />
            </div>
            <div className="md:col-span-6">
              <label className="mini-title mb-1 block">E-mail</label>
              <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" type="email" value={register.email} onChange={(e) => setRegister((s) => ({ ...s, email: e.target.value }))} />
            </div>
            <div className="md:col-span-6">
              <label className="mini-title mb-1 block">Telefone</label>
              <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={register.fone} onChange={(e) => setRegister((s) => ({ ...s, fone: e.target.value }))} />
            </div>
            <div className="md:col-span-12 pt-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Documentação básica</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <DocumentacaoBasicaFields
                  values={{
                    cpf: register.cpf,
                    rg: register.rg,
                    dataNascimento: register.dataNascimento,
                    nomeMae: register.nomeMae,
                    nomePai: register.nomePai,
                  }}
                  onChange={(patch) => setRegister((s) => ({ ...s, ...patch }))}
                  inp="form-input w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  lbl="mini-title mb-1 block"
                />
              </div>
            </div>
            <div className="md:col-span-3">
              <label className="mini-title mb-1 block">UF</label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={register.uf} onChange={(e) => setRegister((s) => ({ ...s, uf: e.target.value.toUpperCase() }))}>
                <option value="">Selecione</option>
                {UF_LIST.map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-9">
              <label className="mini-title mb-1 block">Cidade</label>
              <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={register.cidade} onChange={(e) => setRegister((s) => ({ ...s, cidade: e.target.value }))} />
            </div>
            <div className="md:col-span-6">
              <label className="mini-title mb-1 block">Senha</label>
              <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" type="password" value={register.password} onChange={(e) => setRegister((s) => ({ ...s, password: e.target.value }))} />
            </div>
            <div className="md:col-span-6">
              <label className="mini-title mb-1 block">Confirmar senha</label>
              <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" type="password" value={register.passwordConfirm} onChange={(e) => setRegister((s) => ({ ...s, passwordConfirm: e.target.value }))} />
            </div>
            <div className="md:col-span-12">
              <Button className="w-full" size="sm" onClick={() => void doRegister()} disabled={loading || !tenantId}>
                {loading ? "Criando..." : "Criar acesso"}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Idioma:</span>
          <Button size="sm" variant={locale === "pt-BR" ? "default" : "outline"} onClick={() => setLocale("pt-BR")} title="Português">PT</Button>
          <Button size="sm" variant={locale === "en-US" ? "default" : "outline"} onClick={() => setLocale("en-US")} title="English">EN</Button>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/app/PortalVagas${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ""}`}>
            Voltar para o portal
          </Link>
        </Button>
      </div>

      {helpOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="helpModalLabel">
          <div className="card-soft w-full max-w-sm p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 id="helpModalLabel" className="text-base font-extrabold">Como funciona o processo</h2>
                <p className="text-sm text-muted-foreground">Etapas para acompanhar sua candidatura.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setHelpOpen(false)} aria-label="Fechar">Fechar</Button>
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
              <Button size="sm" onClick={() => setHelpOpen(false)}>Fechar</Button>
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

