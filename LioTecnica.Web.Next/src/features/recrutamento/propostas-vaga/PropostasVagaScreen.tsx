"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiJson } from "@/lib/api";
import {
  cancelarProposta,
  createProposta,
  enviarProposta,
  listPropostas,
  reenviarEmailProposta,
  resolveStatus,
  updateProposta,
  type PropostaVagaResponse,
} from "./propostaApi";

type VagaLite = { id: string; titulo: string | null };
type CandidatoLite = { id: string; nome: string | null; email: string | null };
type PropostaSentFeedback = {
  vagaTitulo: string | null;
  candidatoNome: string | null;
  candidatoEmail: string | null;
  expiraEmUtc: string | null;
};

type AnyRecord = Record<string, unknown>;

function asRecord(value: unknown): AnyRecord | null {
  return value && typeof value === "object" ? (value as AnyRecord) : null;
}

function extractItems(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  const items = record?.items ?? record?.Items;
  return Array.isArray(items) ? items : [];
}

function toVagaLite(value: unknown): VagaLite | null {
  const record = asRecord(value);
  const id = typeof record?.id === "string" ? record.id : typeof record?.Id === "string" ? record.Id : "";
  if (!id) return null;
  const titulo = typeof record?.titulo === "string"
    ? record.titulo
    : typeof record?.Titulo === "string"
      ? record.Titulo
      : null;
  return { id, titulo };
}

function toCandidatoLite(value: unknown): CandidatoLite | null {
  const record = asRecord(value);
  const id = typeof record?.id === "string" ? record.id : typeof record?.Id === "string" ? record.Id : "";
  if (!id) return null;
  const nome = typeof record?.nome === "string"
    ? record.nome
    : typeof record?.Nome === "string"
      ? record.Nome
      : typeof record?.nomeCompleto === "string"
        ? record.nomeCompleto
        : typeof record?.NomeCompleto === "string"
          ? record.NomeCompleto
          : null;
  const email = typeof record?.email === "string"
    ? record.email
    : typeof record?.Email === "string"
      ? record.Email
      : null;
  return { id, nome, email };
}

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

function statusBadgeClass(s: string) {
  switch (s) {
    case "Aceita": return "bg-emerald-100 text-emerald-800";
    case "Recusada": return "bg-red-100 text-red-800";
    case "Expirada":
    case "Cancelada": return "bg-neutral-200 text-neutral-700";
    case "Enviada":
    case "Visualizada": return "bg-sky-100 text-sky-800";
    default: return "bg-amber-100 text-amber-900";
  }
}

function canEditAndSend(status: string) {
  return status === "Rascunho" || status === "Enviada" || status === "Visualizada";
}

