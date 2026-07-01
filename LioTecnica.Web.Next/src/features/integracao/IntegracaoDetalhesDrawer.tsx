"use client";

import React, { useEffect, useState } from "react";
import {
    CheckCircle2,
    XCircle,
    Clock,
    RefreshCw,
    Loader2,
    Download,
    ShieldAlert,
    RotateCcw,
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { WhatsAppContactButton } from "@/components/contact/WhatsAppContactButton";
import { apiFetch } from "@/lib/api";

/* ── types ── */

interface IntegracaoTotvsListItem {
    id: string;
    tipoIntegracao: number;
    tipoIntegracaoLabel: string;
    nome: string;
    cpf: string | null;
    descricao: string;
    approvedAtUtc: string | null;
    integracaoResultado: number | string | null;
    integracaoMensagem: string | null;
    integradaEmUtc: string | null;
}

interface IntegracaoDetalhesDrawerProps {
    item: IntegracaoTotvsListItem | null;
    open: boolean;
    onClose: () => void;
    onRetrySuccess: () => void;
}

const TIPO_COLORS: Record<number, string> = {
    1: "bg-blue-100 text-blue-800",
    2: "bg-purple-100 text-purple-800",
    3: "bg-red-100 text-red-800",
    4: "bg-emerald-100 text-emerald-800",
    5: "bg-cyan-100 text-cyan-800",
    6: "bg-orange-100 text-orange-800",
    7: "bg-pink-100 text-pink-800",
    8: "bg-amber-100 text-amber-800",
    9: "bg-slate-100 text-slate-800",
};

// Mapa de labels legíveis para campos
const FIELD_LABELS: Record<string, string> = {
    nome: "Nome", cpf: "CPF", email: "E-mail", telefone: "Telefone", celular: "Celular",
    dataNascimento: "Data Nascimento", sexo: "Sexo", estadoCivil: "Estado Civil",
    nomeMae: "Nome da Mãe", nomePai: "Nome do Pai", nacionalidade: "Nacionalidade",
    naturalCidade: "Cidade Natal", naturalUf: "UF Natal",
    rg: "RG", rgOrgaoExpedidor: "Órgão Expedidor RG", rgDataExpedicao: "Data Expedição RG",
    pisPasep: "PIS/PASEP", tituloEleitorNumero: "Título Eleitor", tituloEleitorZona: "Zona",
    tituloEleitorSecao: "Seção", tituloEleitorCidade: "Cidade Título", tituloEleitorUf: "UF Título",
    ctps: "CTPS", ctpsSerie: "Série CTPS", ctpsUf: "UF CTPS", ctpsModelo: "Modelo CTPS",
    reservistaNumero: "Reservista", docMilitarTipo: "Tipo Doc. Militar",
    docMilitarNumero: "Nº Doc. Militar", docMilitarSerie: "Série Doc. Militar", docMilitarRegiao: "Região Militar",
    categoriaCnh: "Categoria CNH", validadeCnh: "Validade CNH", cartaoSus: "Cartão SUS",
    possuiDeficiencia: "Possui Deficiência", grauInstrucao: "Grau de Instrução",
    grupoSanguineo: "Grupo Sanguíneo", fatorRh: "Fator RH", altura: "Altura (cm)", peso: "Peso (g)",
    cep: "CEP", logradouro: "Logradouro", numero: "Número", complemento: "Complemento",
    bairro: "Bairro", cidade: "Cidade", uf: "UF",
    dataAdmissao: "Data Admissão", salario: "Salário", tipoContratacao: "Tipo Contratação",
    cargaHorariaSemanal: "Carga Horária Semanal",
    codCargoTotvs: "Código Cargo TOTVS", categoriaSalarial: "Categoria Salarial",
    codTurno: "Código Turno", centroCusto: "Centro de Custo", unidadeLotacao: "Unidade de Lotação",
    codVinculoEmpregaticio: "Cód. Vínculo Empregatício", tipoFuncionario: "Tipo Funcionário",
    estabelecimentoCodigo: "Cód. Estabelecimento", matriculaRM: "Matrícula RM",
    bancoCodigo: "Cód. Banco", bancoNome: "Banco", agencia: "Agência", agenciaDigito: "Dígito Agência",
    conta: "Conta", contaDigito: "Dígito Conta", tipoConta: "Tipo Conta",
    contatoEmergenciaNome: "Contato Emergência", contatoEmergenciaFone: "Fone Emergência",
    // Desligamento
    dataDesligamento: "Data Desligamento", tipoDesligamento: "Tipo Desligamento",
    motivoDesligamento: "Motivo", tipoAvisoPrevio: "Tipo Aviso Prévio", diasAvisoPrevio: "Dias Aviso Prévio",
    elegivelRecontratacao: "Elegível Recontratação", substituirPosicao: "Substituir Posição",
    solicitante: "Solicitante",
    // Promoção
    dataEfetiva: "Data Efetiva", justificativa: "Justificativa",
    cargoAtualNome: "Cargo Atual", novoCargoNome: "Novo Cargo",
    centroCustoAtualNome: "Centro de Custo Atual", novoCentroCustoNome: "Novo Centro de Custo",
    cargoAtual: "Cargo Atual", novoCargo: "Novo Cargo", areaAtual: "Centro de Custo Atual", novaArea: "Novo Centro de Custo",
    // Dependente
    tipoSolicitacao: "Tipo Solicitação", nomeCompleto: "Nome Completo", parentesco: "Parentesco",
    isPcd: "PCD", dependenteIR: "Dependente IR",
    // Benefício
    tipoBeneficio: "Tipo Benefício", tipoAlteracao: "Tipo Alteração",
    descricao: "Descrição", incluirDependentes: "Incluir Dependentes",
    // Férias
    periodoAquisitivo: "Período Aquisitivo", dataInicio: "Data Início", dataFim: "Data Fim",
    qtdDias: "Qtd. Dias", abonoPecuniario: "Abono Pecuniário", diasAbono: "Dias Abono",
    adiantamento13: "Adiantamento 13º",
    // Pagamento Extra
    tipoPagamentoExtra: "Tipo Pgto Extra", valor: "Valor", dataPagamento: "Data Pagamento",
    competencia: "Competência",
    // Solicitação RM
    tentativasIntegracao: "Tentativas de Integração",
    ultimaTentativaUtc: "Última Tentativa",
    rmCriacaoSolicitadaEmUtc: "Enfileirada em",
    rmCodColRequisicao: "Coligada RM",
    rmIdReq: "IDREQ RM",
    rmRequisicaoCodigo: "Vínculo Portal/RM",
    rmCodStatus: "CODSTATUS RM",
    rmUltimaStatusDescricaoRm: "Status RM",
    rmStatusSyncUltimaMensagem: "Mensagem Sync RM",
    // Comuns
    observacoes: "Observações", status: "Status",
};

// Campos que não devem aparecer no grid de detalhes (já estão no header/footer)
const HIDDEN_FIELDS = new Set([
    "id", "tipoIntegracao", "tipoIntegracaoLabel",
    "integracaoResultado", "integracaoMensagem", "integradaEmUtc",
    "approvedAtUtc", "createdAtUtc",
    "efetivadoManualmentePorId", "efetivadoManualmenteEmUtc",
]);

function formatValue(key: string, value: unknown): string {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "boolean") return value ? "Sim" : "Não";
    if (typeof value === "number") {
        if (key === "salario" || key === "valor") return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
        return value.toString();
    }
    const str = String(value);
    // Tentar formatar datas ISO
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        try { return new Date(str).toLocaleDateString("pt-BR"); } catch { /* */ }
    }
    return str;
}

