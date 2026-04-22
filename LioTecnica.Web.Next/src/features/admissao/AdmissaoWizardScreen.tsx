"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    User, MapPin, Phone, CreditCard, Briefcase, FileUp, CheckCircle2, Upload,
    ChevronLeft, ChevronRight, Save, Send, AlertTriangle, Loader2, Eye, Coins,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { CargoAutocomplete } from "@/components/autocomplete/CargoAutocomplete";
import { EmpresaAutocomplete } from "@/components/autocomplete/EmpresaAutocomplete";
import { CategoriaSalarialAutocomplete } from "@/components/autocomplete/CategoriaSalarialAutocomplete";
import { CentroCustoAutocomplete } from "@/components/autocomplete/CentroCustoAutocomplete";
import { EstabelecimentoAutocomplete } from "@/components/autocomplete/EstabelecimentoAutocomplete";
import { TurnoAutocomplete } from "@/components/autocomplete/TurnoAutocomplete";
import { UnidadeLotacaoAutocomplete } from "@/components/autocomplete/UnidadeLotacaoAutocomplete";
import { validatePreAdmissao, firstErrorStep } from "@/features/admissao/validation";
import { mapTotvsIssuesToErrors, type TotvsValidationIssue } from "@/features/admissao/totvsErrorMap";

/** Converte string do autocomplete em número, retornando null quando não numérico. */
function toIntOrNull(v: string | null | undefined): number | null {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
}

/**
 * Normaliza input de país: força uppercase, remove acentos e limita a 3 chars.
 * Converte nomes comuns em português/inglês pro código ISO 3166-1 alpha-3.
 * TOTVS Datasul aceita só o código de 3 letras — "Brasil" retorna "Pais inexistente".
 */
function normalizePaisIso3(v: string): string {
    const t = v.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    const mapa: Record<string, string> = {
        BRASIL: "BRA", BRAZIL: "BRA", BR: "BRA",
        ARGENTINA: "ARG", AR: "ARG",
        URUGUAI: "URY", URUGUAY: "URY", UY: "URY",
        PARAGUAI: "PRY", PARAGUAY: "PRY", PY: "PRY",
        CHILE: "CHL", CL: "CHL",
        "ESTADOS UNIDOS": "USA", "UNITED STATES": "USA", US: "USA",
        PORTUGAL: "PRT", PT: "PRT",
    };
    if (mapa[t]) return mapa[t];
    // Já é código ISO-3 ou texto livre — trunca em 3 caracteres.
    return t.slice(0, 3);
}

/* ── types ── */

interface PreAdmissao {
    id: string;
    nome: string;
    nomeAbreviado: string | null;
    cpf: string | null;
    rg: string | null;
    rgOrgaoExpedidor: string | null;
    rgUfExpedidor: string | null;
    rgDataExpedicao: string | null;
    // RIC — Registro Identidade Civil (documento que substitui o RG)
    regIdentidCivilNumero: string | null;
    regIdentidCivilUf: string | null;
    regIdentidCivilCidade: string | null;
    regIdentidCivilOrgEmiss: string | null;
    regIdentidCivilDataExped: string | null;
    dataNascimento: string | null;
    sexo: number;
    estadoCivil: number;
    nacionalidade: string | null;
    paisNacionalidade: string | null;
    paisNascimento: string | null;
    nomeMae: string | null;
    nomePai: string | null;
    naturalCidade: string | null;
    naturalUf: string | null;
    origemFuncionario: number | null;
    cutis: number | null;
    cabelo: number | null;
    olhos: number | null;
    passaporte: string | null;
    rnmRne: string | null;
    validadeVisto: string | null;
    tipoVisto: string | null;
    cep: string | null;
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
    municipioEnderecoIbge: number | null;
    email: string | null;
    telefone: string | null;
    celular: string | null;
    contatoEmergenciaNome: string | null;
    contatoEmergenciaFone: string | null;
    bancoCodigo: string | null;
    bancoNome: string | null;
    agencia: string | null;
    agenciaDigito: string | null;
    conta: string | null;
    contaDigito: string | null;
    tipoConta: number | null;
    codEmpresa: string | null;
    estabelecimentoCodigo: string | null;
    unitId: string | null;
    areaId: string | null;
    jobPositionId: string | null;
    requisitoCategoriaId: string | null;
    dataAdmissao: string | null;
    salario: number | null;
    tipoContratacao: number | null;
    cargaHorariaSemanal: number | null;
    pisPasep: string | null;
    tituloEleitorNumero: string | null;
    tituloEleitorZona: string | null;
    tituloEleitorSecao: string | null;
    reservistaNumero: string | null;
    categoriaCnh: string | null;
    validadeCnh: string | null;
    ctps: string | null;
    ctpsSerie: string | null;
    ctpsUf: string | null;
    // Campos integração TOTVS
    codCargoTotvs: number | null;
    codVinculoEmpregaticio: number | null;
    tipoFuncionario: number | null;
    categoriaSalarial: number | null;
    grauInstrucao: number | null;
    codTurno: number | null;
    codTurma: number | null;
    tipoEstatistica: number | null;
    centroCusto: string | null;
    unidadeLotacao: string | null;
    emitCartPonto: string | null;
    formaPagamento: number | null;
    tipoAdmissaoFgts: number | null;
    paisLocalidade: string | null;
    indFuncVinculado: number | null;
    tipoMaoDeObra: string | null;
    codSindicato: number | null;
    codLocalMarcacao: number | null;
    codClassFuncPontoEletronico: number | null;
    codLocalidade: number | null;
    // Saúde e docs complementares TOTVS
    grupoSanguineo: number | null;
    fatorRh: number | null;
    possuiDeficiencia: string | null;
    docMilitarTipo: number | null;
    docMilitarNumero: string | null;
    docMilitarSerie: string | null;
    docMilitarRegiao: number | null;
    docMilitarCircunscricao: number | null;
    tipoVistoEstrangeiro: number | null;
    ocorrenciaCAGED: number | null;
    // Encargos e eSocial (antes eram default — agora RH preenche)
    optanteFgts: string | null;
    recolheFgts: string | null;
    recolheInss: string | null;
    sindicalizado: string | null;
    descContribSindical: string | null;
    resideExterior: string | null;
    cargaAutomTurno: string | null;
    calcula13: string | null;
    recebeFerias: string | null;
    considEmissRAIS: string | null;
    recebePericul: string | null;
    recebeInsalub: string | null;
    recebeAdiantamento: string | null;
    tipoLogradouroESocial: string | null;
    categoriaTrabalhoESocial: number | null;
    indAdmissao: number | null;
    tipoAdmissaoESocial: number | null;
    regimeTrabalhista: number | null;
    regimePrevidenciario: number | null;
    regimeJornada: number | null;
    cartaoSus: string | null;
    tituloEleitorCidade: string | null;
    tituloEleitorUf: string | null;
    ctpsModelo: number | null;
    altura: number | null;
    peso: number | null;
    validacaoSalarioJustificativa: string | null;
    status: number;
    documentos: { id: string; tipo: number | string; lado: number | string; nomeArquivo: string; contentType: string; tamanhoBytes: number; status: number; createdAtUtc: string; presignedUrl?: string }[];
    [key: string]: unknown;
}

const STEPS = [
    { key: "pessoal", label: "Dados Pessoais", icon: User },
    { key: "endereco", label: "Endereço", icon: MapPin },
    { key: "contato", label: "Contato", icon: Phone },
    { key: "bancario", label: "Dados Bancários", icon: CreditCard },
    { key: "trabalhista", label: "Dados Trabalhistas", icon: Briefcase },
    { key: "encargos", label: "Encargos e eSocial", icon: Coins },
    { key: "documentos", label: "Documentos", icon: FileUp },
    { key: "revisao", label: "Revisão e Envio", icon: CheckCircle2 },
];

