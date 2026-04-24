"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  aceitarPropostaPublica,
  getPropostaPublica,
  recusarPropostaPublica,
  resolveStatus,
  type PropostaVagaPublicaResponse,
} from "./propostaApi";

type Props = { token: string };

function formatMoney(value: number | null, moeda: string | null) {
  if (value == null) return "—";
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: (moeda ?? "BRL").toUpperCase(),
    }).format(value);
  } catch {
    return `${moeda ?? "R$"} ${value.toLocaleString("pt-BR")}`;
  }
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}

function formatDateOnly(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
}

export default function PropostaPublicaScreen({ token }: Props) {
  const sp = useSearchParams();
  const tenantId = (sp.get("tenantId") || sp.get("tenant") || "").trim();

  const [proposta, setProposta] = useState<PropostaVagaPublicaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [nomeConfirmado, setNomeConfirmado] = useState("");
  const [motivo, setMotivo] = useState("");
  const [mode, setMode] = useState<"view" | "aceitar" | "recusar">("view");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getPropostaPublica(tenantId, token);
      if (!data) {
        setNotFound(true);
      } else {
        setProposta(data);
        if (data.candidatoNome && !nomeConfirmado) {
          setNomeConfirmado(data.candidatoNome);
        }
      }
    } catch {
      toast.error("Erro ao carregar proposta.");
    } finally {
      setLoading(false);
    }
  }, [tenantId, token, nomeConfirmado]);

  useEffect(() => {
    void load();
  }, [load]);

  const status = useMemo(
    () => (proposta ? resolveStatus(proposta.status) : "Rascunho"),
    [proposta],
  );

  const respondida = status === "Aceita" || status === "Recusada";
  const bloqueada = status === "Expirada" || status === "Cancelada";

  const handleAceitar = async () => {
    if (!tenantId || !nomeConfirmado.trim()) {
      toast.error("Confirme seu nome completo para aceitar.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await aceitarPropostaPublica(tenantId, token, nomeConfirmado.trim());
      setProposta(result);
      setMode("view");
      toast.success("Proposta aceita com sucesso!");
    } catch (err) {
      toast.error((err as Error).message ?? "Falha ao aceitar.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecusar = async () => {
    if (!tenantId || !nomeConfirmado.trim()) {
      toast.error("Confirme seu nome completo para recusar.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await recusarPropostaPublica(
        tenantId,
        token,
        nomeConfirmado.trim(),
        motivo.trim() || null,
      );
      setProposta(result);
      setMode("view");
      toast.success("Resposta registrada.");
    } catch (err) {
      toast.error((err as Error).message ?? "Falha ao recusar.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!tenantId) {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900">
        Link inválido — falta o identificador da empresa (<code>?tenantId=...</code>).
      </section>
    );
  }

  if (loading) {
    return (
      <section className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600">
        Carregando proposta…
      </section>
    );
  }

  if (notFound || !proposta) {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        Proposta não encontrada ou link expirou.
      </section>
    );
  }

  return (
    <article className="space-y-6">
      <header className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-neutral-500">Carta de oferta</p>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-900">
          {proposta.vagaTitulo ?? "Oferta profissional"}
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Para: <span className="font-medium">{proposta.candidatoNome ?? "Candidato"}</span>
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className={`rounded-full px-2 py-0.5 font-medium ${
            respondida ? "bg-emerald-100 text-emerald-800"
              : bloqueada ? "bg-red-100 text-red-800"
              : "bg-sky-100 text-sky-800"
          }`}>Status: {status}</span>
          {proposta.expiraEmUtc && !respondida && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">
              Expira em {formatDate(proposta.expiraEmUtc)}
            </span>
          )}
        </div>
      </header>

      <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900">Condições da oferta</h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
          <div>
            <dt className="text-neutral-500">Salário oferecido</dt>
            <dd className="font-medium text-neutral-900">
              {formatMoney(proposta.salarioOferecido, proposta.moeda)}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">Data prevista de início</dt>
            <dd className="font-medium text-neutral-900">
              {formatDateOnly(proposta.dataPrevistaInicio)}
            </dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-neutral-500">Benefícios</dt>
            <dd className="whitespace-pre-wrap text-neutral-900">
              {proposta.descricaoBeneficios?.trim() || "—"}
            </dd>
          </div>
          {proposta.mensagemPersonalizada?.trim() && (
            <div className="md:col-span-2">
              <dt className="text-neutral-500">Mensagem do RH</dt>
              <dd className="whitespace-pre-wrap text-neutral-900">
                {proposta.mensagemPersonalizada}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {respondida && (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-900">
          {status === "Aceita"
            ? "Você aceitou esta proposta. O RH foi notificado."
            : "Você recusou esta proposta."}
          <div className="mt-1 text-xs text-emerald-800">
            Resposta registrada em {formatDate(proposta.respondidaEmUtc)}.
          </div>
        </section>
      )}

      {bloqueada && (
        <section className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          Esta proposta não está mais disponível ({status.toLowerCase()}).
        </section>
      )}

      {!respondida && !bloqueada && (
        <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          {mode === "view" && (
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
              <Button variant="outline" onClick={() => setMode("recusar")}>Recusar</Button>
              <Button onClick={() => setMode("aceitar")}>Aceitar proposta</Button>
            </div>
          )}

          {mode !== "view" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-neutral-900">
                {mode === "aceitar" ? "Confirmar aceite" : "Confirmar recusa"}
              </h3>
              <p className="text-sm text-neutral-600">
                Digite seu nome completo como assinatura digital. A data, hora, IP e navegador serão
                registrados como evidência da resposta.
              </p>

              <label className="block text-sm">
                <span className="mb-1 block font-medium text-neutral-800">Seu nome completo</span>
                <input
                  className="w-full rounded-md border border-neutral-300 px-3 py-2"
                  value={nomeConfirmado}
                  onChange={(e) => setNomeConfirmado(e.target.value)}
                  placeholder="Ex.: Maria da Silva"
                />
              </label>

              {mode === "recusar" && (
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-neutral-800">
                    Motivo (opcional)
                  </span>
                  <textarea
                    className="w-full rounded-md border border-neutral-300 px-3 py-2"
                    rows={3}
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Ex.: aceitei outra proposta"
                  />
                </label>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setMode("view")} disabled={submitting}>
                  Voltar
                </Button>
                <Button
                  onClick={mode === "aceitar" ? handleAceitar : handleRecusar}
                  disabled={submitting || !nomeConfirmado.trim()}
                >
                  {submitting ? "Enviando…" : mode === "aceitar" ? "Confirmar aceite" : "Confirmar recusa"}
                </Button>
              </div>
            </div>
          )}
        </section>
      )}
    </article>
  );
}
