using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Histórico de movimentações de um funcionário no TOTVS RM (LUC-122).
///
/// Consolida 3 fontes do RM:
///   - <c>VREQTRANSFPROMOCAO</c> (promoção / transferência / mudança de função)
///   - <c>VREQAUMENTOQUADRO</c> (quando funcionário é o requisitante de vaga nova)
///   - <c>VREQDESLIGAMENTO</c> (quando o funcionário foi desligado)
///
/// Permite ver na tela Perfil 360 a "linha do tempo" do colaborador:
/// Admissão → Promoção 1 → Transferência → Promoção 2 → ... → Desligamento.
/// </summary>
public sealed class FuncionarioMovimentacao : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>FK para Funcionario (resolvido via CHAPA).</summary>
    public Guid? FuncionarioId { get; set; }
    public Funcionario? Funcionario { get; set; }

    /// <summary>CHAPA do funcionário (chave de lookup).</summary>
    [MaxLength(20)]
    public string ChapaRm { get; set; } = default!;

    /// <summary>IDREQ no RM — chave única dentro do tenant.</summary>
    [MaxLength(40)]
    public string IdReqRm { get; set; } = default!;

    /// <summary>
    /// Tipo da movimentação:
    /// 1=Promoção, 2=Transferência, 3=MudançaFuncao, 4=AumentoSalarial,
    /// 5=Desligamento, 6=AumentoQuadro (requisitante), 7=Substituição.
    /// </summary>
    public short TipoMovimentacao { get; set; }

    /// <summary>Descrição amigável do tipo.</summary>
    [MaxLength(60)]
    public string? TipoDescricao { get; set; }

    public DateTime DataAbertura { get; set; }
    public DateTime? DataConclusao { get; set; }
    public DateTime? DataCancelamento { get; set; }
    public int CodStatus { get; set; }
    [MaxLength(60)]
    public string? StatusDescricao { get; set; }

    /// <summary>De → Para (origem).</summary>
    [MaxLength(20)]
    public string? CodFuncaoOrigem { get; set; }
    [MaxLength(160)]
    public string? FuncaoOrigemNome { get; set; }
    [MaxLength(60)]
    public string? CodSecaoOrigem { get; set; }
    [MaxLength(60)]
    public string? CodSecaoDestino { get; set; }
    [MaxLength(20)]
    public string? CodFuncaoDestino { get; set; }
    [MaxLength(160)]
    public string? FuncaoDestinoNome { get; set; }

    /// <summary>FK pra hierarquia origem/destino.</summary>
    public Guid? HierarquiaOrigemId { get; set; }
    public Guid? HierarquiaDestinoId { get; set; }
    public int? IdHierarquiaOrigemRm { get; set; }
    public int? IdHierarquiaDestinoRm { get; set; }

    /// <summary>Salário de origem (snapshot na data da movimentação).</summary>
    public decimal? SalarioOrigem { get; set; }
    public decimal? SalarioDestino { get; set; }

    /// <summary>Justificativa do gestor / RH.</summary>
    public string? Justificativa { get; set; }

    /// <summary>Quando aplicável (Desligamento), flag se gerou substituição.</summary>
    public bool? GerouSubstituicao { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}