const SEXO_OPTIONS = [
    { value: 0, label: "Não Informado" }, { value: 1, label: "Masculino" },
    { value: 2, label: "Feminino" }, { value: 3, label: "Outro" },
];
const ESTADO_CIVIL_OPTIONS = [
    { value: 0, label: "Não Informado" }, { value: 1, label: "Solteiro(a)" },
    { value: 2, label: "Casado(a)" }, { value: 3, label: "Divorciado(a)" },
    { value: 4, label: "Viúvo(a)" }, { value: 5, label: "União Estável" }, { value: 6, label: "Separado(a)" },
];
const TIPO_CONTRATACAO = [
    { value: 0, label: "CLT" }, { value: 1, label: "PJ" }, { value: 2, label: "Estágio" },
    { value: 3, label: "Temporário" }, { value: 4, label: "Aprendiz" }, { value: 5, label: "Terceirizado" },
];
const TIPO_CONTA = [
    { value: 0, label: "Conta Corrente" }, { value: 1, label: "Conta Poupança" }, { value: 2, label: "Conta Salário" },
];
const BANCOS = [
    "001-Banco do Brasil", "003-Banco da Amazônia", "004-BNB", "021-Banestes",
    "033-Santander", "041-Banrisul", "070-BRB", "077-Banco Inter",
    "104-Caixa Econômica Federal", "136-Unicred", "197-Stone", "208-BTG Pactual",
    "212-Banco Original", "237-Bradesco", "260-Nubank", "290-PagBank",
    "318-BMG", "336-C6 Bank", "341-Itaú Unibanco", "389-Mercantil",
    "394-Banco Finasa", "399-HSBC", "412-Banco Capital", "422-Safra",
    "453-Banco Rural", "633-Banco Rendimento", "707-Banco Daycoval",
    "741-Banco Ribeirão Preto", "745-Citibank", "748-Sicredi",
    "756-Sicoob", "097-CentralCred",
];
const VINCULO_EMPREGATICIO = [
    { value: 10, label: "CLT (Prazo Indeterminado)" },
    { value: 20, label: "CLT (Prazo Determinado)" },
    { value: 30, label: "Estagiário" },
    { value: 40, label: "Temporário" },
    { value: 50, label: "Diretor Sem Vínculo" },
    { value: 55, label: "Diretor Com Vínculo" },
    { value: 60, label: "Aprendiz" },
    { value: 70, label: "Autônomo" },
    { value: 80, label: "Cooperado" },
];
const TIPO_FUNCIONARIO_TOTVS = [
    { value: 1, label: "Mensalista" },
    { value: 2, label: "Horista" },
    { value: 3, label: "Diarista" },
    { value: 4, label: "Tarefeiro" },
];
const ORIGEM_FUNCIONARIO = [
    { value: 1, label: "Brasileiro" },
    { value: 2, label: "Naturalizado" },
    { value: 3, label: "Estrangeiro" },
];
const CUTIS_OPTIONS = [
    { value: 1, label: "Branca" },
    { value: 2, label: "Preta" },
    { value: 3, label: "Parda" },
    { value: 4, label: "Amarela" },
    { value: 5, label: "Indígena" },
    { value: 6, label: "Não Informada" },
    { value: 9, label: "Anonimizado" },
];
const CABELO_OPTIONS = [
    { value: 1, label: "Castanho" },
    { value: 2, label: "Preto" },
    { value: 3, label: "Loiro" },
    { value: 4, label: "Ruivo" },
    { value: 5, label: "Grisalho" },
    { value: 6, label: "Outros" },
    { value: 9, label: "Anonimizado" },
];
const OLHOS_OPTIONS = [
    { value: 1, label: "Castanho" },
    { value: 2, label: "Preto" },
    { value: 3, label: "Azul" },
    { value: 4, label: "Verde" },
    { value: 5, label: "Outros" },
    { value: 9, label: "Anonimizado" },
];
// Códigos TOTVS/Datasul (cEmitCartPonto em apisfadmissao.p).
// Datasul aceita "1" (Sim) / "2" (Não). "S"/"N" retorna erro "Tipo Emissão Cartão Ponto Incorreto".
const EMIT_CART_PONTO = [
    { value: "1", label: "Sim (emite)" },
    { value: "2", label: "Não" },
];
const TIPO_ESTATISTICA = [
    { value: 1, label: "Orçado" },
    { value: 2, label: "Não Orçado" },
    { value: 3, label: "Substituído" },
    { value: 4, label: "Normal" },
    { value: 5, label: "Afastado" },
    { value: 6, label: "Cedido" },
    { value: 7, label: "Pendente" },
];
// Códigos TOTVS Datasul (iFormaPagto em apisfadmissao.p)
const FORMA_PAGAMENTO = [
    { value: 1, label: "1 - Banco" },
    { value: 2, label: "2 - Dinheiro" },
    { value: 3, label: "3 - Cheque" },
    { value: 4, label: "4 - Cartão Salário" },
];
// Códigos TOTVS Datasul (iTipoAdmissFGTS em apisfadmissao.p)
const TIPO_ADMISSAO_FGTS = [
    { value: 1, label: "1 - Admissão Normal" },
    { value: 2, label: "2 - Trabalhador Avulso" },
    { value: 3, label: "3 - Sucessão/Incorporação/Transferência" },
    { value: 4, label: "4 - Primeiro Emprego" },
];
// Datasul rejeita iDocMilitarTipo < 1 mesmo para mulheres/acima de 45 — default "1".
const DOC_MILITAR_TIPO = [
    { value: 1, label: "1 - Cert. Reservista" },
    { value: 2, label: "2 - Cert. Dispensa" },
    { value: 3, label: "3 - Cert. Alistamento" },
];
// Datasul rejeita iTipoVistoEstrang < 1 mesmo para brasileiros — default "1".
const TIPO_VISTO_ESTRANGEIRO = [
    { value: 1, label: "1 - Passaporte Comum" },
    { value: 2, label: "2 - Temporário" },
    { value: 3, label: "3 - Permanente" },
    { value: 4, label: "4 - Oficial/Diplomático" },
    { value: 5, label: "5 - Outros" },
];
// Datasul (iOcorrCaged em apisfadmissao.p) — default "1" (admissão normal).
const OCORRENCIA_CAGED = [
    { value: 1, label: "1 - Admissão Normal" },
    { value: 2, label: "2 - Reintegração" },
    { value: 3, label: "3 - Reemprego" },
    { value: 4, label: "4 - Transferência Entrada" },
    { value: 5, label: "5 - Trabalho Temporário" },
];
// Opções S/N — Datasul rejeita vazio, precisa decisão explícita.
const SIM_NAO = [
    { value: "S", label: "Sim" },
    { value: "N", label: "Não" },
];
// eSocial — tipos de logradouro (cTpLograd na tabela S-1005 eSocial).
const TIPO_LOGRADOURO_ESOCIAL = [
    { value: "R",  label: "R — Rua" },
    { value: "AV", label: "AV — Avenida" },
    { value: "TV", label: "TV — Travessa" },
    { value: "AL", label: "AL — Alameda" },
    { value: "PR", label: "PR — Praça" },
    { value: "RD", label: "RD — Rodovia" },
    { value: "ES", label: "ES — Estrada" },
    { value: "VI", label: "VI — Viela/Vila" },
];
// eSocial S-2200 — Categoria de trabalhador.
const CATEGORIA_ESOCIAL = [
    { value: 101, label: "101 - Empregado Geral (CLT)" },
    { value: 102, label: "102 - Empregado Trab. Rural" },
    { value: 103, label: "103 - Empregado Aprendiz" },
    { value: 104, label: "104 - Empregado Doméstico" },
    { value: 105, label: "105 - Empregado Rural por Prazo Determinado" },
    { value: 106, label: "106 - Trabalhador Temporário (Lei 6.019)" },
    { value: 111, label: "111 - Empregado Contrato Verde Amarelo" },
];
// Indicativo de admissão eSocial (iIndAdmiss).
const IND_ADMISSAO = [
    { value: 1, label: "1 - Admissão Normal" },
    { value: 2, label: "2 - Transferência" },
    { value: 3, label: "3 - Admissão Eletiva" },
    { value: 4, label: "4 - Admissão por Reforma (Militar)" },
    { value: 5, label: "5 - Provimento de Cargo Público" },
];
// Tipo de admissão eSocial (iTpAdmiss).
const TIPO_ADMISSAO_ESOCIAL = [
    { value: 1, label: "1 - Admissão (primeiro emprego no empregador)" },
    { value: 2, label: "2 - Readmissão" },
    { value: 3, label: "3 - Trabalhador Transferido" },
    { value: 4, label: "4 - Servidor Público Exercício Outro Órgão" },
];
// Regime trabalhista (iRegTrab).
const REGIME_TRABALHISTA = [
    { value: 1, label: "1 - CLT" },
    { value: 2, label: "2 - Estatutário/Legislação Especial" },
];
// Regime previdenciário (iRegPrev).
const REGIME_PREVIDENCIARIO = [
    { value: 1, label: "1 - RGPS (Regime Geral — CLT padrão)" },
    { value: 2, label: "2 - RPPS (Regime Próprio Serv. Público)" },
    { value: 3, label: "3 - Regime no Exterior" },
];
// Regime de jornada (iRegJornada).
const REGIME_JORNADA = [
    { value: 1, label: "1 - Submetido a horário de trabalho (art. 58 CLT)" },
    { value: 2, label: "2 - Atividade externa, teletrabalho ou compatível" },
    { value: 3, label: "3 - Exercente de cargo de gestão (art. 62, II)" },
    { value: 4, label: "4 - Tripulante de aeronave (Lei 13.475/2017)" },
    { value: 9, label: "9 - Sem tipificação (regimes específicos)" },
];
const GRAU_INSTRUCAO = [
    { value: 1, label: "Analfabeto" },
    { value: 2, label: "Fundamental Incompleto" },
    { value: 3, label: "Fundamental Completo" },
    { value: 4, label: "Médio Incompleto" },
    { value: 5, label: "Médio Completo" },
    { value: 6, label: "Superior Incompleto" },
    { value: 7, label: "Superior Completo" },
    { value: 8, label: "Pós-Graduação" },
    { value: 9, label: "Mestrado" },
    { value: 10, label: "Doutorado" },
];
const CATEGORIA_SALARIAL = [
    { value: 1, label: "A" }, { value: 2, label: "B" }, { value: 3, label: "C" },
    { value: 4, label: "D" }, { value: 5, label: "E" },
];
const TIPO_DOC_ALL = [
    { value: 0, label: "RG" }, { value: 1, label: "CPF" }, { value: 2, label: "CNH" },
    { value: 5, label: "Comprovante Residência" }, { value: 14, label: "Comprovante Bancário" },
    { value: 6, label: "Certidão Nascimento/Casamento" }, { value: 9, label: "CTPS Digital" },
    { value: 3, label: "Título Eleitor" }, { value: 4, label: "Reservista" }, { value: 7, label: "PIS/PASEP" },
    { value: 15, label: "Foto 3x4" }, { value: 16, label: "Escolaridade" },
    { value: 20, label: "CNPJ" }, { value: 21, label: "Contrato Social/MEI" },
    { value: 22, label: "Conta Bancária PJ" }, { value: 23, label: "Certidões Negativas" },
    { value: 8, label: "Outro" },
];
const DOCS_CLT = new Set([0, 1, 5, 9, 3, 4, 7, 15, 6, 16, 14]);
const DOCS_PJ = new Set([20, 21, 0, 1, 22, 23]);
function getDocsPorTipo(tipo: number | null) {
    if (tipo === 1) return TIPO_DOC_ALL.filter(d => DOCS_PJ.has(d.value));
    return TIPO_DOC_ALL.filter(d => DOCS_CLT.has(d.value));
}
// Mapa string enum → number (API retorna enums como string via JsonStringEnumConverter)
const TIPO_DOC_STR_MAP: Record<string, number> = {
    RG: 0, CPF: 1, CNH: 2, TituloEleitor: 3, Reservista: 4, ComprovanteResidencia: 5,
    CertidaoNascimentoCasamento: 6, PisPasep: 7, Outro: 8, CarteiraTrabalhoCTPS: 9,
    ComprovanteBancario: 14, Foto3x4: 15, Escolaridade: 16,
    CNPJ: 20, ContratoSocialMEI: 21, ContaBancariaPJ: 22, CertidoesNegativas: 23,
};
function resolveDocTipo(raw: number | string): number {
    if (typeof raw === "number") return raw;
    return TIPO_DOC_STR_MAP[raw] ?? -1;
}
// Lado pode vir como int (0,1,2) ou string ("Unico","Frente","Verso") dependendo do endpoint
const LADO_STR_MAP: Record<string, number> = { Unico: 0, Frente: 1, Verso: 2 };
function resolveDocLado(raw: number | string): number {
    if (typeof raw === "number") return raw;
    return LADO_STR_MAP[raw] ?? 0;
}
// Tipos com frente e verso (igual ao portal do candidato)
const TIPOS_COM_VERSO = new Set([0, 2, 9]); // RG, CNH, CTPS
const TIPO_DOC = TIPO_DOC_ALL; // fallback
const UF_LIST = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

