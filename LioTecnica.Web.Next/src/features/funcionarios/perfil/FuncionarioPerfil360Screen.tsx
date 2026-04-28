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

interface MovimentacaoItem {
    id: string;
    chapaRm: string;
    idReqRm: string;
    tipoMovimentacao: number;
    tipoDescricao: string | null;
    dataAbertura: string;
    dataConclusao: string | null;
    codStatus: number;
    statusDescricao: string | null;
    codFuncaoOrigem: string | null;
    codFuncaoDestino: string | null;
    codSecaoOrigem: string | null;
    codSecaoDestino: string | null;
    salarioOrigem: number | null;
    salarioDestino: number | null;
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
    funcaoNome: string | null;
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
    matriculaRm: string | null;
    hierarquiaDescricao: string | null;
    codSituacaoRm: string | null;
    situacaoRmDescricao: string | null;
    cpf: string | null;
    estadoCivil: string | null;
    naturalidade: string | null;
    estadoNatal: string | null;
    grauInstrucao: string | null;
    nomePai: string | null;
    nomeMae: string | null;
    nacionalidade: string | null;
    cep: string | null;
    logradouro: string | null;
    numeroEndereco: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
    rg: string | null;
    rgOrgEmissor: string | null;
    rgUf: string | null;
    rgDataEmissao: string | null;
    carteiraTrabalho: string | null;
    carteiraTrabalhoSerie: string | null;
    carteiraTrabalhoUf: string | null;
    carteiraTrabalhoData: string | null;
    numeroPis: string | null;
    tituloEleitor: string | null;
    tituloEleitorZona: string | null;
    tituloEleitorSecao: string | null;
    certificadoReservista: string | null;
    categoriaMilitar: string | null;
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

export default function FuncionarioPerfil360Screen({ id, onBack }: { id: string; onBack?: () => void }) {
    const router = useRouter();
    // Default volta no histórico do navegador. Quando renderizado dentro de outro componente
    // (ex.: modal), o pai passa onBack pra fechar o overlay em vez de navegar.
    const goBack = onBack ?? (() => router.back());
    const [perfil, setPerfil] = useState<Perfil360 | null>(null);
    const [movimentacoes, setMovimentacoes] = useState<MovimentacaoItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        Promise.allSettled([
            apiFetch(`/api/funcionarios/${id}/perfil-360`).then((r) => r.json() as Promise<Perfil360>),
            apiFetch(`/api/funcionarios/${id}/movimentacoes`).then((r) => r.json() as Promise<MovimentacaoItem[]>),
        ]).then(([perfilRes, movRes]) => {
            if (perfilRes.status === "fulfilled") {
                const p = perfilRes.value;
                setPerfil({
                    ...p,
                    historicoCarreira: p.historicoCarreira ?? [],
                    dependentes: p.dependentes ?? [],
                    documentos: p.documentos ?? [],
                    holerites: p.holerites ?? [],
                });
            } else {
                toast.error("Erro ao carregar perfil.");
            }
            if (movRes.status === "fulfilled" && Array.isArray(movRes.value)) {
                setMovimentacoes(movRes.value);
            }
        }).finally(() => setLoading(false));
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
                <button onClick={() => goBack()} className="text-sm text-violet-600 hover:underline flex items-center gap-1">
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
                <button onClick={() => goBack()} className="mt-1 text-muted-foreground hover:text-foreground">
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
                                <InfoRow label="Estado Civil" value={perfil.estadoCivil} />
                                <InfoRow label="Nacionalidade" value={perfil.nacionalidade === "10" ? "Brasileira" : perfil.nacionalidade} />
                                <InfoRow label="Naturalidade" value={[perfil.naturalidade, perfil.estadoNatal].filter(Boolean).join(" / ")} />
                                <InfoRow label="Grau de Instrução" value={perfil.grauInstrucao} />
                                <InfoRow label="CPF" value={perfil.cpf} />
                                {(perfil.nomePai || perfil.nomeMae) && (
                                    <>
                                        <InfoRow label="Nome do Pai" value={perfil.nomePai} />
                                        <InfoRow label="Nome da Mãe" value={perfil.nomeMae} />
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        {/* Endereço */}
                        {(perfil.logradouro || perfil.cep) && (
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <MapPin className="size-4 text-violet-600" /> Endereço
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <InfoRow label="Logradouro" value={[perfil.logradouro, perfil.numeroEndereco].filter(Boolean).join(", ")} />
                                    <InfoRow label="Complemento" value={perfil.complemento} />
                                    <InfoRow label="Bairro" value={perfil.bairro} />
                                    <InfoRow label="CEP" value={perfil.cep} />
                                    <InfoRow label="Cidade/UF" value={[perfil.cidade, perfil.uf].filter(Boolean).join(" / ")} />
                                </CardContent>
                            </Card>
                        )}

                        {/* Documentos pessoais */}
                        {(perfil.rg || perfil.carteiraTrabalho || perfil.numeroPis || perfil.tituloEleitor || perfil.certificadoReservista) && (
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <FileText className="size-4 text-violet-600" /> Documentos Pessoais
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {perfil.rg && (
                                        <InfoRow
                                            label="RG"
                                            value={[perfil.rg, perfil.rgOrgEmissor, perfil.rgUf].filter(Boolean).join(" · ") + (perfil.rgDataEmissao ? ` · ${fmtDate(perfil.rgDataEmissao)}` : "")}
                                        />
                                    )}
                                    {perfil.carteiraTrabalho && (
                                        <InfoRow
                                            label="CTPS"
                                            value={[perfil.carteiraTrabalho, perfil.carteiraTrabalhoSerie ? `Sér. ${perfil.carteiraTrabalhoSerie}` : null, perfil.carteiraTrabalhoUf].filter(Boolean).join(" · ") + (perfil.carteiraTrabalhoData ? ` · ${fmtDate(perfil.carteiraTrabalhoData)}` : "")}
                                        />
                                    )}
                                    <InfoRow label="PIS/PASEP" value={perfil.numeroPis} />
                                    {perfil.tituloEleitor && (
                                        <InfoRow
                                            label="Título de Eleitor"
                                            value={[perfil.tituloEleitor, perfil.tituloEleitorZona ? `Zona ${perfil.tituloEleitorZona}` : null, perfil.tituloEleitorSecao ? `Seção ${perfil.tituloEleitorSecao}` : null].filter(Boolean).join(" · ")}
                                        />
                                    )}
                                    {perfil.certificadoReservista && (
                                        <InfoRow
                                            label="Reservista"
                                            value={[perfil.certificadoReservista, perfil.categoriaMilitar].filter(Boolean).join(" · Cat. ")}
                                        />
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Briefcase className="size-4 text-violet-600" /> Cargo e Estrutura
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <InfoRow label="Cargo" value={perfil.cargoNome} />
                                <InfoRow label="Função" value={perfil.funcaoNome} />
                                <InfoRow label="Centro de Custo" value={perfil.centroCustoNome} />
                                <InfoRow label="Unidade" value={perfil.unidadeNome} />
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
                                            href={`/funcionarios/perfil?id=${perfil.gestorDiretoId}`}
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

                {/* ── Histórico de Carreira (PFHSTSAL + OcupacoesHistorico) ── */}
                <TabsContent value="carreira" className="mt-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <TrendingUp className="size-4 text-violet-600" />
                                Histórico de Carreira ({movimentacoes.length + perfil.historicoCarreira.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {(movimentacoes.length === 0 && perfil.historicoCarreira.length === 0) ? (
                                <p className="text-center text-muted-foreground text-sm py-6">Sem histórico registrado.</p>
                            ) : (
                                <ol className="relative border-l border-muted ml-3 space-y-6 py-2">
                                    {/* Movimentações (PFHSTSAL — promoções, acordos, enquadramentos, admissão) */}
                                    {[...movimentacoes].sort((a, b) => (a.dataAbertura < b.dataAbertura ? 1 : -1)).map((m) => {
                                        const variacao = m.salarioOrigem != null && m.salarioDestino != null && m.salarioOrigem > 0
                                            ? ((m.salarioDestino - m.salarioOrigem) / m.salarioOrigem) * 100
                                            : null;
                                        return (
                                            <li key={`mov-${m.id}`} className="ml-4">
                                                <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border border-violet-400 bg-violet-100" />
                                                <p className="text-sm font-semibold">
                                                    {m.tipoDescricao ?? `Movimentação ${m.tipoMovimentacao}`}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    {fmtDate(m.dataAbertura)}
                                                    {m.statusDescricao ? <> · <span>{m.statusDescricao}</span></> : null}
                                                </p>
                                                {(m.salarioOrigem != null || m.salarioDestino != null) && (
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        Salário:{" "}
                                                        <span className="font-mono">
                                                            {m.salarioOrigem != null ? `R$ ${m.salarioOrigem.toFixed(2)}` : "—"}
                                                        </span>
                                                        {" → "}
                                                        <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                                                            {m.salarioDestino != null ? `R$ ${m.salarioDestino.toFixed(2)}` : "—"}
                                                        </span>
                                                        {variacao != null && variacao !== 0 && (
                                                            <span className={`ml-1 ${variacao > 0 ? "text-emerald-600" : "text-red-600"}`}>
                                                                ({variacao > 0 ? "+" : ""}{variacao.toFixed(2)}%)
                                                            </span>
                                                        )}
                                                    </p>
                                                )}
                                                {(m.codFuncaoOrigem || m.codFuncaoDestino) && m.codFuncaoOrigem !== m.codFuncaoDestino && (
                                                    <p className="text-xs text-muted-foreground">
                                                        Função: {m.codFuncaoOrigem ?? "—"} → {m.codFuncaoDestino ?? "—"}
                                                    </p>
                                                )}
                                                {(m.codSecaoOrigem || m.codSecaoDestino) && m.codSecaoOrigem !== m.codSecaoDestino && (
                                                    <p className="text-xs text-muted-foreground">
                                                        Seção: {m.codSecaoOrigem ?? "—"} → {m.codSecaoDestino ?? "—"}
                                                    </p>
                                                )}
                                            </li>
                                        );
                                    })}

                                    {/* Ocupações Portal (vagas internas) */}
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

            </Tabs>
        </div>
    );
}
