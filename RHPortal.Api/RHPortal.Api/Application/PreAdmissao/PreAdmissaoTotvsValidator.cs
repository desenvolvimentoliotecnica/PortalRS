using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Application.PreAdmissao;

/// <summary>
/// Valida se uma pré-admissão possui todos os campos necessários para ser
/// integrada ao TOTVS HCM (fp1440 Pessoa Física + fp1500 Funcionário).
///
/// Regras baseadas no mapeamento Datasul — CONSIGAZ (FP1440 / FP1500),
/// atualizado em 15/04/2026 — 125 campos, 42 obrigatórios, 11+ condicionais.
///
/// Valores de referência TOTVS:
///   OrigemFuncionario: 1=Brasileiro  2=Naturalizado  3=Estrangeiro
///   TipoCertidaoCivil: 1=Nascimento  2=Casamento     3=Índio   4=Óbito
///   CodVinculoEmpregaticio: 20=CLT Prazo Determinado
/// </summary>
public static class PreAdmissaoTotvsValidator
{
    // ── Constantes TOTVS ──────────────────────────────────────────────────────

    private const int OrigemEstrangeiro  = 3;
    private const int OrigemNaturalizado = 2;
    private const int CertidaoObito      = 4;
    private const int VinculoPrazoDeterminado = 20;

    // ─────────────────────────────────────────────────────────────────────────

