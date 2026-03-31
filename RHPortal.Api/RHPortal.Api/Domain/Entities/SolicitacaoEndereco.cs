using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Solicitação de alteração de endereço feita pelo colaborador, aprovada por RH.
/// Na aprovação, atualiza os campos de endereço na entidade Pessoa.
/// </summary>
public sealed class SolicitacaoEndereco : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    // ── Solicitante ──

    /// <summary>Colaborador que solicita a mudança de endereço.</summary>
    public Guid SolicitanteId { get; set; }
    public Funcionario? Solicitante { get; set; }

    // ── Dados do endereço ──

    public string Cep { get; set; } = default!;
    public string Logradouro { get; set; } = default!;
    public string? Numero { get; set; }
    public string? Bairro { get; set; }
    public string? Complemento { get; set; }
    public string Cidade { get; set; } = default!;
    public string Uf { get; set; } = default!;

    // ── Status e Aprovação ──

    public SolicitacaoStatus Status { get; set; } = SolicitacaoStatus.Rascunho;

    public Guid? Aprovador1Id { get; set; }
    public Funcionario? Aprovador1 { get; set; }
    public StatusAprovacao Aprovador1Status { get; set; } = StatusAprovacao.Pendente;
    public DateTimeOffset? Aprovador1DataUtc { get; set; }

    public Guid? Aprovador2Id { get; set; }
    public Funcionario? Aprovador2 { get; set; }
    public StatusAprovacao? Aprovador2Status { get; set; }
    public DateTimeOffset? Aprovador2DataUtc { get; set; }
    public bool Aprovador2Habilitado { get; set; }

    public string? ObservacaoAprovador { get; set; }
    public string? Observacoes { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
    public DateTimeOffset? ApprovedAtUtc { get; set; }
}
