/** Texto e organização da relação de documentos para admissão (espelha o e-mail do RH). */

export const ADMISSAO_INSTRUCOES_INTRO =
    "Solicitamos que providencie todos os documentos listados abaixo (obrigatórios), mantendo a ordem indicada, " +
    "e nos encaminhe em formato PDF, preferencialmente por este portal. " +
    "Você também pode tirar fotos nítidas dos documentos — o sistema aceita PDF, JPG e PNG.";

export const ADMISSAO_SITES_EXTERNOS = [
    {
        label: "Validar CEP no site dos Correios",
        url: "http://www.buscacep.correios.com.br/",
        tipoPrint: 27,
    },
    {
        label: "Consultar CPF na Receita Federal",
        url: "https://servicos.receita.fazenda.gov.br/Servicos/CPF/ConsultaSituacao/ConsultaPublica.asp",
        tipoPrint: 28,
    },
] as const;

export interface DocSection {
    id: string;
    title: string;
    description?: string;
    tipos: number[];
}

export const ADMISSAO_DOC_SECTIONS: DocSection[] = [
    {
        id: "principal",
        title: "Documentos para admissão",
        tipos: [
            9, 3, 0, 1, 7, 15, 4, 6, 5, 16, 2, 14, 24, 25, 26,
        ],
    },
    {
        id: "sites",
        title: "Confirmações em sites (enviar print)",
        description: "Acesse os sites abaixo, realize a consulta e envie o print da tela como documento.",
        tipos: [27, 28],
    },
    {
        id: "dependentes",
        title: "Documentos dos dependentes",
        description: "Envie apenas se aplicável ao seu caso (filhos, cônjuge ou companheiro(a)).",
        tipos: [12, 11, 29, 13, 30, 31],
    },
];

/** Ordem global para exibição (tipos não listados vão ao final). */
export const ADMISSAO_DOC_ORDER: number[] = ADMISSAO_DOC_SECTIONS.flatMap((s) => s.tipos);

export const DOC_HINTS: Record<number, string> = {
    9: "Digital ou física. Envie a página com experiências na frente e a página com foto e data de emissão no verso.",
    3: "1 cópia do Título de Eleitor.",
    0: "1 cópia da Carteira de Identidade (R.G.) — frente e verso.",
    1: "1 cópia do C.P.F.",
    7: "1 cópia do Cartão do PIS.",
    15: "1 foto 3x4 ou de perfil recente (para o crachá).",
    4: "1 cópia do Reservista.",
    6: "Certidão de Nascimento (se solteiro) ou Certidão de Casamento (se casado).",
    5: "Conta telefônica, correspondência de banco, luz ou água.",
    16: "1 cópia do comprovante de escolaridade.",
    2: "1 cópia da CNH — frente e verso, se aplicável.",
    14: "Comprovante de abertura de conta no Bradesco ou frente e verso do cartão.",
    24: "Exame médico admissional.",
    25: "Cópia do comprovante de vacinação COVID-19.",
    26: "Carta de boas-vindas assinada.",
    27: "Print da validação de CEP no site dos Correios.",
    28: "Print da consulta de CPF no site da Receita Federal.",
    12: "Certidão de nascimento dos filhos.",
    11: "RG dos filhos (independente da idade).",
    29: "CPF dos filhos (independente da idade).",
    13: "Cartão de vacinação dos filhos (até 7 anos).",
    30: "Comprovante de frequência escolar (de 6 a 14 anos).",
    31: "RG e CPF do cônjuge ou companheiro(a).",
};

export const DOC_FRENTE_LABELS: Record<number, string> = {
    9: "Página com experiências",
    14: "Abertura de conta / frente do cartão",
};

export const DOC_VERSO_LABELS: Record<number, string> = {
    9: "Página com foto e data de emissão",
    14: "Verso do cartão",
};

export interface DocSolicitadoItem {
    tipo: number;
    label: string;
    obrigatorio: boolean;
    jaEnviado?: boolean;
}

export function sortDocumentosSolicitados<T extends DocSolicitadoItem>(docs: T[]): T[] {
    const orderMap = new Map(ADMISSAO_DOC_ORDER.map((t, i) => [t, i]));
    return [...docs].sort((a, b) => {
        const ia = orderMap.get(a.tipo) ?? 999;
        const ib = orderMap.get(b.tipo) ?? 999;
        return ia - ib;
    });
}

export function groupDocumentosBySection<T extends DocSolicitadoItem>(
    docs: T[],
): { section: DocSection; items: T[] }[] {
    const sorted = sortDocumentosSolicitados(docs);
    const byTipo = new Map(sorted.map((d) => [d.tipo, d]));
    const used = new Set<number>();

    const grouped = ADMISSAO_DOC_SECTIONS.map((section) => {
        const items = section.tipos
            .map((t) => byTipo.get(t))
            .filter((d): d is T => !!d);
        items.forEach((d) => used.add(d.tipo));
        return { section, items };
    }).filter((g) => g.items.length > 0);

    const extras = sorted.filter((d) => !used.has(d.tipo));
    if (extras.length > 0) {
        grouped.push({
            section: { id: "outros", title: "Outros documentos", tipos: extras.map((d) => d.tipo) },
            items: extras,
        });
    }

    return grouped;
}
