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
    bool    Ativo
);

public sealed class EtapaConfigAprovacaoSaveRequest
{
    public int Ordem { get; set; }
    public string Label { get; set; } = "";
    public short TipoAprovador { get; set; }   // TipoAprovador enum value
    public Guid? FuncionarioFixoId { get; set; }
    public Guid? RoleFilaId { get; set; }
}
