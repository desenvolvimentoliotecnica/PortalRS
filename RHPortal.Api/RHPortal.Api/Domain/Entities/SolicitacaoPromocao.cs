using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Solicitação de promoção de funcionário, feita pelo gestor e aprovada por RH/Admin.
/// </summary>
public sealed class SolicitacaoPromocao : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    // ── Solicitante ──

    /// <summary>Gestor que criou a solicitação.</summary>
    public Guid SolicitanteId { get; set; }
    public Funcionario? Solicitante { get; set; }

    // ── Dados da promoção ──

    /// <summary>Funcionário a ser promovido.</summary>
    public Guid FuncionarioId { get; set; }
    public Funcionario? Funcionario { get; set; }

    /// <summary>Data efetiva da promoção.</summary>
    public DateOnly DataEfetiva { get; set; }

    /// <summary>Cargo atual (auto-preenchido ao selecionar funcionário).</summary>
    public Guid? CargoAtualId { get; set; }
    public JobPosition? CargoAtual { get; set; }

    /// <summary>Novo cargo proposto.</summary>
    public Guid NovoCargoId { get; set; }
    public JobPosition? NovoCargo { get; set; }

    /// <summary>Centro de custo atual (auto-preenchido ao selecionar funcionário).</summary>
    public Guid? CentroCustoAtualId { get; set; }
    public CentroCusto? CentroCustoAtual { get; set; }

    /// <summary>Novo centro de custo (se houver mudança de unidade organizacional).</summary>
    public Guid? NovoCentroCustoId { get; set; }
    public CentroCusto? NovoCentroCusto { get; set; }

    /// <summary>Nova unidade (se houver transferência de base).</summary>
    public Guid? NovaUnidadeId { get; set; }
    public Unit? NovaUnidade { get; set; }

    /// <summary>Empresa da movimentação (A.RH.005).</summary>
    public Guid? EmpresaId { get; set; }
    public Empresa? Empresa { get; set; }

    /// <summary>Estabelecimento/Local da movimentação (A.RH.005). Mesmo padrão de UnitId em SolicitacaoVaga.</summary>
    public Guid? UnitId { get; set; }
    public Unit? Unit { get; set; }

    /// <summary>Centro de custo da movimentação (A.RH.005).</summary>
    public Guid? CentroCustoId { get; set; }
    public CentroCusto? CentroCusto { get; set; }

    /// <summary>Unidade de lotação da movimentação (A.RH.005).</summary>
    public Guid? UnidadeLotacaoId { get; set; }
    public UnidadeLotacao? UnidadeLotacao { get; set; }

    /// <summary>Motivo da movimentação conforme A.RH.005.</summary>
    public MotivoMovimentacaoPessoal? MotivoMovimentacao { get; set; }

    /// <summary>Nova localidade/cidade do funcionário.</summary>
    public string? NovaLocalidade { get; set; }

    /// <summary>Novo salário base (R$).</summary>
    public decimal? NovoSalario { get; set; }

    /// <summary>Nova periculosidade (ex: "30%", "Sim", "Não").</summary>
    public string? NovaPericulosidade { get; set; }

    /// <summary>Nova remuneração total (R$).</summary>
    public decimal? NovaRemuneracao { get; set; }

    /// <summary>Horário de trabalho proposto (A.RH.005 — Impacto na Folha).</summary>
    public string? HorarioProposto { get; set; }

    /// <summary>Justificativa da promoção.</summary>
    public string Justificativa { get; set; } = default!;

    // ── Status e Aprovação ──

    public SolicitacaoStatus Status { get; set; } = SolicitacaoStatus.Rascunho;

    public string? ObservacaoAprovador { get; set; }
    public string? Observacoes { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
    public DateTimeOffset? ApprovedAtUtc { get; set; }

    // ── Integração TOTVS ──

    public IntegracaoResultado? IntegracaoResultado { get; set; }

    [StringLength(2000)]
    public string? IntegracaoMensagem { get; set; }

    public DateTimeOffset? IntegradaEmUtc { get; set; }
}
