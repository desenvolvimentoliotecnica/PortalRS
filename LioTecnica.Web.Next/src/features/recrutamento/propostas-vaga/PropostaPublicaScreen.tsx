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
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-sky-50 px-4 py-8 text-neutral-900">
      <article className="mx-auto max-w-4xl space-y-6">
        <header className="overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-xl shadow-sky-950/5">
          <div className="bg-gradient-to-r from-sky-900 via-sky-800 to-cyan-700 px-6 py-7 text-white md:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-100">
                  Carta de oferta
                </p>
                <h1 className="mt-3 text-2xl font-bold leading-tight md:text-3xl">
                  {proposta.vagaTitulo ?? "Oferta profissional"}
                </h1>
                <p className="mt-2 text-sm text-sky-100">
                  Preparada para{" "}
                  <span className="font-semibold text-white">{proposta.candidatoNome ?? "Candidato"}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs md:justify-end">
                <span className={`rounded-full px-3 py-1 font-semibold ${
                  respondida ? "bg-emerald-100 text-emerald-800"
                    : bloqueada ? "bg-red-100 text-red-800"
                    : "bg-white/15 text-white ring-1 ring-white/25"
                }`}>
                  Status: {status}
                </span>
                {proposta.expiraEmUtc && !respondida && (
                  <span className="rounded-full bg-amber-300 px-3 py-1 font-semibold text-amber-950">
                    Expira em {formatDate(proposta.expiraEmUtc)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="px-6 py-8 md:px-8">
            <div className="mx-auto max-w-xl rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-7 text-center shadow-inner">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
                Valor da proposta
              </p>
              <div className="mt-3 text-4xl font-extrabold tracking-tight text-emerald-700 md:text-5xl">
                {formatMoney(proposta.salarioOferecido, proposta.moeda)}
              </div>
              <p className="mt-2 text-xs text-emerald-900/70">
                Salário oferecido para a posição
              </p>
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
                Condições
              </p>
              <h2 className="mt-1 text-xl font-semibold text-neutral-950">Detalhes da oferta</h2>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
              <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Data prevista de início
              </div>
              <div className="mt-1 font-semibold text-neutral-900">
                {formatDateOnly(proposta.dataPrevistaInicio)}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Benefícios
              </div>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-900">
                {proposta.descricaoBeneficios?.trim() || "—"}
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Mensagem do RH
              </div>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-900">
                {proposta.mensagemPersonalizada?.trim() || "Estamos felizes em avançar com você nesta oportunidade."}
              </div>
            </div>
          </div>
        </section>

        {respondida && (
          <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-950 shadow-sm">
            <div className="text-lg font-semibold">
              {status === "Aceita" ? "Proposta aceita" : "Resposta registrada"}
            </div>
            <p className="mt-1">
              {status === "Aceita"
                ? "Você aceitou esta proposta. O RH foi notificado."
                : "Você recusou esta proposta."}
            </p>
            <div className="mt-2 text-xs text-emerald-800">
              Resposta registrada em {formatDate(proposta.respondidaEmUtc)}.
            </div>
          </section>
        )}

        {bloqueada && (
          <section className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-800 shadow-sm">
            Esta proposta não está mais disponível ({status.toLowerCase()}).
          </section>
        )}

        {!respondida && !bloqueada && (
          <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-lg shadow-slate-950/5 md:p-8">
            {mode === "view" && (
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-950">Pronto para responder?</h3>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-600">
                    Ao aceitar, você confirmará seu nome completo como assinatura digital.
                    A data, hora, IP e navegador serão registrados como evidência da resposta.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row md:shrink-0">
                  <Button variant="outline" className="px-6" onClick={() => setMode("recusar")}>
                    Recusar
                  </Button>
                  <Button className="bg-sky-800 px-7 hover:bg-sky-900" onClick={() => setMode("aceitar")}>
                    Aceitar proposta
                  </Button>
                </div>
              </div>
            )}

            {mode !== "view" && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-xl font-semibold text-neutral-950">
                    {mode === "aceitar" ? "Confirmar aceite da proposta" : "Confirmar recusa da proposta"}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-neutral-600">
                    Digite seu nome completo como assinatura digital. A data, hora, IP e navegador serão
                    registrados como evidência da resposta.
                  </p>
                </div>

                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-neutral-800">Seu nome completo</span>
                  <input
                    className="w-full rounded-xl border border-neutral-300 px-4 py-3 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
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
                      className="w-full rounded-xl border border-neutral-300 px-4 py-3 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                      rows={3}
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Ex.: aceitei outra proposta"
                    />
                  </label>
                )}

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <Button variant="outline" onClick={() => setMode("view")} disabled={submitting}>
                    Voltar
                  </Button>
                  <Button
                    className={mode === "aceitar" ? "bg-sky-800 hover:bg-sky-900" : ""}
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
    </main>
  );
}
