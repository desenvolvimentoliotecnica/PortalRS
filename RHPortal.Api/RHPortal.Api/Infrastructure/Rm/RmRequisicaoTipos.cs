namespace RhPortal.Api.Infrastructure.Rm;

/// <summary>
/// Tipos de requisição RM expostos/importados pelo Portal.
/// </summary>
public static class RmRequisicaoTipos
{
    public const string AumentoQuadro = "AUMENTO_QUADRO";
    public const string Substituicao = "SUBSTITUICAO";
    public const string Desligamento = "DESLIGAMENTO";

    /// <summary>Consulta admin RM e leitura SQL unificada.</summary>
    public static readonly string[] VisiveisConsulta =
    [
        AumentoQuadro,
        Substituicao,
        Desligamento,
    ];

    /// <summary>Tipos que geram <see cref="RhPortal.Api.Domain.Entities.SolicitacaoVaga"/> + vaga rascunho.</summary>
    public static readonly string[] ImportaveisSolicitacaoVaga =
    [
        AumentoQuadro,
        Substituicao,
    ];

    /// <summary>Tipos que geram <see cref="RhPortal.Api.Domain.Entities.SolicitacaoDesligamento"/> na aba Desligamento.</summary>
    public static readonly string[] ImportaveisSolicitacaoDesligamento =
    [
        Desligamento,
    ];

    public static bool IsVisivelConsulta(string? tipo) =>
        !string.IsNullOrWhiteSpace(tipo)
        && VisiveisConsulta.Contains(Normalize(tipo), StringComparer.OrdinalIgnoreCase);

    public static bool IsImportavelComoSolicitacaoVaga(string? tipo) =>
        !string.IsNullOrWhiteSpace(tipo)
        && ImportaveisSolicitacaoVaga.Contains(Normalize(tipo), StringComparer.OrdinalIgnoreCase);

    public static bool IsImportavelComoSolicitacaoDesligamento(string? tipo) =>
        !string.IsNullOrWhiteSpace(tipo)
        && ImportaveisSolicitacaoDesligamento.Contains(Normalize(tipo), StringComparer.OrdinalIgnoreCase);

    public static string? TryParseTipoFromVinculo(string? rmRequisicaoCodigo)
    {
        if (string.IsNullOrWhiteSpace(rmRequisicaoCodigo)
            || RmPortalRequisicaoVinculo.IsStub(rmRequisicaoCodigo))
        {
            return null;
        }

        return RmPortalRequisicaoVinculo.TryParse(rmRequisicaoCodigo, out var tipo, out _, out _)
            ? tipo
            : null;
    }

    public static string FormatCodigoExibicao(string? rmRequisicaoCodigo, int? rmIdReq)
    {
        if (!string.IsNullOrWhiteSpace(rmRequisicaoCodigo)
            && RmPortalRequisicaoVinculo.TryParse(rmRequisicaoCodigo, out var tipo, out _, out var idReq))
        {
            return $"{FormatLabel(tipo)} · {idReq}";
        }

        if (rmIdReq.HasValue)
            return rmIdReq.Value.ToString();

        return "—";
    }

    public static string FormatLabel(string? tipo) => Normalize(tipo) switch
    {
        AumentoQuadro => "Aumento de Quadro",
        Substituicao => "Substituição",
        Desligamento => "Desligamento",
        _ => string.IsNullOrWhiteSpace(tipo) ? "—" : tipo.Replace('_', ' '),
    };

    private static string Normalize(string? tipo) => tipo?.Trim().ToUpperInvariant() ?? "";
}
