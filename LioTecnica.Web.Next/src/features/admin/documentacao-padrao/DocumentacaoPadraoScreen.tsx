"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save, Loader2, FileCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";

interface DocItem {
    tipoDocumento: number;
    label: string;
    /** 0 = Obrigatório | 1 = Opcional | 2 = Não será pedido */
    configuracao: number;
}

const CONFIG_OPTIONS = [
    { value: "0", label: "Obrigatório" },
    { value: "1", label: "Opcional" },
    { value: "2", label: "Não será pedido" },
];

// Tipos extras que sempre aparecem (independente do backend estar atualizado)
const TIPOS_EXTRAS: DocItem[] = [
    { tipoDocumento: 20, label: "CNPJ",                configuracao: 2 },
    { tipoDocumento: 21, label: "Contrato Social/MEI", configuracao: 2 },
    { tipoDocumento: 22, label: "Conta Bancária PJ",   configuracao: 2 },
    { tipoDocumento: 23, label: "Certidões Negativas", configuracao: 2 },
];

const CONFIG_BADGE: Record<number, { text: string; className: string }> = {
    0: { text: "Obrigatório",     className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    1: { text: "Opcional",        className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    2: { text: "Não será pedido", className: "bg-muted text-muted-foreground" },
};


export default function DocumentacaoPadraoScreen() {
    const [docs, setDocs] = useState<DocItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => { void load(); }, []);

    async function load() {
        setLoading(true);
        try {
            const res = await apiFetch("/api/admin/documentacao-padrao");
            const data = await res.json() as DocItem[];
            const tiposNaLista = new Set(data.map((d) => d.tipoDocumento));
            const extras = TIPOS_EXTRAS.filter((t) => !tiposNaLista.has(t.tipoDocumento));
            setDocs([...data, ...extras]);
        } catch {
            toast.error("Erro ao carregar configuração.");
        } finally {
            setLoading(false);
        }
    }

    function setConfig(tipoDocumento: number, configuracao: number) {
        setDocs((prev) =>
            prev.map((d) => d.tipoDocumento === tipoDocumento ? { ...d, configuracao } : d)
        );
    }

    async function save() {
        setSaving(true);
        try {
            const res = await apiFetch("/api/admin/documentacao-padrao", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    documentos: docs.map((d) => ({
                        tipoDocumento: d.tipoDocumento,
                        configuracao: d.configuracao,
                    })),
                }),
            });
            if (!res.ok) throw new Error();
            toast.success("Configuração salva com sucesso.");
        } catch {
            toast.error("Erro ao salvar configuração.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="flex flex-col gap-6 p-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-xl font-semibold flex items-center gap-2">
                        <FileCheck className="size-5 text-lt-primary" />
                        Documentação Padrão
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Defina quais documentos serão solicitados na admissão e se são obrigatórios ou opcionais.
                    </p>
                </div>
                <Button onClick={save} disabled={saving || loading}>
                    {saving
                        ? <><Loader2 className="size-4 mr-2 animate-spin" />Salvando...</>
                        : <><Save className="size-4 mr-2" />Salvar</>
                    }
                </Button>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border/60 overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-muted/50 border-b border-border/60">
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Documento</th>
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground w-56">Configuração</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={2} className="text-center py-12 text-muted-foreground">
                                    <Loader2 className="size-5 animate-spin mx-auto" />
                                </td>
                            </tr>
                        ) : docs.length === 0 ? (
                            <tr>
                                <td colSpan={2} className="text-center py-12 text-muted-foreground">
                                    Nenhum documento encontrado.
                                </td>
                            </tr>
                        ) : (
                            docs.map((doc, i) => {
                                const badge = CONFIG_BADGE[doc.configuracao];
                                return (
                                    <tr
                                        key={doc.tipoDocumento}
                                        className={`border-b border-border/40 transition-colors hover:bg-muted/30 ${i % 2 === 0 ? "" : "bg-muted/10"}`}
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{doc.label}</span>
                                                <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${badge.className}`}>
                                                    {badge.text}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <select
                                                value={doc.configuracao}
                                                onChange={(e) => setConfig(doc.tipoDocumento, Number(e.target.value))}
                                                className="w-48 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                            >
                                                {CONFIG_OPTIONS.map((opt) => (
                                                    <option key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
