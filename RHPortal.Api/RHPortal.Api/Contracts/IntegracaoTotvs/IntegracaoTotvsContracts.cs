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
    DateTimeOffset? IntegradaEmUtc
);

public sealed record IntegracaoTotvsPainelResponse(
    IReadOnlyList<IntegracaoTotvsListItem> Items,
    int Total,
    int Pendentes,
    int Sucesso,
    int Falha
);

public sealed record IntegracaoTotvsResultadoRequest(
    [Required] IntegracaoResultado Resultado,
    [MaxLength(2000)] string? Mensagem
);
