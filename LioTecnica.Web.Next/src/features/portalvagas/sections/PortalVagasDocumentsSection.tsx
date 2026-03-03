"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import type { DocumentDto } from "./types";

type DocumentsResponse = { items: DocumentDto[] };

export default function PortalVagasDocumentsSection() {
  const [items, setItems] = useState<DocumentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<DocumentDto | null>(null);
  const [form, setForm] = useState({ tipo: "", nome: "", link: "", data: "", observacoes: "", fileName: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/PortalVagas/Documents", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as DocumentsResponse | null;
      if (!res.ok || !json) throw new Error();
      setItems(json.items ?? []);
    } catch {
      toast.error("Falha ao carregar documentos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    if (!form.tipo || !form.nome) {
      toast.error("Preencha tipo e nome.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch("/PortalVagas/Documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: form.tipo,
          nome: form.nome,
          link: form.link || null,
          data: form.data || null,
          observacoes: form.observacoes || null,
          fileName: form.fileName || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Documento adicionado.");
      setForm({ tipo: "", nome: "", link: "", data: "", observacoes: "", fileName: "" });
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
      const res = await apiFetch(`/PortalVagas/Documents/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: form.tipo,
          nome: form.nome,
          link: form.link || null,
          data: form.data || null,
          observacoes: form.observacoes || null,
          fileName: form.fileName || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Documento atualizado.");
      setEditing(null);
      setForm({ tipo: "", nome: "", link: "", data: "", observacoes: "", fileName: "" });
      void load();
    } catch {
      toast.error("Falha ao atualizar.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remover este documento?")) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/PortalVagas/Documents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Removido.");
      void load();
    } catch {
      toast.error("Falha ao remover.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-muted-foreground text-sm">Carregando documentos...</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <input className="form-control" placeholder="Tipo *" value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))} />
        <input className="form-control" placeholder="Nome *" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
        <input className="form-control md:col-span-2" placeholder="Link" value={form.link} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} />
        <input className="form-control" placeholder="Data" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} />
        <input className="form-control" placeholder="Arquivo" value={form.fileName} onChange={(e) => setForm((f) => ({ ...f, fileName: e.target.value }))} />
        <div className="md:col-span-2">
          <textarea className="form-control" rows={2} placeholder="Observações" value={form.observacoes} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} />
        </div>
      </div>
      <div className="flex gap-2">
        {editing ? (
          <>
            <button className="btn-brand" type="button" disabled={saving} onClick={() => void update()}>Salvar</button>
            <button className="btn-ghost" type="button" onClick={() => { setEditing(null); setForm({ tipo: "", nome: "", link: "", data: "", observacoes: "", fileName: "" }); }}>Cancelar</button>
          </>
        ) : (
          <button className="btn-brand" type="button" disabled={saving} onClick={() => void create()}>Adicionar</button>
        )}
      </div>
      <ul className="space-y-1">
        {items.map((d) => (
          <li key={d.id} className="flex items-center justify-between rounded border border-border/60 px-2 py-1 text-sm">
            <span>{d.tipo} • {d.nome}</span>
            <div className="flex gap-1">
              <button className="btn-ghost text-xs" type="button" onClick={() => { setEditing(d); setForm({ tipo: d.tipo, nome: d.nome, link: d.link ?? "", data: d.data ?? "", observacoes: d.observacoes ?? "", fileName: d.fileName ?? "" }); }}>Editar</button>
              <button className="btn-ghost text-xs text-red-600" type="button" onClick={() => void remove(d.id)}>Excluir</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
