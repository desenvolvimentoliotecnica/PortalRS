"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

type Mode = "login" | "register";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export default function PortalVagasAccessScreen() {
  const searchParams = useSearchParams();
  const tenantId = (searchParams.get("tenantId") || "").trim();
  const returnUrl = (searchParams.get("returnUrl") || "").trim();

  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [ufs, setUfs] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);

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

  useEffect(() => {
    if (mode !== "register") return;
    apiFetch("/PortalVagas/Locations/Ufs", { cache: "no-store" })
      .then((r) => r.json().catch(() => []))
      .then((data) => {
        setUfs(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        setUfs([]);
      });
  }, [mode]);

  useEffect(() => {
    if (!register.uf) {
      setCities([]);
      return;
    }
    setLoadingCities(true);
    apiFetch(`/PortalVagas/Locations/Ufs/${encodeURIComponent(register.uf)}/Cities`, { cache: "no-store" })
      .then((r) => r.json().catch(() => []))
      .then((data) => {
        setCities(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        setCities([]);
      })
      .finally(() => setLoadingCities(false));
  }, [register.uf]);

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
      const res = await apiFetch("/PortalVagas/Auth/Login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: login.email.trim(),
          password: login.password,
          tenantId,
          returnUrl: returnUrl || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.message || "Falha ao entrar.");
        return;
      }
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
      const res = await apiFetch("/PortalVagas/Auth/Register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: register.nome.trim(),
          email: register.email.trim(),
          fone: register.fone.trim(),
          cidade: register.cidade,
          uf: register.uf,
          password: register.password,
          tenantId,
          returnUrl: returnUrl || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.message || "Falha ao criar acesso.");
        return;
      }
      window.location.href = data?.redirectUrl || `/app/PortalVagas?tenantId=${encodeURIComponent(tenantId)}`;
    } catch {
      toast.error("Falha ao criar acesso.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl space-y-4 py-8">
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
            <div className="md:col-span-4">
              <label className="mini-title mb-1 block">UF</label>
              <select className="form-select" value={register.uf} onChange={(e) => setRegister((s) => ({ ...s, uf: e.target.value, cidade: "" }))}>
                <option value="">Selecione</option>
                {ufs.map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-8">
              <label className="mini-title mb-1 block">Cidade</label>
              <select className="form-select" value={register.cidade} onChange={(e) => setRegister((s) => ({ ...s, cidade: e.target.value }))} disabled={!register.uf || loadingCities}>
                <option value="">{loadingCities ? "Carregando..." : "Selecione"}</option>
                {cities.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
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

      <div className="flex justify-center">
        <Link className="btn-ghost" href={`/PortalVagas${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ""}`}>
          Voltar para o portal
        </Link>
      </div>
    </section>
  );
}

