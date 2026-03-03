"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import type { AccessibilityResponse } from "./types";

export default function PortalVagasAccessibilitySection() {
  const [data, setData] = useState<AccessibilityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    idioma: "",
    canal: "",
    melhorHorario: "",
    observacoesComunicacao: "",
    precisaLegendas: false,
    precisaInterprete: false,
    precisaLeitorTela: false,
    precisaBaixaEstimulo: false,
    precisaMobilidade: false,
    precisaTempoExtra: false,
    detalhesNecessidades: "",
    consentimentoPcd: false,
    pcdIdentificacao: "",
    pcdTipo: "",
    pcdComprovacao: "",
    pcdObservacoes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/PortalVagas/Accessibility", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as AccessibilityResponse | null;
      if (!res.ok || !json) throw new Error();
      setData(json);
      setForm({
        idioma: json.idioma ?? "",
        canal: json.canal ?? "",
        melhorHorario: json.melhorHorario ?? "",
        observacoesComunicacao: json.observacoesComunicacao ?? "",
        precisaLegendas: json.precisaLegendas ?? false,
        precisaInterprete: json.precisaInterprete ?? false,
        precisaLeitorTela: json.precisaLeitorTela ?? false,
        precisaBaixaEstimulo: json.precisaBaixaEstimulo ?? false,
        precisaMobilidade: json.precisaMobilidade ?? false,
        precisaTempoExtra: json.precisaTempoExtra ?? false,
        detalhesNecessidades: json.detalhesNecessidades ?? "",
        consentimentoPcd: json.consentimentoPcd ?? false,
        pcdIdentificacao: json.pcdIdentificacao ?? "",
        pcdTipo: json.pcdTipo ?? "",
        pcdComprovacao: json.pcdComprovacao ?? "",
        pcdObservacoes: json.pcdObservacoes ?? "",
      });
    } catch {
      toast.error("Falha ao carregar acessibilidade.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    try {
      const res = await apiFetch("/PortalVagas/Accessibility", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idioma: form.idioma || null,
          canal: form.canal || null,
          melhorHorario: form.melhorHorario || null,
          observacoesComunicacao: form.observacoesComunicacao || null,
          precisaLegendas: form.precisaLegendas,
          precisaInterprete: form.precisaInterprete,
          precisaLeitorTela: form.precisaLeitorTela,
          precisaBaixaEstimulo: form.precisaBaixaEstimulo,
          precisaMobilidade: form.precisaMobilidade,
          precisaTempoExtra: form.precisaTempoExtra,
          detalhesNecessidades: form.detalhesNecessidades || null,
          consentimentoPcd: form.consentimentoPcd,
          pcdIdentificacao: form.pcdIdentificacao || null,
          pcdTipo: form.pcdTipo || null,
          pcdComprovacao: form.pcdComprovacao || null,
          pcdObservacoes: form.pcdObservacoes || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Preferências salvas.");
      void load();
    } catch {
      toast.error("Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-muted-foreground text-sm">Carregando acessibilidade...</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <div>
          <label className="text-xs text-muted-foreground">Idioma preferido</label>
          <input className="form-control" value={form.idioma} onChange={(e) => setForm((f) => ({ ...f, idioma: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Canal preferido</label>
          <input className="form-control" value={form.canal} onChange={(e) => setForm((f) => ({ ...f, canal: e.target.value }))} placeholder="Ex: Vídeo, Áudio" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Melhor horário</label>
          <input className="form-control" value={form.melhorHorario} onChange={(e) => setForm((f) => ({ ...f, melhorHorario: e.target.value }))} />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-muted-foreground">Observações de comunicação</label>
          <textarea className="form-control" rows={2} value={form.observacoesComunicacao} onChange={(e) => setForm((f) => ({ ...f, observacoesComunicacao: e.target.value }))} />
        </div>
      </div>
      <div>
        <h4 className="mini-title mb-2">Necessidades de acessibilidade</h4>
        <div className="flex flex-wrap gap-4">
          {(
            [
              ["precisaLegendas", "Legendas"],
              ["precisaInterprete", "Intérprete"],
              ["precisaLeitorTela", "Leitor de tela"],
              ["precisaBaixaEstimulo", "Baixo estímulo"],
              ["precisaMobilidade", "Mobilidade"],
              ["precisaTempoExtra", "Tempo extra"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <input type="checkbox" checked={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <div className="mt-2">
          <label className="text-xs text-muted-foreground">Detalhes das necessidades</label>
          <textarea className="form-control" rows={2} value={form.detalhesNecessidades} onChange={(e) => setForm((f) => ({ ...f, detalhesNecessidades: e.target.value }))} />
        </div>
      </div>
      <div>
        <h4 className="mini-title mb-2">PcD (Pessoa com Deficiência)</h4>
        <label className="flex items-center gap-2 mb-2">
          <input type="checkbox" checked={form.consentimentoPcd} onChange={(e) => setForm((f) => ({ ...f, consentimentoPcd: e.target.checked }))} />
          <span>Declaro-me pessoa com deficiência</span>
        </label>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div>
            <label className="text-xs text-muted-foreground">Identificação</label>
            <input className="form-control" value={form.pcdIdentificacao} onChange={(e) => setForm((f) => ({ ...f, pcdIdentificacao: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Tipo</label>
            <input className="form-control" value={form.pcdTipo} onChange={(e) => setForm((f) => ({ ...f, pcdTipo: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Comprovação</label>
            <input className="form-control" value={form.pcdComprovacao} onChange={(e) => setForm((f) => ({ ...f, pcdComprovacao: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground">Observações PcD</label>
            <textarea className="form-control" rows={2} value={form.pcdObservacoes} onChange={(e) => setForm((f) => ({ ...f, pcdObservacoes: e.target.value }))} />
          </div>
        </div>
      </div>
      <button className="btn-brand" type="button" disabled={saving} onClick={() => void save()}>
        {saving ? "Salvando..." : "Salvar acessibilidade"}
      </button>
    </div>
  );
}
