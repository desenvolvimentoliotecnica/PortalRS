// Tipos de documento que possuem frente E verso
export const TIPOS_COM_VERSO = new Set([
    0,  // RG
    2,  // CNH
    9,  // CTPS
    11, // RG dos Filhos
    14, // Conta Bradesco / cartão
]);

export const ACCEPTED_DOC_MIME = "application/pdf,image/jpeg,image/png,image/webp,image/*";

export const TIPO_DOC_LABELS: Record<number, string> = {
    0: "Carteira de Identidade (R.G.)",
    1: "Cadastro de Pessoas Físicas (C.P.F.)",
    2: "Carteira Nacional de Habilitação",
    3: "Título de Eleitor",
    4: "Reservista",
    5: "Comprovante de Endereço",
    6: "Certidão de Nascimento ou Casamento",
    7: "Cartão do PIS",
    8: "Outro",
    9: "Carteira de Trabalho (CTPS)",
    10: "Declaração de União Estável",
    11: "RG dos filhos",
    12: "Certidão de Nascimento dos filhos",
    13: "Cartão de Vacinação dos filhos",
    14: "Abertura de Conta no Bradesco / Cartão",
    15: "Foto 3x4 ou de perfil (crachá)",
    16: "Comprovante de Escolaridade",
    20: "CNPJ",
    21: "Contrato Social/MEI",
    22: "Conta Bancária PJ",
    23: "Certidões Negativas",
    24: "Exame Médico",
    25: "Comprovante de vacinação COVID-19",
    26: "Carta de boas-vindas assinada",
    27: "Print — validação de CEP (Correios)",
    28: "Print — consulta CPF (Receita Federal)",
    29: "CPF dos filhos",
    30: "Comprovante de frequência escolar dos filhos",
    31: "RG e CPF do cônjuge/companheiro(a)",
};
