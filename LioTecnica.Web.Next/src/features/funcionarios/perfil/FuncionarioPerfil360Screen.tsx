"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import {
    User, Briefcase, Calendar, FileText, CreditCard, Receipt,
    Users, Clock, ArrowLeft, Building2, MapPin, TrendingUp, ChevronRight,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ── Types ──

interface DependenteResponse {
    id: string;
    nomeCompleto: string;
    parentesco: string;
    cpf: string | null;
    dataNascimento: string;
    isPcd: boolean;
    createdAtUtc: string;
}

interface DocumentoResponse {
    id: string;
    tipo: string;
    nomeArquivo: string;
    contentType: string;
    tamanhoBytes: number;
    status: string;
    observacaoRh: string | null;
    createdAtUtc: string;
}

interface HoleriteResponse {
    id: string;
    mesReferencia: number;
    anoReferencia: number;
    arquivoNome: string;
    tamanhoBytes: number;
    enviadoPorId: string | null;
    enviadoPorNome: string | null;
    enviadoEmUtc: string;
}

interface DadosBancariosResponse {
    id: string;
    banco: string;
    agencia: string;
    conta: string;
    tipoConta: string;
    pix: string | null;
    updatedAtUtc: string;
}

interface HistoricoCarreiraItem {
    id: string;
    vagaDescricao: string | null;
    cargoNome: string | null;
    areaNome: string | null;
    dataEntrada: string;
    dataSaida: string | null;
    motivoSaida: string | null;
    isProvisorio: boolean;
}

interface Perfil360 {
    id: string;
    nome: string;
    email: string | null;
    telefone: string | null;
    status: string;
    avatarUrl: string | null;
    dataAdmissao: string | null;
    dataNascimento: string | null;
    sexo: string | null;
    emExperiencia: boolean;
    diasRestantesExperiencia: number | null;
    progressoExperiencia: number | null;
    cargoNome: string | null;
    areaNome: string | null;
    unidadeNome: string | null;
    unidadeLotacaoNome: string | null;
    nivelHierarquicoNome: string | null;
    nivelCargoNome: string | null;
    centroCustoNome: string | null;
    gestorDiretoId: string | null;
    gestorDiretoNome: string | null;
    gestorDiretoAvatarUrl: string | null;
    cdnFuncionario: string | null;
    cdnEmpresa: string | null;
    cdnEstab: string | null;
    historicoCarreira: HistoricoCarreiraItem[];
    dependentes: DependenteResponse[];
    documentos: DocumentoResponse[];
    holerites: HoleriteResponse[];
    dadosBancarios: DadosBancariosResponse | null;
}

// ── Helpers ──

function Avatar({ nome, url, size = "lg" }: { nome: string; url: string | null; size?: "sm" | "lg" }) {
    const cls = size === "lg" ? "size-16 text-2xl" : "size-8 text-sm";
    if (url)
        return <img src={url} alt={nome} className={`${cls} rounded-full object-cover`} />;
    return (
        <div className={`${cls} rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-semibold`}>
            {nome.charAt(0).toUpperCase()}
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
        Active: { label: "Ativo", variant: "default" },
        Inactive: { label: "Inativo", variant: "secondary" },
        OnLeave: { label: "Afastado", variant: "outline" },
    };
    const s = map[status] ?? { label: status, variant: "secondary" as const };
    return <Badge variant={s.variant}>{s.label}</Badge>;
}

function fmtDate(iso: string | null | undefined): string {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleDateString("pt-BR");
    } catch {
        return iso;
    }
}

function fmtBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex justify-between py-1.5 border-b last:border-0 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium text-right">{value ?? "—"}</span>
        </div>
    );
}

// ── Main ──

