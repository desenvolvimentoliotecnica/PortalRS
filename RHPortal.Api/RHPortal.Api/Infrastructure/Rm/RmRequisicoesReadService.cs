using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Options;
using RhPortal.Api.Contracts.Rm;

namespace RhPortal.Api.Infrastructure.Rm;

public sealed class RmRequisicoesReadService : IRmRequisicoesReadService
{
    private readonly RmConnectionOptions _opts;

    public RmRequisicoesReadService(IOptions<RmConnectionOptions> opts) => _opts = opts.Value;

    public async Task<RmRequisicaoListResponse> ListAsync(RmRequisicaoListQuery query, CancellationToken ct)
    {
        var page = Math.Max(1, query.Page);
        const int maxPageSize = 50;
        var pageSize = Math.Clamp(query.PageSize < 1 ? 20 : query.PageSize, 1, maxPageSize);
        var offset = (page - 1) * pageSize;

        DateTime? dataDe = query.DataAberturaDe?.ToDateTime(TimeOnly.MinValue);
        DateTime? dataAte = query.DataAberturaAte?.ToDateTime(TimeOnly.MinValue);
        string? tipo = string.IsNullOrWhiteSpace(query.TipoRequisicao) ? null : query.TipoRequisicao.Trim();
        string? searchPattern = BuildLikePattern(query.Search);

        var cs = _opts.GetConnectionString();
        await using var conn = new SqlConnection(cs);
        await conn.OpenAsync(ct);

        int totalCount;
        await using (var cmdCount = new SqlCommand(RmRequisicoesQueries.SqlCount, conn))
        {
            AddFilterParameters(cmdCount, tipo, dataDe, dataAte, searchPattern);
            var scalar = await cmdCount.ExecuteScalarAsync(ct);
            totalCount = scalar is int i ? i : Convert.ToInt32(scalar ?? 0);
        }

        var items = new List<RmRequisicaoRowDto>();
        await using (var cmdPage = new SqlCommand(RmRequisicoesQueries.SqlPage, conn))
        {
            AddFilterParameters(cmdPage, tipo, dataDe, dataAte, searchPattern);
            cmdPage.Parameters.AddWithValue("@Offset", offset);
            cmdPage.Parameters.AddWithValue("@PageSize", pageSize);

            await using var reader = await cmdPage.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
                items.Add(MapRow(reader));
        }

        return new RmRequisicaoListResponse { Items = items, TotalCount = totalCount };
    }

    public async Task<RmRequisicaoCodStatusSnapshot?> TryGetCodStatusByPortalCodigoAsync(string rmRequisicaoCodigo, CancellationToken ct)
    {
        if (RmPortalRequisicaoVinculo.IsStub(rmRequisicaoCodigo))
            return null;
        if (!RmPortalRequisicaoVinculo.TryParse(rmRequisicaoCodigo, out var tipo, out var codCol, out var idReq))
            return null;

        var cs = _opts.GetConnectionString();
        await using var conn = new SqlConnection(cs);
        await conn.OpenAsync(ct);

        await using var cmd = new SqlCommand(RmRequisicoesQueries.SqlCodStatusPorVinculo, conn);
        cmd.Parameters.AddWithValue("@Tipo", tipo);
        cmd.Parameters.AddWithValue("@CodCol", codCol);
        cmd.Parameters.AddWithValue("@IdReq", idReq);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
            return null;

        var codStatus = SafeInt(reader, "CODSTATUS") ?? 0;
        return new RmRequisicaoCodStatusSnapshot(
            codStatus,
            SafeString(reader, "STATUS_DESCRICAO"),
            SafeString(reader, "TIPO_REQUISICAO") ?? tipo,
            SafeInt(reader, "CODCOLREQUISICAO") ?? codCol,
            SafeInt(reader, "IDREQ") ?? idReq);
    }

    private static void AddFilterParameters(
        SqlCommand cmd,
        string? tipo,
        DateTime? dataDe,
        DateTime? dataAte,
        string? searchPattern)
    {
        cmd.Parameters.Add(CreateNullableParam("@Tipo", System.Data.SqlDbType.NVarChar, 80, tipo));
        cmd.Parameters.Add(CreateNullableDateParam("@DataDe", dataDe));
        cmd.Parameters.Add(CreateNullableDateParam("@DataAte", dataAte));
        if (searchPattern is null)
            cmd.Parameters.AddWithValue("@SearchPattern", DBNull.Value);
        else
            cmd.Parameters.AddWithValue("@SearchPattern", searchPattern);
    }

    private static SqlParameter CreateNullableDateParam(string name, DateTime? value)
    {
        return new SqlParameter(name, System.Data.SqlDbType.Date)
        {
            Value = value.HasValue ? value.Value.Date : DBNull.Value
        };
    }

    private static SqlParameter CreateNullableParam(string name, System.Data.SqlDbType dbType, int size, string? value)
    {
        return new SqlParameter(name, dbType, size) { Value = string.IsNullOrEmpty(value) ? DBNull.Value : value };
    }

