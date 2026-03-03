"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { confirmDialog } from "@/lib/confirm-dialog";
import type { CertificationDto, SkillDto, SkillsPortfolioResponse } from "./types";

export default function PortalVagasSkillsSection() {
  const [data, setData] = useState<SkillsPortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingSkill, setEditingSkill] = useState<SkillDto | null>(null);
  const [editingCert, setEditingCert] = useState<CertificationDto | null>(null);
  const [form, setForm] = useState({
    workModel: "",
    availability: "",
    salary: "",
    shift: "",
    note: "",
    linkedin: "",
    github: "",
    portfolio: "",
    drive: "",
    tags: "",
  });
  const [skillForm, setSkillForm] = useState({ tipo: "", nome: "", nivel: "", evidencia: "" });
  const [certForm, setCertForm] = useState({ nome: "", instituicao: "", ano: "", link: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/PortalVagas/SkillsPortfolio", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as SkillsPortfolioResponse | null;
      if (!res.ok || !json) throw new Error();
      setData(json);
      setForm({
        workModel: json.preferences?.workModel ?? "",
        availability: json.preferences?.availability ?? "",
        salary: json.preferences?.salary ?? "",
        shift: json.preferences?.shift ?? "",
        note: json.preferences?.note ?? "",
        linkedin: json.links?.linkedin ?? "",
        github: json.links?.github ?? "",
        portfolio: json.links?.portfolio ?? "",
        drive: json.links?.drive ?? "",
        tags: json.tags ?? "",
      });
    } catch {
      toast.error("Falha ao carregar competências.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function savePrefs() {
    setSaving(true);
    try {
      const res = await apiFetch("/PortalVagas/SkillsPortfolio", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workModel: form.workModel || null,
          availability: form.availability || null,
          salary: form.salary || null,
          shift: form.shift || null,
          note: form.note || null,
          linkedin: form.linkedin || null,
          github: form.github || null,
          portfolio: form.portfolio || null,
          drive: form.drive || null,
          tags: form.tags || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Preferências salvas.");
      void load();
    } catch {
      toast.error("Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function createSkill() {
    if (!skillForm.tipo || !skillForm.nome || !skillForm.nivel) {
      toast.error("Preencha tipo, nome e nível.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch("/PortalVagas/SkillsPortfolio/Skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(skillForm),
      });
      if (!res.ok) throw new Error();
      toast.success("Competência adicionada.");
      setSkillForm({ tipo: "", nome: "", nivel: "", evidencia: "" });
      void load();
    } catch {
      toast.error("Falha ao adicionar.");
    } finally {
      setSaving(false);
    }
  }

  async function updateSkill() {
    if (!editingSkill || !skillForm.tipo || !skillForm.nome || !skillForm.nivel) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/PortalVagas/SkillsPortfolio/Skills/${editingSkill.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(skillForm),
      });
      if (!res.ok) throw new Error();
      toast.success("Competência atualizada.");
      setEditingSkill(null);
      setSkillForm({ tipo: "", nome: "", nivel: "", evidencia: "" });
      void load();
    } catch {
      toast.error("Falha ao atualizar.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSkill(id: string) {
    if (!(await confirmDialog({ title: "Remover competência", description: "Remover esta competência?", confirmText: "Remover", destructive: true }))) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/PortalVagas/SkillsPortfolio/Skills/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Removido.");
      void load();
    } catch {
      toast.error("Falha ao remover.");
    } finally {
      setSaving(false);
    }
  }

  async function createCert() {
    if (!certForm.nome) {
      toast.error("Preencha o nome da certificação.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch("/PortalVagas/SkillsPortfolio/Certifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(certForm),
      });
      if (!res.ok) throw new Error();
      toast.success("Certificação adicionada.");
      setCertForm({ nome: "", instituicao: "", ano: "", link: "" });
      void load();
    } catch {
      toast.error("Falha ao adicionar.");
    } finally {
      setSaving(false);
    }
  }

  async function updateCert() {
    if (!editingCert || !certForm.nome) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/PortalVagas/SkillsPortfolio/Certifications/${editingCert.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(certForm),
      });
      if (!res.ok) throw new Error();
      toast.success("Certificação atualizada.");
      setEditingCert(null);
      setCertForm({ nome: "", instituicao: "", ano: "", link: "" });
      void load();
    } catch {
      toast.error("Falha ao atualizar.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCert(id: string) {
    if (!(await confirmDialog({ title: "Remover certificação", description: "Remover esta certificação?", confirmText: "Remover", destructive: true }))) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/PortalVagas/SkillsPortfolio/Certifications/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Removido.");
      void load();
    } catch {
      toast.error("Falha ao remover.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-muted-foreground text-sm">Carregando competências...</div>;

  return (
    <div className="space-y-4">
      <div>
        <h4 className="mini-title mb-2">Links e preferências</h4>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {([
            ["LinkedIn", "linkedin"],
            ["GitHub", "github"],
            ["Portfólio", "portfolio"],
            ["Drive", "drive"],
          ] as const).map(([l, k]) => (
            <div key={k}>
              <label className="text-xs text-muted-foreground">{l}</label>
              <input className="form-control" value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
            </div>
          ))}
          {([
            ["Modelo de trabalho", "workModel"],
            ["Disponibilidade", "availability"],
            ["Pretensão salarial", "salary"],
            ["Turno", "shift"],
          ] as const).map(([l, k]) => (
            <div key={k}>
              <label className="text-xs text-muted-foreground">{l}</label>
              <input className="form-control" value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
            </div>
          ))}
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground">Observação</label>
            <input className="form-control" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground">Tags</label>
            <input className="form-control" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="Ex: React, Node, AWS" />
          </div>
        </div>
        <button className="btn-brand mt-2" type="button" disabled={saving} onClick={() => void savePrefs()}>
          {saving ? "Salvando..." : "Salvar preferências"}
        </button>
      </div>

      <div>
        <h4 className="mini-title mb-2">Competências</h4>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <input className="form-control w-24" placeholder="Tipo" value={skillForm.tipo} onChange={(e) => setSkillForm((f) => ({ ...f, tipo: e.target.value }))} />
            <input className="form-control flex-1 min-w-[120px]" placeholder="Nome" value={skillForm.nome} onChange={(e) => setSkillForm((f) => ({ ...f, nome: e.target.value }))} />
            <input className="form-control w-28" placeholder="Nível" value={skillForm.nivel} onChange={(e) => setSkillForm((f) => ({ ...f, nivel: e.target.value }))} />
            <input className="form-control flex-1 min-w-[120px]" placeholder="Evidência" value={skillForm.evidencia} onChange={(e) => setSkillForm((f) => ({ ...f, evidencia: e.target.value }))} />
            {editingSkill ? (
              <>
                <button className="btn-brand" type="button" disabled={saving} onClick={() => void updateSkill()}>Salvar</button>
                <button className="btn-ghost" type="button" onClick={() => { setEditingSkill(null); setSkillForm({ tipo: "", nome: "", nivel: "", evidencia: "" }); }}>Cancelar</button>
              </>
            ) : (
              <button className="btn-brand" type="button" disabled={saving} onClick={() => void createSkill()}>Adicionar</button>
            )}
          </div>
          <ul className="space-y-1">
            {(data?.skills ?? []).map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded border border-border/60 px-2 py-1 text-sm">
                <span>{s.tipo} • {s.nome} ({s.nivel})</span>
                <div className="flex gap-1">
                  <button className="btn-ghost text-xs" type="button" onClick={() => { setEditingSkill(s); setSkillForm({ tipo: s.tipo, nome: s.nome, nivel: s.nivel, evidencia: s.evidencia ?? "" }); }}>Editar</button>
                  <button className="btn-ghost text-xs text-red-600" type="button" onClick={() => void deleteSkill(s.id)}>Excluir</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <h4 className="mini-title mb-2">Certificações</h4>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <input className="form-control flex-1 min-w-[140px]" placeholder="Nome" value={certForm.nome} onChange={(e) => setCertForm((f) => ({ ...f, nome: e.target.value }))} />
            <input className="form-control w-36" placeholder="Instituição" value={certForm.instituicao} onChange={(e) => setCertForm((f) => ({ ...f, instituicao: e.target.value }))} />
            <input className="form-control w-20" placeholder="Ano" value={certForm.ano} onChange={(e) => setCertForm((f) => ({ ...f, ano: e.target.value }))} />
            <input className="form-control flex-1 min-w-[120px]" placeholder="Link" value={certForm.link} onChange={(e) => setCertForm((f) => ({ ...f, link: e.target.value }))} />
            {editingCert ? (
              <>
                <button className="btn-brand" type="button" disabled={saving} onClick={() => void updateCert()}>Salvar</button>
                <button className="btn-ghost" type="button" onClick={() => { setEditingCert(null); setCertForm({ nome: "", instituicao: "", ano: "", link: "" }); }}>Cancelar</button>
              </>
            ) : (
              <button className="btn-brand" type="button" disabled={saving} onClick={() => void createCert()}>Adicionar</button>
            )}
          </div>
          <ul className="space-y-1">
            {(data?.certifications ?? []).map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded border border-border/60 px-2 py-1 text-sm">
                <span>{c.nome}{c.instituicao ? ` (${c.instituicao})` : ""}{c.ano ? ` - ${c.ano}` : ""}</span>
                <div className="flex gap-1">
                  <button className="btn-ghost text-xs" type="button" onClick={() => { setEditingCert(c); setCertForm({ nome: c.nome, instituicao: c.instituicao ?? "", ano: c.ano ?? "", link: c.link ?? "" }); }}>Editar</button>
                  <button className="btn-ghost text-xs text-red-600" type="button" onClick={() => void deleteCert(c.id)}>Excluir</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
