namespace RhPortal.Api.Contracts.Common;

/// <summary>
/// Response para uma etapa de aprovação em execução.
/// Retornada na lista Etapas[] dos responses de solicitação.
/// </summary>
public sealed record EtapaAprovacaoResponse(
    int    Ordem,
    string Label,
    Guid?  AprovadorId,
    string? AprovadorNome,
    Guid?  RoleFilaId,
    string? RoleFilaNome,
    string  Status,      // "Pendente", "Aprovado", "Reprovado"
    DateTimeOffset? DataUtc,
    string? Observacao
);

/// <summary>DTO para GET/PUT de configuração de etapa.</summary>
public sealed record EtapaConfigAprovacaoDto(
    Guid    Id,
    int     Ordem,
    string  Label,
    string  TipoAprovador,   // enum name as string
    Guid?   FuncionarioFixoId,
    string? FuncionarioFixoNome,
    Guid?   RoleFilaId,
    string? RoleFilaNome,
    bool    Ativo,
    short   AcaoEtapa,       // AcaoEtapa enum value (0=Nenhuma, 1=CriarVagaRascunho)
    short   MomentoAcao      // MomentoAcao enum value (0=AoChegar, 1=AoAprovar)
);

public sealed class EtapaConfigAprovacaoSaveRequest
{
    public int Ordem { get; set; }
    public string Label { get; set; } = "";
    public short TipoAprovador { get; set; }   // TipoAprovador enum value
    public Guid? FuncionarioFixoId { get; set; }
    public Guid? RoleFilaId { get; set; }
    public short AcaoEtapa { get; set; }       // AcaoEtapa enum value
    public short MomentoAcao { get; set; }     // MomentoAcao enum value
}

/// <summary>Parâmetros globais de um tipo de fluxo de aprovação.</summary>
public sealed record FluxoAprovacaoConfigDto(
    /// <summary>0 = Solicitante, 1 = SolicitacaoInformada</summary>
    short ReferenciaUnidade
);

public sealed class FluxoAprovacaoConfigSaveRequest
{
    /// <summary>0 = Solicitante, 1 = SolicitacaoInformada</summary>
    public short ReferenciaUnidade { get; set; }
}
