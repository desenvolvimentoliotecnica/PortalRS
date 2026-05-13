namespace RhPortal.Api.Infrastructure.Rm;

/// <summary>
/// Chave gravada em <see cref="RhPortal.Api.Domain.Entities.SolicitacaoVaga.RmRequisicaoCodigo"/> para correlacionar com o RM.
/// Formato produção: <c>TIPO_REQUISICAO|CODCOLREQUISICAO|IDREQ</c> (ex.: <c>AUMENTO_QUADRO|1|8421</c>).
/// Código <c>STUB-*</c> (dev) não consulta SQL Server.
/// </summary>
public static class RmPortalRequisicaoVinculo
{
    public const char Separator = '|';
    public const string TipoAumentoQuadro = "AUMENTO_QUADRO";

    public static bool IsStub(string? rmRequisicaoCodigo) =>
        !string.IsNullOrWhiteSpace(rmRequisicaoCodigo)
        && rmRequisicaoCodigo.TrimStart().StartsWith("STUB-", StringComparison.OrdinalIgnoreCase);

    public static string Build(string tipo, int codCol, int idReq) =>
        System.FormattableString.Invariant($"{tipo}{Separator}{codCol}{Separator}{idReq}");

    /// <summary>True se houver três partes TIPO|CODCOL|IDREQ.</summary>
    public static bool TryParse(string? rmRequisicaoCodigo, out string tipo, out int codCol, out int idReq)
    {
        tipo = "";
        codCol = 0;
        idReq = 0;
        if (string.IsNullOrWhiteSpace(rmRequisicaoCodigo))
            return false;
        if (IsStub(rmRequisicaoCodigo))
            return false;
        var parts = rmRequisicaoCodigo.Trim().Split(Separator, 3, StringSplitOptions.TrimEntries);
        if (parts.Length != 3)
            return false;
        tipo = parts[0];
        if (tipo.Length == 0)
            return false;
        return int.TryParse(parts[1], System.Globalization.NumberStyles.Integer, System.Globalization.CultureInfo.InvariantCulture, out codCol)
               && int.TryParse(parts[2], System.Globalization.NumberStyles.Integer, System.Globalization.CultureInfo.InvariantCulture, out idReq);
    }
}
