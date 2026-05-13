using System.ComponentModel.DataAnnotations;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.IntegracaoTotvs;

public sealed record IntegracaoTotvsPainelQuery(
    TipoIntegracao? Tipo,
    IntegracaoResultado? Resultado,
    string? Search,
    int Skip = 0,
    int Take = 50
);

public sealed record IntegracaoTotvsListItem(
    Guid Id,
    short TipoIntegracao,
    string TipoIntegracaoLabel,
    string Nome,
    string? Cpf,
    string Descricao,
    DateTimeOffset? ApprovedAtUtc,
    IntegracaoResultado? IntegracaoResultado,
    string? IntegracaoMensagem,
    DateTimeOffset? IntegradaEmUtc,
    /// <summary>Preenchido para <see cref="TipoIntegracao.SolicitacaoVaga"/> após sync SYN.</summary>
    short? RmCodStatus = null,
    string? RmUltimaStatusDescricaoRm = null,
    string? RmStatusSyncUltimaMensagem = null,
    int TentativasIntegracao = 0,
    DateTimeOffset? UltimaTentativaUtc = null,
    DateTimeOffset? RmCriacaoSolicitadaEmUtc = null,
    short? RmCodColRequisicao = null,
    int? RmIdReq = null,
    string? Status = null
);

public sealed record IntegracaoTotvsPainelResponse(
    IReadOnlyList<IntegracaoTotvsListItem> Items,
    int Total,
    int Pendentes,
    int Sucesso,
    int Falha
);

public sealed record IntegracaoReconciliacaoItemResponse(
    Guid Id,
    short TipoIntegracao,
    string TipoIntegracaoLabel,
    string Nome,
    IntegracaoResultado? IntegracaoResultado,
    string? IntegracaoMensagem,
    int TentativasIntegracao,
    DateTimeOffset? UltimaTentativaUtc,
    DateTimeOffset? IntegradaEmUtc,
    DateTimeOffset? ApprovedAtUtc
);

public sealed record IntegracaoReconciliacaoResponse(
    IReadOnlyList<IntegracaoReconciliacaoItemResponse> Pendentes,
    IReadOnlyList<IntegracaoReconciliacaoItemResponse> EmFalha,
    IReadOnlyList<IntegracaoReconciliacaoItemResponse> FalhaDefinitiva,
    int Total
);

public sealed record IntegracaoTotvsResultadoRequest(
    [Required] IntegracaoResultado Resultado,
    [MaxLength(2000)] string? Mensagem,
    /// <summary>
    /// Código do funcionário retornado pelo TOTVS (cdn_funcionario).
    /// Apenas para TipoIntegracao.Admissao — usado para materializar o Funcionario.
    /// </summary>
    [MaxLength(30)] string? CdnFuncionario = null
);

public sealed record EfetivarManualResponse(
    DateTimeOffset EfetivadoManualmenteEmUtc,
    string? ResponsavelNome
);
