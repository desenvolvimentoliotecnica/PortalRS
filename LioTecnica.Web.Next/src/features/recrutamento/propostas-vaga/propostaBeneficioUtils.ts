import type { PropostaBeneficioItem } from "./propostaApi";

const TIPO_LABELS: Record<string, string> = {
  ValeTransporte: "Vale-transporte",
  ValeRefeicao: "Vale-refeição",
  ValeAlimentacao: "Vale-alimentação",
  PlanoDeSaude: "Plano de saúde",
  PlanoOdontologico: "Plano odontológico",
  SeguroDeVida: "Seguro de vida",
  AuxilioCreche: "Auxílio-creche",
  AuxilioEducacao: "Auxílio-educação",
  GympassBemEstar: "Gympass / bem-estar",
  HomeOfficeAjudaDeCusto: "Ajuda de custo home office",
  DayOffAniversario: "Day off aniversário",
  ParticipacaoResultados: "Participação nos resultados",
  Outros: "Outros",
};

const REC_LABELS: Record<string, string> = {
  Mensal: "mensal",
  Semanal: "semanal",
  Diario: "diário",
  Unico: "único",
  Anual: "anual",
};

export function labelBeneficioTipo(tipo: string | number): string {
  const key = String(tipo);
  return TIPO_LABELS[key] ?? key;
}

export function labelBeneficioRecorrencia(rec: string | number | undefined): string {
  if (rec == null || rec === "") return "";
  return REC_LABELS[String(rec)] ?? String(rec);
}

export function formatBeneficioLinha(item: PropostaBeneficioItem): string {
  const partes = [labelBeneficioTipo(item.tipo)];
  if (item.valor != null) {
    partes.push(
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.valor),
    );
  }
  const rec = labelBeneficioRecorrencia(item.recorrencia);
  if (rec) partes.push(rec);
  if (item.observacoes?.trim()) partes.push(item.observacoes.trim());
  return partes.join(" — ");
}

export function beneficioKey(item: PropostaBeneficioItem): string {
  return item.id ?? `${item.tipo}|${item.valor ?? ""}|${item.recorrencia ?? ""}|${item.observacoes ?? ""}`;
}

export type VagaBeneficioFormItem = PropostaBeneficioItem & { key: string };

export function mapVagaBeneficios(raw: unknown): VagaBeneficioFormItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((b) => {
    const row = b as Record<string, unknown>;
    const item: PropostaBeneficioItem = {
      id: typeof row.id === "string" ? row.id : typeof row.Id === "string" ? row.Id : null,
      tipo: (row.tipo ?? row.Tipo ?? "") as string | number,
      valor: typeof row.valor === "number" ? row.valor : typeof row.Valor === "number" ? row.Valor : null,
      recorrencia: (row.recorrencia ?? row.Recorrencia ?? "") as string | number,
      observacoes: typeof row.observacoes === "string"
        ? row.observacoes
        : typeof row.Observacoes === "string"
          ? row.Observacoes
          : null,
    };
    return { ...item, key: beneficioKey(item) };
  }).filter((b) => b.tipo !== "" && b.tipo != null);
}
