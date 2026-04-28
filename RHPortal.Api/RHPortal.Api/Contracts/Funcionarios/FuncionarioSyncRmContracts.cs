namespace RhPortal.Api.Contracts.Funcionarios;

/// <summary>
/// Item enviado pelo worker TOTVS RM (<c>PortalFuncionarioSyncService</c>) com
/// os códigos crus do RM. O endpoint resolve os FKs internamente:
///   - CodSecao → CentroCustoId (lookup por Code)
///   - CodFuncao → JobPositionId (via PFUNCAO.CARGO → PCARGO.CODIGO)
///   - CodFilial → UnitId (lookup por Code)
///   - IdHierarquiaDestinoRm → HierarquiaId (lookup por IdHierarquiaRm)
/// </summary>
public sealed class FuncionarioSyncRmItem
{
    /// <summary>PFUNC.CHAPA (ex.: "00000581").</summary>
    public string Chapa { get; set; } = default!;

    /// <summary>Nome do funcionário (vem de PPESSOA via PFUNC.CODPESSOA).</summary>
    public string Nome { get; set; } = default!;

    /// <summary>E-mail real (PPESSOA.EMAIL). Aceita NULL — não cria fake.</summary>
    public string? Email { get; set; }

    /// <summary>CPF (PPESSOA.CPF).</summary>
    public string? Cpf { get; set; }

    /// <summary>Telefone.</summary>
    public string? Telefone { get; set; }

    /// <summary>Data de admissão no PFUNC.</summary>
    public DateOnly? DataAdmissao { get; set; }

    /// <summary>Data de nascimento (de PPESSOA).</summary>
    public DateOnly? DataNascimento { get; set; }

    /// <summary>PFUNC.CODSITUACAO (A, F, P = ativos / outros = inativos).</summary>
    public string? CodSituacao { get; set; }

    /// <summary>PFUNC.CODSECAO (ex.: "01.11.023.002") — resolve para CentroCustoId.</summary>
    public string? CodSecao { get; set; }

    /// <summary>PFUNC.CODFUNCAO (ex.: "904") — informativo, mantido pra rastreabilidade.</summary>
    public string? CodFuncao { get; set; }

    /// <summary>Código do cargo (PCARGO.CODIGO). Worker resolve via PFUNCAO.CARGO offline. Lookup direto para JobPosition.Code no Portal.</summary>
    public string? CodCargo { get; set; }

    /// <summary>PFUNC.CODFILIAL (ex.: 11) — resolve para UnitId via Empresa.Code.</summary>
    public int? CodFilial { get; set; }

    /// <summary>Última VREQTRANSFPROMOCAO.IDHIERARQUIADESTINO aprovada — resolve para HierarquiaId. Null = sem promoção registrada.</summary>
    public int? IdHierarquiaDestinoRm { get; set; }

    /// <summary>PPESSOA.CODIGO (chave pra resolver PessoaId no Portal).</summary>
    public int? CodPessoa { get; set; }

    /// <summary>PFUNC.CODCOLIGADA — código da empresa/coligada (geralmente 1 na Liotécnica).</summary>
    public int? CodColigada { get; set; }

    // ─── Cadastro pessoal completo (LUC-122 — vida do colaborador) ─────────
    // Tudo vem de PPESSOA via JOIN no worker. Endpoint cria/atualiza Pessoa
    // pelo CPF (chave) e vincula PessoaId no Funcionario.

    public string? Apelido { get; set; }
    public string? Sexo { get; set; }
    public string? EstadoCivil { get; set; }
    public string? Naturalidade { get; set; }
    public string? EstadoNatal { get; set; }
    public string? GrauInstrucao { get; set; }

    /// <summary>Endereço completo (tudo de PPESSOA).</summary>
    public string? Cep { get; set; }
    public string? Logradouro { get; set; }
    public string? NumeroEndereco { get; set; }
    public string? Complemento { get; set; }
    public string? Bairro { get; set; }
    public string? Cidade { get; set; }
    public string? Uf { get; set; }

    /// <summary>RG e órgão emissor.</summary>
    public string? Rg { get; set; }
    public string? RgOrgEmissor { get; set; }
    public string? RgUf { get; set; }
    public DateTime? RgDataEmissao { get; set; }

    /// <summary>CTPS.</summary>
    public string? CarteiraTrabalho { get; set; }
    public string? CarteiraTrabalhoSerie { get; set; }
    public string? CarteiraTrabalhoUf { get; set; }
    public DateTime? CarteiraTrabalhoData { get; set; }

    /// <summary>PIS/PASEP/NIS.</summary>
    public string? NumeroPis { get; set; }

    /// <summary>Título de eleitor.</summary>
    public string? TituloEleitor { get; set; }
    public string? TituloEleitorZona { get; set; }
    public string? TituloEleitorSecao { get; set; }

    /// <summary>Reservista (certificado militar).</summary>
    public string? CertificadoReservista { get; set; }
    public string? CategoriaMilitar { get; set; }
}

public sealed class FuncionarioSyncRmBulkRequest
{
    public List<FuncionarioSyncRmItem> Items { get; set; } = new();
}

public sealed record FuncionarioSyncRmBulkResponse(
    int Created,
    int Updated,
    int Skipped,
    int SkippedInactive,
    int Total,
    List<string> Warnings);
