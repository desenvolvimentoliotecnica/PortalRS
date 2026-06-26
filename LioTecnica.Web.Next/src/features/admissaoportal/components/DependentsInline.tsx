"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Edit2, Plus, Trash2, X } from "lucide-react";
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
    { value: 0, label: "Cônjuge" },
    { value: 1, label: "Filho(a)" },
    { value: 2, label: "Pai" },
    { value: 3, label: "Mãe" },
    { value: 4, label: "Outro" },
];

const PARENTESCO_LABEL: Record<number, string> = Object.fromEntries(
    PARENTESCO_OPTIONS.map((o) => [o.value, o.label]),
);

interface Props {
    session: AdmissaoPortalSession;
    disabled?: boolean;
}

export default function DependentsInline({ session, disabled }: Props) {
    const {
        dependentes,
        setHasDependentes,
        addDependente,
        updateDependente,
        removeDependente,
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
            setHasDependentes(true);
            resetForm();
        } catch {
            toast.error("Erro ao salvar dependente.");
        }
        setSaving(false);
    }, [form, editingId, session, addDependente, updateDependente, setHasDependentes]);

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

    const selectCls = "flex h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm";

    return (
        <div className="space-y-3">
            {dependentes.length > 0 && (
                <div className="space-y-2">
                    {dependentes.map((dep) => (
                        <div key={dep.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-slate-900">{dep.nomeCompleto}</p>
                                <p className="text-xs text-slate-500">
                                    {PARENTESCO_LABEL[dep.parentesco] || "Outro"}
                                    {dep.cpf && ` · CPF: ${dep.cpf}`}
                                    {` · Nasc.: ${dep.dataNascimento}`}
                                    {dep.isPcd && " · PCD"}
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

            {showForm && (
                <div className="space-y-3 rounded-xl border border-[#bfdbfe] bg-[#f8fbff] p-4">
                    <h4 className="text-sm font-semibold text-slate-900">
                        {editingId ? "Editar dependente" : "Novo dependente"}
                    </h4>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Field label="Nome completo">
                            <Input className="h-11" value={form.nomeCompleto} onChange={(e) => setForm({ ...form, nomeCompleto: e.target.value })} />
                        </Field>
                        <Field label="Parentesco">
                            <select className={selectCls} value={form.parentesco} onChange={(e) => setForm({ ...form, parentesco: Number(e.target.value) })}>
                                {PARENTESCO_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </Field>
                        <Field label="CPF">
                            <Input className="h-11" value={form.cpf ?? ""} onChange={(e) => setForm({ ...form, cpf: e.target.value || null })} placeholder="Opcional" />
                        </Field>
                        <Field label="Data de nascimento">
                            <Input className="h-11" type="date" value={form.dataNascimento} onChange={(e) => setForm({ ...form, dataNascimento: e.target.value })} />
                        </Field>
                        <div className="flex items-center gap-2 sm:col-span-2">
                            <input type="checkbox" id="depPcd" checked={form.isPcd} onChange={(e) => setForm({ ...form, isPcd: e.target.checked })} className="size-4" />
                            <label htmlFor="depPcd" className="text-sm text-slate-700">Pessoa com deficiência (PCD)</label>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={resetForm}><X className="mr-1 size-4" /> Cancelar</Button>
                        <Button onClick={handleSave} disabled={saving} className="bg-[#0047BB] hover:bg-[#003a99]">
                            <Check className="mr-1 size-4" /> {editingId ? "Atualizar" : "Adicionar"}
                        </Button>
                    </div>
                </div>
            )}

            {!showForm && !disabled && (
                <Button variant="outline" className="w-full gap-2" onClick={() => setShowForm(true)}>
                    <Plus className="size-4" /> Adicionar dependente
                </Button>
            )}
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
            {children}
        </div>
    );
}
