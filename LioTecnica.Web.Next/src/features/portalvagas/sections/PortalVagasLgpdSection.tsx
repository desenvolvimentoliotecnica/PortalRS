"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { confirmDialog } from "@/lib/confirm-dialog";
import { Button } from "@/components/ui/button";
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

  function lgpdRequestAccess() {
    toast.info("Solicitação de acesso registrada (MVP).");
  }

  function lgpdRequestCorrection() {
    toast.info("Solicitação de correção registrada (MVP).");
  }

  async function lgpdRequestDeletion() {
    const ok = await confirmDialog({
      title: "Solicitar exclusão",
      description: "Solicitar exclusão dos dados? (MVP)",
      confirmText: "Solicitar",
      destructive: true,
    });
    if (!ok) return;
    toast.success("Solicitação de exclusão registrada (MVP).");
  }

  async function lgpdRevokeConsent() {
    const ok = await confirmDialog({
      title: "Revogar consentimentos",
      description: "Revogar todos os consentimentos?",
      confirmText: "Revogar",
      destructive: true,
    });
    if (!ok) return;
    setForm((f) => ({
      ...f,
      processarCandidatura: false,
      permitirContato: false,
      bancoTalentos: false,
      dadosSensiveis: false,
      comunicacoes: false,
    }));
    try {
      const res = await apiFetch("/PortalVagas/Lgpd", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          processarCandidatura: false,
          permitirContato: false,
          bancoTalentos: false,
          retencaoMeses: form.retencaoMeses ? Number(form.retencaoMeses) : null,
          compartilhamento: form.compartilhamento || null,
          dadosSensiveis: false,
          comunicacoes: false,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Consentimentos revogados.");
      void load();
    } catch {
      toast.error("Falha ao revogar consentimentos.");
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
          <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm w-24" type="number" value={form.retencaoMeses} onChange={(e) => setForm((f) => ({ ...f, retencaoMeses: e.target.value || "" }))} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Compartilhamento</label>
          <textarea className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" rows={2} value={form.compartilhamento} onChange={(e) => setForm((f) => ({ ...f, compartilhamento: e.target.value }))} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={saving} onClick={() => void save()}>
          {saving ? "Salvando..." : "Salvar consentimentos"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => void loadReceipt()}>
          Gerar comprovante
        </Button>
        <Button variant="outline" size="sm" onClick={() => void lgpdRevokeConsent()}>
          Revogar consentimento
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <Button variant="outline" size="sm" onClick={lgpdRequestAccess}>
          Solicitar acesso aos dados
        </Button>
        <Button variant="outline" size="sm" onClick={lgpdRequestCorrection}>
          Solicitar correção
        </Button>
        <Button variant="destructive" size="sm" onClick={lgpdRequestDeletion}>
          Solicitar exclusão
        </Button>
      </div>
      {data?.consentidoEmUtc && (
        <p className="text-xs text-muted-foreground">Último consentimento: {new Date(data.consentidoEmUtc).toLocaleString("pt-BR")}</p>
      )}
      {receiptHtml && (
        <div className="mt-4 rounded border border-border/60 p-4">
          <div className="flex justify-between">
            <strong>Comprovante LGPD</strong>
            <Button variant="outline" size="sm" onClick={() => setReceiptHtml(null)}>Fechar</Button>
          </div>
          <div className="mt-2 max-h-64 overflow-auto text-sm [&_*]:max-w-full" dangerouslySetInnerHTML={{ __html: receiptHtml }} />
        </div>
      )}
    </div>
  );
}
