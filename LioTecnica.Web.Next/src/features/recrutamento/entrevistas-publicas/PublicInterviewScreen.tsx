"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  confirmPublicInterview,
  getPublicInterview,
  suggestPublicInterviewTime,
  type PublicInterviewResponse,
} from "./interviewApi";

type Props = { token: string };

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function toUtcIso(localValue: string) {
  const date = new Date(localValue);
  return date.toISOString();
}

export default function PublicInterviewScreen({ token }: Props) {
  const sp = useSearchParams();
  const tenantId = (sp.get("tenantId") || sp.get("tenant") || "").trim();
  const [interview, setInterview] = useState<PublicInterviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [mode, setMode] = useState<"view" | "suggest">("view");
  const [suggestedStart, setSuggestedStart] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getPublicInterview(tenantId, token);
      if (!data) setNotFound(true);
      else setInterview(data);
    } catch {
      toast.error("Erro ao carregar entrevista.");
    } finally {
      setLoading(false);
    }
  }, [tenantId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleConfirm = async () => {
    if (!tenantId) return;
    setSubmitting(true);
    try {
      const result = await confirmPublicInterview(tenantId, token);
      setInterview(result);
      toast.success("Presença confirmada. Obrigado!");
    } catch {
      toast.error("Não foi possível confirmar a entrevista.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuggest = async () => {
    if (!tenantId || !suggestedStart) {
      toast.error("Informe uma nova data e horário.");
      return;
    }
    setSubmitting(true);
    try {
      const start = new Date(suggestedStart);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const result = await suggestPublicInterviewTime(
        tenantId,
        token,
        toUtcIso(suggestedStart),
        end.toISOString(),
        message.trim() || null,
      );
      setInterview(result);
      setMode("view");
      toast.success("Sugestão enviada ao RH.");
    } catch {
      toast.error("Não foi possível enviar a sugestão.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!tenantId) {
    return <section className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900">Link inválido: falta o identificador da empresa.</section>;
  }

  if (loading) {
    return <section className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600">Carregando entrevista...</section>;
  }

  if (notFound || !interview) {
    return <section className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">Entrevista não encontrada.</section>;
  }

  const responded = interview.candidateResponseStatus && interview.candidateResponseStatus !== "pendente";

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-sky-50 px-4 py-8 text-neutral-900">
      <article className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-xl shadow-sky-950/5">
        <header className="bg-gradient-to-r from-sky-900 via-sky-800 to-cyan-700 px-6 py-7 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-100">Entrevista</p>
          <h1 className="mt-3 text-2xl font-bold">{interview.vagaTitle ?? interview.title}</h1>
          <p className="mt-2 text-sm text-sky-100">Olá, {interview.candidate ?? "candidato"}.</p>
        </header>

        <section className="space-y-5 px-6 py-7">
          <div className="rounded-2xl border border-neutral-200 bg-slate-50 p-5">
            <div className="text-sm text-neutral-500">Data e horário</div>
            <div className="mt-1 text-lg font-semibold">{formatDate(interview.startAtUtc)}</div>
            <div className="mt-4 text-sm text-neutral-500">Modalidade/local</div>
            <div className="mt-1 font-medium">{interview.location ?? "A combinar"}</div>
            {interview.owner && <div className="mt-4 text-sm text-neutral-600">Responsável: {interview.owner}</div>}
          </div>

          {responded && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              Resposta registrada: {interview.candidateResponseStatus === "confirmado" ? "presença confirmada" : "novo horário sugerido"}.
            </div>
          )}

          {mode === "suggest" ? (
            <div className="space-y-3 rounded-2xl border border-neutral-200 p-4">
              <label className="block text-sm font-medium">
                Nova data e horário sugeridos
                <input
                  type="datetime-local"
                  value={suggestedStart}
                  onChange={(event) => setSuggestedStart(event.target.value)}
                  className="mt-1 w-full rounded-md border px-3 py-2"
                />
              </label>
              <label className="block text-sm font-medium">
                Observação opcional
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  className="mt-1 min-h-24 w-full rounded-md border px-3 py-2"
                  placeholder="Informe sua disponibilidade ou restrições de horário."
                />
              </label>
              <div className="flex gap-2">
                <Button onClick={handleSuggest} disabled={submitting}>Enviar sugestão</Button>
                <Button variant="outline" onClick={() => setMode("view")} disabled={submitting}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={handleConfirm} disabled={submitting || interview.candidateResponseStatus === "confirmado"}>
                Confirmar presença
              </Button>
              <Button variant="outline" onClick={() => setMode("suggest")} disabled={submitting}>
                Sugerir outra data/horário
              </Button>
            </div>
          )}
        </section>
      </article>
    </main>
  );
}
