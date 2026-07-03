import { ADMISSAO_DOC_SECTIONS } from "./admissaoDocumentoCatalog";
import { TIPO_DOC_LABELS } from "./constants";
import type { DadosPessoais } from "./useAdmissaoWizardStore";

/** Documentos principais exibidos no mock (mesma lista do e-mail padrão do RH). */
export function buildMockDocumentosSolicitados() {
    const tipos = ADMISSAO_DOC_SECTIONS[0]?.tipos ?? [];
    return tipos.map((tipo) => ({
        tipo,
        label: TIPO_DOC_LABELS[tipo] ?? "Documento",
        obrigatorio: true,
        jaEnviado: false,
    }));
}

export const MOCK_PORTAL_FORM: Partial<DadosPessoais> = {
    nome: "Maria Silva Santos",
    cpf: "123.456.789-00",
    dataNascimento: "1990-05-15",
    estadoCivil: 2,
    rg: "12.345.678-9",
    orgaoEmissorRg: "SSP/SP",
    ufRg: "SP",
    nomeMae: "Ana Silva Santos",
    email: "maria.silva@email.com",
    celular: "(11) 98765-4321",
    cep: "01310-100",
    logradouro: "Av. Paulista",
    numero: "1000",
    bairro: "Bela Vista",
    cidade: "São Paulo",
    uf: "SP",
};

export const MOCK_VAGA = {
    cargo: "Analista de Recursos Humanos",
    area: "Recursos Humanos",
    localTrabalho: "São Paulo — SP (Híbrido)",
    tipoContratacao: "CLT",
    salario: "R$ 5.500,00",
    dataInicioPrevista: "15/08/2026",
};
