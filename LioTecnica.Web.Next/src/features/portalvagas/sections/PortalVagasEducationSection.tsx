"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { confirmDialog } from "@/lib/confirm-dialog";
import type { EducationItem, EducationResponse } from "./types";

export default function PortalVagasEducationSection() {
  const [data, setData] = useState<EducationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<EducationItem | null>(null);
  const [summary, setSummary] = useState({ nivel: "", areaPrincipal: "", situacao: "", destaques: "" });
  const [itemForm, setItemForm] = useState({
    curso: "",
    instituicao: "",
    tipo: "",
    status: "",
    inicio: "",
    fim: "",
    observacoes: "",
    link: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/PortalVagas/Education", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as EducationResponse | null;
      if (!res.ok || !json) throw new Error();
      setData(json);
      setSummary({
        nivel: json.summary?.nivel ?? "",
        areaPrincipal: json.summary?.areaPrincipal ?? "",
        situacao: json.summary?.situacao ?? "",
        destaques: json.summary?.destaques ?? "",
      });
    } catch {
      toast.error("Falha ao carregar formação.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSummary() {
    setSaving(true);
    try {
      const res = await apiFetch("/PortalVagas/Education/Summary", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(summary),
      });
      if (!res.ok) throw new Error();
      toast.success("Resumo salvo.");
      void load();
    } catch {
      toast.error("Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function createItem() {
    if (!itemForm.curso) {
      toast.error("Preencha o curso.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch("/PortalVagas/Education/Items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemForm),
      });
      if (!res.ok) throw new Error();
      toast.success("Formação adicionada.");
      setItemForm({ curso: "", instituicao: "", tipo: "", status: "", inicio: "", fim: "", observacoes: "", link: "" });
      void load();
    } catch {
      toast.error("Falha ao adicionar.");
    } finally {
      setSaving(false);
    }
  }

  async function updateItem() {
    if (!editing || !itemForm.curso) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/PortalVagas/Education/Items/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemForm),
      });
      if (!res.ok) throw new Error();
      toast.success("Formação atualizada.");
      setEditing(null);
      setItemForm({ curso: "", instituicao: "", tipo: "", status: "", inicio: "", fim: "", observacoes: "", link: "" });
      void load();
    } catch {
      toast.error("Falha ao atualizar.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(id: string) {
    if (!(await confirmDialog({ title: "Remover formação", description: "Remover esta formação?", confirmText: "Remover", destructive: true }))) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/PortalVagas/Education/Items/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Removido.");
      void load();
    } catch {
      toast.error("Falha ao remover.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-muted-foreground text-sm">Carregando formação...</div>;

  return (
    <div className="space-y-4">
      <div>
        <h4 className="mini-title mb-2">Resumo da formação</h4>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div>
            <label className="text-xs text-muted-foreground">Nível</label>
            <input className="form-control" value={summary.nivel} onChange={(e) => setSummary((s) => ({ ...s, nivel: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Área principal</label>
            <input className="form-control" value={summary.areaPrincipal} onChange={(e) => setSummary((s) => ({ ...s, areaPrincipal: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Situação</label>
            <input className="form-control" value={summary.situacao} onChange={(e) => setSummary((s) => ({ ...s, situacao: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground">Destaques</label>
            <textarea className="form-control" rows={2} value={summary.destaques} onChange={(e) => setSummary((s) => ({ ...s, destaques: e.target.value }))} />
          </div>
        </div>
        <button className="btn-brand mt-2" type="button" disabled={saving} onClick={() => void saveSummary()}>
          {saving ? "Salvando..." : "Salvar resumo"}
        </button>
      </div>

      <div>
        <h4 className="mini-title mb-2">Formações</h4>
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <input className="form-control" placeholder="Curso *" value={itemForm.curso} onChange={(e) => setItemForm((f) => ({ ...f, curso: e.target.value }))} />
            <input className="form-control" placeholder="Instituição" value={itemForm.instituicao} onChange={(e) => setItemForm((f) => ({ ...f, instituicao: e.target.value }))} />
            <input className="form-control" placeholder="Tipo" value={itemForm.tipo} onChange={(e) => setItemForm((f) => ({ ...f, tipo: e.target.value }))} />
            <input className="form-control" placeholder="Status" value={itemForm.status} onChange={(e) => setItemForm((f) => ({ ...f, status: e.target.value }))} />
            <input className="form-control" placeholder="Início" value={itemForm.inicio} onChange={(e) => setItemForm((f) => ({ ...f, inicio: e.target.value }))} />
            <input className="form-control" placeholder="Fim" value={itemForm.fim} onChange={(e) => setItemForm((f) => ({ ...f, fim: e.target.value }))} />
            <input className="form-control md:col-span-2" placeholder="Link" value={itemForm.link} onChange={(e) => setItemForm((f) => ({ ...f, link: e.target.value }))} />
            <div className="md:col-span-2">
              <textarea className="form-control" rows={2} placeholder="Observações" value={itemForm.observacoes} onChange={(e) => setItemForm((f) => ({ ...f, observacoes: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            {editing ? (
              <>
                <button className="btn-brand" type="button" disabled={saving} onClick={() => void updateItem()}>Salvar</button>
                <button className="btn-ghost" type="button" onClick={() => { setEditing(null); setItemForm({ curso: "", instituicao: "", tipo: "", status: "", inicio: "", fim: "", observacoes: "", link: "" }); }}>Cancelar</button>
              </>
            ) : (
              <button className="btn-brand" type="button" disabled={saving} onClick={() => void createItem()}>Adicionar</button>
            )}
          </div>
          <ul className="space-y-1">
            {(data?.items ?? []).map((i) => (
              <li key={i.id} className="flex items-center justify-between rounded border border-border/60 px-2 py-1 text-sm">
                <span>{i.curso}{i.instituicao ? ` (${i.instituicao})` : ""}{i.inicio || i.fim ? ` - ${i.inicio || "?"} a ${i.fim || "atual"}` : ""}</span>
                <div className="flex gap-1">
                  <button className="btn-ghost text-xs" type="button" onClick={() => { setEditing(i); setItemForm({ curso: i.curso, instituicao: i.instituicao ?? "", tipo: i.tipo ?? "", status: i.status ?? "", inicio: i.inicio ?? "", fim: i.fim ?? "", observacoes: i.observacoes ?? "", link: i.link ?? "" }); }}>Editar</button>
                  <button className="btn-ghost text-xs text-red-600" type="button" onClick={() => void deleteItem(i.id)}>Excluir</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
