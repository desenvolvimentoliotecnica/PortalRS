using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.Funcionarios;

/// <summary>Request para criar funcionário (inclui UserId opcional para vincular usuário existente).</summary>
public sealed class FuncionarioCreateRequest
{
    /// <summary>Construtor sem parâmetros para deserialização por System.Text.Json.</summary>
    public FuncionarioCreateRequest()
    {
        Name = string.Empty;
        Email = string.Empty;
    }

    [Required, MaxLength(160)]
    public string Name { get; set; } = string.Empty;

    [Required, MaxLength(180), EmailAddress]
    public string Email { get; set; } = string.Empty;

    [MaxLength(40)]
    public string? Phone { get; set; }

    public FuncionarioStatus Status { get; set; }

    public int Headcount { get; set; }

    public Guid? UnitId { get; set; }

    public Guid? AreaId { get; set; }

    public Guid? JobPositionId { get; set; }

    /// <summary>Função do funcionário (RequisitoCategoria / PFUNCAO no RM).</summary>
    public Guid? RequisitoCategoriaId { get; set; }

    [MaxLength(1000)]
    public string? Notes { get; set; }

    public Guid? UserId { get; set; }
}

/// <summary>Item retornado por GET users-without-funcionario: todos os usuários do tenant com indicação se já têm funcionário.</summary>
public sealed record UserWithoutFuncionarioItemResponse(Guid Id, string FullName, string Email, bool HasFuncionario);

public sealed record FuncionarioUpdateRequest(
    [Required, MaxLength(160)] string Name,
    [Required, MaxLength(180), EmailAddress] string Email,
    [MaxLength(40)] string? Phone,
    FuncionarioStatus Status,
    int Headcount,
    Guid? UnitId,
    Guid? AreaId,
    Guid? JobPositionId,
    Guid? RequisitoCategoriaId,
    [MaxLength(1000)] string? Notes
);

public sealed record FuncionarioResponse(
    Guid Id,
    string Name,
    string Email,
    string? Phone,
    FuncionarioStatus Status,
    int Headcount,
    Guid? UnitId,
    string? UnitName,
    Guid? AreaId,
    string? AreaName,
    Guid? JobPositionId,
    string? JobPositionName,
    Guid? RequisitoCategoriaId,
    string? RequisitoCategoriaName,
    Guid? UserId,
    string? Notes,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc
);
