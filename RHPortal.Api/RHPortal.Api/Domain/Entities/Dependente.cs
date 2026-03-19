using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

public sealed class Dependente : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid FuncionarioId { get; set; }
    public Funcionario? Funcionario { get; set; }

    public string NomeCompleto { get; set; } = default!;
    public Parentesco Parentesco { get; set; }
    public string? Cpf { get; set; }
    public DateOnly DataNascimento { get; set; }
    public bool IsPcd { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