    /// <summary>Envolve termo para LIKE SQL com escape dos wildcards principais.</summary>
    internal static string? BuildLikePattern(string? term)
    {
        if (string.IsNullOrWhiteSpace(term))
            return null;
        var t = term.Trim();
        var escaped = new System.Text.StringBuilder(t.Length + 8);
        foreach (var ch in t)
        {
            if (ch is '[' or ']' or '%' or '_')
                escaped.Append('[').Append(ch).Append(']');
            else
                escaped.Append(ch);
        }
        return "%" + escaped + "%";
    }

    private static RmRequisicaoRowDto MapRow(SqlDataReader r)
    {
        return new RmRequisicaoRowDto
        {
            TipoRequisicao = SafeString(r, "TIPO_REQUISICAO") ?? "",
            Codcolrequisicao = SafeInt(r, "CODCOLREQUISICAO"),
            Idreq = SafeInt(r, "IDREQ") ?? 0,
            Justificativa = SafeString(r, "JUSTIFICATIVA"),
            Dataabertura = SafeDateTime(r, "DATAABERTURA"),
            Dataprevista = SafeDateTime(r, "DATAPREVISTA"),
            Dataconclusao = SafeDateTime(r, "DATACONCLUSAO"),
            Datacancelamento = SafeDateTime(r, "DATACANCELAMENTO"),
            Codstatus = SafeInt(r, "CODSTATUS"),
            StatusDescricao = SafeString(r, "STATUS_DESCRICAO"),
            StatusPermiteAlterar = SafeBool(r, "STATUS_PERMITE_ALTERAR"),
            Codcolrequisitante = SafeInt(r, "CODCOLREQUISITANTE"),
            Chaparequisitante = SafeString(r, "CHAPAREQUISITANTE"),
            NomeRequisitante = SafeString(r, "NOME_REQUISITANTE"),
            Codatendimento = SafeInt(r, "CODATENDIMENTO"),
            Codlocal = SafeInt(r, "CODLOCAL"),
            AtendimentoAssunto = SafeString(r, "ATENDIMENTO_ASSUNTO"),
            Tiporeqpai = SafeString(r, "TIPOREQPAI"),
            Idreqpai = SafeInt(r, "IDREQPAI"),
            ChapaFuncionario = SafeString(r, "CHAPA_FUNCIONARIO"),
            NomeFuncionarioEnvolvido = SafeString(r, "NOME_FUNCIONARIO_ENVOLVIDO"),
            ChapaSubstituto = SafeString(r, "CHAPA_SUBSTITUTO"),
            NomeFuncionarioSubstituto = SafeString(r, "NOME_FUNCIONARIO_SUBSTITUTO"),
            Numvagas = SafeInt(r, "NUMVAGAS"),
            Codfilial = SafeString(r, "CODFILIAL"),
            Codsecao = SafeString(r, "CODSECAO"),
            Codfuncao = SafeString(r, "CODFUNCAO"),
            NomeFuncao = SafeString(r, "NOME_FUNCAO"),
            DescricaoFuncao = SafeString(r, "DESCRICAO_FUNCAO"),
            Vlrsalario = SafeDecimal(r, "VLRSALARIO"),
            Codccusto = SafeString(r, "CODCCUSTO"),
            Reccreatedby = SafeString(r, "RECCREATEDBY"),
            Reccreatedon = SafeDateTime(r, "RECCREATEDON"),
            Recmodifiedby = SafeString(r, "RECMODIFIEDBY"),
            Recmodifiedon = SafeDateTime(r, "RECMODIFIEDON")
        };
    }

    private static string? SafeString(SqlDataReader r, string column)
    {
        try
        {
            var ord = r.GetOrdinal(column);
            if (r.IsDBNull(ord))
                return null;
            var o = r.GetValue(ord);
            return o.ToString()?.TrimEnd();
        }
        catch { return null; }
    }

    private static int? SafeInt(SqlDataReader r, string column)
    {
        try
        {
            var ord = r.GetOrdinal(column);
            if (r.IsDBNull(ord))
                return null;
            return Convert.ToInt32(r.GetValue(ord), System.Globalization.CultureInfo.InvariantCulture);
        }
        catch { return null; }
    }

    private static decimal? SafeDecimal(SqlDataReader r, string column)
    {
        try
        {
            var ord = r.GetOrdinal(column);
            if (r.IsDBNull(ord))
                return null;
            return Convert.ToDecimal(r.GetValue(ord), System.Globalization.CultureInfo.InvariantCulture);
        }
        catch { return null; }
    }

    private static DateTime? SafeDateTime(SqlDataReader r, string column)
    {
        try
        {
            var ord = r.GetOrdinal(column);
            return r.IsDBNull(ord) ? null : r.GetDateTime(ord);
        }
        catch { return null; }
    }

    private static bool? SafeBool(SqlDataReader r, string column)
    {
        try
        {
            var ord = r.GetOrdinal(column);
            if (r.IsDBNull(ord))
                return null;
            var o = r.GetValue(ord);
            return o switch
            {
                bool b => b,
                byte x => x != 0,
                short x => x != 0,
                int x => x != 0,
                _ => ParseBoolFlexible(o.ToString())
            };
        }
        catch { return null; }
    }

    private static bool ParseBoolFlexible(string? s)
    {
        if (string.IsNullOrWhiteSpace(s))
            return false;
        if (bool.TryParse(s, out var b))
            return b;
        var t = s.Trim();
        return t is "1" or "S" or "s" or "T" or "t" or "Y" or "y";
    }
}
