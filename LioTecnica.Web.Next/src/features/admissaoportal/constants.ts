// Tipos de documento que possuem frente E verso
export const TIPOS_COM_VERSO = new Set([
    0,  // RG
    2,  // CNH
    9,  // CTPS
    11, // RG dos Filhos
]);

export const TIPO_DOC_LABELS: Record<number, string> = {
    0: "RG",
    1: "CPF",
    2: "CNH",
    3: "Título de Eleitor",
    4: "Reservista",
    5: "Comprovante de Residência",
    6: "Certidão Nasc./Casamento",
    7: "PIS/PASEP",
    8: "Outro",
    9: "Carteira de Trabalho (CTPS)",
    10: "Declaração de União Estável",
    11: "RG dos Filhos",
    12: "Certidão de Nascimento dos Filhos",
    13: "Carteira de Vacinação dos Filhos",
    14: "Comprovante Bancário",
    15: "Foto 3x4",
    16: "Escolaridade",
    20: "CNPJ",
    21: "Contrato Social/MEI",
    22: "Conta Bancária PJ",
    23: "Certidões Negativas",
};
