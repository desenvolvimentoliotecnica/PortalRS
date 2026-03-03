"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import type { LgpdResponse } from "./types";

export default function PortalVagasLgpdSection() {
  const [data, setData] = useState<LgpdResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    processarCandidatura: true,
    permitirContato: true,
    bancoTalentos: false,
    retencaoMeses: "" as string | number,
    compartilhamento: "",
    dadosSensiveis: false,
    comunicacoes: true,
  });
  const [receiptHtml, setReceiptHtml] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/PortalVagas/Lgpd", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as LgpdResponse | null;
      if (!res.ok || !json) throw new Error();
      setData(json);
      setForm({
        processarCandidatura: json.processarCandidatura ?? true,
        permitirContato: json.permitirContato ?? true,
        bancoTalentos: json.bancoTalentos ?? false,
        retencaoMeses: json.retencaoMeses ?? "",
        compartilhamento: json.compartilhamento ?? "",
        dadosSensiveis: json.dadosSensiveis ?? false,
        comunicacoes: json.comunicacoes ?? true,
      });
    } catch {
      toast.error("Falha ao carregar LGPD.");
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
      const res = await apiFetch("/PortalVagas/Lgpd", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          processarCandidatura: form.processarCandidatura,
          permitirContato: form.permitirContato,
          bancoTalentos: form.bancoTalentos,
          retencaoMeses: form.retencaoMeses ? Number(form.retencaoMeses) : null,
          compartilhamento: form.compartilhamento || null,
          dadosSensiveis: form.dadosSensiveis,
          comunicacoes: form.comunicacoes,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Consentimentos salvos.");
      void load();
    } catch {
      toast.error("Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function loadReceipt() {
    try {
      const res = await apiFetch("/PortalVagas/Lgpd/Receipt", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as { html?: string } | null;
      if (!res.ok || !json?.html) throw new Error();
      setReceiptHtml(json.html);
    } catch {
      toast.error("Falha ao gerar comprovante.");
    }
  }

  if (loading) return <div className="text-muted-foreground text-sm">Carregando LGPD...</div>;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.processarCandidatura} onChange={(e) => setForm((f) => ({ ...f, processarCandidatura: e.target.checked }))} />
          <span>Autorizo o processamento da minha candidatura</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.permitirContato} onChange={(e) => setForm((f) => ({ ...f, permitirContato: e.target.checked }))} />
          <span>Permito contato para recrutamento</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.bancoTalentos} onChange={(e) => setForm((f) => ({ ...f, bancoTalentos: e.target.checked }))} />
          <span>Autorizo inclusão no banco de talentos</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.dadosSensiveis} onChange={(e) => setForm((f) => ({ ...f, dadosSensiveis: e.target.checked }))} />
          <span>Informo dados sensíveis (PcD, etc.)</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.comunicacoes} onChange={(e) => setForm((f) => ({ ...f, comunicacoes: e.target.checked }))} />
          <span>Autorizo comunicações de marketing</span>
        </label>
        <div>
          <label className="text-xs text-muted-foreground">Retenção (meses)</label>
          <input className="form-control w-24" type="number" value={form.retencaoMeses} onChange={(e) => setForm((f) => ({ ...f, retencaoMeses: e.target.value || "" }))} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Compartilhamento</label>
          <textarea className="form-control" rows={2} value={form.compartilhamento} onChange={(e) => setForm((f) => ({ ...f, compartilhamento: e.target.value }))} />
        </div>
      </div>
      <div className="flex gap-2">
        <button className="btn-brand" type="button" disabled={saving} onClick={() => void save()}>
          {saving ? "Salvando..." : "Salvar consentimentos"}
        </button>
        <button className="btn-ghost" type="button" onClick={() => void loadReceipt()}>
          Gerar comprovante
        </button>
      </div>
      {data?.consentidoEmUtc && (
        <p className="text-xs text-muted-foreground">Último consentimento: {new Date(data.consentidoEmUtc).toLocaleString("pt-BR")}</p>
      )}
      {receiptHtml && (
        <div className="mt-4 rounded border border-border/60 p-4">
          <div className="flex justify-between">
            <strong>Comprovante LGPD</strong>
            <button className="btn-ghost text-xs" type="button" onClick={() => setReceiptHtml(null)}>Fechar</button>
          </div>
          <div className="mt-2 max-h-64 overflow-auto text-sm [&_*]:max-w-full" dangerouslySetInnerHTML={{ __html: receiptHtml }} />
        </div>
      )}
    </div>
  );
}
