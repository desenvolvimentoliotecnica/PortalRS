using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Espelho de uma <c>VREQDESLIGAMENTO</c> do TOTVS RM — solicitação de rescisão de funcionário.
///
/// Inclui o flag <c>GerouSubstituicao</c> (= <c>VREQDESLIGAMENTO.CRIASUBSTITUICAO</c>) que indica
/// se o RM gerou automaticamente uma <c>VREQSUBSTITUICAO</c> (que vira uma vaga aberta no Portal).
/// Quando o flag é true, a vaga gerada referencia este desligamento via <c>Vaga.OrigemDesligamentoId</c>.
///
/// O Portal exibe pipeline de desligamentos em <c>/gestao/desligamentos</c> (permission <c>folha.desligamentos.view</c>).
/// </summary>
public sealed class Desligamento : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    /// <summary>VREQDESLIGAMENTO.IDREQ — chave única no RM da Liotécnica.</summary>
    [MaxLength(40)]
    public string IdReqRm { get; set; } = default!;

    /// <summary>VREQDESLIGAMENTO.CHAPA — matrícula do funcionário a desligar.</summary>
    [MaxLength(20)]
    public string ChapaRm { get; set; } = default!;

    /// <summary>FK para Funcionario (resolvido via CHAPA = Funcionario.MatriculaRm). Null = funcionário não encontrado no Portal ainda.</summary>
    public Guid? FuncionarioId { get; set; }
    public Funcionario? Funcionario { get; set; }

    /// <summary>VREQDESLIGAMENTO.CODMOTRESCISAO — motivo da demissão (ex.: "05" = Pedido de demissão).</summary>
    [MaxLength(10)]
    public string? CodMotivoRescisao { get; set; }

    /// <summary>Descrição resolvida do motivo (ex.: "Pedido de demissao").</summary>
    [MaxLength(120)]
    public string? MotivoRescisaoDescricao { get; set; }

    /// <summary>VREQDESLIGAMENTO.CODTIPORESCISAO — tipo da demissão. String porque admite números ("1","2","3","4","9") e letras ("B","N","T") em legados.</summary>
    [MaxLength(5)]
    public string? CodTipoRescisao { get; set; }

    /// <summary>Descrição resolvida do tipo de demissão.</summary>
    [MaxLength(120)]
    public string? TipoRescisaoDescricao { get; set; }

    /// <summary>VREQDESLIGAMENTO.CRIASUBSTITUICAO — flag "Gerar substituição". Quando true, deve haver uma vaga linkada.</summary>
    public bool GerouSubstituicao { get; set; }

    /// <summary>VREQDESLIGAMENTO.DATAABERTURA — quando o pedido foi aberto.</summary>
    public DateTime DataAbertura { get; set; }

    /// <summary>VREQDESLIGAMENTO.DATAPREVISTA — data prevista para o efeito (data do print: 06/01/2025).</summary>
    public DateTime? DataPrevista { get; set; }

    /// <summary>VREQDESLIGAMENTO.DATACONCLUSAO — quando virou efetivo (data do print: 10/01/2025).</summary>
    public DateTime? DataConclusao { get; set; }

    /// <summary>VREQDESLIGAMENTO.DATACANCELAMENTO — quando o pedido foi cancelado.</summary>
    public DateTime? DataCancelamento { get; set; }

    /// <summary>VREQDESLIGAMENTO.CODSTATUS — status da requisição (1=Aberta, 2=Em análise, 3=Aprovada, 4=Concluída, 6=Cancelada, 7=...).</summary>
    public int CodStatus { get; set; }

    /// <summary>Justificativa preenchida pelo gestor (texto longo).</summary>
    public string? Justificativa { get; set; }

    /// <summary>VREQDESLIGAMENTO.NUMDIASAVISO — dias de aviso prévio.</summary>
    public int? NumDiasAviso { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}
