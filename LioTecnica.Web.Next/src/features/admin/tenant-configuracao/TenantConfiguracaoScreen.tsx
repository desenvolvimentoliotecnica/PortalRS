"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Settings2, Users, Clock, ChevronDown, ChevronRight, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/* ──────────────────────────── types ──────────────────────────── */

interface ConfiguracaoHeadcountDto {
    diasProvisaoSubstituicao: number;
    diasAlertaVagaSemFill: number;
}

interface SlaStatusConfigItem {
    tipoEntidade: string; // serialized as enum name: "SolicitacaoVaga", "Vaga", etc.
    status: string;
    slaHoras: number | null;
    ativo: boolean;
    configuradoId: string | null;
}

interface SlaStatusConfigGroup {
    tipoEntidade: string;
    itens: SlaStatusConfigItem[];
}

interface SlaUpsertItem {
    tipoEntidade: string;
    status: string;
    slaHoras: number;
    ativo: boolean;
}

/* ──────────────────────────── label & description maps ──────────────────────────── */

const TIPO_LABELS: Record<string, { label: string; descricao: string }> = {
    SolicitacaoVaga: { label: "Solicitação de Vaga", descricao: "Requisições de pessoal abertas por gestores — tela Gestão > Solicitações de Vaga." },
    SolicitacaoDesligamento: { label: "Solicitação de Desligamento", descricao: "Pedidos de desligamento de colaboradores — tela Gestão > Desligamentos." },
    SolicitacaoPromocao: { label: "Solicitação de Promoção / Movimentação", descricao: "Movimentações de cargo, área ou salário — tela Gestão > Promoções." },
    SolicitacaoFerias: { label: "Solicitação de Férias", descricao: "Pedidos de férias dos colaboradores — tela Gestão > Férias." },
    SolicitacaoBeneficio: { label: "Solicitação de Benefício", descricao: "Alterações de benefícios (plano de saúde, vale, etc.) — tela Gestão > Benefícios." },
    SolicitacaoDependente: { label: "Solicitação de Dependente", descricao: "Inclusão ou exclusão de dependentes — tela Gestão > Dependentes." },
    SolicitacaoEndereco: { label: "Solicitação de Endereço", descricao: "Atualização de endereço residencial — tela Gestão > Endereços." },
    SolicitacaoPagamentoExtra: { label: "Solicitação de Pagamento Extra", descricao: "Lançamentos de horas extras, bônus e adicionais — tela Gestão > Pagamentos Extra." },
    Vaga: { label: "Vaga", descricao: "Vagas do quadro de recrutamento — menu Vagas (/vagas)." },
};

interface StatusInfo {
    label: string;
    descricao: string;
    responsavel?: string;
    bloqueado?: string; // motivo pelo qual este status não pode ser desativado do fluxo
}