/* ── component ── */

export default function IntegracaoDetalhesDrawer({
    item,
    open,
    onClose,
    onRetrySuccess,
}: IntegracaoDetalhesDrawerProps) {
    const [retrying, setRetrying] = useState(false);
    const [retryError, setRetryError] = useState<string | null>(null);
    const [detalhe, setDetalhe] = useState<Record<string, unknown> | null>(null);
    const [loading, setLoading] = useState(false);

    const [forcarOpen, setForcarOpen] = useState(false);
    const [forcando, setForcando] = useState(false);
    const [forcarError, setForcarError] = useState<string | null>(null);

    const [voltarOpen, setVoltarOpen] = useState(false);
    const [voltando, setVoltando] = useState(false);
    const [voltarError, setVoltarError] = useState<string | null>(null);

    useEffect(() => {
        if (!item || !open) { setDetalhe(null); return; }
        let cancelled = false;
        setLoading(true);
        (async () => {
            try {
                const res = await apiFetch(`/api/integracao-totvs/${item.tipoIntegracao}/${item.id}`);
                if (res.ok) {
                    const json = await res.json();
                    if (!cancelled) setDetalhe(json as Record<string, unknown>);
                }
            } catch { /* fallback to item data */ }
            finally { if (!cancelled) setLoading(false); }
        })();
        return () => { cancelled = true; };
    }, [item, open]);

    const handleRetry = async () => {
        if (!item) return;
        setRetrying(true);
        setRetryError(null);
        try {
            const res = await apiFetch(
                `/api/integracao-totvs/${item.tipoIntegracao}/${item.id}/retry`,
                { method: "POST" }
            );
            if (!res.ok) {
                const body = await res.text();
                throw new Error(body || `Erro HTTP ${res.status}`);
            }
            onRetrySuccess();
        } catch (e) {
            setRetryError(e instanceof Error ? e.message : "Erro ao reenviar.");
        } finally {
            setRetrying(false);
        }
    };

    const handleVoltarPendente = async () => {
        if (!item) return;
        setVoltando(true);
        setVoltarError(null);
        try {
            const res = await apiFetch(
                `/api/integracao-totvs/${item.tipoIntegracao}/${item.id}/voltar-pendente`,
                { method: "POST" }
            );
            if (!res.ok) {
                const body = await res.json().catch(() => ({ message: `Erro HTTP ${res.status}` }));
                throw new Error((body as { message?: string })?.message || `Erro HTTP ${res.status}`);
            }
            setVoltarOpen(false);
            onRetrySuccess();
        } catch (e) {
            setVoltarError(e instanceof Error ? e.message : "Erro ao voltar para pendente.");
        } finally {
            setVoltando(false);
        }
    };

    const handleEfetivarManual = async () => {
        if (!item) return;
        setForcando(true);
        setForcarError(null);
        try {
            const res = await apiFetch(
                `/api/integracao-totvs/${item.tipoIntegracao}/${item.id}/efetivar-manual`,
                { method: "POST" }
            );
            if (!res.ok) {
                const body = await res.json().catch(() => ({ message: `Erro HTTP ${res.status}` }));
                throw new Error((body as { message?: string })?.message || `Erro HTTP ${res.status}`);
            }
            setForcarOpen(false);
            onRetrySuccess();
        } catch (e) {
            setForcarError(e instanceof Error ? e.message : "Erro ao efetivar manualmente.");
        } finally {
            setForcando(false);
        }
    };

    if (!item) return null;

    const resultado = item.integracaoResultado;
    const jaSucesso = resultado === 1 || resultado === "Sucesso";

    // Campos do detalhe, excluindo os hidden
    const fields = detalhe
        ? Object.entries(detalhe).filter(([k]) => !HIDDEN_FIELDS.has(k))
        : [];

    const efetivadoManualmenteEmUtc = detalhe?.efetivadoManualmenteEmUtc as string | null | undefined;

    return (
        <>
            <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
                <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <DialogTitle className="flex items-center gap-3">
                                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TIPO_COLORS[item.tipoIntegracao] ?? "bg-gray-100 text-gray-800"}`}>
                                        {item.tipoIntegracaoLabel}
                                    </span>
                                    {item.nome}
                                </DialogTitle>
                                <DialogDescription>
                                    Dados completos para integração TOTVS
                                </DialogDescription>
                            </div>
                            <WhatsAppContactButton
                                size="sm"
                                celular={typeof detalhe?.celular === "string" ? detalhe.celular : null}
                                fone={typeof detalhe?.telefone === "string" ? detalhe.telefone : null}
                            />
                        </div>
                    </DialogHeader>

                    {/* Resultado + datas */}
                    <div className="flex flex-wrap items-center gap-4 py-2 border-b border-border">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground mb-0.5">Resultado</p>
                            {jaSucesso ? (
                                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/15 text-emerald-700">
                                    <CheckCircle2 className="size-3" /> Sucesso
                                </span>
                            ) : resultado === 2 || resultado === 3 || resultado === "Falha" || resultado === "FalhaDefinitiva" ? (
                                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-red-500/15 text-red-700">
                                    <XCircle className="size-3" /> {resultado === 3 || resultado === "FalhaDefinitiva" ? "Falha Definitiva" : "Falha"}
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-500/15 text-amber-700">
                                    <Clock className="size-3" /> Pendente
                                </span>
                            )}
                        </div>
                        <div>
                            <p className="text-xs font-medium text-muted-foreground mb-0.5">Aprovada em</p>
                            <p className="text-sm">{item.approvedAtUtc ? new Date(item.approvedAtUtc).toLocaleString("pt-BR") : "—"}</p>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-muted-foreground mb-0.5">Integrada em</p>
                            <p className="text-sm">{item.integradaEmUtc ? new Date(item.integradaEmUtc).toLocaleString("pt-BR") : "—"}</p>
                        </div>
                        {efetivadoManualmenteEmUtc && (
                            <div>
                                <p className="text-xs font-medium text-muted-foreground mb-0.5">Efetivado manualmente em</p>
                                <p className="text-sm text-amber-700 font-medium">
                                    {new Date(efetivadoManualmenteEmUtc).toLocaleString("pt-BR")}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Mensagem de integração */}
                    {item.integracaoMensagem && (
                        <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap break-words">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Mensagem da Integração</p>
                            {item.integracaoMensagem}
                        </div>
                    )}

                    {/* Dados completos */}
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="size-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : fields.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 py-2">
                            {fields.map(([key, value]) => {
                                const label = FIELD_LABELS[key] ?? key;
                                const formatted = formatValue(key, value);
                                if (formatted === "—") return null;
                                return (
                                    <div key={key}>
                                        <p className="text-xs font-medium text-muted-foreground">{label}</p>
                                        <p className="text-sm break-words">{formatted}</p>
                                    </div>
                                );
                            })}
                        </div>
                    ) : null}

                    {retryError && (
                        <p className="text-xs text-red-600">{retryError}</p>
                    )}

                    <div className="flex flex-col gap-3 pt-2">
                        {(resultado !== null || !jaSucesso) && (
                            <div className="flex flex-wrap gap-2 justify-end">
                                {resultado !== null && (
                                    <Button
                                        variant="outline"
                                        onClick={() => { setVoltarError(null); setVoltarOpen(true); }}
                                        disabled={voltando}
                                    >
                                        <RotateCcw className="size-4 mr-2" />
                                        Voltar para Pendente
                                    </Button>
                                )}
                                {!jaSucesso && (
                                    <Button
                                        variant="destructive"
                                        onClick={() => { setForcarError(null); setForcarOpen(true); }}
                                        disabled={forcando}
                                    >
                                        <ShieldAlert className="size-4 mr-2" />
                                        Forçar Efetivação Manual
                                    </Button>
                                )}
                                {resultado !== null && (
                                    <Button onClick={handleRetry} disabled={retrying}>
                                        {retrying ? (
                                            <Loader2 className="size-4 mr-2 animate-spin" />
                                        ) : (
                                            <RefreshCw className="size-4 mr-2" />
                                        )}
                                        Reenviar
                                    </Button>
                                )}
                            </div>
                        )}
                        <div className="flex gap-2 justify-between border-t pt-3">
                            <Button variant="outline" onClick={onClose}>
                                Fechar
                            </Button>
                            <Button variant="secondary" onClick={() => {
                                const data = detalhe ? { ...item, ...detalhe } : item;
                                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = `integracao-${item.nome.replace(/\s+/g, "_")}-${item.id}.json`;
                                a.click();
                                URL.revokeObjectURL(url);
                            }}>
                                <Download className="size-4 mr-2" />
                                Baixar JSON
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Dialog de confirmação — Voltar para Pendente */}
            <Dialog open={voltarOpen} onOpenChange={(v) => !v && setVoltarOpen(false)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Voltar para Pendente</DialogTitle>
                        <DialogDescription>
                            Esta ação reinicia o fluxo de integração do zero: limpa o resultado atual
                            e recoloca o registro na fila de envio ao TOTVS.
                            {jaSucesso && " Como esta integração já foi concluída com sucesso, o status será revertido para Em Integração."}
                            {" "}A operação ficará registrada no histórico com seu nome.
                        </DialogDescription>
                    </DialogHeader>
                    {voltarError && (
                        <p className="text-xs text-red-600 mt-1">{voltarError}</p>
                    )}
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setVoltarOpen(false)} disabled={voltando}>
                            Cancelar
                        </Button>
                        <Button onClick={handleVoltarPendente} disabled={voltando}>
                            {voltando
                                ? <Loader2 className="size-4 mr-2 animate-spin" />
                                : <RotateCcw className="size-4 mr-2" />}
                            Confirmar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog de confirmação de efetivação manual */}
            <Dialog open={forcarOpen} onOpenChange={(v) => !v && setForcarOpen(false)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Confirmar Efetivação Manual</DialogTitle>
                        <DialogDescription>
                            Esta ação força a efetivação da integração como &quot;Sucesso&quot; sem aguardar resposta do TOTVS.
                            Ela executará todos os efeitos colaterais (materializar funcionário, fechar headcount, etc.)
                            e ficará registrada com seu nome. Não pode ser desfeita.
                        </DialogDescription>
                    </DialogHeader>
                    {forcarError && (
                        <p className="text-xs text-red-600 mt-1">{forcarError}</p>
                    )}
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setForcarOpen(false)} disabled={forcando}>
                            Cancelar
                        </Button>
                        <Button variant="destructive" onClick={handleEfetivarManual} disabled={forcando}>
                            {forcando
                                ? <Loader2 className="size-4 mr-2 animate-spin" />
                                : <ShieldAlert className="size-4 mr-2" />}
                            Confirmar Efetivação Manual
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
