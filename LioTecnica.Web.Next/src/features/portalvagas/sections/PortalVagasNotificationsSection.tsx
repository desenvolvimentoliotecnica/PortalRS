"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import type { NotificationsResponse } from "./types";

/** Alinhado ao portal candidato e ao contrato varchar da API (Frequencia até 40 chars). */
const FREQUENCY_OPTIONS = [
  { value: "", label: "— Definir depois —" },
  { value: "immediate", label: "Imediato" },
  { value: "daily", label: "Resumo diário" },
  { value: "weekly", label: "Resumo semanal" },
  { value: "urgent", label: "Somente urgentes" },
] as const;

/** CandidaturaNotificacaoService.EstaDentroSilencio: ligado = true / 1 / on; vazio com janela ainda respeita horários. */
const SILENCIO_ATIVO_OPTIONS = [
  { value: "", label: "Automático (null — usa horários se preenchidos)" },
  { value: "true", label: "Sim (true)" },
  { value: "false", label: "Não (false)" },
] as const;

const SILENCIO_PRIORIDADE_OPTIONS = [
  { value: "", label: "—" },
  { value: "normal", label: "Normal" },
  { value: "urgent", label: "Só urgentes" },
  { value: "all", label: "Todas" },
] as const;

function silencioFlag(raw: string | undefined): "on" | "off" | "auto" {
  const t = (raw ?? "").trim().toLowerCase();
  if (!t) return "auto";
  if (t === "true" || t === "1" || t === "on" || t === "sim") return "on";
  if (t === "false" || t === "0") return "off";
  return "off";
}

function normalizeSilencioAtivo(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  const l = t.toLowerCase();
  if (!t) return "";
  if (l === "true" || l === "1" || l === "on" || l === "sim") return "true";
  if (l === "false" || l === "0") return "false";
  return t.slice(0, 10);
}

