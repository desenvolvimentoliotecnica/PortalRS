import { tipoDocumentoToCode } from "@/features/admissao/admissaoDocumentosPadrao";

/** basePath do Next (ver next.config.ts) */
const APP_BASE = "/app";

const DOC_ICON_FILES: Record<number, string> = {
    0: "03-rg-identidade.png",
    1: "04-cpf.png",
    3: "02-titulo-eleitor.png",
    5: "07-comprovante-endereco.png",
    7: "05-pis.png",
    9: "01-ctps-carteira-trabalho.png",
    14: "09-conta-bancaria-cartao.png",
    15: "06-foto-cracha.png",
    16: "08-escolaridade-certificado.png",
};

export function resolveDocumentoIconSrc(tipo: number | string): string | null {
    const code = tipoDocumentoToCode(tipo);
    const file = DOC_ICON_FILES[code];
    if (!file) return null;
    return `${APP_BASE}/icons/documentos-admissao/${file}`;
}
