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
        // FP1440 — Aba Cadastral (Pessoa Física)
        // ══════════════════════════════════════════════════════════════════════
        Req(e, p.NomeAbreviado,    "NomeAbreviado",   "Nome Abreviado",    "FP1440 — Cadastral");
        Req(e, p.Nome,             "Nome",            "Nome Relat. Legais","FP1440 — Cadastral");
        Req(e, p.PaisNacionalidade,"PaisNacionalidade","País",             "FP1440 — Cadastral");
        Req(e, p.DataNascimento,   "DataNascimento",  "Data Nascimento",   "FP1440 — Cadastral");
        Req(e, p.PaisNascimento,   "PaisNascimento",  "País Nascimento",   "FP1440 — Cadastral");
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
        ReqInt(e, p.MunicipioEnderecoIbge, "MunicipioEnderecoIbge", "Município (cód. IBGE)", "FP1440A — eSocial");

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