function slugNorm(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

const LEGACY_FREQ: Record<string, string> = {
  imediato: "immediate",
  "resumo diario": "daily",
  "resumo semanal": "weekly",
  urgentes: "urgent",
  "somente urgentes": "urgent",
};

function normalizeFrequencia(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  if (FREQUENCY_OPTIONS.some((o) => o.value === t)) return t;
  const slug = slugNorm(t);
  return LEGACY_FREQ[slug] ?? t.slice(0, 40);
}

function normalizeSilencioPrioridade(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  const slug = slugNorm(t);
  if (slug === "normal" || t === "normal") return "normal";
  if (slug === "somente urgentes" || slug === "so urgentes" || t === "urgent") return "urgent";
  if (slug === "todas" || slug === "todos" || t === "all") return "all";
  return t.slice(0, 20);
}

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
        frequencia: normalizeFrequencia(json.frequencia ?? ""),
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
        silencioAtivo: normalizeSilencioAtivo(json.silencioAtivo ?? ""),
        silencioInicio: (json.silencioInicio ?? "").trim().slice(0, 10),
        silencioFim: (json.silencioFim ?? "").trim().slice(0, 10),
        silencioPrioridade: normalizeSilencioPrioridade(json.silencioPrioridade ?? ""),
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
          frequencia: form.frequencia.trim().slice(0, 40) || null,
          idioma: form.idioma || null,
          email: form.email || null,
          telefone: form.telefone || null,
          silencioAtivo: form.silencioAtivo.trim().slice(0, 10) || null,
          silencioInicio: form.silencioInicio.trim().slice(0, 10) || null,
          silencioFim: form.silencioFim.trim().slice(0, 10) || null,
          silencioPrioridade: form.silencioPrioridade.trim().slice(0, 20) || null,
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

  function formatFrequenciaLabel(v: string) {
    const t = v.trim();
    if (!t) return "Sem frequência";
    const row = FREQUENCY_OPTIONS.find((o) => o.value === t);
    return row?.label ?? t;
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

    const hasJanela = Boolean(form.silencioInicio?.trim() && form.silencioFim?.trim());
    const flag = silencioFlag(form.silencioAtivo);
    let quiet: string;
    if (flag === "off") {
      quiet = "Silêncio: desligado (silencioAtivo bloqueia horários)";
    } else if (!hasJanela) {
      quiet = "Silêncio: sem janela HH:mm (servidor só aplica quando início e fim estão preenchidos)";
    } else {
      const priRow = SILENCIO_PRIORIDADE_OPTIONS.find((o) => o.value === (form.silencioPrioridade ?? "").trim());
      const pri = priRow?.label ?? (form.silencioPrioridade?.trim() || "—");
      const modo = flag === "auto" ? "automático" : "explicitamente ligado";
      quiet = `Silêncio: ${form.silencioInicio}–${form.silencioFim}; prioridade ${pri} (${modo})`;
    }

    return `${channels.join(", ") || "Nenhum canal"} | ${formatFrequenciaLabel(form.frequencia)} | ${types.join(", ") || "Sem alertas"} | ${quiet}`;
  }

  function testNotify() {
    toast.info("Teste de notificação (MVP): sua configuração foi aplicada.");
  }

  const frequencySelectOptions = useMemo((): { value: string; label: string }[] => {
    const opts: { value: string; label: string }[] = FREQUENCY_OPTIONS.map((o) => ({ value: o.value, label: o.label }));
    const v = form.frequencia.trim();
    if (v && !opts.some((o) => o.value === v)) opts.push({ value: v, label: `(legado) ${v}` });
    return opts;
  }, [form.frequencia]);

  const silencioPrioridadeOptions = useMemo((): { value: string; label: string }[] => {
    const opts: { value: string; label: string }[] = SILENCIO_PRIORIDADE_OPTIONS.map((o) => ({ value: o.value, label: o.label }));
    const v = form.silencioPrioridade.trim();
    if (v && !opts.some((o) => o.value === v)) opts.push({ value: v, label: `(legado) ${v}` });
    return opts;
  }, [form.silencioPrioridade]);

  const silencioAtivoOptions = useMemo((): { value: string; label: string }[] => {
    const opts: { value: string; label: string }[] = SILENCIO_ATIVO_OPTIONS.map((o) => ({ value: o.value, label: o.label }));
    const v = form.silencioAtivo.trim();
    if (v && !opts.some((o) => o.value === v)) opts.push({ value: v, label: `(legado) ${v}` });
    return opts;
  }, [form.silencioAtivo]);

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
          <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Telefone</label>
          <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Frequência (immediate · daily · weekly · urgent)</label>
          <select
            className="form-input w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            value={form.frequencia}
            onChange={(e) => setForm((f) => ({ ...f, frequencia: e.target.value }))}
          >
            {frequencySelectOptions.map((o) => (
              <option key={`${o.label}-${o.value}`} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Idioma</label>
          <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={form.idioma} onChange={(e) => setForm((f) => ({ ...f, idioma: e.target.value }))} />
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
        <div className="md:col-span-2">
          <label className="text-xs text-muted-foreground">Silêncio ativo (SilencioAtivo · true/false até 10 chars)</label>
          <select
            className="form-input w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            value={form.silencioAtivo}
            onChange={(e) => setForm((f) => ({ ...f, silencioAtivo: e.target.value }))}
          >
            {silencioAtivoOptions.map((o) => (
              <option key={`${o.label}-${o.value}`} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Silêncio início (HH:mm)</label>
          <input
            className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            maxLength={10}
            value={form.silencioInicio}
            onChange={(e) => setForm((f) => ({ ...f, silencioInicio: e.target.value }))}
            placeholder="22:00"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Silêncio fim (HH:mm)</label>
          <input
            className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            maxLength={10}
            value={form.silencioFim}
            onChange={(e) => setForm((f) => ({ ...f, silencioFim: e.target.value }))}
            placeholder="07:00"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-muted-foreground">Prioridade no silêncio (até 20 chars)</label>
          <select
            className="form-input w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            value={form.silencioPrioridade}
            onChange={(e) => setForm((f) => ({ ...f, silencioPrioridade: e.target.value }))}
          >
            {silencioPrioridadeOptions.map((o) => (
              <option key={`${o.label}-${o.value}`} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={saving} onClick={() => void save()}>
          {saving ? "Salvando..." : "Salvar notificações"}
        </Button>
        <Button variant="outline" size="sm" onClick={testNotify}>
          Testar
        </Button>
      </div>
      <div className="rounded-lg border border-border/60 bg-slate-50 p-3 text-sm text-muted-foreground">
        <strong className="text-slate-700">Resumo:</strong> {buildPreview()}
      </div>
    </div>
  );
}
