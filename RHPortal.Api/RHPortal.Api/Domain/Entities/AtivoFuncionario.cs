namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Ativo corporativo entregue a um funcionário (notebook, crachá, celular, etc.).
/// Usado durante o off-boarding para controlar devoluções.
/// </summary>
public sealed class AtivoFuncionario : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid FuncionarioId { get; set; }
    public Funcionario? Funcionario { get; set; }

    public TipoAtivoFuncionario Tipo { get; set; }

    public StatusAtivoFuncionario Status { get; set; } = StatusAtivoFuncionario.EmUso;

    /// <summary>Descrição livre (ex: "Notebook Dell Latitude 5520").</summary>
    public string? Descricao { get; set; }

    /// <summary>Número de série / patrimônio.</summary>
    public string? NumeroSerie { get; set; }

    public DateOnly? DataEntrega { get; set; }
    public DateOnly? DataDevolucao { get; set; }

    public string? ObservacoesDevolucao { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}

public enum TipoAtivoFuncionario : short
{
    Notebook = 1,
    Celular = 2,
    Cracha = 3,
    CartaoAcesso = 4,
    Veiculo = 5,
    Outro = 99
}

public enum StatusAtivoFuncionario : short
{
    EmUso = 0,
    EmDevolucao = 1,
    Devolvido = 2
}
