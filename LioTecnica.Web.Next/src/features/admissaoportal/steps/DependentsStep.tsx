"use client";

import React, { useState, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Edit2, Check, X, Users } from "lucide-react";
import WizardStepPanel from "../components/WizardStepPanel";
import { useAdmissaoWizardStore } from "../useAdmissaoWizardStore";
import {
    addDependente as apiAddDependente,
    updateDependente as apiUpdateDependente,
    removeDependente as apiRemoveDependente,
    type AdmissaoPortalSession,
    type DependentePayload,
    type DependenteResponse,
} from "../publicApi";

const PARENTESCO_OPTIONS = [
    { value: 0, label: "Conjuge" },
    { value: 1, label: "Filho(a)" },
    { value: 2, label: "Pai" },
    { value: 3, label: "Mae" },
    { value: 4, label: "Outro" },
];

const PARENTESCO_LABEL: Record<number, string> = Object.fromEntries(PARENTESCO_OPTIONS.map(o => [o.value, o.label]));

interface Props {
    session: AdmissaoPortalSession;
    disabled?: boolean;
}

export default function DependentsStep({ session, disabled }: Props) {
    const {
        dependentes,
        hasDependentes,
        setHasDependentes,
        addDependente,
        updateDependente,
        removeDependente,
        currentStep,
        markStepComplete,
        setStep,
    } = useAdmissaoWizardStore();
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const [form, setForm] = useState<DependentePayload>({
        nomeCompleto: "",
        parentesco: 1,
        cpf: null,
        dataNascimento: "",
        isPcd: false,
    });

    const resetForm = () => {
        setForm({ nomeCompleto: "", parentesco: 1, cpf: null, dataNascimento: "", isPcd: false });
        setShowForm(false);
        setEditingId(null);
    };

    const handleSave = useCallback(async () => {
        if (!form.nomeCompleto.trim() || !form.dataNascimento) {
            toast.error("Preencha o nome e a data de nascimento.");
            return;
        }
        setSaving(true);
        try {
            if (editingId) {
                const result = await apiUpdateDependente(session, editingId, form);
                updateDependente(editingId, result);
                toast.success("Dependente atualizado!");
            } else {
                const result = await apiAddDependente(session, form);
                addDependente(result);
                toast.success("Dependente adicionado!");
            }
            resetForm();
        } catch {
            toast.error("Erro ao salvar dependente.");
        }
        setSaving(false);
    }, [form, editingId, session, addDependente, updateDependente]);

    const handleDelete = useCallback(async (id: string) => {
        try {
            await apiRemoveDependente(session, id);
            removeDependente(id);
            toast.success("Dependente removido.");
        } catch {
            toast.error("Erro ao remover dependente.");
        }
    }, [session, removeDependente]);

    const handleEdit = (dep: DependenteResponse) => {
        setForm({
            nomeCompleto: dep.nomeCompleto,
            parentesco: dep.parentesco,
            cpf: dep.cpf,
            dataNascimento: dep.dataNascimento,
            isPcd: dep.isPcd,
        });
        setEditingId(dep.id);
        setShowForm(true);
    };

    const selectCls = "flex h-14 w-full rounded-md border border-input bg-transparent px-4 py-2 text-base";

    function handleNoDependents() {
        setHasDependentes(false);
        markStepComplete(currentStep);
        setStep(currentStep + 1);
    }

    // Toggle: "Voce tem dependentes?"
    if (hasDependentes === null || hasDependentes === false) {
        return (
            <WizardStepPanel wide>
            <div className="space-y-8">
                <div className="text-center space-y-4">
                    <div className="mx-auto size-24 rounded-full bg-muted flex items-center justify-center">
                        <Users className="size-12 text-muted-foreground" />
                    </div>
                    <h3 className="text-2xl font-semibold">Voce tem dependentes?</h3>
                    <p className="text-base text-muted-foreground">
                        Dependentes sao conjuges, filhos ou outros familiares que dependem de voce.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button size="lg" className="min-h-[72px] min-w-[200px] text-base" onClick={() => { setHasDependentes(true); setShowForm(true); }}>
                        Sim, tenho dependentes
                    </Button>
                    <Button size="lg" variant="outline" className="min-h-[72px] min-w-[200px] text-base" onClick={handleNoDependents}>
                        Nao tenho dependentes
                    </Button>
                </div>
            </div>
            </WizardStepPanel>
        );
    }

    return (
        <WizardStepPanel wide>
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
                Adicione seus dependentes (conjuges, filhos, pais).
            </p>

            {/* Dependents list */}
            {dependentes.length > 0 && (
                <div className="space-y-2">
                    {dependentes.map((dep) => (
                        <div key={dep.id} className="flex items-center gap-3 rounded-xl border border-border/40 bg-card p-4">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate">{dep.nomeCompleto}</p>
                                <p className="text-xs text-muted-foreground">
                                    {PARENTESCO_LABEL[dep.parentesco] || "Outro"}
                                    {dep.cpf && ` - CPF: ${dep.cpf}`}
                                    {` - Nasc: ${dep.dataNascimento}`}
                                    {dep.isPcd && " - PCD"}
                                </p>
                            </div>
                            {!disabled && (
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="sm" onClick={() => handleEdit(dep)}>
                                        <Edit2 className="size-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(dep.id)}>
                                        <Trash2 className="size-4 text-red-500" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Form */}
            {showForm && (
                <div className="rounded-xl border-2 border-primary/30 bg-card p-4 space-y-3">
                    <h4 className="text-sm font-semibold">{editingId ? "Editar Dependente" : "Novo Dependente"}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome Completo</label>
                            <Input className="h-11" value={form.nomeCompleto} onChange={e => setForm({ ...form, nomeCompleto: e.target.value })} />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Parentesco</label>
                            <select className={selectCls} value={form.parentesco} onChange={e => setForm({ ...form, parentesco: Number(e.target.value) })}>
                                {PARENTESCO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">CPF</label>
                            <Input className="h-11" value={form.cpf ?? ""} onChange={e => setForm({ ...form, cpf: e.target.value || null })} placeholder="Opcional" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Data de Nascimento</label>
                            <Input className="h-11" type="date" value={form.dataNascimento} onChange={e => setForm({ ...form, dataNascimento: e.target.value })} />
                        </div>
                        <div className="flex items-center gap-2 sm:col-span-2">
                            <input type="checkbox" id="isPcd" checked={form.isPcd} onChange={e => setForm({ ...form, isPcd: e.target.checked })} className="size-4" />
                            <label htmlFor="isPcd" className="text-sm">Pessoa com deficiencia (PCD)</label>
                        </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                        <Button variant="ghost" onClick={resetForm}><X className="size-4 mr-1" /> Cancelar</Button>
                        <Button onClick={handleSave} disabled={saving}><Check className="size-4 mr-1" /> {editingId ? "Atualizar" : "Adicionar"}</Button>
                    </div>
                </div>
            )}

            {/* Add button */}
            {!showForm && !disabled && (
                <Button variant="outline" size="lg" className="w-full gap-2 min-h-[48px]" onClick={() => setShowForm(true)}>
                    <Plus className="size-5" /> Adicionar outro dependente
                </Button>
            )}

            {!disabled && dependentes.length > 0 && (
                <button
                    type="button"
                    onClick={() => { setHasDependentes(false); }}
                    className="text-xs text-muted-foreground underline"
                >
                    Na verdade nao tenho dependentes
                </button>
            )}
        </div>
        </WizardStepPanel>
    );
}
