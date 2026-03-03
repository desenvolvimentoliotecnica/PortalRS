"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import type { ReferenceDto } from "./types";

type ReferencesResponse = { items: ReferenceDto[] };

export default function PortalVagasReferencesSection() {
  const [items, setItems] = useState<ReferenceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<ReferenceDto | null>(null);
  const [form, setForm] = useState({
    nome: "",
    relacao: "",
    empresa: "",
    cargo: "",
    contato: "",
    periodo: "",
    linkedin: "",
    observacoes: "",
    podeContatar: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/PortalVagas/References", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as ReferencesResponse | null;
      if (!res.ok || !json) throw new Error();
      setItems(json.items ?? []);
    } catch {
      toast.error("Falha ao carregar referências.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    if (!form.nome) {
      toast.error("Preencha o nome.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch("/PortalVagas/References", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          relacao: form.relacao || null,
          empresa: form.empresa || null,
          cargo: form.cargo || null,
          contato: form.contato || null,
          periodo: form.periodo || null,
          linkedin: form.linkedin || null,
          observacoes: form.observacoes || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Referência adicionada.");
      setForm({ nome: "", relacao: "", empresa: "", cargo: "", contato: "", periodo: "", linkedin: "", observacoes: "", podeContatar: true });
      void load();
    } catch {
      toast.error("Falha ao adicionar.");
    } finally {
      setSaving(false);
    }
  }

  async function update() {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/PortalVagas/References/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          relacao: form.relacao || null,
          empresa: form.empresa || null,
          cargo: form.cargo || null,
          contato: form.contato || null,
          periodo: form.periodo || null,
          linkedin: form.linkedin || null,
          observacoes: form.observacoes || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Referência atualizada.");
      setEditing(null);
      setForm({ nome: "", relacao: "", empresa: "", cargo: "", contato: "", periodo: "", linkedin: "", observacoes: "", podeContatar: true });
      void load();
    } catch {
      toast.error("Falha ao atualizar.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remover esta referência?")) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/PortalVagas/References/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Removido.");
      void load();
    } catch {
      toast.error("Falha ao remover.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-muted-foreground text-sm">Carregando referências...</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <input className="form-control" placeholder="Nome *" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
        <input className="form-control" placeholder="Relação" value={form.relacao} onChange={(e) => setForm((f) => ({ ...f, relacao: e.target.value }))} />
        <input className="form-control" placeholder="Empresa" value={form.empresa} onChange={(e) => setForm((f) => ({ ...f, empresa: e.target.value }))} />
        <input className="form-control" placeholder="Cargo" value={form.cargo} onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))} />
        <input className="form-control" placeholder="Contato" value={form.contato} onChange={(e) => setForm((f) => ({ ...f, contato: e.target.value }))} />
        <input className="form-control" placeholder="Período" value={form.periodo} onChange={(e) => setForm((f) => ({ ...f, periodo: e.target.value }))} />
        <input className="form-control md:col-span-2" placeholder="LinkedIn" value={form.linkedin} onChange={(e) => setForm((f) => ({ ...f, linkedin: e.target.value }))} />
        <div className="md:col-span-2">
          <textarea className="form-control" rows={2} placeholder="Observações" value={form.observacoes} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} />
        </div>
        <label className="flex items-center gap-2 md:col-span-2">
          <input type="checkbox" checked={form.podeContatar} onChange={(e) => setForm((f) => ({ ...f, podeContatar: e.target.checked }))} />
          <span>Pode contatar</span>
        </label>
      </div>
      <div className="flex gap-2">
        {editing ? (
          <>
            <button className="btn-brand" type="button" disabled={saving} onClick={() => void update()}>Salvar</button>
            <button className="btn-ghost" type="button" onClick={() => { setEditing(null); setForm({ nome: "", relacao: "", empresa: "", cargo: "", contato: "", periodo: "", linkedin: "", observacoes: "", podeContatar: true }); }}>Cancelar</button>
          </>
        ) : (
          <button className="btn-brand" type="button" disabled={saving} onClick={() => void create()}>Adicionar</button>
        )}
      </div>
      <ul className="space-y-1">
        {items.map((r) => (
          <li key={r.id} className="flex items-center justify-between rounded border border-border/60 px-2 py-1 text-sm">
            <span>{r.nome}{r.empresa ? ` (${r.empresa})` : ""}{r.podeContatar ? " • Pode contatar" : ""}</span>
            <div className="flex gap-1">
              <button className="btn-ghost text-xs" type="button" onClick={() => { setEditing(r); setForm({ nome: r.nome, relacao: r.relacao ?? "", empresa: r.empresa ?? "", cargo: r.cargo ?? "", contato: r.contato ?? "", periodo: r.periodo ?? "", linkedin: r.linkedin ?? "", observacoes: r.observacoes ?? "", podeContatar: r.podeContatar }); }}>Editar</button>
              <button className="btn-ghost text-xs text-red-600" type="button" onClick={() => void remove(r.id)}>Excluir</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
