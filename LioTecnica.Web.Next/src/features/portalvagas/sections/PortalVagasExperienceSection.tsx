"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { confirmDialog } from "@/lib/confirm-dialog";
import { Button } from "@/components/ui/button";
import type { ExperienceDto, ProjectDto } from "./types";

type ExperienceProjectsResponse = { experiences: ExperienceDto[]; projects: ProjectDto[] };

export default function PortalVagasExperienceSection() {
  const [experiences, setExperiences] = useState<ExperienceDto[]>([]);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingExp, setEditingExp] = useState<ExperienceDto | null>(null);
  const [editingProj, setEditingProj] = useState<ProjectDto | null>(null);
  const [expForm, setExpForm] = useState({ empresa: "", cargo: "", inicio: "", fim: "", local: "", atividades: "" });
  const [projForm, setProjForm] = useState({ nome: "", periodo: "", descricao: "", link: "", stack: "", destaques: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/PortalVagas/ExperienceProjects", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as ExperienceProjectsResponse | null;
      if (!res.ok || !json) throw new Error();
      setExperiences(json.experiences ?? []);
      setProjects(json.projects ?? []);
    } catch {
      toast.error("Falha ao carregar experiências.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createExp() {
    if (!expForm.empresa || !expForm.cargo) {
      toast.error("Preencha empresa e cargo.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch("/PortalVagas/Experiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(expForm),
      });
      if (!res.ok) throw new Error();
      toast.success("Experiência adicionada.");
      setExpForm({ empresa: "", cargo: "", inicio: "", fim: "", local: "", atividades: "" });
      void load();
    } catch {
      toast.error("Falha ao adicionar.");
    } finally {
      setSaving(false);
    }
  }

  async function updateExp() {
    if (!editingExp || !expForm.empresa || !expForm.cargo) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/PortalVagas/Experiences/${editingExp.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(expForm),
      });
      if (!res.ok) throw new Error();
      toast.success("Experiência atualizada.");
      setEditingExp(null);
      setExpForm({ empresa: "", cargo: "", inicio: "", fim: "", local: "", atividades: "" });
      void load();
    } catch {
      toast.error("Falha ao atualizar.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteExp(id: string) {
    if (!(await confirmDialog({ title: "Remover experiência", description: "Remover esta experiência?", confirmText: "Remover", destructive: true }))) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/PortalVagas/Experiences/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Removido.");
      void load();
    } catch {
      toast.error("Falha ao remover.");
    } finally {
      setSaving(false);
    }
  }

  async function createProj() {
    if (!projForm.nome) {
      toast.error("Preencha o nome do projeto.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch("/PortalVagas/Projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projForm),
      });
      if (!res.ok) throw new Error();
      toast.success("Projeto adicionado.");
      setProjForm({ nome: "", periodo: "", descricao: "", link: "", stack: "", destaques: "" });
      void load();
    } catch {
      toast.error("Falha ao adicionar.");
    } finally {
      setSaving(false);
    }
  }

  async function updateProj() {
    if (!editingProj || !projForm.nome) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/PortalVagas/Projects/${editingProj.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projForm),
      });
      if (!res.ok) throw new Error();
      toast.success("Projeto atualizado.");
      setEditingProj(null);
      setProjForm({ nome: "", periodo: "", descricao: "", link: "", stack: "", destaques: "" });
      void load();
    } catch {
      toast.error("Falha ao atualizar.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProj(id: string) {
    if (!(await confirmDialog({ title: "Remover projeto", description: "Remover este projeto?", confirmText: "Remover", destructive: true }))) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/PortalVagas/Projects/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Removido.");
      void load();
    } catch {
      toast.error("Falha ao remover.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-muted-foreground text-sm">Carregando experiências...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h4 className="mini-title mb-2">Experiências profissionais</h4>
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" placeholder="Empresa *" value={expForm.empresa} onChange={(e) => setExpForm((f) => ({ ...f, empresa: e.target.value }))} />
            <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" placeholder="Cargo *" value={expForm.cargo} onChange={(e) => setExpForm((f) => ({ ...f, cargo: e.target.value }))} />
            <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" placeholder="Início" value={expForm.inicio} onChange={(e) => setExpForm((f) => ({ ...f, inicio: e.target.value }))} />
            <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" placeholder="Fim" value={expForm.fim} onChange={(e) => setExpForm((f) => ({ ...f, fim: e.target.value }))} />
            <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm md:col-span-2" placeholder="Local" value={expForm.local} onChange={(e) => setExpForm((f) => ({ ...f, local: e.target.value }))} />
            <div className="md:col-span-2">
              <textarea className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" rows={2} placeholder="Atividades" value={expForm.atividades} onChange={(e) => setExpForm((f) => ({ ...f, atividades: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            {editingExp ? (
              <>
                <Button size="sm" disabled={saving} onClick={() => void updateExp()}>Salvar</Button>
                <Button variant="outline" size="sm" onClick={() => { setEditingExp(null); setExpForm({ empresa: "", cargo: "", inicio: "", fim: "", local: "", atividades: "" }); }}>Cancelar</Button>
              </>
            ) : (
              <Button size="sm" disabled={saving} onClick={() => void createExp()}>Adicionar</Button>
            )}
          </div>
          <ul className="space-y-1">
            {experiences.map((e) => (
              <li key={e.id} className="flex items-center justify-between rounded border border-border/60 px-2 py-1 text-sm">
                <span>{e.empresa} • {e.cargo} {e.inicio || e.fim ? `(${e.inicio || "?"} - ${e.fim || "atual"})` : ""}</span>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => { setEditingExp(e); setExpForm({ empresa: e.empresa, cargo: e.cargo, inicio: e.inicio ?? "", fim: e.fim ?? "", local: e.local ?? "", atividades: e.atividades ?? "" }); }}>Editar</Button>
                  <Button variant="destructive" size="sm" onClick={() => void deleteExp(e.id)}>Excluir</Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <h4 className="mini-title mb-2">Projetos</h4>
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" placeholder="Nome *" value={projForm.nome} onChange={(e) => setProjForm((f) => ({ ...f, nome: e.target.value }))} />
            <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" placeholder="Período" value={projForm.periodo} onChange={(e) => setProjForm((f) => ({ ...f, periodo: e.target.value }))} />
            <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm md:col-span-2" placeholder="Link" value={projForm.link} onChange={(e) => setProjForm((f) => ({ ...f, link: e.target.value }))} />
            <div className="md:col-span-2">
              <textarea className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" rows={2} placeholder="Descrição" value={projForm.descricao} onChange={(e) => setProjForm((f) => ({ ...f, descricao: e.target.value }))} />
            </div>
            <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" placeholder="Stack" value={projForm.stack} onChange={(e) => setProjForm((f) => ({ ...f, stack: e.target.value }))} />
            <div className="md:col-span-2">
              <textarea className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" rows={2} placeholder="Destaques" value={projForm.destaques} onChange={(e) => setProjForm((f) => ({ ...f, destaques: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            {editingProj ? (
              <>
                <Button size="sm" disabled={saving} onClick={() => void updateProj()}>Salvar</Button>
                <Button variant="outline" size="sm" onClick={() => { setEditingProj(null); setProjForm({ nome: "", periodo: "", descricao: "", link: "", stack: "", destaques: "" }); }}>Cancelar</Button>
              </>
            ) : (
              <Button size="sm" disabled={saving} onClick={() => void createProj()}>Adicionar</Button>
            )}
          </div>
          <ul className="space-y-1">
            {projects.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded border border-border/60 px-2 py-1 text-sm">
                <span>{p.nome}{p.periodo ? ` (${p.periodo})` : ""}</span>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => { setEditingProj(p); setProjForm({ nome: p.nome, periodo: p.periodo ?? "", descricao: p.descricao ?? "", link: p.link ?? "", stack: p.stack ?? "", destaques: p.destaques ?? "" }); }}>Editar</Button>
                  <Button variant="destructive" size="sm" onClick={() => void deleteProj(p.id)}>Excluir</Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
