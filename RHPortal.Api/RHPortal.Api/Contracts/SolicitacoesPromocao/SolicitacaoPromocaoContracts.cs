using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.SolicitacoesPromocao;

public sealed record SolicitacaoPromocaoListQuery(
    string? Q,
    SolicitacaoStatus? Status,
    bool? ApenasMeus,
    int? Page,
    int? PageSize
);

public sealed class SolicitacaoPromocaoCreateRequest
{
    [Required]
    public Guid FuncionarioId { get; set; }

    [Required]
    public DateOnly DataEfetiva { get; set; }

    public Guid? CargoAtualId { get; set; }

    [Required]
    public Guid NovoCargoId { get; set; }

    public Guid? AreaAtualId { get; set; }

    public Guid? NovaAreaId { get; set; }

    public Guid? NovaUnidadeId { get; set; }

    public Guid? EmpresaId { get; set; }
    public Guid? UnitId { get; set; }
    public Guid? CentroCustoId { get; set; }
    public Guid? UnidadeLotacaoId { get; set; }

    [MaxLength(120)]
    public string? NovaLocalidade { get; set; }
    public decimal? NovoSalario { get; set; }
    [MaxLength(60)]
    public string? NovaPericulosidade { get; set; }
    public decimal? NovaRemuneracao { get; set; }
    [MaxLength(200)]
    public string? HorarioProposto { get; set; }

    public MotivoMovimentacaoPessoal? MotivoMovimentacao { get; set; }

    [Required, MaxLength(2000)]
    public string Justificativa { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string? Observacoes { get; set; }
}

public sealed class SolicitacaoPromocaoUpdateRequest
{
    [Required]
    public Guid FuncionarioId { get; set; }

    [Required]
    public DateOnly DataEfetiva { get; set; }

    public Guid? CargoAtualId { get; set; }

    [Required]
    public Guid NovoCargoId { get; set; }

    public Guid? AreaAtualId { get; set; }

    public Guid? NovaAreaId { get; set; }

    public Guid? NovaUnidadeId { get; set; }

    public Guid? EmpresaId { get; set; }
    public Guid? UnitId { get; set; }
    public Guid? CentroCustoId { get; set; }
    public Guid? UnidadeLotacaoId { get; set; }

    [MaxLength(120)]
    public string? NovaLocalidade { get; set; }
    public decimal? NovoSalario { get; set; }
    [MaxLength(60)]
    public string? NovaPericulosidade { get; set; }
    public decimal? NovaRemuneracao { get; set; }
    [MaxLength(200)]
    public string? HorarioProposto { get; set; }

    public MotivoMovimentacaoPessoal? MotivoMovimentacao { get; set; }

    [Required, MaxLength(2000)]
    public string Justificativa { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string? Observacoes { get; set; }
}

public sealed record SolicitacaoPromocaoResponse(
    Guid Id,
    SolicitacaoStatus Status,
    Guid SolicitanteId,
    string? SolicitanteNome,
    Guid FuncionarioId,
    string? FuncionarioNome,
    DateOnly DataEfetiva,
    Guid? CargoAtualId,
    string? CargoAtualNome,
    Guid NovoCargoId,
    string? NovoCargoNome,
    Guid? AreaAtualId,
    string? AreaAtualNome,
    Guid? NovaAreaId,
    string? NovaAreaNome,
    Guid? NovaUnidadeId,
    string? NovaUnidadeNome,
    Guid? EmpresaId,
    string? EmpresaNome,
    Guid? UnitId,
    string? UnitNome,
    Guid? CentroCustoId,
    string? CentroCustoNome,
    Guid? UnidadeLotacaoId,
    string? UnidadeLotacaoNome,
    string? NovaLocalidade,
    decimal? NovoSalario,
    string? NovaPericulosidade,
    decimal? NovaRemuneracao,
    string? HorarioProposto,
    MotivoMovimentacaoPessoal? MotivoMovimentacao,
    string Justificativa,
    string? ObservacaoAprovador,
    string? Observacoes,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    DateTimeOffset? ApprovedAtUtc,
    IntegracaoResultado? IntegracaoResultado,
    string? IntegracaoMensagem,
    DateTimeOffset? IntegradaEmUtc,
    IReadOnlyList<RhPortal.Api.Contracts.Common.EtapaAprovacaoResponse> Etapas
);

public sealed record SolicitacaoPromocaoGridRow(
    Guid Id,
    SolicitacaoStatus Status,
    string? SolicitanteNome,
    string? FuncionarioNome,
    string? NovoCargoNome,
    DateOnly DataEfetiva,
    DateTimeOffset CreatedAtUtc,
    string? EtapaPendenteLabel,
    string? EtapaPendenteCom,
    bool EtapaPendenteIsQueue,
    Guid? EtapaPendenteAprovadorId,
    bool EtapaPendenteCanAssume
);
