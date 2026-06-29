/** Seções do formulário "Seus Dados" — uma etapa do wizard cada. */
export const DADOS_FORM_SECTIONS = [
    { id: "pessoal", label: "Dados Pessoais" },
    { id: "endereco", label: "Endereço" },
    { id: "contatos", label: "Contatos" },
    { id: "bancario", label: "Dados Bancários" },
    { id: "trabalhista", label: "Dados Trabalhistas" },
    { id: "titulo-eleitor", label: "Título de Eleitor" },
    { id: "cnh", label: "Carteira de Habilitação (CNH)" },
    { id: "militar", label: "Documento Militar / Reservista" },
    { id: "estrangeiro", label: "Dados de Estrangeiro" },
    { id: "saude", label: "Saúde e Características Físicas" },
] as const;

export type DadosSectionId = (typeof DADOS_FORM_SECTIONS)[number]["id"];

export function getDadosSectionLabel(id: DadosSectionId): string {
    return DADOS_FORM_SECTIONS.find((s) => s.id === id)?.label ?? "Seus Dados";
}
