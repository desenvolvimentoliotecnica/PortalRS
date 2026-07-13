import type { AprovacaoStep } from "./AcompanhamentoModal";

/**
 * Parses "(Consenso: reason)" / "(Sem aprovador: reason)" from the end of the label.
 * Usa o último "(Consenso:" para não quebrar quando o título da etapa já tem parênteses
 * (ex.: "Aprovação (Gestor) (Consenso: …)").
 */
function parseConsensoLabel(label: string): { cleanLabel: string; aviso: string | null } {
    const t = label.trim();
    const markers = ["(Consenso:", "(Sem aprovador:"] as const;
    let bestIdx = -1;
    let markerLen = 0;
    for (const m of markers) {
        const i = t.lastIndexOf(m);
        if (i > bestIdx) {
            bestIdx = i;
            markerLen = m.length;
        }
    }
    if (bestIdx < 0) return { cleanLabel: label, aviso: null };

    const cleanLabel = t.slice(0, bestIdx).trim() || label;
    const afterMarker = t.slice(bestIdx + markerLen);
    const close = afterMarker.lastIndexOf(")");
    const aviso = (close >= 0 ? afterMarker.slice(0, close) : afterMarker).trim();
    return { cleanLabel, aviso: aviso || null };
}

/**
 * Extracts the person name from a consenso aviso string like:
 *   "aprovador 'NOME' sem conta de acesso ao sistema"
 */
function extractConsensoNome(aviso: string): string | null {
    const match = aviso.match(/aprovador '(.+?)'/);
    return match ? match[1] : null;
}

/**
 * Shape returned by the API for each dynamic approval step.
 * Mirrors EtapaAprovacaoResponse on the C# side.
 * Single definition shared across all solicitação screens.
 */
export interface EtapaAprovacaoResponse {
    ordem: number;
    label: string;
    aprovadorId: string | null;
    aprovadorNome: string | null;
    roleFilaId: string | null;
    roleFilaNome: string | null;
    status: string; // "Pendente" | "Aprovado" | "Reprovado" | "Cancelado"
    dataUtc: string | null;
    observacao: string | null;
}

export interface SolicitacaoTimelineEventoResponse {
    ordem: number;
    label: string;
    nome: string | null;
    status: number | null;
    dataUtc: string | null;
    observacao: string | null;
}

export function normalizeEtapaStatus(status: unknown): string {
    if (typeof status === "number") {
        switch (status) {
            case 1: return "Aprovado";
            case 2: return "Reprovado";
            case 3: return "Cancelado";
            default: return "Pendente";
        }
    }

    if (typeof status === "string") {
        const normalized = status.trim().toLowerCase();
        switch (normalized) {
            case "1":
            case "aprovado":
                return "Aprovado";
            case "2":
            case "reprovado":
            case "rejeitado":
                return "Reprovado";
            case "3":
            case "cancelado":
                return "Cancelado";
            default:
                return "Pendente";
        }
    }

    return "Pendente";
}

function etapaStatusToNumber(status: string): number | null {
    switch (status.toLowerCase()) {
        case "aprovado":  return 1;
        case "reprovado": return 2;
        case "cancelado": return 3;
        default:          return null; // Pendente = aguardando
    }
}

/**
 * Maps the dynamic etapas[] array from any solicitação detail response
 * into AprovacaoStep[] for AcompanhamentoModal.
 * Prepends a synthetic "Criado" step using solicitanteNome + createdAt.
 *
 * Works for all flow types: Desligamento, Promoção, Férias, Vaga, etc.
 */
