"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { RefreshCw, Plus, Trash2, ExternalLink, Sparkles, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store", ...init });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

interface SuperSurvey {
    id: string;
    title: string;
    createdAtUtc: string;
    endAtUtc: string | null;
    type?: string | null;
    responsesCount?: number;
}

interface SurveyListResponse {
    items: SuperSurvey[];
    totalCount?: number;
    totalItems?: number;
    page?: number;
    pageSize?: number;
}

type QuestionType = "Texto" | "Múltipla escolha" | "Escala 1-5";

interface SuperSurveyQuestion {
    id: string;
    dimension: string;
    text: string;
    type: QuestionType;
    required: boolean;
}

export default function SuperPesquisaScreen() {
    const [loading, setLoading] = useState(true);
    const [surveys, setSurveys] = useState<SuperSurvey[]>([]);
    const [saving, setSaving] = useState(false);

    const [unit, setUnit] = useState("Todos");
    const [department, setDepartment] = useState("Todos");
    const [group, setGroup] = useState("Todos");
    const [leadership, setLeadership] = useState("Todos");
    const [collaborator, setCollaborator] = useState("Todos");
    const [admissionStart, setAdmissionStart] = useState("");
    const [admissionEnd, setAdmissionEnd] = useState("");
    const [directReports, setDirectReports] = useState(false);
    const [indirectReports, setIndirectReports] = useState(false);

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [endDate, setEndDate] = useState("");
    const [surveyType, setSurveyType] = useState("Anônima (não serão identificados os colaboradores)");
    const [allowBackButton, setAllowBackButton] = useState("Sim");
    const [questions, setQuestions] = useState<SuperSurveyQuestion[]>([
        { id: crypto.randomUUID(), dimension: "", text: "", type: "Texto", required: true },
    ]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchJson<SurveyListResponse>("/api/feedback/surveys?page=1&pageSize=20");
            const onlySuper = (data?.items ?? []).filter((s) => (s.type ?? "").toLowerCase().includes("super"));
            setSurveys(onlySuper);
        } catch { /* silent */ } finally { setLoading(false); }
    }, []);

    useEffect(() => { void loadData(); }, [loadData]);

    function fmtDate(iso: string) {
        try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return iso; }
    }

    function updateQuestion(id: string, patch: Partial<SuperSurveyQuestion>) {
        setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
    }

    function addQuestion() {
        setQuestions((prev) => [...prev, { id: crypto.randomUUID(), dimension: "", text: "", type: "Texto", required: true }]);
    }

    function removeQuestion(id: string) {
        setQuestions((prev) => (prev.length <= 1 ? prev : prev.filter((q) => q.id !== id)));
    }

    async function createSuperSurvey() {
        if (!title.trim()) {
            toast.error("Preencha o título da pesquisa.");
            return;
        }
        if (!description.trim()) {
            toast.error("Preencha as informações sobre a pesquisa.");
            return;
        }
        if (!endDate) {
            toast.error("Informe a data de encerramento.");
            return;
        }
        if (questions.some((q) => !q.text.trim())) {
            toast.error("Preencha o texto de todas as perguntas.");
            return;
        }

        const departmentsJson = JSON.stringify({
            participants: {
                unit,
                department,
                group,
                leadership,
                collaborator,
                admissionStart,
                admissionEnd,
                directReports,
                indirectReports,
            },
            config: {
                surveyType,
                allowBackButton,
            },
            questions: questions.map((q, index) => ({
                order: index + 1,
                dimension: q.dimension,
                text: q.text,
                type: q.type,
                required: q.required,
            })),
        });

        setSaving(true);
        try {
            await fetchJson("/api/feedback/surveys", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: title.trim(),
                    type: "super",
                    endAtUtc: new Date(endDate).toISOString(),
                    departmentsJson,
                }),
            });
            toast.success("Super Pesquisa criada com sucesso.");
            setTitle("");
            setDescription("");
            setEndDate("");
            setQuestions([{ id: crypto.randomUUID(), dimension: "", text: "", type: "Texto", required: true }]);
            void loadData();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha ao criar Super Pesquisa.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Super Pesquisa</h4>
                    <div className="text-muted-foreground text-sm">Crie e analise pesquisas completas de forma muito fácil e rápida!</div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={loading}>
                        <RefreshCw className="mr-1 size-4" />
                        Atualizar
                    </Button>
                </div>
            </div>

            <div className="rounded-xl border border-sky-200/60 bg-sky-50/70 p-4 text-sm text-sky-900 dark:border-sky-900/30 dark:bg-sky-950/20 dark:text-sky-100">
                <div className="font-semibold">Dicas incríveis para criação da pesquisa clicando aqui.</div>
                <Link
                    href="https://www.feedz.com.br/blog/perguntas-para-pesquisa-de-satisfacao-interna/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-sky-700 underline underline-offset-4 hover:text-sky-800 dark:text-sky-300"
                >
                    Abrir sugestões de perguntas <ExternalLink className="size-3.5" />
                </Link>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="size-3.5" /> Super Pesquisas criadas
                    </div>
                    <div className="mt-1 text-2xl font-bold text-primary">{surveys.length}</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Em andamento</div>
                    <div className="mt-1 text-2xl font-bold text-green-600">
                        {surveys.filter((s) => !s.endAtUtc || new Date(s.endAtUtc) >= new Date()).length}
                    </div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider flex items-center gap-1">
                        <Trophy className="size-3.5" /> Pontos por resposta
                    </div>
                    <div className="mt-1 text-2xl font-bold text-amber-600">500 RC</div>
                </div>
            </div>

            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="font-bold text-base mb-1">Participantes</div>
                <div className="text-sm text-muted-foreground mb-3">Seleciona os colaboradores que irão receber a Super Pesquisa</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Unidades</label>
                        <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Todos" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Departamentos</label>
                        <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Todos" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Grupos</label>
                        <Input value={group} onChange={(e) => setGroup(e.target.value)} placeholder="Todos" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">Data admissão inicial</label>
                            <Input type="date" value={admissionStart} onChange={(e) => setAdmissionStart(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">Data admissão final</label>
                            <Input type="date" value={admissionEnd} onChange={(e) => setAdmissionEnd(e.target.value)} />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Lideranças</label>
                        <Input value={leadership} onChange={(e) => setLeadership(e.target.value)} placeholder="Todos" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Filtros de liderança</label>
                        <div className="flex flex-wrap gap-4 rounded-md border border-border/50 px-3 py-2 text-sm">
                            <label className="inline-flex items-center gap-2">
                                <input type="checkbox" checked={directReports} onChange={(e) => setDirectReports(e.target.checked)} />
                                Liderados diretos
                            </label>
                            <label className="inline-flex items-center gap-2">
                                <input type="checkbox" checked={indirectReports} onChange={(e) => setIndirectReports(e.target.checked)} />
                                Liderados indiretos
                            </label>
                        </div>
                    </div>
                    <div className="md:col-span-2 space-y-1">
                        <label className="text-xs text-muted-foreground">Outros participantes - Colaboradores</label>
                        <Input value={collaborator} onChange={(e) => setCollaborator(e.target.value)} placeholder="Todos" />
                    </div>
                </div>
            </div>

            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur space-y-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="md:col-span-2 space-y-1">
                        <label className="text-xs text-muted-foreground">Título da Pesquisa</label>
                        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Pesquisa de final de ano" />
                    </div>
                    <div className="md:col-span-2 space-y-1">
                        <label className="text-xs text-muted-foreground">Informações sobre a pesquisa</label>
                        <textarea
                            rows={3}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="A ideia dessa pesquisa é entendermos como podemos fazer a melhor festa de final de ano!"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Data de Encerramento</label>
                        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Tipo de Pesquisa</label>
                        <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={surveyType} onChange={(e) => setSurveyType(e.target.value)}>
                            <option>Anônima (não serão identificados os colaboradores)</option>
                            <option>Identificada</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Habilitar botão voltar?</label>
                        <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={allowBackButton} onChange={(e) => setAllowBackButton(e.target.value)}>
                            <option>Sim</option>
                            <option>Não</option>
                        </select>
                    </div>
                </div>

                <div className="space-y-2">
                    {questions.map((question, index) => (
                        <div key={question.id} className="rounded-lg border border-border/50 bg-background/70 p-3">
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-[180px_1fr_180px_140px_auto] md:items-end">
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">Dimensão</label>
                                    <Input
                                        value={question.dimension}
                                        onChange={(e) => updateQuestion(question.id, { dimension: e.target.value })}
                                        placeholder="Ex.: Clima"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">Pergunta #{index + 1}</label>
                                    <Input
                                        value={question.text}
                                        onChange={(e) => updateQuestion(question.id, { text: e.target.value })}
                                        placeholder="Digite a pergunta"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">Tipo de Resposta</label>
                                    <select
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                        value={question.type}
                                        onChange={(e) => updateQuestion(question.id, { type: e.target.value as QuestionType })}
                                    >
                                        <option>Texto</option>
                                        <option>Múltipla escolha</option>
                                        <option>Escala 1-5</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">Obrigatório?</label>
                                    <select
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                        value={question.required ? "Sim" : "Não"}
                                        onChange={(e) => updateQuestion(question.id, { required: e.target.value === "Sim" })}
                                    >
                                        <option>Sim</option>
                                        <option>Não</option>
                                    </select>
                                </div>
                                <div className="flex justify-end md:pb-0.5">
                                    <Button variant="outline" size="sm" onClick={() => removeQuestion(question.id)} disabled={questions.length <= 1}>
                                        <Trash2 className="size-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="outline" onClick={addQuestion}>
                        <Plus className="size-4 mr-1" />Adicionar Pergunta
                    </Button>
                    <Button onClick={() => void createSuperSurvey()} disabled={saving}>
                        {saving ? "Salvando..." : "Salvar"}
                    </Button>
                </div>
            </div>

            <div className="card-soft rounded-xl border border-border/40 bg-card/60 backdrop-blur overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Título</TableHead>
                            <TableHead>Data criação</TableHead>
                            <TableHead>Encerramento</TableHead>
                            <TableHead className="text-right">Respostas</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                        ) : surveys.length === 0 ? (
                            <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhuma Super Pesquisa criada ainda.</TableCell></TableRow>
                        ) : (
                            surveys.map((s) => (
                                <TableRow key={s.id}>
                                    <TableCell className="font-medium">{s.title}</TableCell>
                                    <TableCell>{fmtDate(s.createdAtUtc)}</TableCell>
                                    <TableCell>{s.endAtUtc ? fmtDate(s.endAtUtc) : "—"}</TableCell>
                                    <TableCell className="text-right font-semibold">{s.responsesCount ?? 0}</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </section>
    );
}
