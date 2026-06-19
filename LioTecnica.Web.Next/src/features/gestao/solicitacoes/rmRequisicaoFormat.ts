export const RM_TIPO_LABELS: Record<string, string> = {
  AUMENTO_QUADRO: "Aumento de Quadro",
  SUBSTITUICAO: "Substituição",
  DESLIGAMENTO: "Desligamento",
};

export function formatRmTipoRequisicao(tipo: string | null | undefined): string {
  const value = (tipo ?? "").trim();
  if (!value) return "—";
  return RM_TIPO_LABELS[value] ?? value.replace(/_/g, " ");
}

export function formatSolicitacaoCodigoRm(input: {
  rmRequisicaoCodigo?: string | null;
  rmIdReq?: number | null;
}): string {
  const cod = input.rmRequisicaoCodigo?.trim();
  if (cod && !cod.startsWith("STUB-")) {
    const parts = cod.split("|");
    if (parts.length === 3) {
      return `${formatRmTipoRequisicao(parts[0])} · ${parts[2].trim()}`;
    }
  }
  if (input.rmIdReq != null) return String(input.rmIdReq);
  return "";
}

export function formatTipoSolicitacaoLabel(
  tipoSolicitacao: number,
  rmTipoRequisicao?: string | null,
): string {
  if (rmTipoRequisicao) return formatRmTipoRequisicao(rmTipoRequisicao);
  if (tipoSolicitacao === 1) return "Substituição";
  if (tipoSolicitacao === 2) return "Aumento de Quadro";
  return "Nova";
}

export function tipoSolicitacaoBadgeClass(tipoSolicitacao: number, rmTipoRequisicao?: string | null): string {
  const rm = (rmTipoRequisicao ?? "").toUpperCase();
  if (rm === "SUBSTITUICAO" || tipoSolicitacao === 1) return "bg-blue-500/15 text-blue-700";
  if (rm === "AUMENTO_QUADRO" || tipoSolicitacao === 2) return "bg-emerald-500/15 text-emerald-700";
  return "bg-sky-500/15 text-sky-700";
}
