using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>Meta individual ou de equipe, com acompanhamento de progresso.</summary>
public sealed class Meta : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>Funcionário ao qual a meta pertence.</summary>
    public Guid FuncionarioId { get; set; }
    public Funcionario? Funcionario { get; set; }

    /// <summary>Funcionário que criou a meta (gestor ou RH).</summary>
    public Guid CriadaPorId { get; set; }
    public Funcionario? CriadaPor { get; set; }

    public string Titulo { get; set; } = default!;
    public string? Descricao { get; set; }

    /// <summary>Valor-alvo a ser atingido.</summary>
    public decimal ValorMeta { get; set; }

    /// <summary>Progresso atual.</summary>
    public decimal ValorAtual { get; set; }

    /// <summary>Unidade de medida: "%", "R$", "qtd", etc.</summary>
    public string Unidade { get; set; } = "%";

    public DateOnly? Prazo { get; set; }

    public MetaStatus Status { get; set; } = MetaStatus.Ativa;

    public DateTimeOffset CriadoEmUtc { get; set; }
    public DateTimeOffset AtualizadoEmUtc { get; set; }
}
