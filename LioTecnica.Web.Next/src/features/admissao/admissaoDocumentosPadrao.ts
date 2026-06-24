import { TIPO_DOC_LABELS } from "@/features/admissaoportal/constants";
import { DOC_FRENTE_LABELS, DOC_VERSO_LABELS } from "@/features/admissaoportal/admissaoDocumentoCatalog";

/** Relação CLT padrão enviada pelo RH — ordem de exibição no tracking. */
export const DOCS_CLT_OBRIGATORIOS: number[] = [
  9, // Carteira de Trabalho (CTPS)
  3, // Título de Eleitor
  0, // R.G.
  1, // C.P.F.
  7, // PIS
  15, // Foto 3x4 / crachá
  4, // Reservista
  6, // Certidão nascimento ou casamento
  5, // Comprovante de endereço
  16, // Escolaridade
  2, // CNH
  14, // Conta Bradesco / cartão
  24, // Exame médico
  25, // Vacina COVID-19
  26, // Carta de boas-vindas
];

const TIPO_DOC_ENUM_TO_CODE: Record<string, number> = {
  RG: 0,
  CPF: 1,
  CNH: 2,
  TituloEleitor: 3,
  Reservista: 4,
  ComprovanteResidencia: 5,
  CertidaoNascimentoCasamento: 6,
  PisPasep: 7,
  Outro: 8,
  CarteiraTrabalhoCTPS: 9,
  DeclaracaoUniaoEstavel: 10,
  RGFilho: 11,
  CertidaoNascimentoFilho: 12,
  CarteiraVacinacaoFilho: 13,
  ComprovanteBancario: 14,
  Foto3x4: 15,
  Escolaridade: 16,
  CNPJ: 20,
  ContratoSocialMEI: 21,
  ContaBancariaPJ: 22,
  CertidoesNegativas: 23,
  ExameMedico: 24,
  ComprovanteVacinaCovid: 25,
  CartaBoasVindas: 26,
  PrintValidacaoCep: 27,
  PrintConsultaCpfReceita: 28,
  CpfFilho: 29,
  FrequenciaEscolarFilho: 30,
  RgCpfConjuge: 31,
};

export function tipoDocumentoToCode(tipo: number | string): number {
  if (typeof tipo === "number" && !Number.isNaN(tipo)) return tipo;
  const s = String(tipo).trim();
  if (/^\d+$/.test(s)) return Number(s);
  return TIPO_DOC_ENUM_TO_CODE[s] ?? -1;
}

const STATUS_DOC_LABELS: Record<string, string> = {
  "0": "Pendente validação",
  "1": "Aprovado",
  "2": "Rejeitado",
  PendenteValidacao: "Pendente validação",
  Aprovado: "Aprovado",
  Rejeitado: "Rejeitado",
};

export function resolveTipoDocumentoLabel(tipo: number | string, lado?: number | null): string {
  const code = tipoDocumentoToCode(tipo);
  const base = TIPO_DOC_LABELS[code]
    ?? (typeof tipo === "string" && !TIPO_DOC_ENUM_TO_CODE[tipo]
      ? tipo.replace(/([a-z])([A-Z])/g, "$1 $2")
      : `Documento (${tipo})`);

  if (lado === 1 && DOC_FRENTE_LABELS[code]) return DOC_FRENTE_LABELS[code];
  if (lado === 2 && DOC_VERSO_LABELS[code]) return DOC_VERSO_LABELS[code];
  if (lado === 1) return `${base} — Frente`;
  if (lado === 2) return `${base} — Verso`;
  return base;
}

export function resolveStatusDocumentoLabel(status: number | string): string {
  return STATUS_DOC_LABELS[String(status)] ?? String(status);
}

export function resolveStatusDocumentoCode(status: number | string): number {
  if (typeof status === "number") return status;
  const map: Record<string, number> = {
    PendenteValidacao: 0,
    Aprovado: 1,
    Rejeitado: 2,
  };
  return map[status] ?? -1;
}

export type DocSelection = { checked: boolean; obrigatorio: boolean };

export function buildDefaultSelectedDocs(
  fromServer?: { tipoDocumento: number | string; obrigatorio: boolean }[],
): Map<number, DocSelection> {
  const map = new Map<number, DocSelection>();

  if (fromServer && fromServer.length > 0) {
    fromServer.forEach((ds) => {
      const code = tipoDocumentoToCode(ds.tipoDocumento);
      if (code >= 0) map.set(code, { checked: true, obrigatorio: ds.obrigatorio });
    });
    return map;
  }

  DOCS_CLT_OBRIGATORIOS.forEach((code) => {
    map.set(code, { checked: true, obrigatorio: true });
  });
  return map;
}

/** Tipos ordenados: padrão CLT primeiro, demais alfabético. */
export function orderedTipoDocumentoEntries(): [number, string][] {
  const seen = new Set<number>();
  const ordered: [number, string][] = [];

  for (const code of DOCS_CLT_OBRIGATORIOS) {
    const label = TIPO_DOC_LABELS[code];
    if (label && !seen.has(code)) {
      seen.add(code);
      ordered.push([code, label]);
    }
  }

  const rest = Object.entries(TIPO_DOC_LABELS)
    .map(([k, label]) => [Number(k), label] as [number, string])
    .filter(([code]) => !seen.has(code))
    .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));

  return [...ordered, ...rest];
}
