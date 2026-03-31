"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Save, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const API = "/api/colaborador/solicitacoes-beneficio";

const TIPO_BENEFICIO_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Vale Refeição" },
  { value: 1, label: "Vale Alimentação" },
  { value: 2, label: "Plano de Saúde" },
  { value: 3, label: "Plano Odontológico" },
  { value: 4, label: "Vale Transporte" },
  { value: 5, label: "Seguro de Vida" },
  { value: 6, label: "Aux. Creche" },
  { value: 7, label: "Gympass" },
  { value: 8, label: "Outro" },
];

const TIPO_ALTERACAO_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Inclusão" },
  { value: 1, label: "Exclusão" },
  { value: 2, label: "Alteração de Plano" },
];

interface BeneficioFormValues {
  tipoBeneficio: number;
  tipoAlteracao: number;
  descricao: string;
  incluirDependentes: boolean;
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

const INITIAL: BeneficioFormValues = {
  tipoBeneficio: 0,
  tipoAlteracao: 0,
  descricao: "",
  incluirDependentes: false,
  observacoes: "",
};

export default function BeneficioFormModal({ open, onClose, onSuccess }: Props) {
  const [form, setForm] = useState<BeneficioFormValues>(INITIAL);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof BeneficioFormValues>(key: K, value: BeneficioFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.descricao.trim()) {
      toast.error("Preencha a descrição da solicitação.");
      return;
    }

    setSaving(true);
    try {
      const body = {
        tipoBeneficio: form.tipoBeneficio,
        tipoAlteracao: form.tipoAlteracao,
        descricao: form.descricao.trim(),
        incluirDependentes: form.incluirDependentes,
        observacoes: form.observacoes.trim() || null,
      };
      await fetchJson(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      toast.success("Solicitação de benefício enviada!");
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
          <DialogTitle>Nova Solicitação de Benefício</DialogTitle>
          <DialogDescription>
            Preencha os dados para solicitar uma alteração de benefício.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tipo de Benefício */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              Benefício *
            </label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.tipoBeneficio}
              onChange={(e) => set("tipoBeneficio", Number(e.target.value))}
            >
              {TIPO_BENEFICIO_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Tipo de Alteração */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              Tipo de Alteração *
            </label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.tipoAlteracao}
              onChange={(e) => set("tipoAlteracao", Number(e.target.value))}
            >
              {TIPO_ALTERACAO_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Descrição */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              Descrição *
            </label>
            <textarea
              className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Descreva o que precisa ser alterado..."
              value={form.descricao}
              onChange={(e) => set("descricao", e.target.value)}
            />
          </div>

          {/* Incluir Dependentes */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.incluirDependentes}
              onChange={(e) => set("incluirDependentes", e.target.checked)}
              className="rounded"
            />
            Incluir dependentes nesta solicitação
          </label>

          {/* Observações */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              Observações
            </label>
            <textarea
              className="w-full min-h-[70px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
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