/* ── component ── */

export default function AdmissaoWizardScreen() {
    const router = useRouter();
    const params = useSearchParams();
    const id = params.get("id");
    const [step, setStep] = useState(0);
    const [form, setForm] = useState<Partial<PreAdmissao>>({});
    const [saving, setSaving] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    // Erros de validação — exibidos como borda vermelha nos inputs culpados.
    const [fieldErrors, setFieldErrors] = useState<Set<string>>(new Set());
    // DEBUG: expõe p/ Playwright inspecionar em testes E2E
    if (typeof window !== "undefined") {
        (window as unknown as { __admissaoFieldErrors?: string[] }).__admissaoFieldErrors = Array.from(fieldErrors);
    }
    const [loadingData, setLoadingData] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        if (id) {
            loadData();
        } else {
            // Pre-fill from query params (coming from Pipeline → "Iniciar Admissão")
            const cargo = params.get("cargo");
            if (cargo) {
                setForm(prev => ({ ...prev, nome: prev.nome || cargo }));
                setStep(4); // Jump to Dados Trabalhistas where cargo is relevant
            }
        }
    }, [id]);

    async function loadData() {
        setLoadingData(true);
        setLoadError(null);
        try {
            const res = await apiFetch(`/api/pre-admissao/${id}`);
            if (res.ok) setForm(await res.json());
            else setLoadError("Não foi possível carregar os dados da admissão.");
        } catch {
            setLoadError("Erro de conexão ao carregar a admissão.");
        } finally {
            setLoadingData(false);
        }
    }

    function set(field: string, value: unknown) {
        setForm(prev => ({ ...prev, [field]: value }));
    }

    async function save() {
        if (!id) return;
        try {
            setSaving(true);
            const res = await apiFetch(`/api/pre-admissao/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            if (res.ok) { setForm(await res.json()); toast.success("Salvo!"); }
            else toast.error("Erro ao salvar");
        } catch { toast.error("Erro de conexão"); }
        finally { setSaving(false); }
    }

    // Navega ao step do primeiro erro, destaca inputs em vermelho e faz scroll até o campo.
    function applyErrors(errors: { field: string; label: string; stepIndex: number; message: string }[]) {
        if (errors.length === 0) return;
        const firstStep = firstErrorStep(errors) ?? 0;
        setStep(firstStep);
        setFieldErrors(new Set(errors.map(e => e.field)));
        const first = errors[0];
        toast.error(`${first.label}: ${first.message}${errors.length > 1 ? ` (+${errors.length - 1} campo(s) com pend\u00eancia)` : ""}`);
        // Scroll até o primeiro campo culpado (depois do setStep pintar o DOM).
        setTimeout(() => {
            const el = document.querySelector<HTMLElement>(`[data-field="${first.field}"]`);
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                const input = el.querySelector<HTMLElement>("input, select, textarea");
                input?.focus();
            }
        }, 120);
    }

    async function submit() {
        if (!id) return;
        // Validação só no clique em "Finalizar" — passos intermediários permitem dados incompletos.
        const errors = validatePreAdmissao(form);
        if (errors.length > 0) {
            applyErrors(errors);
            return;
        }
        setFieldErrors(new Set());
        try {
            setSubmitting(true);
            await save();
            const res = await apiFetch(`/api/pre-admissao/${id}/submit`, { method: "POST" });
            if (res.ok) { toast.success("Admissão finalizada com sucesso!"); router.push("/admissao?submitted=1"); return; }

            // 422 → backend identificou campo TOTVS faltando; redireciona ao step culpado.
            if (res.status === 422) {
                const body = await res.json().catch(() => null) as
                    | { type?: string; message?: string; errors?: TotvsValidationIssue[] }
                    | null;
                if (body?.type === "totvs_validation" && body.errors?.length) {
                    const mapped = mapTotvsIssuesToErrors(body.errors);
                    applyErrors(mapped);
                    return;
                }
            }

            const fallback = await res.text().catch(() => "");
            toast.error(fallback || "Erro ao submeter");
        } catch { toast.error("Erro de conexão"); }
        finally { setSubmitting(false); }
    }

    async function handleCep() {
        const cep = form.cep?.replace(/\D/g, "");
        if (!cep || cep.length !== 8) return;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: controller.signal });
            clearTimeout(timeoutId);
            const data = await res.json();
            if (data.erro) { toast.error("CEP não encontrado"); return; }
            // IBGE é obrigatório TOTVS/eSocial — ViaCEP retorna como string, convertemos para int.
            const ibgeNum = data.ibge ? Number(data.ibge) : null;
            setForm(prev => ({
                ...prev,
                logradouro: data.logradouro,
                bairro: data.bairro,
                cidade: data.localidade,
                uf: data.uf,
                ...(Number.isFinite(ibgeNum) ? { municipioEnderecoIbge: ibgeNum } : {}),
            }));
            toast.success("Endereço preenchido via CEP!");
        } catch (e) {
            if ((e as Error).name === "AbortError") toast.error("Busca de CEP demorou demais — preencha o endereço manualmente");
            else toast.error("Não foi possível buscar o CEP");
        }
    }

    async function handleDeleteDoc(docId: string) {
        if (!id) return;
        try {
            const res = await apiFetch(`/api/pre-admissao/${id}/documentos/${docId}`, { method: "DELETE" });
            if (res.ok) { toast.success("Documento removido"); loadData(); }
            else toast.error("Erro ao remover documento");
        } catch {
            toast.error("Erro de conexão ao remover documento");
        }
    }

    const fmtBrl = (v: number | null) => v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

    if (loadingData) return (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm gap-2">
            <Loader2 className="size-4 animate-spin" /> Carregando admissão…
        </div>
    );

    if (loadError) return (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <AlertTriangle className="size-8 text-destructive" />
            <p className="text-sm text-destructive">{loadError}</p>
            <Button variant="outline" size="sm" onClick={() => { if (id) loadData(); }}>Tentar novamente</Button>
            <Button variant="outline" size="sm" onClick={() => router.push("/admissao")}>Voltar para lista</Button>
        </div>
    );

    return (
        <ErrorCtx.Provider value={fieldErrors}>
        <section className="space-y-4">
            {/* header */}
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-lg font-bold">Nova Admissão</h4>
                </div>
                <Button variant="outline" size="sm" onClick={() => router.push("/admissao")}>
                    <ChevronLeft className="size-4" /> Voltar
                </Button>
            </div>

            {/* card unificado: nav steps + conteúdo */}
            <div className="rounded-xl border border-border/40 bg-card shadow-sm overflow-hidden">
                {/* step indicators — barra de navegação */}
                <div className="flex gap-1 overflow-x-auto px-4 py-3 border-b border-border/40 bg-muted/20">
                    {STEPS.map((s, i) => {
                        const Icon = s.icon;
                        return (
                            <button key={s.key} onClick={() => setStep(i)}
                                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${step === i ? "bg-blue-600 text-white shadow-sm" : i < step ? "bg-emerald-500/15 text-emerald-700" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                                    }`}
                            >
                                <Icon className="size-3.5" /> {s.label}
                            </button>
                        );
                    })}
                </div>

            {/* conteúdo do step */}
            <div className="p-6 min-h-[400px]">

                {/* Step 0: Dados Pessoais */}
                {step === 0 && (
                    <div className="space-y-4">
                        <h5 className="font-semibold text-sm flex items-center gap-2"><User className="size-4" /> Dados Pessoais</h5>

                        <section>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Identificação</div>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                <div className="col-span-2 lg:col-span-3"><Field field="nome" label="Nome Completo *" value={form.nome} onChange={v => set("nome", v)} /></div>
                                <div className="col-span-2"><Field field="nomeAbreviado" label="Nome Abreviado *" value={form.nomeAbreviado} onChange={v => set("nomeAbreviado", v)} placeholder="Máx. 12 caracteres" maxLength={12} /></div>
                                <Field field="cpf" label="CPF *" value={form.cpf} onChange={v => set("cpf", v)} placeholder="000.000.000-00" maxLength={14} />
                                <Field field="dataNascimento" label="Data Nascimento *" value={form.dataNascimento} onChange={v => set("dataNascimento", v)} type="date" />
                                <Select field="sexo" label="Sexo *" value={form.sexo} options={SEXO_OPTIONS} onChange={v => set("sexo", Number(v))} />
                                <Select field="estadoCivil" label="Estado Civil *" value={form.estadoCivil} options={ESTADO_CIVIL_OPTIONS} onChange={v => set("estadoCivil", Number(v))} />
                                <Select field="origemFuncionario" label="Origem *" value={form.origemFuncionario} options={ORIGEM_FUNCIONARIO} onChange={v => set("origemFuncionario", Number(v))} />
                                <Field label="Nacionalidade" value={form.nacionalidade} onChange={v => set("nacionalidade", v)} placeholder="Brasileira" />
                                <Field field="paisNacionalidade" label="País Nacionalidade *" value={form.paisNacionalidade} onChange={v => set("paisNacionalidade", normalizePaisIso3(v))} placeholder="BRA" maxLength={3} hint="ISO 3 letras (BRA, USA, ARG)" />
                                <div className="col-span-2"><Field field="naturalCidade" label="Natural (Cidade) *" value={form.naturalCidade} onChange={v => set("naturalCidade", v)} /></div>
                                <Select field="naturalUf" label="UF *" value={form.naturalUf} options={UF_LIST.map(u => ({ value: u, label: u }))} onChange={v => set("naturalUf", v)} />
                                <Field field="paisNascimento" label="País Nascimento *" value={form.paisNascimento} onChange={v => set("paisNascimento", normalizePaisIso3(v))} placeholder="BRA" maxLength={3} hint="ISO 3 letras" />
                                <div className="col-span-2 md:col-span-3"><Field label="Nome da Mãe" value={form.nomeMae} onChange={v => set("nomeMae", v)} /></div>
                                <div className="col-span-2 md:col-span-3"><Field label="Nome do Pai" value={form.nomePai} onChange={v => set("nomePai", v)} /></div>
                            </div>
                        </section>

                        <section className="border-t border-border/30 pt-3">
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">RG — Registro Geral <span className="text-muted-foreground/70 normal-case">(se informar um, preencha os três)</span></div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <Field label="RG" value={form.rg} onChange={v => set("rg", v)} />
                                <Field label="Órgão Expedidor" value={form.rgOrgaoExpedidor} onChange={v => set("rgOrgaoExpedidor", v)} placeholder="SSP" maxLength={10} />
                                <Select label="UF" value={form.rgUfExpedidor} options={UF_LIST.map(u => ({ value: u, label: u }))} onChange={v => set("rgUfExpedidor", v)} />
                                <Field label="Data Expedição" value={form.rgDataExpedicao} onChange={v => set("rgDataExpedicao", v)} type="date" />
                            </div>
                        </section>

                        <section className="border-t border-border/30 pt-3">
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">RIC — Registro Identidade Civil (obrigatório TOTVS)</div>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                <div className="col-span-2"><Field field="regIdentidCivilNumero" label="RIC Nº *" value={form.regIdentidCivilNumero} onChange={v => set("regIdentidCivilNumero", v)} /></div>
                                <Field field="regIdentidCivilOrgEmiss" label="Órgão Expedidor *" value={form.regIdentidCivilOrgEmiss} onChange={v => set("regIdentidCivilOrgEmiss", v)} placeholder="SSP" maxLength={10} />
                                <Select field="regIdentidCivilUf" label="UF *" value={form.regIdentidCivilUf} options={UF_LIST.map(u => ({ value: u, label: u }))} onChange={v => set("regIdentidCivilUf", v)} />
                                <Field field="regIdentidCivilCidade" label="Cidade *" value={form.regIdentidCivilCidade} onChange={v => set("regIdentidCivilCidade", v)} />
                                <Field label="Data Expedição" value={form.regIdentidCivilDataExped} onChange={v => set("regIdentidCivilDataExped", v)} type="date" />
                            </div>
                        </section>

                        <section className="border-t border-border/30 pt-3">
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Características Físicas *</div>
                            <div className="grid grid-cols-3 gap-3 max-w-2xl">
                                <Select field="cutis" label="Raça/Cor *" value={form.cutis} options={CUTIS_OPTIONS} onChange={v => set("cutis", Number(v))} />
                                <Select field="cabelo" label="Cabelo *" value={form.cabelo} options={CABELO_OPTIONS} onChange={v => set("cabelo", Number(v))} />
                                <Select field="olhos" label="Olhos *" value={form.olhos} options={OLHOS_OPTIONS} onChange={v => set("olhos", Number(v))} />
                            </div>
                        </section>

                        {form.nacionalidade && form.nacionalidade.toLowerCase() !== "brasileira" && (
                            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-3">
                                <div className="text-sm font-semibold text-amber-700 flex items-center gap-1"><AlertTriangle className="size-4" /> Dados do Estrangeiro</div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <Field label="Passaporte" value={form.passaporte} onChange={v => set("passaporte", v)} />
                                    <Field label="RNM/RNE" value={form.rnmRne} onChange={v => set("rnmRne", v)} />
                                    <Field label="Validade Visto" value={form.validadeVisto} onChange={v => set("validadeVisto", v)} type="date" />
                                    <Field label="Tipo Visto" value={form.tipoVisto} onChange={v => set("tipoVisto", v)} />
                                </div>
                                {form.validadeVisto && new Date(form.validadeVisto) < new Date() && (
                                    <div className="mt-2 rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-700 flex items-center gap-2">
                                        <AlertTriangle className="size-4 flex-shrink-0" />
                                        <span><strong>Visto expirado!</strong> A validade do visto é anterior à data atual. O processo não poderá prosseguir até a renovação.</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Step 1: Endereço */}
                {step === 1 && (
                    <div className="space-y-3">
                        <h5 className="font-semibold text-sm flex items-center gap-2"><MapPin className="size-4" /> Endereço</h5>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            <div data-field="cep" className="col-span-2 md:col-span-1">
                                <label className={`text-[11px] font-medium block mb-0.5 ${fieldErrors.has("cep") ? "text-red-600" : "text-muted-foreground"}`}>CEP *</label>
                                <div className="flex gap-1">
                                    <Input
                                        value={form.cep || ""}
                                        onChange={e => set("cep", e.target.value)}
                                        placeholder="00000-000"
                                        maxLength={9}
                                        className={`h-8 text-sm ${fieldErrors.has("cep") ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                                    />
                                    <Button variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={handleCep} type="button">🔍</Button>
                                </div>
                            </div>
                            <div className="col-span-2 md:col-span-3"><Field field="logradouro" label="Logradouro *" value={form.logradouro} onChange={v => set("logradouro", v)} /></div>
                            <Field label="Número" value={form.numero} onChange={v => set("numero", v)} maxLength={10} />
                            <Field label="Complemento" value={form.complemento} onChange={v => set("complemento", v)} />
                            <div className="col-span-2"><Field field="bairro" label="Bairro *" value={form.bairro} onChange={v => set("bairro", v)} /></div>
                            <div className="col-span-2"><Field field="cidade" label="Cidade *" value={form.cidade} onChange={v => set("cidade", v)} /></div>
                            <Select field="uf" label="UF *" value={form.uf} options={UF_LIST.map(u => ({ value: u, label: u }))} onChange={v => set("uf", v)} />
                            <Field field="municipioEnderecoIbge" label="Código IBGE *" value={form.municipioEnderecoIbge != null ? String(form.municipioEnderecoIbge) : ""} onChange={v => {
                                const n = parseInt(v, 10);
                                set("municipioEnderecoIbge", Number.isFinite(n) ? n : null);
                            }} type="number" placeholder="3550308" maxLength={7} hint="7 dígitos — preenchido automaticamente pelo CEP" />
                        </div>
                    </div>
                )}

                {/* Step 2: Contato */}
                {step === 2 && (
                    <div className="space-y-3">
                        <h5 className="font-semibold text-sm flex items-center gap-2"><Phone className="size-4" /> Contato</h5>
                        <section>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Pessoal</div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="col-span-2"><Field label="E-mail" value={form.email} onChange={v => set("email", v)} type="email" placeholder="email@exemplo.com" /></div>
                                <Field label="Telefone" value={form.telefone} onChange={v => set("telefone", v)} placeholder="(11) 0000-0000" maxLength={15} />
                                <Field label="Celular" value={form.celular} onChange={v => set("celular", v)} placeholder="(11) 90000-0000" maxLength={16} />
                            </div>
                        </section>
                        <section className="border-t border-border/30 pt-3">
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Contato de Emergência</div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="col-span-2"><Field label="Nome" value={form.contatoEmergenciaNome} onChange={v => set("contatoEmergenciaNome", v)} /></div>
                                <div className="col-span-2"><Field label="Telefone" value={form.contatoEmergenciaFone} onChange={v => set("contatoEmergenciaFone", v)} placeholder="(11) 90000-0000" maxLength={16} /></div>
                            </div>
                        </section>
                    </div>
                )}

                {/* Step 3: Bancário */}
                {step === 3 && (
                    <div className="space-y-3">
                        <h5 className="font-semibold text-sm flex items-center gap-2"><CreditCard className="size-4" /> Dados Bancários</h5>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            <div className="col-span-2 md:col-span-3">
                                <label className="text-[11px] font-medium block mb-0.5 text-muted-foreground">Banco (FEBRABAN)</label>
                                <select className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm" value={form.bancoCodigo || ""} onChange={e => {
                                    const cod = e.target.value;
                                    if (!cod) { set("bancoCodigo", null); set("bancoNome", null); return; }
                                    const banco = BANCOS.find(b => b.startsWith(cod + "-"));
                                    set("bancoCodigo", cod);
                                    set("bancoNome", banco ? banco.substring(cod.length + 1) : null);
                                }}>
                                    <option value="">Selecione…</option>
                                    {BANCOS.map(b => {
                                        const dash = b.indexOf("-");
                                        const cod = b.substring(0, dash);
                                        return <option key={b} value={cod}>{b}</option>;
                                    })}
                                </select>
                            </div>
                            <div className="col-span-2"><Select label="Tipo de Conta" value={form.tipoConta} options={TIPO_CONTA} onChange={v => set("tipoConta", Number(v))} /></div>
                            <Field label="Agência" value={form.agencia} onChange={v => set("agencia", v)} maxLength={6} />
                            <Field label="Dígito Ag." value={form.agenciaDigito} onChange={v => set("agenciaDigito", v)} maxLength={2} />
                            <div className="col-span-2"><Field label="Conta" value={form.conta} onChange={v => set("conta", v)} maxLength={15} /></div>
                            <Field label="Dígito Cta." value={form.contaDigito} onChange={v => set("contaDigito", v)} maxLength={2} />
                        </div>
                    </div>
                )}

                {/* Step 4: Trabalhista */}
                {step === 4 && (
                    <div className="space-y-3">
                        <h5 className="font-semibold text-sm flex items-center gap-2"><Briefcase className="size-4" /> Dados Trabalhistas</h5>

                        <section>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Empresa e Admissão</div>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                <div data-field="codEmpresa" className="col-span-2 md:col-span-3">
                                    <label className={`text-[11px] font-medium block mb-0.5 flex items-center ${fieldErrors.has("codEmpresa") ? "text-red-600" : "text-muted-foreground"}`}>
                                        Empresa *<Hint text="Busca nas empresas do tenant. Vira cCodEmpresa no TOTVS." />
                                    </label>
                                    <EmpresaAutocomplete
                                        value={null}
                                        onChange={() => {}}
                                        onSelect={(empresa) => set("codEmpresa", empresa?.code || null)}
                                        defaultLabel={form.codEmpresa ? { code: form.codEmpresa, description: "Empresa selecionada" } : undefined}
                                        placeholder="Razão social ou código..."
                                    />
                                </div>
                                <div className="col-span-2 md:col-span-3">
                                    <label className="text-[11px] font-medium block mb-0.5 text-muted-foreground">Estabelecimento</label>
                                    <EstabelecimentoAutocomplete
                                        value={form.estabelecimentoCodigo ?? null}
                                        onChange={(code) => set("estabelecimentoCodigo", code || null)}
                                        valueAsCode
                                    />
                                </div>
                                <Field field="dataAdmissao" label="Data Admissão *" value={form.dataAdmissao} onChange={v => set("dataAdmissao", v)} type="date" />
                                <Field field="salario" label="Salário (R$) *" value={form.salario != null ? String(form.salario) : ""} onChange={v => {
                                    if (!v) { set("salario", null); return; }
                                    const n = parseFloat(v);
                                    set("salario", Number.isFinite(n) ? n : null);
                                }} type="number" placeholder="0,00" />
                                <Select field="tipoContratacao" label="Contratação *" value={form.tipoContratacao} options={TIPO_CONTRATACAO} onChange={v => set("tipoContratacao", Number(v))} />
                                <Field field="cargaHorariaSemanal" label="Carga Horária/sem *" value={form.cargaHorariaSemanal != null ? String(form.cargaHorariaSemanal) : ""} onChange={v => {
                                    if (!v) { set("cargaHorariaSemanal", null); return; }
                                    const n = parseInt(v, 10);
                                    if (!Number.isFinite(n) || n < 0) { set("cargaHorariaSemanal", null); return; }
                                    set("cargaHorariaSemanal", Math.min(n, 32767));
                                }} type="number" placeholder="44" maxLength={3} />
                                <Field label="PIS/PASEP" value={form.pisPasep} onChange={v => set("pisPasep", v)} maxLength={11} hint="11 dígitos sem máscara" />
                            </div>
                            {form.salario && form.validacaoSalarioOk === false && (
                                <div data-field="validacaoSalarioJustificativa" className="mt-2 rounded border border-amber-500/30 bg-amber-500/5 p-2.5 flex items-start gap-2">
                                    <AlertTriangle className="size-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1 space-y-1.5">
                                        <div className="text-[11px] font-semibold text-amber-700">Salário acima do teto da faixa do cargo — justifique:</div>
                                        <Input
                                            value={form.validacaoSalarioJustificativa || ""}
                                            onChange={e => set("validacaoSalarioJustificativa", e.target.value)}
                                            placeholder="Ex: contratação estratégica aprovada pelo diretor"
                                            className={`h-8 text-sm ${fieldErrors.has("validacaoSalarioJustificativa") ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                                        />
                                    </div>
                                </div>
                            )}
                        </section>

                        <section className="border-t border-border/30 pt-3">
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Cargo e Vínculo TOTVS</div>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                <div data-field="codCargoTotvs" className={`col-span-2 ${fieldErrors.has("codCargoTotvs") ? "[&_input]:border-red-500 [&_input]:focus-visible:ring-red-500" : ""}`}>
                                    <label className={`text-[11px] font-medium block mb-0.5 ${fieldErrors.has("codCargoTotvs") ? "text-red-600" : "text-muted-foreground"}`}>Cargo TOTVS *</label>
                                    <CargoAutocomplete
                                      value={form.codCargoTotvs != null ? String(form.codCargoTotvs) : ""}
                                      onChange={() => {}}
                                      onSelect={(cargo) => {
                                        set("codCargoTotvs", cargo.totvsCargoBasicId ?? null);
                                        set("jobPositionId", cargo.id || null);
                                      }}
                                    />
                                </div>
                                <Select field="codVinculoEmpregaticio" label="Vínculo *" value={form.codVinculoEmpregaticio} options={VINCULO_EMPREGATICIO} onChange={v => set("codVinculoEmpregaticio", Number(v))} />
                                <Select field="tipoFuncionario" label="Tipo Func. *" value={form.tipoFuncionario} options={TIPO_FUNCIONARIO_TOTVS} onChange={v => set("tipoFuncionario", Number(v))} />
                                <div data-field="categoriaSalarial" className={fieldErrors.has("categoriaSalarial") ? "[&_input]:border-red-500 [&_input]:focus-visible:ring-red-500" : ""}>
                                    <label className={`text-[11px] font-medium block mb-0.5 ${fieldErrors.has("categoriaSalarial") ? "text-red-600" : "text-muted-foreground"}`}>Cat. Salarial *</label>
                                    <CategoriaSalarialAutocomplete
                                      value={form.categoriaSalarial != null ? String(form.categoriaSalarial) : ""}
                                      onChange={(code) => set("categoriaSalarial", toIntOrNull(code))}
                                    />
                                </div>
                                <Select field="grauInstrucao" label="Grau de Instrução *" value={form.grauInstrucao} options={GRAU_INSTRUCAO} onChange={v => set("grauInstrucao", Number(v))} />
                                <Select field="emitCartPonto" label="Emite Cart. Ponto *" value={form.emitCartPonto} options={EMIT_CART_PONTO} onChange={v => set("emitCartPonto", v)} />
                                <Select field="tipoEstatistica" label="Estatística *" value={form.tipoEstatistica} options={TIPO_ESTATISTICA} onChange={v => set("tipoEstatistica", Number(v))} />
                                <Select field="formaPagamento" label="Forma Pagto *" value={form.formaPagamento} options={FORMA_PAGAMENTO} onChange={v => set("formaPagamento", Number(v))} />
                                <Select field="tipoAdmissaoFgts" label="Tipo Adm. FGTS *" value={form.tipoAdmissaoFgts} options={TIPO_ADMISSAO_FGTS} onChange={v => set("tipoAdmissaoFgts", Number(v))} />
                                <Field field="paisLocalidade" label="País Localidade *" value={form.paisLocalidade} onChange={v => set("paisLocalidade", normalizePaisIso3(v))} placeholder="BRA" maxLength={3} hint="ISO 3 letras" />
                            </div>
                        </section>

                        <section className="border-t border-border/30 pt-3">
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Lotação e Turno</div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[11px] font-medium block mb-0.5 text-muted-foreground">Cód. Turno *</label>
                                    <TurnoAutocomplete value={form.codTurno ?? null} onChange={(code) => set("codTurno", toIntOrNull(code))} />
                                </div>
                                <div>
                                    <label className="text-[11px] font-medium block mb-0.5 text-muted-foreground">Centro de Custo *</label>
                                    <CentroCustoAutocomplete value={form.centroCusto ?? null} onChange={(code) => set("centroCusto", code || null)} />
                                </div>
                                <div>
                                    <label className="text-[11px] font-medium block mb-0.5 text-muted-foreground">Unid. Lotação *</label>
                                    <UnidadeLotacaoAutocomplete value={form.unidadeLotacao ?? null} onChange={(code) => set("unidadeLotacao", code || null)} />
                                </div>
                            </div>
                        </section>

                        <section className="border-t border-border/30 pt-3">
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Jornada, Ponto e Sindicato (TOTVS)</div>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                <Field field="codTurma" label="Cód. Turma *" value={form.codTurma != null ? String(form.codTurma) : ""} onChange={v => set("codTurma", toIntOrNull(v))} type="number" />
                                <Field field="indFuncVinculado" label="Ind. Func. Vinc. *" value={form.indFuncVinculado != null ? String(form.indFuncVinculado) : ""} onChange={v => set("indFuncVinculado", toIntOrNull(v))} type="number" />
                                <div data-field="tipoMaoDeObra">
                                    <label className={`text-[11px] font-medium block mb-0.5 ${fieldErrors.has("tipoMaoDeObra") ? "text-red-600" : "text-muted-foreground"}`}>Tipo Mão-de-Obra *</label>
                                    <select
                                        className={`w-full h-8 rounded-md border bg-background px-2 text-sm ${fieldErrors.has("tipoMaoDeObra") ? "border-red-500 focus-visible:ring-red-500" : "border-input"}`}
                                        value={form.tipoMaoDeObra ?? ""}
                                        onChange={e => set("tipoMaoDeObra", e.target.value || null)}
                                    >
                                        <option value="">Selecione…</option>
                                        <option value="ADM">ADM — Administrativo</option>
                                        <option value="COM">COM — Comercial</option>
                                        <option value="GER">GER — Gerencial</option>
                                        <option value="OPE">OPE — Operacional</option>
                                    </select>
                                </div>
                                <Field field="codSindicato" label="Cód. Sindicato *" value={form.codSindicato != null ? String(form.codSindicato) : ""} onChange={v => set("codSindicato", toIntOrNull(v))} type="number" />
                                <Field field="codLocalMarcacao" label="Cód. Loc. Marcação *" value={form.codLocalMarcacao != null ? String(form.codLocalMarcacao) : ""} onChange={v => set("codLocalMarcacao", toIntOrNull(v))} type="number" />
                                <Field field="codClassFuncPontoEletronico" label="Classif. Func. Ponto *" value={form.codClassFuncPontoEletronico != null ? String(form.codClassFuncPontoEletronico) : ""} onChange={v => set("codClassFuncPontoEletronico", toIntOrNull(v))} type="number" />
                                <Field field="codLocalidade" label="Cód. Localidade *" value={form.codLocalidade != null ? String(form.codLocalidade) : ""} onChange={v => set("codLocalidade", toIntOrNull(v))} type="number" />
                            </div>
                        </section>

                        <section className="border-t border-border/30 pt-3">
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Documentos Militares / Estrangeiro / CAGED (TOTVS)</div>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                <Select field="docMilitarTipo" label="Tipo Doc. Militar *" value={form.docMilitarTipo} options={DOC_MILITAR_TIPO} onChange={v => set("docMilitarTipo", Number(v))} />
                                <Field field="docMilitarRegiao" label="Região *" value={form.docMilitarRegiao != null ? String(form.docMilitarRegiao) : ""} onChange={v => set("docMilitarRegiao", toIntOrNull(v))} type="number" />
                                <Field field="docMilitarCircunscricao" label="Circunscrição *" value={form.docMilitarCircunscricao != null ? String(form.docMilitarCircunscricao) : ""} onChange={v => set("docMilitarCircunscricao", toIntOrNull(v))} type="number" />
                                <Field label="Doc. Nº" value={form.docMilitarNumero} onChange={v => set("docMilitarNumero", v)} />
                                <Field label="Série" value={form.docMilitarSerie} onChange={v => set("docMilitarSerie", v)} maxLength={5} />
                                <div></div>
                                <Select field="tipoVistoEstrangeiro" label="Tipo Visto Estrang. *" value={form.tipoVistoEstrangeiro} options={TIPO_VISTO_ESTRANGEIRO} onChange={v => set("tipoVistoEstrangeiro", Number(v))} />
                                <Select field="ocorrenciaCAGED" label="Ocorrência CAGED *" value={form.ocorrenciaCAGED} options={OCORRENCIA_CAGED} onChange={v => set("ocorrenciaCAGED", Number(v))} />
                            </div>
                        </section>

                        <section className="border-t border-border/30 pt-3">
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Outros Documentos (opcionais)</div>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                <Field label="Título Eleitor" value={form.tituloEleitorNumero} onChange={v => set("tituloEleitorNumero", v)} maxLength={13} />
                                <Field label="Zona" value={form.tituloEleitorZona} onChange={v => set("tituloEleitorZona", v)} maxLength={4} />
                                <Field label="Seção" value={form.tituloEleitorSecao} onChange={v => set("tituloEleitorSecao", v)} maxLength={4} />
                                <Field label="Reservista Nº" value={form.reservistaNumero} onChange={v => set("reservistaNumero", v)} />
                                <Field label="Cat. CNH" value={form.categoriaCnh} onChange={v => set("categoriaCnh", v)} maxLength={3} placeholder="A, B, AB…" />
                                <Field label="Validade CNH" value={form.validadeCnh} onChange={v => set("validadeCnh", v)} type="date" />
                                <Field label="CTPS" value={form.ctps} onChange={v => set("ctps", v)} maxLength={10} />
                                <Field label="CTPS Série" value={form.ctpsSerie} onChange={v => set("ctpsSerie", v)} maxLength={6} />
                                <Select label="CTPS UF" value={form.ctpsUf} options={UF_LIST.map(u => ({ value: u, label: u }))} onChange={v => set("ctpsUf", v)} />
                            </div>
                        </section>
                    </div>
                )}

                {/* Step 5: Encargos / eSocial — flags FGTS/INSS/Sindicato + códigos eSocial obrigatórios TOTVS */}
                {step === 5 && (
                    <div className="space-y-3">
                        <h5 className="font-semibold text-sm flex items-center gap-2"><Coins className="size-4" /> Encargos, Sindicato e eSocial</h5>
                        <div className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-[11px] text-amber-700">
                            Passe o mouse no <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-muted-foreground/15 text-[9px] font-bold">?</span> para ver o valor típico CLT. Cada funcionário pode ter contexto diferente — confirme antes.
                        </div>

                        <section>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">FGTS / INSS</div>
                            <div className="flex flex-wrap gap-x-6 gap-y-3">
                                <FlagSN field="optanteFgts"  label="Optante FGTS *"  value={form.optanteFgts}  onChange={v => set("optanteFgts", v)}  hint="CLT regular: Sim" />
                                <FlagSN field="recolheFgts"  label="Recolhe FGTS *"  value={form.recolheFgts}  onChange={v => set("recolheFgts", v)}  hint="CLT padrão: Sim" />
                                <FlagSN field="recolheInss"  label="Recolhe INSS *"  value={form.recolheInss}  onChange={v => set("recolheInss", v)}  hint="CLT padrão: Sim" />
                            </div>
                        </section>

                        <section>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Sindicato</div>
                            <div className="flex flex-wrap gap-x-6 gap-y-3">
                                <FlagSN field="sindicalizado"       label="Sindicalizado *"             value={form.sindicalizado}       onChange={v => set("sindicalizado", v)}       hint="Comum: Não" />
                                <FlagSN field="descContribSindical" label="Desconta Contrib. Sindical *" value={form.descContribSindical} onChange={v => set("descContribSindical", v)} hint="Pós Reforma 2017: Não" />
                                <FlagSN field="resideExterior"      label="Reside no Exterior *"        value={form.resideExterior}      onChange={v => set("resideExterior", v)}      hint="Quase sempre: Não" />
                            </div>
                        </section>

                        <section>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Cálculo da folha</div>
                            <div className="flex flex-wrap gap-x-6 gap-y-3">
                                <FlagSN field="cargaAutomTurno"  label="Carga Aut. Turno *"   value={form.cargaAutomTurno}  onChange={v => set("cargaAutomTurno", v)}  hint="Mensalista turno fixo: Sim" />
                                <FlagSN field="calcula13"        label="Calcula 13º *"         value={form.calcula13}        onChange={v => set("calcula13", v)}        hint="CLT regular: Sim" />
                                <FlagSN field="recebeFerias"     label="Recebe Férias *"       value={form.recebeFerias}     onChange={v => set("recebeFerias", v)}     hint="CLT regular: Sim" />
                                <FlagSN field="considEmissRAIS"  label="Considera RAIS *"      value={form.considEmissRAIS}  onChange={v => set("considEmissRAIS", v)}  hint="CLT: Sim (obrigatório)" />
                            </div>
                        </section>

                        <section>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Adicionais (marque se aplica ao funcionário)</div>
                            <div className="flex flex-wrap gap-x-6 gap-y-3">
                                <FlagSN field="recebePericul"      label="Periculosidade *"  value={form.recebePericul}      onChange={v => set("recebePericul", v)}      hint="Ambiente periculoso: Sim" />
                                <FlagSN field="recebeInsalub"      label="Insalubridade *"   value={form.recebeInsalub}      onChange={v => set("recebeInsalub", v)}      hint="Ambiente insalubre: Sim" />
                                <FlagSN field="recebeAdiantamento" label="Adiantamento *"    value={form.recebeAdiantamento} onChange={v => set("recebeAdiantamento", v)} hint="Empresa faz adto. quinzenal: Sim" />
                            </div>
                        </section>

                        <section className="border-t border-border/30 pt-3">
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Parâmetros eSocial</div>
                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                <Select field="tipoLogradouroESocial"     label="Tipo Logradouro *"          value={form.tipoLogradouroESocial}     options={TIPO_LOGRADOURO_ESOCIAL} onChange={v => set("tipoLogradouroESocial", v || null)}              hint="Mesmo tipo do endereço (R, AV...)" />
                                <Select field="categoriaTrabalhoESocial" label="Cat. Trabalhador *"          value={form.categoriaTrabalhoESocial} options={CATEGORIA_ESOCIAL}       onChange={v => set("categoriaTrabalhoESocial", Number(v) || null)} hint="Empregado CLT: 101" />
                                <Select field="indAdmissao"              label="Indicativo Admissão *"       value={form.indAdmissao}              options={IND_ADMISSAO}            onChange={v => set("indAdmissao", Number(v) || null)}              hint="Novo funcionário: 1" />
                                <Select field="tipoAdmissaoESocial"      label="Tipo Admissão *"             value={form.tipoAdmissaoESocial}      options={TIPO_ADMISSAO_ESOCIAL}   onChange={v => set("tipoAdmissaoESocial", Number(v) || null)}      hint="Admissão padrão: 1" />
                                <Select field="regimeTrabalhista"        label="Regime Trabalhista *"        value={form.regimeTrabalhista}        options={REGIME_TRABALHISTA}      onChange={v => set("regimeTrabalhista", Number(v) || null)}        hint="CLT: 1" />
                                <Select field="regimePrevidenciario"     label="Regime Previdenciário *"     value={form.regimePrevidenciario}     options={REGIME_PREVIDENCIARIO}   onChange={v => set("regimePrevidenciario", Number(v) || null)}     hint="CLT: 1 (RGPS)" />
                                <Select field="regimeJornada"            label="Regime de Jornada *"         value={form.regimeJornada}            options={REGIME_JORNADA}          onChange={v => set("regimeJornada", Number(v) || null)}            hint="Horário fixo: 1" />
                            </div>
                        </section>
                    </div>
                )}

                {/* Step 6: Documentos — campo individual por tipo */}
                {step === 6 && (
                    <div className="space-y-4">
                        <h5 className="font-semibold text-sm flex items-center gap-2"><FileUp className="size-4" /> Documentos — {form.tipoContratacao === 1 ? "PJ" : "CLT"}</h5>
                        <div className="space-y-3">
                            {getDocsPorTipo(form.tipoContratacao ?? null).map(docTipo => {
                                const hasLados = TIPOS_COM_VERSO.has(docTipo.value);

                                const uploadSlot = (lado: number, sideLabel: string) => {
                                    const enviado = form.documentos?.find(d =>
                                        resolveDocTipo(d.tipo) === docTipo.value &&
                                        (hasLados ? resolveDocLado(d.lado) === lado : true)
                                    );
                                    return (
                                        <div key={`${docTipo.value}-${lado}`} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                                            <div className="flex items-center gap-2 min-w-0">
                                                {enviado ? (
                                                    <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                                                ) : (
                                                    <span className="size-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                                                )}
                                                <div className="min-w-0">
                                                    <div className="text-sm font-medium">{sideLabel}</div>
                                                    {enviado && (
                                                        <div className="text-xs text-muted-foreground truncate">{enviado.nomeArquivo} • {(enviado.tamanhoBytes / 1024).toFixed(0)} KB</div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="shrink-0 flex items-center gap-2">
                                                {enviado ? (
                                                    <>
                                                        {enviado.presignedUrl && (
                                                            <Button variant="outline" size="sm" onClick={() => window.open(enviado.presignedUrl, "_blank")}>
                                                                <Eye className="size-3.5 mr-1" /> Visualizar
                                                            </Button>
                                                        )}
                                                        <Button variant="destructive" size="sm" onClick={() => handleDeleteDoc(enviado.id)}>Remover</Button>
                                                    </>
                                                ) : (
                                                    <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted/50 transition-colors">
                                                        <Upload className="size-3" /> Enviar
                                                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={async (e) => {
                                                            const file = e.target.files?.[0];
                                                            if (!file) return;
                                                            const fd = new FormData();
                                                            fd.append("file", file);
                                                            fd.append("tipo", String(docTipo.value));
                                                            fd.append("lado", String(lado));
                                                            try {
                                                                const res = await apiFetch(`/api/pre-admissao/${id}/documentos`, { method: "POST", body: fd });
                                                                if (!res.ok) throw new Error("Falha no upload");
                                                                toast.success(`${sideLabel} enviado!`);
                                                                await loadData();
                                                            } catch { toast.error(`Falha ao enviar ${sideLabel}`); }
                                                            e.target.value = "";
                                                        }} />
                                                    </label>
                                                )}
                                            </div>
                                        </div>
                                    );
                                };

                                return (
                                    <div key={docTipo.value} className="rounded-lg border border-border/40 p-3">
                                        {hasLados ? (
                                            <div className="space-y-0 divide-y divide-border/40">
                                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pb-2">{docTipo.label}</p>
                                                {uploadSlot(1, `${docTipo.label} — Frente`)}
                                                {uploadSlot(2, `${docTipo.label} — Costas`)}
                                            </div>
                                        ) : (
                                            uploadSlot(0, docTipo.label)
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Step 7: Revisão */}
                {step === 7 && (
                    <div className="space-y-4">
                        <h5 className="font-semibold text-sm flex items-center gap-2"><CheckCircle2 className="size-4" /> Revisão Final</h5>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                            <Info label="Nome" value={form.nome} />
                            <Info label="CPF" value={form.cpf} />
                            <Info label="RG" value={form.rg} />
                            <Info label="Email" value={form.email} />
                            <Info label="Celular" value={form.celular} />
                            <Info label="Nascimento" value={form.dataNascimento} />
                            <Info label="Nacionalidade" value={form.nacionalidade} />
                            <Info label="Endereço" value={[form.logradouro, form.numero].filter(Boolean).join(", ")} />
                            <Info label="Cidade/UF" value={[form.cidade, form.uf].filter(Boolean).join("/")} />
                            <Info label="Banco" value={form.bancoNome} />
                            <Info label="Agência" value={form.agencia} />
                            <Info label="Conta" value={form.conta} />
                            <Info label="Estab." value={form.estabelecimentoCodigo} />
                            <Info label="Data Admissão" value={form.dataAdmissao} />
                            <Info label="Salário" value={form.salario != null ? fmtBrl(form.salario) : null} />
                            <Info label="Tipo Contratação" value={TIPO_CONTRATACAO.find(t => t.value === form.tipoContratacao)?.label} />
                            <Info label="Cargo TOTVS" value={form.codCargoTotvs != null ? String(form.codCargoTotvs) : null} />
                            <Info label="Vínculo" value={VINCULO_EMPREGATICIO.find(v => v.value === form.codVinculoEmpregaticio)?.label} />
                            <Info label="Tipo Func." value={TIPO_FUNCIONARIO_TOTVS.find(v => v.value === form.tipoFuncionario)?.label} />
                            <Info label="Grau Instrução" value={GRAU_INSTRUCAO.find(v => v.value === form.grauInstrucao)?.label} />
                            <Info label="Tipo Estatística" value={TIPO_ESTATISTICA.find(v => v.value === form.tipoEstatistica)?.label} />
                            <Info label="Centro Custo" value={form.centroCusto} />
                            <Info label="Unid. Lotação" value={form.unidadeLotacao} />
                            <Info label="Cód. Turma" value={form.codTurma != null ? String(form.codTurma) : null} />
                            <Info label="Ind. Func. Vinc." value={form.indFuncVinculado != null ? String(form.indFuncVinculado) : null} />
                            <Info label="Tipo Mão-de-Obra" value={form.tipoMaoDeObra} />
                            <Info label="Cód. Sindicato" value={form.codSindicato != null ? String(form.codSindicato) : null} />
                            <Info label="Local Marcação" value={form.codLocalMarcacao != null ? String(form.codLocalMarcacao) : null} />
                            <Info label="Classif. Ponto Eletr." value={form.codClassFuncPontoEletronico != null ? String(form.codClassFuncPontoEletronico) : null} />
                            <Info label="Cód. Localidade" value={form.codLocalidade != null ? String(form.codLocalidade) : null} />
                            <Info label="Documentos" value={`${form.documentos?.length ?? 0} arquivo(s)`} />
                        </div>
                        <div className="rounded-md bg-sky-500/10 p-3 text-sm text-sky-700">
                            Revise os dados antes de finalizar. Após finalizar, a admissão será processada.
                        </div>
                    </div>
                )}
            </div>

            {/* navigation buttons — rodapé do card */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-border/40 bg-muted/10">
                <Button variant="outline" disabled={step === 0} onClick={() => setStep(s => s - 1)}>
                    <ChevronLeft className="size-4" /> Anterior
                </Button>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={save} disabled={saving}>
                        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Salvar Rascunho
                    </Button>
                    {step < STEPS.length - 1 ? (
                        <Button className="bg-blue-600 hover:bg-blue-700" onClick={async () => { await save(); setStep(s => s + 1); }}>
                            Próximo <ChevronRight className="size-4" />
                        </Button>
                    ) : (
                        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={submit} disabled={submitting}>
                            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Finalizar Admissão
                        </Button>
                    )}
                </div>
            </div>
            </div>{/* fim card unificado */}
        </section>
        </ErrorCtx.Provider>
    );
}

/* ── sub-components ── */

// Contexto simples — evita precisar passar fieldErrors em todo call-site.
const ErrorCtx = React.createContext<Set<string>>(new Set());
const useFieldError = (field?: string) => {
    const errs = React.useContext(ErrorCtx);
    return field ? errs.has(field) : false;
};

// Larguras padrão por tipo de dado — evita input de nome do tamanho de UF.
const SIZE_CLASS: Record<string, string> = {
    xs: "max-w-[80px]",     // UF (2 chars), bool, siglas
    sm: "max-w-[140px]",    // CEP, CPF, data, código pequeno
    md: "max-w-[220px]",    // cidade, banco, agência
    lg: "max-w-[380px]",    // nome, logradouro
    full: "w-full",
};

/** Ícone de dica (aparece ao lado do label). Mostra o hint em tooltip no hover. */
function Hint({ text }: { text: string }) {
    return (
        <span
            title={text}
            className="inline-flex items-center justify-center w-3.5 h-3.5 ml-1 rounded-full bg-muted-foreground/15 text-[9px] text-muted-foreground font-bold cursor-help select-none"
        >?</span>
    );
}

function Field({ label, value, onChange, type = "text", placeholder, field, hint, size = "full", maxLength }: {
    label: string; value: unknown; onChange: (v: string) => void;
    type?: string; placeholder?: string; field?: string; hint?: string;
    size?: keyof typeof SIZE_CLASS; maxLength?: number;
}) {
    const hasError = useFieldError(field);
    return (
        <div data-field={field} className={SIZE_CLASS[size]}>
            <label className={`text-[11px] font-medium block mb-0.5 flex items-center ${hasError ? "text-red-600" : "text-muted-foreground"}`}>
                {label}{hint && <Hint text={hint} />}
            </label>
            <Input
                type={type}
                value={(value as string) || ""}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                maxLength={maxLength}
                className={`h-8 text-sm ${hasError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
            />
        </div>
    );
}

function Select({ label, value, options, onChange, field, hint, size = "full" }: {
    label: string; value: unknown; options: { value: string | number; label: string }[];
    onChange: (v: string) => void; field?: string; hint?: string;
    size?: keyof typeof SIZE_CLASS;
}) {
    const hasError = useFieldError(field);
    return (
        <div data-field={field} className={SIZE_CLASS[size]}>
            <label className={`text-[11px] font-medium block mb-0.5 flex items-center ${hasError ? "text-red-600" : "text-muted-foreground"}`}>
                {label}{hint && <Hint text={hint} />}
            </label>
            <select
                className={`w-full h-8 rounded-md border bg-background px-2 text-sm ${hasError ? "border-red-500 focus-visible:ring-red-500" : "border-input"}`}
                value={String(value ?? "")}
                onChange={e => onChange(e.target.value)}
            >
                <option value="">Selecione…</option>
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        </div>
    );
}

/**
 * Toggle binário S/N — par de botões compactos. 10x mais rápido que dropdown
 * pro RH marcar "sim/não" em 13 flags Datasul em sequência.
 */
function FlagSN({ label, value, onChange, field, hint }: {
    label: string; value: string | null | undefined; onChange: (v: string | null) => void;
    field?: string; hint?: string;
}) {
    const hasError = useFieldError(field);
    const buttonBase = "h-8 px-3 text-xs font-bold border transition-colors select-none";
    return (
        <div data-field={field}>
            <label className={`text-[11px] font-medium block mb-0.5 flex items-center ${hasError ? "text-red-600" : "text-muted-foreground"}`}>
                {label}{hint && <Hint text={hint} />}
            </label>
            <div className={`inline-flex rounded-md overflow-hidden ${hasError ? "ring-1 ring-red-500" : ""}`}>
                <button type="button"
                    onClick={() => onChange(value === "S" ? null : "S")}
                    className={`${buttonBase} rounded-l-md ${value === "S" ? "bg-emerald-600 text-white border-emerald-600" : "bg-background border-input hover:bg-muted"}`}
                >Sim</button>
                <button type="button"
                    onClick={() => onChange(value === "N" ? null : "N")}
                    className={`${buttonBase} rounded-r-md border-l-0 ${value === "N" ? "bg-slate-600 text-white border-slate-600" : "bg-background border-input hover:bg-muted"}`}
                >Não</button>
            </div>
        </div>
    );
}

function Info({ label, value }: { label: string; value: unknown }) {
    return (
        <div className="rounded-lg border border-border/30 bg-muted/10 p-2">
            <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
            <div className="text-sm font-medium truncate">{(value as string) || "—"}</div>
        </div>
    );
}