// Statuses shared by all solicitation types (1–8)
const SOLICITACAO_STATUS: Record<string, StatusInfo> = {
    Rascunho: {
        label: "Rascunho",
        descricao: "Solicitação criada mas ainda não enviada. Visível apenas para o solicitante.",
        responsavel: "Solicitante",
        bloqueado: "Status inicial — não pode ser desativado do fluxo.",
    },
    PendenteAprovacao: {
        label: "Pendente de Aprovação",
        descricao: "Enviada e aguardando aprovação do gestor responsável na fila de aprovação.",
        responsavel: "Aprovador (Gestor)",
    },
    PendenteAprovacaoRh: {
        label: "Pendente de Aprovação do RH",
        descricao: "Aprovada pelos gestores e agora aguarda validação final da equipe de RH.",
        responsavel: "RH",
    },
    AguardandoDecisaoRH: {
        label: "Aguardando Decisão do RH",
        descricao: "Aprovada pelo fluxo de gestores; o RH ainda não tomou a decisão de headcount (apenas Solicitações de Vaga).",
        responsavel: "RH",
    },
    PendenteAprovacaoAumentoHC: {
        label: "Pendente Aprovação de Aumento de HC",
        descricao: "O RH escalou para aprovação de aumento definitivo de headcount, aguardando aprovador configurado (apenas Solicitações de Vaga).",
        responsavel: "Aprovador (Diretoria)",
    },
    AjustesNecessarios: {
        label: "Ajustes Necessários",
        descricao: "O aprovador devolveu pedindo correções. O solicitante deve editar e reenviar.",
        responsavel: "Solicitante",
    },
    Aprovada: {
        label: "Aprovada",
        descricao: "Fluxo de aprovação concluído com sucesso. Pendente de efetivação ou integração.",
        responsavel: "RH",
    },
    Reprovada: {
        label: "Reprovada",
        descricao: "Recusada por um aprovador. O solicitante é notificado com o motivo.",
        responsavel: "—",
        bloqueado: "Status terminal — não pode ser removido do fluxo.",
    },
    Cancelada: {
        label: "Cancelada",
        descricao: "Cancelada pelo solicitante ou pelo RH antes da conclusão.",
        responsavel: "—",
        bloqueado: "Status terminal — não pode ser removido do fluxo.",
    },
    EmIntegracao: {
        label: "Em Integração",
        descricao: "Aprovada e enviada ao ERP (TOTVS). Aguardando confirmação de processamento.",
        responsavel: "Sistema / ERP",
    },
    Concluida: {
        label: "Concluída",
        descricao: "Integração confirmada com sucesso. Status final — nenhuma ação necessária.",
        responsavel: "—",
        bloqueado: "Status terminal — não pode ser removido do fluxo.",
    },
};

const VAGA_STATUS: Record<string, StatusInfo> = {
    NaoInformado: {
        label: "Não Informado",
        descricao: "Status inicial de vagas importadas sem status definido.",
        responsavel: "RH",
        bloqueado: "Estado técnico de importação — não pode ser desativado.",
    },
    Rascunho: {
        label: "Rascunho",
        descricao: "Vaga criada mas ainda não publicada. Apenas o RH a visualiza.",
        responsavel: "RH",
        bloqueado: "Status inicial — não pode ser desativado do fluxo.",
    },
    Aberta: {
        label: "Aberta",
        descricao: "Publicada e visível no Portal de Vagas. Candidatos podem se inscrever.",
        responsavel: "Recrutador / RH",
    },
    Pausada: {
        label: "Pausada",
        descricao: "Temporariamente fora do ar — não aparece no portal, mas o processo interno continua.",
        responsavel: "RH",
    },
    EmTriagem: {
        label: "Em Triagem",
        descricao: "RH está triando candidatos inscritos — fase inicial do workflow de recrutamento.",
        responsavel: "Recrutador / RH",
    },
    EmEntrevistas: {
        label: "Em Entrevistas",
        descricao: "Candidatos selecionados estão em fase de entrevistas com gestor e RH.",
        responsavel: "Recrutador + Gestor",
    },
    EmOferta: {
        label: "Em Oferta",
        descricao: "Proposta salarial enviada ao candidato finalista, aguardando aceite.",
        responsavel: "RH + Gestor",
    },
    Encerrada: {
        label: "Encerrada",
        descricao: "Vaga encerrada — candidato contratado ou processo finalizado sem contratação.",
        responsavel: "—",
        bloqueado: "Status terminal — não pode ser removido do fluxo.",
    },
    Cancelada: {
        label: "Cancelada",
        descricao: "Processo cancelado antes da conclusão. Candidatos são notificados.",
        responsavel: "—",
        bloqueado: "Status terminal — não pode ser removido do fluxo.",
    },
    Preenchida: {
        label: "Preenchida",
        descricao: "Posição estrutural já ocupada no quadro de pessoal (gerada via carga inicial). Não aparece no portal.",
        responsavel: "—",
        bloqueado: "Estado estrutural de importação — não pode ser desativado.",
    },
};

