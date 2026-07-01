"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Briefcase, FileUp, CheckCircle2, Upload,
    ChevronLeft, ChevronRight, Save, Send, AlertTriangle, Loader2, Eye,
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
import { validateRhContratual, firstRhErrorStep } from "@/features/admissao/rhWizardValidation";
import AdmissaoContratualStep from "@/features/admissao/AdmissaoContratualStep";

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
    centroCustoId: string | null;
    jobPositionId: string | null;
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
    // Campos adicionados para cobertura completa do payload TOTVS
    nomeSocial: string | null;
    municipioNascimentoIbge: number | null;
    pontoReferencia: string | null;
    emailAlternativo: string | null;
    dddTelefone: number | null;
    dddTelContato: number | null;
    funcDoador: string | null;
    manequim: number | null;
    sapato: number | null;
    codNivel: number | null;
    codPlanoLotacao: number | null;
    numCartaoPonto: number | null;
    salarioSimulado: number | null;
    funcQualificado: string | null;
    contribSindicDia: string | null;
    dataOpcaoFgts: string | null;
    dataTerminoContrato: number | null;
    naturezaAtividade: number | null;
    matriculaESocial: string | null;
    codFpas: number | null;
    codRegistroExterior: string | null;
    cnhNumero: string | null;
    cnhUf: string | null;
    cnhOrgaoEmissor: string | null;
    cnhDataExpedicao: string | null;
    cnhPrimeiraHabilitacao: string | null;
    ctpsSerieESocial: string | null;
    validacaoSalarioJustificativa: string | null;
    status: number;
    documentos: { id: string; tipo: number | string; lado: number | string; nomeArquivo: string; contentType: string; tamanhoBytes: number; status: number; createdAtUtc: string; presignedUrl?: string }[];
    [key: string]: unknown;
}