    public static List<TotvsValidationIssue> Validate(Domain.Entities.PreAdmissao p)
    {
        var e = new List<TotvsValidationIssue>();

        // ══════════════════════════════════════════════════════════════════════
        // Identificação da empresa / estabelecimento (TOTVS Datasul rejeita sem esses)
        // ══════════════════════════════════════════════════════════════════════
        Req(e, p.CodEmpresa,              "CodEmpresa",             "Código da Empresa",          "Identificação");
        Req(e, p.EstabelecimentoCodigo,   "EstabelecimentoCodigo",  "Código do Estabelecimento",  "Identificação");

        // ══════════════════════════════════════════════════════════════════════
        // FP1440 — Aba Cadastral (Pessoa Física)
        // ══════════════════════════════════════════════════════════════════════
        Req(e, p.NomeAbreviado,    "NomeAbreviado",   "Nome Abreviado",    "FP1440 — Cadastral");
        Req(e, p.Nome,             "Nome",            "Nome Relat. Legais","FP1440 — Cadastral");
        ReqPaisIso3(e, p.PaisNacionalidade, "PaisNacionalidade", "País (Nacionalidade)", "FP1440 — Cadastral");
        Req(e, p.DataNascimento,   "DataNascimento",  "Data Nascimento",   "FP1440 — Cadastral");
        ReqPaisIso3(e, p.PaisNascimento, "PaisNascimento", "País Nascimento", "FP1440 — Cadastral");
        Req(e, p.NaturalUf,        "NaturalUf",       "UF Nascimento",     "FP1440 — Cadastral");
        Req(e, p.NaturalCidade,    "NaturalCidade",   "Naturalidade",      "FP1440 — Cadastral");
        ReqInt(e, p.GrauInstrucao, "GrauInstrucao",   "Grau Instrução",    "FP1440 — Cadastral");
        ReqEnum(e, (int)p.EstadoCivil, (int)EstadoCivil.NaoInformado,
                   "EstadoCivil", "Estado Civil",     "FP1440 — Cadastral");
        ReqEnum(e, (int)p.Sexo, (int)Sexo.NaoInformado,
                   "Sexo",       "Sexo",              "FP1440 — Cadastral");

        // ══════════════════════════════════════════════════════════════════════
        // FP1440 — Aba Endereço
        // ══════════════════════════════════════════════════════════════════════
        Req(e, p.Logradouro, "Logradouro", "Endereço",  "FP1440 — Endereço");
        Req(e, p.Bairro,     "Bairro",     "Bairro",    "FP1440 — Endereço");
        Req(e, p.Cidade,     "Cidade",     "Cidade",    "FP1440 — Endereço");
        Req(e, p.Uf,         "Uf",         "UF",        "FP1440 — Endereço");
        Req(e, p.Cep,        "Cep",        "CEP",       "FP1440 — Endereço");

        // ══════════════════════════════════════════════════════════════════════
        // FP1440 — Aba Documentos
        // ══════════════════════════════════════════════════════════════════════
        Req(e, p.Cpf,            "Cpf",             "CPF",   "FP1440 — Documentos");
        ReqInt(e, p.OrigemFuncionario, "OrigemFuncionario", "Origem (Brasileiro/Naturalizado/Estrangeiro)",
               "FP1440 — Documentos");

        // Conjunto: Carteira de Identidade (RG + Órgão + UF — todos ou nenhum)
        Set(e, "Carteira de Identidade", "FP1440 — Documentos",
            (p.Rg,               "Rg",              "Carteira Identidade"),
            (p.RgOrgaoExpedidor, "RgOrgaoExpedidor","Órgão Emissor RG"),
            (p.RgUfExpedidor,    "RgUfExpedidor",   "UF Emissão RG"));

        // RIC — Registro Identidade Civil (novo documento exigido pelo TOTVS/Datasul)
        ReqMinLen(e, p.RegIdentidCivilNumero, 3, "RegIdentidCivilNumero", "Nº Registro Identidade Civil (RIC)", "FP1440 — Documentos");
        Req(e, p.RegIdentidCivilOrgEmiss,  "RegIdentidCivilOrgEmiss",  "Órgão Emissor RIC",                  "FP1440 — Documentos");
        Req(e, p.RegIdentidCivilUf,        "RegIdentidCivilUf",        "UF Emissão RIC",                     "FP1440 — Documentos");
        ReqMinLen(e, p.RegIdentidCivilCidade, 3, "RegIdentidCivilCidade", "Cidade Emissão RIC",              "FP1440 — Documentos");

        // Condicional: Estrangeiro
        if (p.OrigemFuncionario == OrigemEstrangeiro)
        {
            Cond(e, p.TipoVistoEstrangeiro,  "TipoVistoEstrangeiro", "Tipo Visto Estrangeiro",   "FP1440 — Documentos", "Origem = Estrangeiro");
            Cond(e, p.Passaporte,            "Passaporte",           "Passaporte",               "FP1440 — Documentos", "Origem = Estrangeiro");
            CondInt(e, p.OrgaoEmisPassaporte,"OrgaoEmisPassaporte",  "Órgão Emis. Passaporte",   "FP1440 — Documentos", "Origem = Estrangeiro");
            Cond(e, p.PaisEmisPassaporte,    "PaisEmisPassaporte",   "País Emis. Passaporte",    "FP1440 — Documentos", "Origem = Estrangeiro");
            Cond(e, p.ValidadeVisto,         "ValidadeVisto",        "Validade Passaporte",      "FP1440 — Documentos", "Origem = Estrangeiro");
            Cond(e, p.RnmRne,               "RnmRne",               "Identidade Estrangeiro",   "FP1440 — Documentos", "Origem = Estrangeiro");
            Cond(e, p.ValidadeIdentEstrangeiro,"ValidadeIdentEstrangeiro","Val. Ident. Estrangeiro","FP1440 — Documentos","Origem = Estrangeiro");
            CondInt(e, p.AnoChegada,         "AnoChegada",           "Ano Chegada",              "FP1440 — Documentos", "Origem = Estrangeiro");
        }

        // Condicional: Naturalizado
        if (p.OrigemFuncionario == OrigemNaturalizado)
        {
            Cond(e, p.PortariaNaturalizacao, "PortariaNaturalizacao","Portaria Naturalização",  "FP1440 — Documentos", "Origem = Naturalizado");
            Cond(e, p.Naturalizacao,         "Naturalizacao",        "Naturalização",           "FP1440 — Documentos", "Origem = Naturalizado");
        }

        // ══════════════════════════════════════════════════════════════════════
        // FP1440 — Aba Tipo Físico
        // ══════════════════════════════════════════════════════════════════════
        ReqInt(e, p.Cutis,  "Cutis",  "Raça/Cor", "FP1440 — Tipo Físico");
        ReqInt(e, p.Cabelo, "Cabelo", "Cabelo",   "FP1440 — Tipo Físico");
        ReqInt(e, p.Olhos,  "Olhos",  "Olhos",    "FP1440 — Tipo Físico");

        // ══════════════════════════════════════════════════════════════════════
        // FP1440 — Aba Cert. Civil
        // ══════════════════════════════════════════════════════════════════════
        // Data Óbito: condicional — só se Tipo Certidão = Óbito
        if (p.TipoCertidaoCivil == CertidaoObito)
            Cond(e, p.DataObitoCivil, "DataObitoCivil", "Data Óbito", "FP1440 — Cert. Civil", "Tipo Certidão = Óbito");

        // ══════════════════════════════════════════════════════════════════════
        // FP1440A — Complemento eSocial
        // ══════════════════════════════════════════════════════════════════════
        // País Nacionalidade já validado em Cadastral (PaisNacionalidade)
        // Município de endereço (código IBGE)
        ReqInt(e, p.MunicipioEnderecoIbge,    "MunicipioEnderecoIbge",    "Município Endereço (cód. IBGE)",  "FP1440A — eSocial");
        Req(e, p.TipoLogradouroESocial,       "TipoLogradouroESocial",    "Tipo Logradouro eSocial (R/AV/etc)","FP1440A — eSocial");

        // Condicional: Reside no Exterior
        if (p.ResideExterior == "S")
        {
            Cond(e, p.CodEnderecoPostalExterior, "CodEnderecoPostalExterior",
                "Cód. Endereçamento Postal", "FP1440A — eSocial", "Reside Exterior = Sim");
            Cond(e, p.CidadeExterior, "CidadeExterior",
                "Cidade Exterior", "FP1440A — eSocial", "Reside Exterior = Sim");
        }

        // ══════════════════════════════════════════════════════════════════════
        // FP1500 — Aba Cadastral (Funcionário)
        // ══════════════════════════════════════════════════════════════════════
        ReqInt(e, p.CategoriaSalarial,       "CategoriaSalarial",      "Categoria Salarial",   "FP1500 — Cadastral");
        Req(e, p.DataAdmissao,               "DataAdmissao",           "Data Admissão",        "FP1500 — Cadastral");
        ReqInt(e, p.TipoFuncionario,         "TipoFuncionario",        "Tipo Funcionário",     "FP1500 — Cadastral");
        ReqInt(e, p.CodVinculoEmpregaticio,  "CodVinculoEmpregaticio", "Vínculo",              "FP1500 — Cadastral");
        Req(e, p.EmitCartPonto,              "EmitCartPonto",          "Emite Cartão Ponto",   "FP1500 — Cadastral");
        ReqInt(e, p.TipoEstatistica,         "TipoEstatistica",        "Tipo Estatística",     "FP1500 — Cadastral");
        ReqInt(e, p.FormaPagamento,          "FormaPagamento",         "Forma de Pagamento",   "FP1500 — Cadastral");
        ReqInt(e, p.TipoAdmissaoFgts,        "TipoAdmissaoFgts",       "Tipo Admissão FGTS",   "FP1500 — Cadastral");
        ReqPaisIso3(e, p.PaisLocalidade,     "PaisLocalidade",         "País Localidade",      "FP1500 — Cadastral");

        // ══════════════════════════════════════════════════════════════════════
        // Documento Militar / Visto / CAGED — Datasul rejeita estes ints com < 1
        // ══════════════════════════════════════════════════════════════════════
        // Todos devem ser >= 1 no payload enviado ao Datasul, mesmo quando o campo
        // não se aplica (ex: mulher, brasileiro). O seeder aplica default 1. Se
        // alguém zerar explicitamente via update direto, o validator barra.
        ReqInt(e, p.DocMilitarTipo,          "DocMilitarTipo",         "Tipo Doc. Militar",    "FP1440 — Documentos");
        ReqInt(e, p.DocMilitarRegiao,        "DocMilitarRegiao",       "Região Militar",       "FP1440 — Documentos");
        ReqInt(e, p.DocMilitarCircunscricao, "DocMilitarCircunscricao","Circunscrição Militar","FP1440 — Documentos");
        ReqInt(e, p.TipoVistoEstrangeiro,    "TipoVistoEstrangeiro",   "Tipo Visto Estrangeiro","FP1440 — Documentos");
        ReqInt(e, p.OcorrenciaCAGED,         "OcorrenciaCAGED",        "Ocorrência CAGED",     "FP1440A — eSocial");

        // ══════════════════════════════════════════════════════════════════════
        // Encargos FGTS/INSS/Sindicato — flags S/N obrigatórias (antes eram default do seeder)
        // ══════════════════════════════════════════════════════════════════════
        // RH preenche cada uma explicitamente pelo wizard. Datasul rejeita vazio em qualquer desses.
        ReqSN(e, p.OptanteFgts,         "OptanteFgts",        "Optante FGTS",             "FP1500 — Encargos");
        ReqSN(e, p.RecolheFgts,         "RecolheFgts",        "Recolhe FGTS",             "FP1500 — Encargos");
        ReqSN(e, p.RecolheInss,         "RecolheInss",        "Recolhe INSS",             "FP1500 — Encargos");
        ReqSN(e, p.Sindicalizado,       "Sindicalizado",      "Sindicalizado",            "FP1500 — Sindicato");
        ReqSN(e, p.DescContribSindical, "DescContribSindical","Desc. Contrib. Sindical",  "FP1500 — Sindicato");
        ReqSN(e, p.ResideExterior,      "ResideExterior",     "Reside no Exterior",       "FP1440A — eSocial");
        ReqSN(e, p.CargaAutomTurno,     "CargaAutomTurno",    "Carga Automática Turno",   "FP1500 — Folha");
        ReqSN(e, p.Calcula13,           "Calcula13",          "Calcula 13º",              "FP1500 — Folha");
        ReqSN(e, p.RecebeFerias,        "RecebeFerias",       "Recebe Férias",            "FP1500 — Folha");
        ReqSN(e, p.ConsidEmissRAIS,     "ConsidEmissRAIS",    "Considera Emissão RAIS",   "FP1500 — Folha");
        ReqSN(e, p.RecebePericul,       "RecebePericul",      "Recebe Periculosidade",    "FP1500 — Adicionais");
        ReqSN(e, p.RecebeInsalub,       "RecebeInsalub",      "Recebe Insalubridade",     "FP1500 — Adicionais");
        ReqSN(e, p.RecebeAdiantamento,  "RecebeAdiantamento", "Recebe Adiantamento",      "FP1500 — Adicionais");

        // ══════════════════════════════════════════════════════════════════════
        // eSocial — códigos TOTVS obrigatórios (categoria, regimes, etc.)
        // ══════════════════════════════════════════════════════════════════════
        ReqInt(e, p.CategoriaTrabalhoESocial, "CategoriaTrabalhoESocial", "Cat. Trabalhador eSocial", "FP1440A — eSocial");
        ReqInt(e, p.IndAdmissao,              "IndAdmissao",              "Indicativo Admissão",       "FP1440A — eSocial");
        ReqInt(e, p.TipoAdmissaoESocial,      "TipoAdmissaoESocial",      "Tipo Admissão eSocial",    "FP1440A — eSocial");
        ReqInt(e, p.RegimeTrabalhista,        "RegimeTrabalhista",        "Regime Trabalhista",        "FP1440A — eSocial");
        ReqInt(e, p.RegimePrevidenciario,     "RegimePrevidenciario",     "Regime Previdenciário",     "FP1440A — eSocial");
        ReqInt(e, p.RegimeJornada,            "RegimeJornada",            "Regime de Jornada",         "FP1440A — eSocial");

        // Condicional: Prazo Determinado
        if (p.CodVinculoEmpregaticio == VinculoPrazoDeterminado)
            CondInt(e, p.DataTerminoContrato, "DataTerminoContrato",
                "Término do Contrato", "FP1500 — Cadastral", "Vínculo = CLT Prazo Determinado");

        return e;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /// <summary>Campo de texto/objeto obrigatório.</summary>
    private static void Req(List<TotvsValidationIssue> e, object? v,
        string campo, string label, string secao)
    {
        if (IsBlank(v))
            e.Add(new(campo, label, secao, "Obrigatório", $"'{label}' é obrigatório."));
    }

    /// <summary>Campo int? obrigatório (null ou 0 = inválido).</summary>
    private static void ReqInt(List<TotvsValidationIssue> e, int? v,
        string campo, string label, string secao)
    {
        if (v is null || v == 0)
            e.Add(new(campo, label, secao, "Obrigatório", $"'{label}' é obrigatório."));
    }

    /// <summary>
    /// Flag S/N obrigatória (aceita apenas "S" ou "N"). Datasul rejeita vazio em qualquer
    /// campo booleano textual.
    /// </summary>
    private static void ReqSN(List<TotvsValidationIssue> e, string? v,
        string campo, string label, string secao)
    {
        if (string.IsNullOrWhiteSpace(v))
            e.Add(new(campo, label, secao, "Obrigatório", $"'{label}' é obrigatório (use S ou N)."));
        else if (v.Trim() != "S" && v.Trim() != "N")
            e.Add(new(campo, label, secao, "Formato", $"'{label}' deve ser 'S' ou 'N' (recebido: '{v}')."));
    }

    /// <summary>Texto com comprimento mínimo (descarta placeholders tipo "1", "N/A").</summary>
    private static void ReqMinLen(List<TotvsValidationIssue> e, string? v, int minLen,
        string campo, string label, string secao)
    {
        if (string.IsNullOrWhiteSpace(v))
            e.Add(new(campo, label, secao, "Obrigatório", $"'{label}' é obrigatório."));
        else if (v.Trim().Length < minLen)
            e.Add(new(campo, label, secao, "Formato", $"'{label}' deve ter pelo menos {minLen} caracteres (recebido: '{v}')."));
    }

    /// <summary>
    /// País no formato ISO 3166-1 alpha-3 (3 letras maiúsculas).
    /// TOTVS Datasul rejeita nomes por extenso como "Brasil" — aceita só "BRA".
    /// Seeder converte automaticamente no backend, mas valida aqui pra garantir que
    /// não passou "Brasil" por outro caminho (ex: seed antigo, integração externa).
    /// </summary>
    private static void ReqPaisIso3(List<TotvsValidationIssue> e, string? v,
        string campo, string label, string secao)
    {
        if (string.IsNullOrWhiteSpace(v))
        {
            e.Add(new(campo, label, secao, "Obrigatório", $"'{label}' é obrigatório."));
            return;
        }
        var t = v.Trim();
        if (t.Length != 3 || !t.All(char.IsLetter) || t != t.ToUpperInvariant())
            e.Add(new(campo, label, secao, "Formato",
                $"'{label}' deve ser código ISO de 3 letras maiúsculas (ex: BRA). Recebido: '{v}'."));
    }

    /// <summary>Enum com sentinela "não informado" — recusa o valor default.</summary>
    private static void ReqEnum(List<TotvsValidationIssue> e, int v, int naoInformadoValue,
        string campo, string label, string secao)
    {
        if (v == naoInformadoValue)
            e.Add(new(campo, label, secao, "Obrigatório", $"'{label}' é obrigatório."));
    }

    /// <summary>Campo de texto condicional.</summary>
    private static void Cond(List<TotvsValidationIssue> e, object? v,
        string campo, string label, string secao, string condicao)
    {
        if (IsBlank(v))
            e.Add(new(campo, label, secao, "Condicional",
                $"'{label}' é obrigatório quando {condicao}."));
    }

    /// <summary>Campo int? condicional.</summary>
    private static void CondInt(List<TotvsValidationIssue> e, int? v,
        string campo, string label, string secao, string condicao)
    {
        if (v is null || v == 0)
            e.Add(new(campo, label, secao, "Condicional",
                $"'{label}' é obrigatório quando {condicao}."));
    }

    /// <summary>
    /// Regra de Conjunto: se QUALQUER campo do grupo estiver preenchido,
    /// TODOS os outros também devem estar.
    /// </summary>
    private static void Set(List<TotvsValidationIssue> e, string nomeConjunto, string secao,
        params (object? valor, string campo, string label)[] campos)
    {
        bool algumPreenchido = campos.Any(c => !IsBlank(c.valor));
        if (!algumPreenchido) return; // grupo todo vazio — OK

        foreach (var (valor, campo, label) in campos)
        {
            if (IsBlank(valor))
                e.Add(new(campo, label, secao, "Conjunto",
                    $"'{label}' é obrigatório porque '{nomeConjunto}' foi parcialmente informado."));
        }
    }

    private static bool IsBlank(object? v) => v switch
    {
        null              => true,
        string s          => string.IsNullOrWhiteSpace(s),
        DateOnly d        => d == default,
        _                 => false
    };
}