const STATUS_INFO_BY_TIPO: Record<string, Record<string, StatusInfo>> = {
    SolicitacaoVaga: SOLICITACAO_STATUS,
    SolicitacaoDesligamento: SOLICITACAO_STATUS,
    SolicitacaoPromocao: SOLICITACAO_STATUS,
    SolicitacaoFerias: SOLICITACAO_STATUS,
    SolicitacaoBeneficio: SOLICITACAO_STATUS,
    SolicitacaoDependente: SOLICITACAO_STATUS,
    SolicitacaoEndereco: SOLICITACAO_STATUS,
    SolicitacaoPagamentoExtra: SOLICITACAO_STATUS,
    Vaga: VAGA_STATUS,
};

/* ──────────────────────────── component ──────────────────────────── */

export default function TenantConfiguracaoScreen() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingSla, setSavingSla] = useState(false);

    const [diasProvisao, setDiasProvisao] = useState(30);
    const [diasAlerta, setDiasAlerta] = useState(60);

    const [slaGroups, setSlaGroups] = useState<SlaStatusConfigGroup[]>([]);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [slaEdits, setSlaEdits] = useState<Record<string, { slaHoras: number; ativo: boolean }>>({});

    const slaKey = (tipoEntidade: string, status: string) => `${tipoEntidade}:${status}`;

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [headcountRes, slaRes] = await Promise.all([
                apiFetch("/api/admin/configuracoes-headcount").then(
                    (r) => r.json() as Promise<ConfiguracaoHeadcountDto>
                ),
                apiFetch("/api/configuracoes/sla-status").then(
                    (r) => r.json() as Promise<SlaStatusConfigGroup[]>
                ),
            ]);

            setDiasProvisao(headcountRes.diasProvisaoSubstituicao ?? 30);
            setDiasAlerta(headcountRes.diasAlertaVagaSemFill ?? 60);
            setSlaGroups(slaRes);

            const edits: Record<string, { slaHoras: number; ativo: boolean }> = {};
            for (const group of slaRes) {
                for (const item of group.itens) {
                    edits[slaKey(item.tipoEntidade, item.status)] = {
                        slaHoras: item.slaHoras ?? 48,
                        ativo: item.ativo,
                    };
                }
            }
            setSlaEdits(edits);
        } catch {
            toast.error("Falha ao carregar configurações.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    async function save() {
        if (diasProvisao < 1 || diasAlerta < 1) {
            toast.error("Os dias devem ser maiores que zero.");
            return;
        }
        setSaving(true);
        try {
            const res = await apiFetch("/api/admin/configuracoes-headcount", {
                method: "PUT",
                body: JSON.stringify({
                    diasProvisaoSubstituicao: diasProvisao,
                    diasAlertaVagaSemFill: diasAlerta,
                }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            toast.success("Configurações de headcount salvas.");
        } catch (e) {
            toast.error(`Falha ao salvar: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setSaving(false);
        }
    }

    async function saveSla() {
        setSavingSla(true);
        try {
            const items: SlaUpsertItem[] = [];
            for (const group of slaGroups) {
                for (const item of group.itens) {
                    const edit = slaEdits[slaKey(item.tipoEntidade, item.status)];
                    if (edit) {
                        items.push({
                            tipoEntidade: item.tipoEntidade,
                            status: item.status,
                            slaHoras: edit.slaHoras ?? 48,
                            ativo: edit.ativo,
                        });
                    }
                }
            }

            const res = await apiFetch("/api/configuracoes/sla-status", {
                method: "PUT",
                body: JSON.stringify(items),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const updated = (await res.json()) as SlaStatusConfigGroup[];
            setSlaGroups(updated);
            toast.success("Configuração de status e SLA salva.");
        } catch (e) {
            toast.error(`Falha ao salvar SLA: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setSavingSla(false);
        }
    }

    function toggleGroup(tipo: string) {
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(tipo)) next.delete(tipo);
            else next.add(tipo);
            return next;
        });
    }

    function updateSlaEdit(tipoEntidade: string, status: string, field: "slaHoras" | "ativo", value: number | boolean) {
        const key = slaKey(tipoEntidade, status);
        setSlaEdits((prev) => ({
            ...prev,
            [key]: { ...prev[key], [field]: value },
        }));
    }

    return (
        <section className="space-y-8">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                    <Settings2 className="size-5 text-muted-foreground" />
                    Configurações
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                    Parâmetros gerais do tenant: headcount e SLA por status.
                </p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="h-6 w-6 animate-spin rounded-full border-4 border-t-transparent border-primary" />
                </div>
            ) : (
                <div className="space-y-10">

                    {/* ── Headcount ── */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Users className="size-4 text-muted-foreground" />
                            <h2 className="text-base font-semibold">Headcount</h2>
                        </div>

                        <div className="rounded-xl border border-border/40 bg-card p-6 space-y-6 max-w-xl">
                            <div className="space-y-2">
                                <Label htmlFor="diasProvisao">Dias de provisão na substituição</Label>
                                <Input
                                    id="diasProvisao"
                                    type="number"
                                    min={1}
                                    max={365}
                                    value={diasProvisao}
                                    onChange={(e) => setDiasProvisao(Number(e.target.value))}
                                    className="w-32"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Quando uma requisição de substituição é aprovada, o headcount extra
                                    fica ativo por este número de dias antes de expirar automaticamente.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="diasAlerta">Dias para alerta de vaga sem preenchimento</Label>
                                <Input
                                    id="diasAlerta"
                                    type="number"
                                    min={1}
                                    max={365}
                                    value={diasAlerta}
                                    onChange={(e) => setDiasAlerta(Number(e.target.value))}
                                    className="w-32"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Vagas abertas há mais que este número de dias sem candidato admitido
                                    recebem um alerta visual no painel de vagas.
                                </p>
                            </div>
                        </div>

                        <div>
                            <Button onClick={() => void save()} disabled={saving}>
                                <Save className="size-4 mr-1.5" />
                                {saving ? "Salvando…" : "Salvar headcount"}
                            </Button>
                        </div>
                    </div>

                    {/* ── Configuração de Status ── */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Clock className="size-4 text-muted-foreground" />
                            <h2 className="text-base font-semibold">Configuração de Status e SLA</h2>
                        </div>
                        <p className="text-sm text-muted-foreground -mt-2">
                            Controla quais status fazem parte do fluxo deste tenant. <span className="font-medium text-foreground">Status desativado é pulado automaticamente</span> — a entidade avança direto para o próximo.
                            O campo SLA (horas) define o tempo máximo esperado naquele status: o sistema registra se foi respeitado para auditoria e relatórios. <span className="font-medium text-foreground">24h = 1 dia · 48h = 2 dias · 168h = 1 semana.</span>
                        </p>

                        <div className="space-y-2">
                            {slaGroups.map((group) => {
                                const isExpanded = expandedGroups.has(group.tipoEntidade);
                                const tipoInfo = TIPO_LABELS[group.tipoEntidade];
                                const statusInfoMap = STATUS_INFO_BY_TIPO[group.tipoEntidade] ?? {};
                                const activeCount = group.itens.filter(
                                    (i) => slaEdits[slaKey(i.tipoEntidade, i.status)]?.ativo
                                ).length;

                                return (
                                    <div
                                        key={group.tipoEntidade}
                                        className="rounded-xl border border-border/40 bg-card overflow-hidden"
                                    >
                                        {/* accordion header */}
                                        <button
                                            type="button"
                                            onClick={() => toggleGroup(group.tipoEntidade)}
                                            className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
                                        >
                                            {isExpanded
                                                ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                                                : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                                            }
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold">{tipoInfo?.label ?? `Tipo ${group.tipoEntidade}`}</p>
                                                {tipoInfo?.descricao && (
                                                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{tipoInfo.descricao}</p>
                                                )}
                                            </div>
                                            {activeCount > 0 && (
                                                <span className="shrink-0 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                                                    {activeCount} ativo{activeCount !== 1 ? "s" : ""} no fluxo
                                                </span>
                                            )}
                                        </button>

                                        {/* accordion body */}
                                        {isExpanded && (
                                            <div className="border-t border-border/40">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="bg-muted/20 border-b border-border/40">
                                                            <th className="px-5 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide w-44">
                                                                Status
                                                            </th>
                                                            <th className="px-5 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide w-36">
                                                                Responsável
                                                            </th>
                                                            <th className="px-5 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                                                O que significa / onde aparece
                                                            </th>
                                                            <th className="px-5 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide w-36">
                                                                SLA (horas)
                                                            </th>
                                                            <th className="px-5 py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide w-24">
                                                                Ativo no fluxo
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {group.itens.map((item) => {
                                                            const key = slaKey(item.tipoEntidade, item.status);
                                                            const edit = slaEdits[key] ?? { slaHoras: 48, ativo: false };
                                                            const info = statusInfoMap[item.status];
                                                            const isBloqueado = !!info?.bloqueado;
                                                            return (
                                                                <tr
                                                                    key={item.status}
                                                                    className={cn(
                                                                        "border-b border-border/20 last:border-0 transition-colors",
                                                                        isBloqueado
                                                                            ? "opacity-50 bg-muted/20"
                                                                            : edit.ativo ? "bg-background" : "bg-muted/10"
                                                                    )}
                                                                >
                                                                    <td className="px-5 py-3 align-top">
                                                                        <span className={cn(
                                                                            "inline-block text-xs font-medium px-2 py-0.5 rounded-full",
                                                                            isBloqueado || !edit.ativo
                                                                                ? "bg-muted text-muted-foreground"
                                                                                : "bg-primary/10 text-primary"
                                                                        )}>
                                                                            {info?.label ?? item.status}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-5 py-3 align-top">
                                                                        {info?.responsavel && info.responsavel !== "—" ? (
                                                                            <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-foreground whitespace-nowrap">
                                                                                {info.responsavel}
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-xs text-muted-foreground">—</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-5 py-3 align-top">
                                                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                                                            {info?.descricao ?? "—"}
                                                                        </p>
                                                                        {isBloqueado && (
                                                                            <p className="flex items-center gap-1 text-xs text-muted-foreground/70 mt-1 italic">
                                                                                <Lock className="size-3 shrink-0" />
                                                                                {info!.bloqueado}
                                                                            </p>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-5 py-3 align-top">
                                                                        {isBloqueado ? (
                                                                            <span className="text-xs text-muted-foreground/60">N/A</span>
                                                                        ) : (
                                                                            <Input
                                                                                type="number"
                                                                                min={1}
                                                                                max={8760}
                                                                                value={edit.slaHoras}
                                                                                disabled={!edit.ativo}
                                                                                onChange={(e) =>
                                                                                    updateSlaEdit(item.tipoEntidade, item.status, "slaHoras", Math.max(1, Number(e.target.value)))
                                                                                }
                                                                                className="h-7 w-24 text-sm"
                                                                            />
                                                                        )}
                                                                    </td>
                                                                    <td className="px-5 py-3 align-top text-center">
                                                                        {isBloqueado ? (
                                                                            <Lock className="size-3.5 mx-auto text-muted-foreground/40" />
                                                                        ) : (
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={edit.ativo}
                                                                                onChange={(e) =>
                                                                                    updateSlaEdit(item.tipoEntidade, item.status, "ativo", e.target.checked)
                                                                                }
                                                                                className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                                                            />
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div>
                            <Button onClick={() => void saveSla()} disabled={savingSla}>
                                <Save className="size-4 mr-1.5" />
                                {savingSla ? "Salvando…" : "Salvar configuração de status"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