const STEPS = [
    { key: "contratual", label: "Dados Contratuais", icon: Briefcase },
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
const GRUPO_SANGUINEO_OPTIONS = [
    { value: 1, label: "A" },
    { value: 2, label: "B" },
    { value: 3, label: "AB" },
    { value: 4, label: "O" },
];
const FATOR_RH_OPTIONS = [
    { value: 1, label: "Positivo (+)" },
    { value: 2, label: "Negativo (−)" },
];
const NATUREZA_ATIVIDADE_OPTIONS = [
    { value: 1, label: "Urbana" },
    { value: 2, label: "Rural" },
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

// Mapas string enum → number para campos que chegam como string do JsonStringEnumConverter
const SEXO_STR_MAP: Record<string, number> = { NaoInformado: 0, Masculino: 1, Feminino: 2, Outro: 3 };
const ESTADO_CIVIL_STR_MAP: Record<string, number> = { NaoInformado: 0, Solteiro: 1, Casado: 2, Divorciado: 3, Viuvo: 4, UniaoEstavel: 5, Separado: 6 };
const TIPO_CONTRATACAO_STR_MAP: Record<string, number> = { CLT: 0, PJ: 1, Estagio: 2, Temporario: 3, Aprendiz: 4, Terceirizado: 5 };
const TIPO_CONTA_STR_MAP: Record<string, number> = { ContaCorrente: 0, ContaPoupanca: 1, ContaSalario: 2 };

/**
 * Normaliza a resposta da API para o estado do formulário.
 * A API usa JsonStringEnumConverter — enums chegam como strings ("Masculino", "CLT", etc.)
 * mas os Selects do wizard esperam valores numéricos (1, 0, etc.).
 * Esta função converte os campos problemáticos de string → number.
 */
function normalizeApiForm(data: Record<string, unknown>): Partial<PreAdmissao> {
    const resolveEnum = (val: unknown, map: Record<string, number>): number | null => {
        if (val === null || val === undefined) return null;
        if (typeof val === "number") return val;
        if (typeof val === "string") return map[val] ?? null;
        return null;
    };
    const resolveInt = (val: unknown): number | null => {
        if (val === null || val === undefined) return null;
        const n = Number(val);
        return Number.isFinite(n) ? n : null;
    };
    return {
        ...(data as Partial<PreAdmissao>),
        // Enums não-nullable que chegam como string (ex: "Masculino")
        sexo: resolveEnum(data.sexo, SEXO_STR_MAP) ?? 0,
        estadoCivil: resolveEnum(data.estadoCivil, ESTADO_CIVIL_STR_MAP) ?? 0,
        // Enums nullable
        tipoContratacao: resolveEnum(data.tipoContratacao, TIPO_CONTRATACAO_STR_MAP),
        tipoConta: resolveEnum(data.tipoConta, TIPO_CONTA_STR_MAP),
        // Campos int? — garantir que nunca cheguem como string
        cutis: resolveInt(data.cutis),
        cabelo: resolveInt(data.cabelo),
        olhos: resolveInt(data.olhos),
        origemFuncionario: resolveInt(data.origemFuncionario),
        grauInstrucao: resolveInt(data.grauInstrucao),
        codCargoTotvs: resolveInt(data.codCargoTotvs),
        codVinculoEmpregaticio: resolveInt(data.codVinculoEmpregaticio),
        tipoFuncionario: resolveInt(data.tipoFuncionario),
        categoriaSalarial: resolveInt(data.categoriaSalarial),
        codTurno: resolveInt(data.codTurno),
        tipoEstatistica: resolveInt(data.tipoEstatistica),
        formaPagamento: resolveInt(data.formaPagamento),
        tipoAdmissaoFgts: resolveInt(data.tipoAdmissaoFgts),
        docMilitarTipo: resolveInt(data.docMilitarTipo),
        docMilitarRegiao: resolveInt(data.docMilitarRegiao),
        docMilitarCircunscricao: resolveInt(data.docMilitarCircunscricao),
        tipoVistoEstrangeiro: resolveInt(data.tipoVistoEstrangeiro),
        ocorrenciaCAGED: resolveInt(data.ocorrenciaCAGED),
        municipioEnderecoIbge: resolveInt(data.municipioEnderecoIbge),
        municipioNascimentoIbge: resolveInt(data.municipioNascimentoIbge),
        codTurma: resolveInt(data.codTurma),
        indFuncVinculado: resolveInt(data.indFuncVinculado),
        codSindicato: resolveInt(data.codSindicato),
        codLocalMarcacao: resolveInt(data.codLocalMarcacao),
        codClassFuncPontoEletronico: resolveInt(data.codClassFuncPontoEletronico),
        codLocalidade: resolveInt(data.codLocalidade),
    };
}

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
                setStep(0);
            }
        }
    }, [id]);

    async function loadData() {
        setLoadingData(true);
        setLoadError(null);
        try {
            const res = await apiFetch(`/api/pre-admissao/${id}`);
            if (res.ok) setForm(normalizeApiForm(await res.json() as Record<string, unknown>));
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
            if (res.ok) { setForm(normalizeApiForm(await res.json() as Record<string, unknown>)); toast.success("Salvo!"); }
            else {
                const msg = await res.text().catch(() => "");
                toast.error(`Erro ao salvar (${res.status})${msg ? `: ${msg.slice(0, 120)}` : ""}`);
            }
        } catch { toast.error("Erro de conexão"); }
        finally { setSaving(false); }
    }

    // Navega ao step do primeiro erro, destaca inputs em vermelho e faz scroll até o campo.
    function applyErrors(errors: { field: string; label: string; stepIndex: number; message: string }[]) {
        if (errors.length === 0) return;
        const firstStep = firstRhErrorStep(errors) ?? 0;
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

    async function finishWizard() {
        if (!id) return;
        const errors = validateRhContratual(form);
        if (errors.length > 0) {
            applyErrors(errors);
            return;
        }
        setFieldErrors(new Set());
        try {
            setSubmitting(true);
            await save();
            toast.success("Dados salvos. Continue no acompanhamento para enviar o link ao candidato.");
            router.push(`/app/admissao/tracking?id=${encodeURIComponent(id)}`);
        } catch {
            toast.error("Erro de conexão");
        } finally {
            setSubmitting(false);
        }
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

                {/* Step 0: Dados Contratuais */}
                {step === 0 && (
                    <AdmissaoContratualStep form={form} set={set} fieldErrors={fieldErrors} />
                )}

                {/* Step 1: Documentos — campo individual por tipo */}
                {step === 1 && (
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

                {/* Step 2: Revisão */}
                {step === 2 && (
                    <div className="space-y-4">
                        <h5 className="font-semibold text-sm flex items-center gap-2"><CheckCircle2 className="size-4" /> Revisão</h5>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                            <Info label="Nome" value={form.nome} />
                            <Info label="CPF" value={form.cpf} />
                            <Info label="E-mail" value={form.email} />
                            <Info label="Celular" value={form.celular ?? form.telefone} />
                            <Info label="Data Admissão" value={form.dataAdmissao} />
                            <Info label="Salário" value={form.salario != null ? fmtBrl(form.salario) : null} />
                            <Info label="Tipo Contratação" value={TIPO_CONTRATACAO.find(t => t.value === form.tipoContratacao)?.label} />
                            <Info label="Centro Custo" value={form.centroCusto} />
                            <Info label="Unid. Lotação" value={form.unidadeLotacao} />
                            <Info label="Documentos" value={`${form.documentos?.length ?? 0} arquivo(s)`} />
                        </div>
                        <div className="rounded-md bg-sky-500/10 p-3 text-sm text-sky-700">
                            Revise os dados contratuais. Na próxima tela você poderá gerar e enviar o link ao candidato.
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
                        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={finishWizard} disabled={submitting}>
                            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Salvar e continuar
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
