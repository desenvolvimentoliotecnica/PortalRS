import type { AprovacaoStep } from "./AcompanhamentoModal";

/**
 * Parses "(Consenso: reason)" suffix from a label string.
 * Returns the clean label and the extracted aviso, if present.
 */
function parseConsensoLabel(label: string): { cleanLabel: string; aviso: string | null } {
    const match = label.match(/^(.*?)\s*\((Consenso|Sem aprovador):\s*(.+?)\)\s*$/);
    if (match) return { cleanLabel: match[1].trim(), aviso: match[3].trim() };
    return { cleanLabel: label, aviso: null };
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