export default function PropostasVagaScreen() {
  const [items, setItems] = useState<PropostaVagaResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editingProposta, setEditingProposta] = useState<PropostaVagaResponse | null>(null);
  const [sentFeedback, setSentFeedback] = useState<PropostaSentFeedback | null>(null);
  const [vagas, setVagas] = useState<VagaLite[]>([]);
  const [candidatos, setCandidatos] = useState<CandidatoLite[]>([]);
  const routePrefillHandled = useRef(false);

  const [form, setForm] = useState({
    vagaId: "",
    candidatoId: "",
    moeda: "BRL",
    salarioOferecido: "",
    descricaoBeneficios: "",
    dataPrevistaInicio: "",
    mensagemPersonalizada: "",
    observacaoInternaRh: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPropostas();
      setItems(data);
    } catch {
      toast.error("Falha ao listar propostas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (loading || routePrefillHandled.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") !== "1") return;
    const prefillVagaId = params.get("vagaId") ?? "";
    const prefillCandidatoId = params.get("candidatoId") ?? "";
    const existing = items.find((p) => (
      p.vagaId === prefillVagaId
      && p.candidatoId === prefillCandidatoId
      && canEditAndSend(resolveStatus(p.status))
    ));

    routePrefillHandled.current = true;
    if (existing) {
      setForm({
        vagaId: existing.vagaId,
        candidatoId: existing.candidatoId,
        moeda: existing.moeda ?? "BRL",
        salarioOferecido: existing.salarioOferecido != null ? String(existing.salarioOferecido) : "",
        descricaoBeneficios: existing.descricaoBeneficios ?? "",
        dataPrevistaInicio: existing.dataPrevistaInicio ? existing.dataPrevistaInicio.slice(0, 10) : "",
        mensagemPersonalizada: existing.mensagemPersonalizada ?? "",
        observacaoInternaRh: existing.observacaoInternaRh ?? "",
      });
      setEditingProposta(existing);
      setShowNew(false);
      toast.info("Já existe proposta para este candidato nesta vaga. Abrimos para edição e reenvio.");
      return;
    }

    setEditingProposta(null);
    setShowNew(true);
    setForm((f) => ({
      ...f,
      vagaId: prefillVagaId || f.vagaId,
      candidatoId: prefillCandidatoId || f.candidatoId,
    }));
  }, [items, loading]);

  useEffect(() => {
    if (!showNew && !editingProposta) return;
    const ac = new AbortController();
    (async () => {
      try {
        const [vs, cs] = await Promise.all([
          apiJson<unknown>("/api/vagas").catch(() => []),
          apiJson<unknown>("/api/candidatos").catch(() => []),
        ]);
        if (!ac.signal.aborted) {
          setVagas(extractItems(vs).map(toVagaLite).filter((v): v is VagaLite => v !== null));
          setCandidatos(extractItems(cs).map(toCandidatoLite).filter((c): c is CandidatoLite => c !== null));
        }
      } catch { /* ignore */ }
    })();
    return () => ac.abort();
  }, [showNew, editingProposta]);

  const resetForm = () => setForm({
    vagaId: "", candidatoId: "", moeda: "BRL", salarioOferecido: "",
    descricaoBeneficios: "", dataPrevistaInicio: "",
    mensagemPersonalizada: "", observacaoInternaRh: "",
  });

  function fillFormFromProposta(p: PropostaVagaResponse) {
    setForm({
      vagaId: p.vagaId,
      candidatoId: p.candidatoId,
      moeda: p.moeda ?? "BRL",
      salarioOferecido: p.salarioOferecido != null ? String(p.salarioOferecido) : "",
      descricaoBeneficios: p.descricaoBeneficios ?? "",
      dataPrevistaInicio: p.dataPrevistaInicio ? p.dataPrevistaInicio.slice(0, 10) : "",
      mensagemPersonalizada: p.mensagemPersonalizada ?? "",
      observacaoInternaRh: p.observacaoInternaRh ?? "",
    });
  }

  function openEditProposta(p: PropostaVagaResponse) {
    fillFormFromProposta(p);
    setEditingProposta(p);
    setShowNew(false);
  }

  function closeProposalModal() {
    setShowNew(false);
    setEditingProposta(null);
    resetForm();
  }

  const propostaPayload = () => ({
    moeda: form.moeda || null,
    salarioOferecido: form.salarioOferecido ? Number(form.salarioOferecido) : null,
    descricaoBeneficios: form.descricaoBeneficios || null,
    dataPrevistaInicio: form.dataPrevistaInicio || null,
    mensagemPersonalizada: form.mensagemPersonalizada || null,
    observacaoInternaRh: form.observacaoInternaRh || null,
  });

  const submitNew = async () => {
    if (!form.vagaId || !form.candidatoId) {
      toast.error("Selecione vaga e candidato.");
      return;
    }
    try {
      if (editingProposta) {
        await updateProposta(editingProposta.id, propostaPayload());
        const status = resolveStatus(editingProposta.status);
        const enviada = status === "Rascunho"
          ? await enviarProposta(editingProposta.id, 7)
          : await reenviarEmailProposta(editingProposta.id);
        toast.success(status === "Rascunho"
          ? "Proposta atualizada e enviada com validade de 7 dias."
          : "Proposta atualizada e reenviada por e-mail.");
        setSentFeedback(toSentFeedback(enviada));
        closeProposalModal();
        await load();
        return;
      }

      const criada = await createProposta({
        vagaId: form.vagaId,
        candidatoId: form.candidatoId,
        ...propostaPayload(),
      });
      const enviada = await enviarProposta(criada.id, 7);
      toast.success("Proposta criada e enviada com validade de 7 dias.");
      setSentFeedback(toSentFeedback(enviada));
      closeProposalModal();
      await load();
    } catch (err) {
      toast.error((err as Error).message ?? "Falha ao salvar proposta.");
    }
  };

  const enviar = async (p: PropostaVagaResponse) => {
    const dias = window.prompt("Prazo em dias para resposta (padrão 7):", "7");
    if (dias === null) return;
    const n = Number(dias);
    try {
      const enviada = await enviarProposta(p.id, Number.isFinite(n) && n > 0 ? n : undefined);
      toast.success("Proposta enviada — token gerado.");
      setSentFeedback(toSentFeedback(enviada));
      await load();
    } catch (err) {
      toast.error((err as Error).message ?? "Falha ao enviar.");
    }
  };

  const cancelar = async (p: PropostaVagaResponse) => {
    if (!window.confirm("Cancelar esta proposta? O candidato não conseguirá mais aceitar.")) return;
    try {
      await cancelarProposta(p.id);
      toast.success("Proposta cancelada.");
      await load();
    } catch (err) {
      toast.error((err as Error).message ?? "Falha ao cancelar.");
    }
  };

  const reenviarEmail = async (p: PropostaVagaResponse) => {
    try {
      await reenviarEmailProposta(p.id);
      toast.success("E-mail da proposta reenviado.");
      await load();
    } catch (err) {
      toast.error((err as Error).message ?? "Falha ao reenviar proposta.");
    }
  };

  const rows = useMemo(() => items.map((p) => {
    const s = resolveStatus(p.status) as string;
    return { p, statusStr: s };
  }), [items]);

  return (
    <section className="space-y-6 p-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Propostas / Cartas de oferta</h1>
          <p className="text-sm text-neutral-600">
            RH cria a proposta, envia por link único e acompanha aceite digital.
          </p>
        </div>
        <Button onClick={() => setShowNew(true)}>Nova proposta</Button>
      </header>

      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-6 text-sm text-neutral-500">Carregando…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-neutral-500">Nenhuma proposta criada ainda.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-600">
              <tr>
                <th className="px-4 py-3">Vaga</th>
                <th className="px-4 py-3">Candidato</th>
                <th className="px-4 py-3">Salário</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, statusStr }) => (
                <tr key={p.id} className="border-t border-neutral-100">
                  <td className="px-4 py-3">{p.vagaTitulo ?? p.vagaId.slice(0, 8)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-neutral-900">{p.candidatoNome ?? "—"}</div>
                    <div className="text-xs text-neutral-500">{p.candidatoEmail ?? ""}</div>
                  </td>
                  <td className="px-4 py-3">{formatMoney(p.salarioOferecido, p.moeda)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${statusBadgeClass(statusStr)}`}>
                      {statusStr}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {statusStr === "Rascunho" && (
                        <Button size="sm" onClick={() => enviar(p)}>Enviar</Button>
                      )}
                      {canEditAndSend(statusStr) && (
                        <Button size="sm" variant="outline" onClick={() => openEditProposta(p)}>
                          Editar
                        </Button>
                      )}
                      {p.accessToken && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const url = `${window.location.origin}/app/PortalVagas/Proposta?token=${encodeURIComponent(p.accessToken ?? "")}&tenantId=${encodeURIComponent(
                              (localStorage.getItem("tenantId") ?? "").trim(),
                            )}`;
                            navigator.clipboard.writeText(url).then(
                              () => toast.success("Link copiado."),
                              () => toast.error("Falha ao copiar."),
                            );
                          }}
                        >
                          Copiar link
                        </Button>
                      )}
                      {(statusStr === "Enviada" || statusStr === "Visualizada") && (
                        <Button size="sm" variant="outline" onClick={() => void reenviarEmail(p)}>
                          Reenviar e-mail
                        </Button>
                      )}
                      {statusStr !== "Aceita" && statusStr !== "Recusada" && statusStr !== "Cancelada" && (
                        <Button size="sm" variant="outline" onClick={() => cancelar(p)}>Cancelar</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(showNew || editingProposta) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-neutral-900">
              {editingProposta ? "Editar proposta" : "Nova proposta"}
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              {editingProposta
                ? "Ao salvar, a proposta será atualizada e reenviada por e-mail ao candidato."
                : "Ao criar, a proposta será enviada automaticamente por e-mail com validade de 7 dias."}
            </p>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block font-medium">Vaga</span>
                <select
                  className="w-full rounded-md border border-neutral-300 px-3 py-2"
                  value={form.vagaId}
                  onChange={(e) => setForm((f) => ({ ...f, vagaId: e.target.value }))}
                  disabled={editingProposta !== null}
                >
                  <option value="">Selecione…</option>
                  {editingProposta && (
                    <option value={editingProposta.vagaId}>
                      {editingProposta.vagaTitulo ?? editingProposta.vagaId.slice(0, 8)}
                    </option>
                  )}
                  {vagas.map((v) => (
                    <option key={v.id} value={v.id}>{v.titulo ?? v.id.slice(0, 8)}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Candidato</span>
                <select
                  className="w-full rounded-md border border-neutral-300 px-3 py-2"
                  value={form.candidatoId}
                  onChange={(e) => setForm((f) => ({ ...f, candidatoId: e.target.value }))}
                  disabled={editingProposta !== null}
                >
                  <option value="">Selecione…</option>
                  {editingProposta && (
                    <option value={editingProposta.candidatoId}>
                      {editingProposta.candidatoNome ?? editingProposta.candidatoEmail ?? editingProposta.candidatoId.slice(0, 8)}
                    </option>
                  )}
                  {candidatos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome ?? c.email ?? c.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Moeda</span>
                <input
                  className="w-full rounded-md border border-neutral-300 px-3 py-2"
                  value={form.moeda}
                  onChange={(e) => setForm((f) => ({ ...f, moeda: e.target.value }))}
                  maxLength={3}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Salário oferecido</span>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded-md border border-neutral-300 px-3 py-2"
                  value={form.salarioOferecido}
                  onChange={(e) => setForm((f) => ({ ...f, salarioOferecido: e.target.value }))}
                />
              </label>
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block font-medium">Benefícios</span>
                <textarea
                  rows={2}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2"
                  value={form.descricaoBeneficios}
                  onChange={(e) => setForm((f) => ({ ...f, descricaoBeneficios: e.target.value }))}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Data prevista de início</span>
                <input
                  type="date"
                  className="w-full rounded-md border border-neutral-300 px-3 py-2"
                  value={form.dataPrevistaInicio}
                  onChange={(e) => setForm((f) => ({ ...f, dataPrevistaInicio: e.target.value }))}
                />
              </label>
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block font-medium">Mensagem personalizada (opcional)</span>
                <textarea
                  rows={3}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2"
                  value={form.mensagemPersonalizada}
                  onChange={(e) => setForm((f) => ({ ...f, mensagemPersonalizada: e.target.value }))}
                />
              </label>
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block font-medium">Observação interna (RH)</span>
                <input
                  className="w-full rounded-md border border-neutral-300 px-3 py-2"
                  value={form.observacaoInternaRh}
                  onChange={(e) => setForm((f) => ({ ...f, observacaoInternaRh: e.target.value }))}
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={closeProposalModal}>Cancelar</Button>
              <Button onClick={submitNew}>
                {editingProposta
                  ? resolveStatus(editingProposta.status) === "Rascunho" ? "Salvar e enviar" : "Salvar e reenviar"
                  : "Criar e enviar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={sentFeedback !== null} onOpenChange={(open) => !open && setSentFeedback(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
              ✓
            </div>
            <DialogTitle className="text-center text-xl">Proposta enviada com sucesso!</DialogTitle>
          </DialogHeader>
          {sentFeedback && (
            <div className="space-y-3 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-950">
              <p>
                O e-mail da proposta foi enviado para{" "}
                <strong>{sentFeedback.candidatoNome ?? sentFeedback.candidatoEmail ?? "o candidato"}</strong>.
              </p>
              <div className="space-y-1 text-xs text-emerald-900/80">
                <div>Vaga: <strong>{sentFeedback.vagaTitulo ?? "—"}</strong></div>
                {sentFeedback.candidatoEmail && <div>E-mail: {sentFeedback.candidatoEmail}</div>}
                {sentFeedback.expiraEmUtc && (
                  <div>Validade: {new Date(sentFeedback.expiraEmUtc).toLocaleString("pt-BR")}</div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button className="w-full" onClick={() => setSentFeedback(null)}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function toSentFeedback(proposta: PropostaVagaResponse): PropostaSentFeedback {
  return {
    vagaTitulo: proposta.vagaTitulo,
    candidatoNome: proposta.candidatoNome,
    candidatoEmail: proposta.candidatoEmail,
    expiraEmUtc: proposta.expiraEmUtc,
  };
}
