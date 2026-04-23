using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Rodada de seleção dentro de uma Vaga. Uma Vaga pode ter N Projetos (rodadas).
/// Ao criar o Projeto 2, candidatos reprovados do Projeto 1 são automaticamente filtrados.
/// </summary>
public sealed class ProjetoVaga : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid VagaId { get; set; }
    public RHPortal.Api.Domain.Entities.Vaga? Vaga { get; set; }

    /// <summary>Número sequencial da rodada (1, 2, 3...).</summary>
    public int Numero { get; set; }

    /// <summary>Descrição/nome customizado da rodada (ex: "Projeto Jan 2026").</summary>
    public string? Descricao { get; set; }

    public StatusProjeto Status { get; set; } = StatusProjeto.Ativo;

    /// <summary>Data de início desta rodada/publicação (preenchida automaticamente ao abrir a vaga).</summary>
    public DateOnly? DataInicio { get; set; }

    /// <summary>Data de encerramento desta rodada/publicação (preenchida ao fechar/pausar/cancelar a vaga).</summary>
    public DateOnly? DataEncerramento { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
