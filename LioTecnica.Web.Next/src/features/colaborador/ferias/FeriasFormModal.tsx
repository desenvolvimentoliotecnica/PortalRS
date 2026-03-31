"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Save, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const API = "/api/colaborador/solicitacoes-ferias";

interface FeriasFormValues {
  periodoAquisitivo: string;
  dataInicio: string;
  dataFim: string;
  qtdDias: number | "";
  abonoPecuniario: boolean;
  diasAbono: number;
  adiantamento13: boolean;
  observacoes: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(url, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

function calcDias(inicio: string, fim: string): number {
  if (!inicio || !fim) return 0;
  const diff = Math.floor(
    (new Date(fim).getTime() - new Date(inicio).getTime()) / 86400000
  ) + 1;
  return diff > 0 ? diff : 0;
}

function addDaysToDate(dateStr: string, days: number): string {
  if (!dateStr || days <= 0) return "";
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days - 1);
  return d.toISOString().slice(0, 10);
}

const INITIAL: FeriasFormValues = {
  periodoAquisitivo: "",
  dataInicio: "",
  dataFim: "",
  qtdDias: "",
  abonoPecuniario: false,
  diasAbono: 10,
  adiantamento13: false,
  observacoes: "",
};

export default function FeriasFormModal({ open, onClose, onSuccess }: Props) {
  const [form, setForm] = useState<FeriasFormValues>(INITIAL);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof FeriasFormValues>(key: K, value: FeriasFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleDataInicioChange(value: string) {
    setForm((prev) => {
      const dias = prev.dataFim
        ? calcDias(value, prev.dataFim)
        : typeof prev.qtdDias === "number" && prev.qtdDias > 0
        ? prev.qtdDias
        : 0;
      const newFim =
        !prev.dataFim && typeof prev.qtdDias === "number" && prev.qtdDias > 0
          ? addDaysToDate(value, prev.qtdDias)
          : prev.dataFim;
      return {
        ...prev,
        dataInicio: value,
        dataFim: newFim,
        qtdDias: prev.dataFim ? dias : prev.qtdDias,
      };
    });
  }

  function handleDataFimChange(value: string) {
    setForm((prev) => {
      const dias = prev.dataInicio ? calcDias(prev.dataInicio, value) : prev.qtdDias;
      return { ...prev, dataFim: value, qtdDias: dias };
    });
  }

  function handleQtdDiasChange(value: string) {
    const n = value === "" ? "" : Math.max(1, parseInt(value, 10) || 1);
    setForm((prev) => {
      const newFim =
        prev.dataInicio && typeof n === "number" && n > 0
          ? addDaysToDate(prev.dataInicio, n)
          : prev.dataFim;
      return { ...prev, qtdDias: n, dataFim: newFim };
    });
  }

  const isQtdDiasReadonly = !!(form.dataInicio && form.dataFim);
  const computedQtdDias =
    form.dataInicio && form.dataFim
      ? calcDias(form.dataInicio, form.dataFim)
      : form.qtdDias;

  async function handleSave() {
    if (!form.dataInicio) { toast.error("Informe a data de início."); return; }
    if (!form.dataFim)    { toast.error("Informe a data de fim."); return; }
    const dias = calcDias(form.dataInicio, form.dataFim);
    if (dias <= 0) { toast.error("A data de fim deve ser posterior à data de início."); return; }
    if (form.abonoPecuniario && (!form.diasAbono || form.diasAbono < 1 || form.diasAbono > 10)) {
      toast.error("Dias de abono devem ser entre 1 e 10."); return;
    }

    setSaving(true);
    try {
      const body = {
        periodoAquisitivo: form.periodoAquisitivo.trim() || null,
        dataInicio: form.dataInicio,
        dataFim: form.dataFim,
        qtdDias: dias,
        abonoPecuniario: form.abonoPecuniario,
        diasAbono: form.abonoPecuniario ? form.diasAbono : 0,
        adiantamento13: form.adiantamento13,
        observacoes: form.observacoes.trim() || null,
      };
      await fetchJson(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      toast.success("Solicitação de férias enviada!");
      onSuccess();
    } catch (e) {
      toast.error(`Falha ao salvar: ${e instanceof Error ? e.message : "erro desconhecido"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Solicitar Férias</DialogTitle>
          <DialogDescription>
            Preencha os dados para solicitar suas férias.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Período aquisitivo */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              Período Aquisitivo
            </label>
            <Input
              value={form.periodoAquisitivo}
              onChange={(e) => set("periodoAquisitivo", e.target.value)}
              placeholder="Ex: 2024/2025"
            />
          </div>

          {/* Dates + qtdDias */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                Data de Início *
              </label>
              <Input
                type="date"
                value={form.dataInicio}
                onChange={(e) => handleDataInicioChange(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                Data de Fim *
              </label>
              <Input
                type="date"
                value={form.dataFim}
                min={form.dataInicio || undefined}
                onChange={(e) => handleDataFimChange(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                Qtd. Dias
              </label>
              <Input
                type="number"
                min={1}
                value={isQtdDiasReadonly ? computedQtdDias : form.qtdDias}
                readOnly={isQtdDiasReadonly}
                onChange={
                  isQtdDiasReadonly ? undefined : (e) => handleQtdDiasChange(e.target.value)
                }
                className={isQtdDiasReadonly ? "opacity-70 cursor-default" : ""}
                placeholder="—"
              />
              {isQtdDiasReadonly && (
                <div className="text-xs text-muted-foreground mt-1">Calculado automaticamente</div>
              )}
            </div>
          </div>

          {/* Abono Pecuniário */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.abonoPecuniario}
                onChange={(e) => set("abonoPecuniario", e.target.checked)}
                className="rounded"
              />
              Abono Pecuniário (venda de dias de férias)
            </label>

            {form.abonoPecuniario && (
              <div className="ml-6">
                <label className="text-xs text-muted-foreground block mb-1">
                  Dias de Abono (1–10)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={form.diasAbono}
                  onChange={(e) => {
                    const v = Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1));
                    set("diasAbono", v);
                  }}
                  className="max-w-[100px]"
                />
              </div>
            )}
          </div>

          {/* Adiantamento 13° */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.adiantamento13}
              onChange={(e) => set("adiantamento13", e.target.checked)}
              className="rounded"
            />
            Antecipar 13º salário
          </label>

          {/* Observações */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              Observações
            </label>
            <textarea
              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Alguma informação adicional? (opcional)"
              value={form.observacoes}
              onChange={(e) => set("observacoes", e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            <X className="size-4" /> Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="size-4" /> {saving ? "Enviando…" : "Solicitar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
