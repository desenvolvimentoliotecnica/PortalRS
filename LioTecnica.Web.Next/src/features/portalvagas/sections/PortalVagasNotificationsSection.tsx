"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import type { NotificationsResponse } from "./types";

export default function PortalVagasNotificationsSection() {
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    canalEmail: true,
    canalWhatsapp: false,
    canalSms: false,
    canalPush: false,
    frequencia: "",
    idioma: "pt-BR",
    email: "",
    telefone: "",
    permiteContato: true,
    alertaNovasVagas: true,
    alertaAtualizacoes: true,
    alertaEntrevistas: true,
    alertaMensagens: true,
    alertaDocumentos: true,
    alertaLembretes: false,
    silencioAtivo: "",
    silencioInicio: "",
    silencioFim: "",
    silencioPrioridade: "",
    assinatura: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/PortalVagas/Notifications", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as NotificationsResponse | null;
      if (!res.ok || !json) throw new Error();
      setData(json);
      setForm({
        canalEmail: json.canalEmail ?? true,
        canalWhatsapp: json.canalWhatsapp ?? false,
        canalSms: json.canalSms ?? false,
        canalPush: json.canalPush ?? false,
        frequencia: json.frequencia ?? "",
        idioma: json.idioma ?? "pt-BR",
        email: json.email ?? "",
        telefone: json.telefone ?? "",
        permiteContato: json.permiteContato ?? true,
        alertaNovasVagas: json.alertaNovasVagas ?? true,
        alertaAtualizacoes: json.alertaAtualizacoes ?? true,
        alertaEntrevistas: json.alertaEntrevistas ?? true,
        alertaMensagens: json.alertaMensagens ?? true,
        alertaDocumentos: json.alertaDocumentos ?? true,
        alertaLembretes: json.alertaLembretes ?? false,
        silencioAtivo: json.silencioAtivo ?? "",
        silencioInicio: json.silencioInicio ?? "",
        silencioFim: json.silencioFim ?? "",
        silencioPrioridade: json.silencioPrioridade ?? "",
        assinatura: json.assinatura ?? "",
      });
    } catch {
      toast.error("Falha ao carregar notificações.");
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
      const res = await apiFetch("/PortalVagas/Notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          frequencia: form.frequencia || null,
          idioma: form.idioma || null,
          email: form.email || null,
          telefone: form.telefone || null,
          silencioAtivo: form.silencioAtivo || null,
          silencioInicio: form.silencioInicio || null,
          silencioFim: form.silencioFim || null,
          silencioPrioridade: form.silencioPrioridade || null,
          assinatura: form.assinatura || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Notificações salvas.");
      void load();
    } catch {
      toast.error("Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  function buildPreview() {
    const channels: string[] = [];
    if (form.canalEmail) channels.push("E-mail");
    if (form.canalWhatsapp) channels.push("WhatsApp");
    if (form.canalSms) channels.push("SMS");
    if (form.canalPush) channels.push("Push");

    const types: string[] = [];
    if (form.alertaNovasVagas) types.push("Vagas");
    if (form.alertaAtualizacoes) types.push("Status");
    if (form.alertaEntrevistas) types.push("Entrevistas");
    if (form.alertaMensagens) types.push("Mensagens");
    if (form.alertaDocumentos) types.push("Docs");
    if (form.alertaLembretes) types.push("Lembretes");

    const quiet =
      form.silencioAtivo?.toLowerCase() === "sim"
        ? `Silêncio: ${form.silencioInicio || "?"}-${form.silencioFim || "?"} (${form.silencioPrioridade || "Normal"})`
        : "Sem silêncio";

    return `${channels.join(", ") || "Nenhum canal"} | ${form.frequencia || "Sem frequência"} | ${types.join(", ") || "Sem alertas"} | ${quiet}`;
  }

  function testNotify() {
    toast.info("Teste de notificação (MVP): sua configuração foi aplicada.");
  }

  if (loading) return <div className="text-muted-foreground text-sm">Carregando notificações...</div>;

  return (
    <div className="space-y-4">
      <div>
        <h4 className="mini-title mb-2">Canais</h4>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.canalEmail} onChange={(e) => setForm((f) => ({ ...f, canalEmail: e.target.checked }))} />
            <span>E-mail</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.canalWhatsapp} onChange={(e) => setForm((f) => ({ ...f, canalWhatsapp: e.target.checked }))} />
            <span>WhatsApp</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.canalSms} onChange={(e) => setForm((f) => ({ ...f, canalSms: e.target.checked }))} />
            <span>SMS</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.canalPush} onChange={(e) => setForm((f) => ({ ...f, canalPush: e.target.checked }))} />
            <span>Push</span>
          </label>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <div>
          <label className="text-xs text-muted-foreground">E-mail para notificações</label>
          <input className="form-control" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Telefone</label>
          <input className="form-control" value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Frequência</label>
          <input className="form-control" value={form.frequencia} onChange={(e) => setForm((f) => ({ ...f, frequencia: e.target.value }))} placeholder="Ex: Diário, Semanal" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Idioma</label>
          <input className="form-control" value={form.idioma} onChange={(e) => setForm((f) => ({ ...f, idioma: e.target.value }))} />
        </div>
      </div>
      <div>
        <h4 className="mini-title mb-2">Alertas</h4>
        <div className="flex flex-wrap gap-4">
          {(
            [
              ["alertaNovasVagas", "Novas vagas"],
              ["alertaAtualizacoes", "Atualizações"],
              ["alertaEntrevistas", "Entrevistas"],
              ["alertaMensagens", "Mensagens"],
              ["alertaDocumentos", "Documentos"],
              ["alertaLembretes", "Lembretes"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <input type="checkbox" checked={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={form.permiteContato} onChange={(e) => setForm((f) => ({ ...f, permiteContato: e.target.checked }))} />
        <span>Permitir contato para recrutamento</span>
      </label>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <div>
          <label className="text-xs text-muted-foreground">Silêncio início</label>
          <input className="form-control" value={form.silencioInicio} onChange={(e) => setForm((f) => ({ ...f, silencioInicio: e.target.value }))} /> 
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Silêncio fim</label>
          <input className="form-control" value={form.silencioFim} onChange={(e) => setForm((f) => ({ ...f, silencioFim: e.target.value }))} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn-brand" type="button" disabled={saving} onClick={() => void save()}>
          {saving ? "Salvando..." : "Salvar notificações"}
        </button>
        <button className="btn-ghost" type="button" onClick={testNotify}>
          Testar
        </button>
      </div>
      <div className="rounded-lg border border-border/60 bg-slate-50 p-3 text-sm text-muted-foreground">
        <strong className="text-slate-700">Resumo:</strong> {buildPreview()}
      </div>
    </div>
  );
}
