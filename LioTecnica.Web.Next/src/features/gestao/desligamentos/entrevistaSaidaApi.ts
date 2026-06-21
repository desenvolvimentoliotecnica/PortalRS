import { apiFetch } from "@/lib/api";

const API = "/api/solicitacoes-desligamento";
const ENTREVISTA_API = "/api/entrevistas-saida";

export type EntrevistaSaidaStatusCode =
    | "NaoEnviada"
    | "Enviada"
    | "Respondida"
    | "Expirada"
    | "SemTemplate"
    | "SemEmail";

export interface EntrevistaSaidaDetalhe {
    status: EntrevistaSaidaStatusCode;
    enviadaEmUtc: string | null;
    respondidaEmUtc: string | null;
    expiraEmUtc: string | null;
    respostas: EntrevistaSaidaRespostaDetalhe[] | null;
}

export interface EntrevistaSaidaRespostaDetalhe {
    pergunta: string;
    valorTexto: string | null;
    valorEscala: number | null;
    valorOpcao: string | null;
}

export interface TemplatePergunta {
    id?: string | null;
    ordem: number;
    texto: string;
    tipoResposta: "Texto" | "Escala" | "MultiplaEscolha" | string;
    opcoes: string[] | null;
    obrigatoria: boolean;
}

export interface TemplateEntrevistaSaida {
    id: string;
    nome: string;
    ativo: boolean;
    perguntas: TemplatePergunta[];
}

export interface EntrevistaSaidaRelatorio {
    totalEnviadas: number;
    totalRespondidas: number;
    itens: EntrevistaSaidaRelatorioItem[];
}

export interface EntrevistaSaidaRelatorioItem {
    entrevistaId: string;
    desligamentoId: string;
    funcionarioNome: string;
    submittedAt: string;
    respostas: EntrevistaSaidaRespostaDetalhe[];
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, {
        ...init,
        headers: { Accept: "application/json", ...(init?.headers || {}) },
        cache: "no-store",
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        let message = text || res.statusText;
        try {
            const parsed = JSON.parse(text) as { message?: string; code?: string };
            if (parsed.message) message = parsed.message;
        } catch { /* ignore */ }
        throw new Error(message);
    }
    if (res.status === 204) return null as T;
    return (await res.json()) as T;
}

export async function enviarEntrevistaSaida(desligamentoId: string): Promise<void> {
    await fetchJson(`${API}/${desligamentoId}/entrevista-saida/enviar`, { method: "POST" });
}

export async function reenviarEntrevistaSaida(desligamentoId: string): Promise<void> {
    await fetchJson(`${API}/${desligamentoId}/entrevista-saida/reenviar`, { method: "POST" });
}

export async function getEntrevistaSaidaDetalhe(desligamentoId: string): Promise<EntrevistaSaidaDetalhe> {
    return fetchJson(`${API}/${desligamentoId}/entrevista-saida`);
}

export async function getTemplateAtivo(): Promise<TemplateEntrevistaSaida | null> {
    const res = await apiFetch(`${ENTREVISTA_API}/template-ativo`, { cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || res.statusText);
    }
    return (await res.json()) as TemplateEntrevistaSaida;
}

export async function upsertTemplateAtivo(payload: {
    nome: string;
    perguntas: TemplatePergunta[];
}): Promise<TemplateEntrevistaSaida> {
    return fetchJson(`${ENTREVISTA_API}/template-ativo`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
}

export async function getRelatorioEntrevistasSaida(de?: string, ate?: string): Promise<EntrevistaSaidaRelatorio> {
    const params = new URLSearchParams();
    if (de) params.set("de", de);
    if (ate) params.set("ate", ate);
    const qs = params.toString();
    return fetchJson(`${ENTREVISTA_API}/relatorio${qs ? `?${qs}` : ""}`);
}

export const ENTREVISTA_STATUS_LABELS: Record<EntrevistaSaidaStatusCode, string> = {
    NaoEnviada: "Não enviada",
    Enviada: "Enviada",
    Respondida: "Respondida",
    Expirada: "Expirada",
    SemTemplate: "Sem questionário",
    SemEmail: "Sem e-mail",
};

export const ENTREVISTA_STATUS_COLORS: Record<EntrevistaSaidaStatusCode, string> = {
    NaoEnviada: "bg-zinc-400/15 text-zinc-600",
    Enviada: "bg-blue-500/15 text-blue-700",
    Respondida: "bg-emerald-500/15 text-emerald-700",
    Expirada: "bg-red-500/15 text-red-700",
    SemTemplate: "bg-orange-500/15 text-orange-700",
    SemEmail: "bg-red-500/15 text-red-700",
};

export function normalizeEntrevistaStatus(
    status: EntrevistaSaidaStatusCode | string | null | undefined,
): EntrevistaSaidaStatusCode {
    if (!status) return "NaoEnviada";
    const key = status as EntrevistaSaidaStatusCode;
    return ENTREVISTA_STATUS_LABELS[key] ? key : "NaoEnviada";
}

export function formatRespostaValor(r: EntrevistaSaidaRespostaDetalhe): string {
    if (r.valorOpcao) return r.valorOpcao;
    if (r.valorEscala != null) return String(r.valorEscala);
    if (r.valorTexto) return r.valorTexto;
    return "—";
}