export function mapEtapasToSteps(
    etapas: EtapaAprovacaoResponse[],
    solicitanteNome: string | null,
    createdAt: string
): AprovacaoStep[] {
    const steps: AprovacaoStep[] = [
        {
            label: "Criado",
            nome: solicitanteNome,
            status: 1,
            habilitado: true,
            date: createdAt,
            observacao: null,
        },
    ];

    const sorted = [...etapas].sort((a, b) => a.ordem - b.ordem);
    for (const e of sorted) {
        const { cleanLabel, aviso: rawAviso } = parseConsensoLabel(e.label);

        // A step is an automated process step only when there is truly no person/queue info.
        // Checking IDs alone is unreliable because some callers set them to null even for
        // approval steps (e.g. SolicitacoesScreen maps EtapaFluxoInfo which has no IDs).
        // Using name fields is more robust: if either is populated it's a human/queue step.
        const isProcessoStep =
            e.aprovadorId == null &&
            e.roleFilaId == null &&
            (e.aprovadorNome == null || e.aprovadorNome === "") &&
            (e.roleFilaNome == null || e.roleFilaNome === "") &&
            !rawAviso; // consenso steps have an aviso but no names — they are NOT automatic

        // When consenso fired, the original collaborator name is embedded in the aviso.
        // Surfacing it as `nome` makes the step show WHO was supposed to approve.
        const consensoNome = rawAviso ? extractConsensoNome(rawAviso) : null;

        const nome = isProcessoStep
            ? (etapaStatusToNumber(e.status) === 1 ? "Sistema (automático)" : null)
            : (consensoNome ?? e.aprovadorNome ?? e.roleFilaNome ?? null);

        // Simplify aviso: name is already in `nome`, so just keep the reason part.
        const aviso = consensoNome
            ? `${consensoNome} não possui conta de acesso ao sistema`
            : rawAviso;

        steps.push({
            label: cleanLabel,
            nome,
            status: etapaStatusToNumber(e.status),
            habilitado: true,
            date: e.dataUtc,
            observacao: e.observacao,
            aviso,
        });
    }

    return steps;
}

export function mapTimelineEventosToSteps(eventos: SolicitacaoTimelineEventoResponse[]): AprovacaoStep[] {
    const sorted = [...eventos].sort((a, b) => a.ordem - b.ordem);

    return sorted.map((evento) => {
        const { cleanLabel, aviso } = parseConsensoLabel(evento.label);
        return {
            label: cleanLabel,
            nome: evento.nome,
            status: evento.status,
            habilitado: true,
            date: evento.dataUtc,
            observacao: evento.observacao,
            aviso,
        };
    });
}

/** Parecer RM (campo `rmPareceres` do GET solicitacoes-vaga). */
export interface RmParecerResponse {
    idParecer: number;
    dataParecer: string | null;
    codStatus: number | string | null;
    status: string | null;
    solicitante: string | null;
    chapaSolicitante: string | null;
    parecer: string | null;
}

export function formatRmCodStatusLabel(value: number | string | null | undefined): string | null {
    if (value == null || value === "") return null;
    const code = Number(value);
    if (!Number.isFinite(code)) return String(value);
    const labels: Record<number, string> = {
        1: "Em andamento",
        2: "Reprovada",
        3: "Aprovada",
        4: "Concluída",
        5: "Pendente aprovação",
        6: "Cancelada",
    };
    return labels[code] ?? `CODSTATUS ${code}`;
}

function rmCodStatusToStepStatus(codStatus: number | string | null | undefined): number {
    const code = Number(codStatus);
    if (code === 2) return 2; // reprovado
    if (code === 6) return 3; // cancelado
    return 1; // parecer registrado (aprovado / em andamento / concluído / etc.)
}

/**
 * Mapeia pareceres RM para a timeline do Acompanhamento (mesma fonte da aba Aprovações).
 * Mantém a ordem da API (mais recente primeiro).
 */
export function mapRmPareceresToSteps(pareceres: RmParecerResponse[]): AprovacaoStep[] {
    return pareceres
        .filter((p) => Number(p.idParecer) > 0)
        .map((p) => {
            const statusLabel =
                (p.status?.trim() || null)
                ?? formatRmCodStatusLabel(p.codStatus)
                ?? `Parecer #${p.idParecer}`;
            const nomeParts = [
                p.solicitante?.trim() || null,
                p.chapaSolicitante?.trim() || null,
            ].filter(Boolean);
            return {
                label: `${statusLabel} · Parecer #${p.idParecer}`,
                nome: nomeParts.length > 0 ? nomeParts.join(" · ") : "Solicitante RM",
                status: rmCodStatusToStepStatus(p.codStatus),
                habilitado: true,
                date: p.dataParecer,
                observacao: p.parecer?.trim() || null,
            };
        });
}
