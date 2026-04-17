using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Application.PublicApproval;

public interface IMagicLinkService
{
    /// <summary>
    /// Gera token, salva no banco e envia email ao aprovador com links de aprovação/reprovação.
    /// </summary>
    Task CreateAndSendAsync(
        SolicitacaoAprovacaoEtapa etapa,
        TipoFluxoAprovacao tipoFluxo,
        Guid solicitacaoId,
        string tituloSolicitacao,
        string solicitanteNome,
        string? httpScheme,
        string? httpHost,
        CancellationToken ct);

    /// <summary>
    /// Retorna resumo da solicitação para a landing page de aprovação (sem autenticação).
    /// Null se token inválido ou expirado.
    /// </summary>
    Task<MagicLinkSummary?> GetSummaryAsync(string token, CancellationToken ct);

    /// <summary>
    /// Valida o token e executa a ação (Aprovar / Reprovar).
    /// </summary>
    Task<MagicLinkResultado> ProcessarAcaoAsync(
        string token,
        MagicLinkAcao acao,
        string? observacao,
        string? ipAddress,
        string? userAgent,
        CancellationToken ct);
}

public sealed record MagicLinkSummary(
    Guid SolicitacaoId,
    string TipoFluxoLabel,
    string TituloSolicitacao,
    string SolicitanteNome,
    bool Expirado,
    bool JaUtilizado);

public enum MagicLinkResultado
{
    Sucesso,
    TokenInvalido,
    Expirado,
    JaUtilizado,
    EtapaJaProcessada,
    SolicitacaoNaoEncontrada
}