export default function FuncionarioPerfil360Screen({ id }: { id: string }) {
    const router = useRouter();
    const [perfil, setPerfil] = useState<Perfil360 | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        apiFetch(`/api/funcionarios/${id}/perfil-360`)
            .then((r) => r.json() as Promise<Perfil360>)
            .then((p) => setPerfil({
                ...p,
                historicoCarreira: p.historicoCarreira ?? [],
                dependentes: p.dependentes ?? [],
                documentos: p.documentos ?? [],
                holerites: p.holerites ?? [],
            }))
            .catch(() => toast.error("Erro ao carregar perfil."))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                Carregando perfil...
            </div>
        );
    }

    if (!perfil) {
        return (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
                <p className="text-muted-foreground">Funcionário não encontrado.</p>
                <button onClick={() => router.back()} className="text-sm text-violet-600 hover:underline flex items-center gap-1">
                    <ArrowLeft className="size-3" /> Voltar
                </button>
            </div>
        );
    }

    const holeritesPorAno = perfil.holerites.reduce<Record<number, HoleriteResponse[]>>((acc, h) => {
        (acc[h.anoReferencia] ??= []).push(h);
        return acc;
    }, {});

    return (
        <div className="space-y-5">
            {/* ── Header ── */}
            <div className="flex items-start gap-4">
                <button onClick={() => router.back()} className="mt-1 text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="size-4" />
                </button>
                <div className="flex items-center gap-4 flex-1">
                    <Avatar nome={perfil.nome} url={perfil.avatarUrl} />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-xl font-bold truncate">{perfil.nome}</h2>
                            <StatusBadge status={perfil.status} />
                            {perfil.emExperiencia && (
                                <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">
                                    <Clock className="size-3 mr-1" /> Experiência
                                </Badge>
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {[perfil.cargoNome, perfil.areaNome].filter(Boolean).join(" · ")}
                        </p>
                        {perfil.email && (
                            <p className="text-xs text-muted-foreground">{perfil.email}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Barra de Experiência ── */}
            {perfil.emExperiencia && perfil.progressoExperiencia != null && (
                <Card className="border-amber-200 bg-amber-50">
                    <CardContent className="pt-4 pb-3">
                        <div className="flex justify-between text-xs text-amber-700 mb-1.5">
                            <span className="font-medium flex items-center gap-1">
                                <Clock className="size-3" /> Em Período de Experiência
                            </span>
                            <span>{perfil.diasRestantesExperiencia} dias restantes</span>
                        </div>
                        <Progress value={perfil.progressoExperiencia} className="h-1.5" />
                    </CardContent>
                </Card>
            )}

            {/* ── Tabs ── */}
            <Tabs defaultValue="cadastro">
                <TabsList className="flex flex-wrap h-auto gap-1">
                    <TabsTrigger value="cadastro"><User className="size-3.5 mr-1" />Cadastro</TabsTrigger>
                    <TabsTrigger value="carreira"><TrendingUp className="size-3.5 mr-1" />Carreira</TabsTrigger>
                    <TabsTrigger value="dependentes"><Users className="size-3.5 mr-1" />Dependentes</TabsTrigger>
                    <TabsTrigger value="documentos"><FileText className="size-3.5 mr-1" />Documentos</TabsTrigger>
                    <TabsTrigger value="holerites"><Receipt className="size-3.5 mr-1" />Holerites</TabsTrigger>
                    <TabsTrigger value="dados-bancarios"><CreditCard className="size-3.5 mr-1" />Banco</TabsTrigger>
                </TabsList>

                {/* ── Cadastro ── */}
                <TabsContent value="cadastro" className="mt-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <User className="size-4 text-violet-600" /> Dados Pessoais
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <InfoRow label="Nome" value={perfil.nome} />
                                <InfoRow label="E-mail" value={perfil.email} />
                                <InfoRow label="Telefone" value={perfil.telefone} />
                                <InfoRow label="Nascimento" value={fmtDate(perfil.dataNascimento)} />
                                <InfoRow label="Sexo" value={perfil.sexo === "M" ? "Masculino" : perfil.sexo === "F" ? "Feminino" : null} />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Briefcase className="size-4 text-violet-600" /> Cargo e Estrutura
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <InfoRow label="Cargo" value={perfil.cargoNome} />
                                <InfoRow label="Nível de Cargo" value={perfil.nivelCargoNome} />
                                <InfoRow label="Nível Hierárquico" value={perfil.nivelHierarquicoNome} />
                                <InfoRow label="Área" value={perfil.areaNome} />
                                <InfoRow label="Unidade" value={perfil.unidadeNome} />
                                <InfoRow label="Lotação" value={perfil.unidadeLotacaoNome} />
                                <InfoRow label="Centro de Custo" value={perfil.centroCustoNome} />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Calendar className="size-4 text-violet-600" /> Admissão
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <InfoRow label="Data de Admissão" value={fmtDate(perfil.dataAdmissao)} />
                                <InfoRow label="Status" value={<StatusBadge status={perfil.status} />} />
                                {perfil.cdnFuncionario && (
                                    <InfoRow
                                        label="Matrícula TOTVS"
                                        value={`${perfil.cdnEmpresa ?? ""}-${perfil.cdnEstab ?? ""}-${perfil.cdnFuncionario}`}
                                    />
                                )}
                            </CardContent>
                        </Card>

                        {perfil.gestorDiretoId && (
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <Users className="size-4 text-violet-600" /> Gestor Direto
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center gap-3">
                                        <Avatar nome={perfil.gestorDiretoNome ?? "?"} url={perfil.gestorDiretoAvatarUrl} size="sm" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{perfil.gestorDiretoNome}</p>
                                        </div>
                                        <Link
                                            href={`/funcionarios/${perfil.gestorDiretoId}/perfil`}
                                            className="text-xs text-violet-600 hover:underline flex items-center gap-0.5"
                                        >
                                            Ver <ChevronRight className="size-3" />
                                        </Link>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </TabsContent>

                {/* ── Histórico de Carreira ── */}
                <TabsContent value="carreira" className="mt-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <TrendingUp className="size-4 text-violet-600" />
                                Histórico de Carreira ({perfil.historicoCarreira.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {perfil.historicoCarreira.length === 0 ? (
                                <p className="text-center text-muted-foreground text-sm py-6">Sem histórico registrado.</p>
                            ) : (
                                <ol className="relative border-l border-muted ml-3 space-y-6 py-2">
                                    {perfil.historicoCarreira.map((h) => (
                                        <li key={h.id} className="ml-4">
                                            <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border border-violet-400 bg-violet-100" />
                                            <p className="text-sm font-semibold">{h.cargoNome ?? h.vagaDescricao ?? "Cargo não informado"}</p>
                                            {h.areaNome && <p className="text-xs text-muted-foreground">{h.areaNome}</p>}
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {fmtDate(h.dataEntrada)} →{" "}
                                                {h.dataSaida ? fmtDate(h.dataSaida) : <span className="text-emerald-600 font-medium">Atual</span>}
                                            </p>
                                            {h.motivoSaida && (
                                                <Badge variant="outline" className="mt-1 text-xs">{h.motivoSaida}</Badge>
                                            )}
                                            {h.isProvisorio && (
                                                <Badge variant="outline" className="mt-1 text-xs text-amber-600 border-amber-300 ml-1">Provisório</Badge>
                                            )}
                                        </li>
                                    ))}
                                </ol>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Dependentes ── */}
                <TabsContent value="dependentes" className="mt-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Users className="size-4 text-violet-600" />
                                Dependentes ({perfil.dependentes.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {perfil.dependentes.length === 0 ? (
                                <p className="text-center text-muted-foreground text-sm py-6">Nenhum dependente cadastrado.</p>
                            ) : (
                                <div className="divide-y">
                                    {perfil.dependentes.map((d) => (
                                        <div key={d.id} className="py-3 flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-medium">{d.nomeCompleto}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {d.parentesco} · Nasc: {fmtDate(d.dataNascimento)}
                                                    {d.cpf && ` · CPF: ${d.cpf}`}
                                                </p>
                                            </div>
                                            {d.isPcd && (
                                                <Badge variant="outline" className="text-xs text-blue-600 border-blue-300 shrink-0">
                                                    PCD
                                                </Badge>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Documentos ── */}
                <TabsContent value="documentos" className="mt-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <FileText className="size-4 text-violet-600" />
                                Documentos ({perfil.documentos.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {perfil.documentos.length === 0 ? (
                                <p className="text-center text-muted-foreground text-sm py-6">Nenhum documento enviado.</p>
                            ) : (
                                <div className="divide-y">
                                    {perfil.documentos.map((d) => {
                                        const statusMap: Record<string, { label: string; color: string }> = {
                                            PendenteValidacao: { label: "Pendente", color: "text-amber-600 border-amber-300" },
                                            Aprovado: { label: "Aprovado", color: "text-emerald-600 border-emerald-300" },
                                            Reprovado: { label: "Reprovado", color: "text-red-600 border-red-300" },
                                        };
                                        const st = statusMap[d.status] ?? { label: d.status, color: "" };
                                        return (
                                            <div key={d.id} className="py-3 flex items-center justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium truncate">{d.nomeArquivo}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {d.tipo} · {fmtBytes(d.tamanhoBytes)}
                                                    </p>
                                                    {d.observacaoRh && (
                                                        <p className="text-xs text-muted-foreground italic">{d.observacaoRh}</p>
                                                    )}
                                                </div>
                                                <Badge variant="outline" className={`text-xs shrink-0 ${st.color}`}>
                                                    {st.label}
                                                </Badge>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Holerites ── */}
                <TabsContent value="holerites" className="mt-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Receipt className="size-4 text-violet-600" />
                                Holerites
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {perfil.holerites.length === 0 ? (
                                <p className="text-center text-muted-foreground text-sm py-6">Nenhum holerite disponível.</p>
                            ) : (
                                <div className="space-y-4">
                                    {Object.entries(holeritesPorAno)
                                        .sort(([a], [b]) => Number(b) - Number(a))
                                        .map(([ano, lista]) => (
                                            <div key={ano}>
                                                <p className="text-xs font-semibold text-muted-foreground mb-2">{ano}</p>
                                                <div className="divide-y border rounded-md">
                                                    {lista.map((h) => (
                                                        <div key={h.id} className="flex items-center justify-between px-3 py-2">
                                                            <div>
                                                                <p className="text-sm font-medium">
                                                                    {MESES[h.mesReferencia - 1]} {h.anoReferencia}
                                                                </p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {fmtBytes(h.tamanhoBytes)}
                                                                    {h.enviadoPorNome ? ` · RH: ${h.enviadoPorNome}` : " · TOTVS"}
                                                                </p>
                                                            </div>
                                                            <a
                                                                href={`/api/colaborador/holerites/${h.id}/download`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-xs text-violet-600 hover:underline flex items-center gap-0.5"
                                                            >
                                                                Download
                                                            </a>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Dados Bancários ── */}
                <TabsContent value="dados-bancarios" className="mt-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <CreditCard className="size-4 text-violet-600" /> Dados Bancários
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {!perfil.dadosBancarios ? (
                                <p className="text-center text-muted-foreground text-sm py-6">Dados bancários não cadastrados.</p>
                            ) : (
                                <>
                                    <InfoRow label="Banco" value={perfil.dadosBancarios.banco} />
                                    <InfoRow label="Agência" value={perfil.dadosBancarios.agencia} />
                                    <InfoRow label="Conta" value={perfil.dadosBancarios.conta} />
                                    <InfoRow label="Tipo" value={perfil.dadosBancarios.tipoConta} />
                                    {perfil.dadosBancarios.pix && (
                                        <InfoRow label="PIX" value={perfil.dadosBancarios.pix} />
                                    )}
                                    <p className="text-xs text-muted-foreground mt-3">
                                        Atualizado em: {fmtDate(perfil.dadosBancarios.updatedAtUtc)}
                                    </p>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
