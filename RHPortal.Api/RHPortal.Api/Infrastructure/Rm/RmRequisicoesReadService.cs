using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;
using RhPortal.Api.Application.RmConfiguracao;
using RhPortal.Api.Application.TenantConfiguracao;
using RhPortal.Api.Contracts.Rm;

namespace RhPortal.Api.Infrastructure.Rm;

public sealed class RmRequisicoesReadService : IRmRequisicoesReadService
{
    private readonly ITenantRmConfiguracaoService _rmConfiguracaoService;
    private readonly IHttpClientFactory _httpClientFactory;

    public RmRequisicoesReadService(
        ITenantRmConfiguracaoService rmConfiguracaoService,
        IHttpClientFactory httpClientFactory)
    {
        _rmConfiguracaoService = rmConfiguracaoService;
        _httpClientFactory = httpClientFactory;
    }

    public async Task<RmRequisicaoListResponse> ListAsync(RmRequisicaoListQuery query, CancellationToken ct)
    {
        var tenantConfig = await BuildRmRequisicaoConfigAsync(ct);
        if (!string.IsNullOrWhiteSpace(tenantConfig.GetEndpointUrl))
            return await ListFromRestAsync(query, tenantConfig, ct);

        var page = Math.Max(1, query.Page);
        const int maxPageSize = 100;
        var pageSize = Math.Clamp(query.PageSize < 1 ? 20 : query.PageSize, 1, maxPageSize);
        var offset = (page - 1) * pageSize;

        DateTime? dataDe = query.DataAberturaDe?.ToDateTime(TimeOnly.MinValue);
        DateTime? dataAte = query.DataAberturaAte?.ToDateTime(TimeOnly.MinValue);
        string? tipo = string.IsNullOrWhiteSpace(query.TipoRequisicao) ? null : query.TipoRequisicao.Trim();
        string? searchPattern = BuildLikePattern(query.Search);
        string? codStatusCsv = BuildCodStatusCsv(query.CodStatusIn);

        var cs = (await _rmConfiguracaoService.GetConnectionOptionsAsync(ct)).GetConnectionString();
        await using var conn = new SqlConnection(cs);
        await conn.OpenAsync(ct);

        int totalCount;
        await using (var cmdCount = new SqlCommand(RmRequisicoesQueries.SqlCount, conn))
        {
            AddFilterParameters(cmdCount, tipo, dataDe, dataAte, searchPattern, codStatusCsv);
            var scalar = await cmdCount.ExecuteScalarAsync(ct);
            totalCount = scalar is int i ? i : Convert.ToInt32(scalar ?? 0);
        }

        var items = new List<RmRequisicaoRowDto>();
        await using (var cmdPage = new SqlCommand(RmRequisicoesQueries.SqlPage(query.SortBy, query.SortDir), conn))
        {
            AddFilterParameters(cmdPage, tipo, dataDe, dataAte, searchPattern, codStatusCsv);
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

        var tenantConfig = await BuildRmRequisicaoConfigAsync(ct);
        if (!string.IsNullOrWhiteSpace(tenantConfig.GetEndpointUrl))
            return await TryGetCodStatusFromRestAsync(tenantConfig, tipo, codCol, idReq, ct);

        var cs = (await _rmConfiguracaoService.GetConnectionOptionsAsync(ct)).GetConnectionString();
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

    private async Task<ConfiguracaoRmRequisicaoDto> BuildRmRequisicaoConfigAsync(CancellationToken ct)
    {
        var publicConfig = await _rmConfiguracaoService.GetAsync(ct);
        var createOptions = await _rmConfiguracaoService.GetCreateOptionsAsync(ct);

        return new ConfiguracaoRmRequisicaoDto
        {
            EndpointUrl = publicConfig.CreateEndpointUrl,
            GetEndpointUrl = publicConfig.GetEndpointUrl,
            ParecerEndpointUrl = publicConfig.ParecerEndpointUrl,
            Username = createOptions.Username,
            Password = createOptions.Password,
        };
    }

    private async Task<RmRequisicaoListResponse> ListFromRestAsync(
        RmRequisicaoListQuery query,
        ConfiguracaoRmRequisicaoDto config,
        CancellationToken ct)
    {
        var page = Math.Max(1, query.Page);
        const int maxPageSize = 100;
        var pageSize = Math.Clamp(query.PageSize < 1 ? 20 : query.PageSize, 1, maxPageSize);
        var offset = (page - 1) * pageSize;

        var items = await FetchRestRowsAsync(config, codCol: null, idReq: null, ct);
        var filtered = ApplyRestSort(ApplyRestFilters(items, query), query).ToList();

        return new RmRequisicaoListResponse
        {
            Items = filtered.Skip(offset).Take(pageSize).ToList(),
            TotalCount = filtered.Count
        };
    }

    private async Task<RmRequisicaoCodStatusSnapshot?> TryGetCodStatusFromRestAsync(
        ConfiguracaoRmRequisicaoDto config,
        string tipo,
        int codCol,
        int idReq,
        CancellationToken ct)
    {
        var items = await FetchRestRowsAsync(config, codCol, idReq, ct);
        var row = items.FirstOrDefault(i =>
            i.Codcolrequisicao == codCol &&
            i.Idreq == idReq);

        if (row is null)
            return null;

        return new RmRequisicaoCodStatusSnapshot(
            row.Codstatus ?? 0,
            row.StatusDescricao,
            string.IsNullOrWhiteSpace(row.TipoRequisicao) ? tipo : row.TipoRequisicao,
            row.Codcolrequisicao ?? codCol,
            row.Idreq);
    }

    private async Task<IReadOnlyList<RmRequisicaoRowDto>> FetchRestRowsAsync(
        ConfiguracaoRmRequisicaoDto config,
        int? codCol,
        int? idReq,
        CancellationToken ct)
    {
        var endpoint = BuildConsultaUri(config.GetEndpointUrl!, codCol, idReq);
        using var request = new HttpRequestMessage(HttpMethod.Get, endpoint);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        ApplyBasicAuthentication(request, config);

        var client = _httpClientFactory.CreateClient();
        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeoutCts.CancelAfter(TimeSpan.FromSeconds(60));

        using var response = await client.SendAsync(request, timeoutCts.Token);
        var body = await response.Content.ReadAsStringAsync(timeoutCts.Token);
        if (!response.IsSuccessStatusCode)
        {
            var suffix = string.IsNullOrWhiteSpace(body) ? string.Empty : $" Resposta: {body.Trim()}";
            throw new InvalidOperationException($"Falha ao consultar requisições RM via endpoint GET ({(int)response.StatusCode}).{suffix}");
        }

        try
        {
            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("data", out var data))
                root = data;

            if (root.ValueKind != JsonValueKind.Array)
                throw new InvalidOperationException("Endpoint GET RM retornou JSON fora do formato esperado (array de requisições).");

            return root.EnumerateArray()
                .Where(e => e.ValueKind == JsonValueKind.Object)
                .Select(MapRestRow)
                .ToList();
        }
        catch (JsonException ex)
        {
            throw new InvalidOperationException($"Resposta do endpoint GET RM inválida: {ex.Message}", ex);
        }
    }

    private static IEnumerable<RmRequisicaoRowDto> ApplyRestFilters(
        IEnumerable<RmRequisicaoRowDto> items,
        RmRequisicaoListQuery query)
    {
        var tipo = string.IsNullOrWhiteSpace(query.TipoRequisicao) ? null : query.TipoRequisicao.Trim();
        var search = string.IsNullOrWhiteSpace(query.Search) ? null : query.Search.Trim();

        foreach (var item in items)
        {
            if (!string.IsNullOrWhiteSpace(tipo)
                && !string.Equals(item.TipoRequisicao, tipo, StringComparison.OrdinalIgnoreCase))
                continue;

            if (query.DataAberturaDe.HasValue && (!item.Dataabertura.HasValue || DateOnly.FromDateTime(item.Dataabertura.Value) < query.DataAberturaDe.Value))
                continue;

            if (query.DataAberturaAte.HasValue && (!item.Dataabertura.HasValue || DateOnly.FromDateTime(item.Dataabertura.Value) > query.DataAberturaAte.Value))
                continue;

            if (query.CodStatusIn is { Length: > 0 }
                && (!item.Codstatus.HasValue || !query.CodStatusIn.Contains(item.Codstatus.Value)))
                continue;

            if (!string.IsNullOrWhiteSpace(search)
                && !ContainsIgnoreCase(item.Idreq.ToString(System.Globalization.CultureInfo.InvariantCulture), search)
                && !ContainsIgnoreCase(item.Justificativa, search)
                && !ContainsIgnoreCase(item.Chaparequisitante, search)
                && !ContainsIgnoreCase(item.Reccreatedby, search))
                continue;

            yield return item;
        }
    }

    private static IEnumerable<RmRequisicaoRowDto> ApplyRestSort(
        IEnumerable<RmRequisicaoRowDto> items,
        RmRequisicaoListQuery query)
    {
        var desc = !string.Equals(query.SortDir, "asc", StringComparison.OrdinalIgnoreCase);
        var key = query.SortBy?.Trim().ToLowerInvariant();

        IOrderedEnumerable<RmRequisicaoRowDto> ordered = key switch
        {
            "tipo" => desc
                ? items.OrderByDescending(i => i.TipoRequisicao)
                : items.OrderBy(i => i.TipoRequisicao),
            "id" => desc
                ? items.OrderByDescending(i => i.Idreq)
                : items.OrderBy(i => i.Idreq),
            "status" => desc
                ? items.OrderByDescending(i => i.Codstatus ?? int.MinValue)
                : items.OrderBy(i => i.Codstatus ?? int.MaxValue),
            "requisitante" => desc
                ? items.OrderByDescending(i => i.NomeRequisitante ?? i.Chaparequisitante ?? "")
                : items.OrderBy(i => i.NomeRequisitante ?? i.Chaparequisitante ?? ""),
            "funcao" => desc
                ? items.OrderByDescending(i => i.NomeFuncao ?? i.Codfuncao ?? "")
                : items.OrderBy(i => i.NomeFuncao ?? i.Codfuncao ?? ""),
            "salario" => desc
                ? items.OrderByDescending(i => i.Vlrsalario ?? decimal.MinValue)
                : items.OrderBy(i => i.Vlrsalario ?? decimal.MaxValue),
            "justificativa" => desc
                ? items.OrderByDescending(i => i.Justificativa ?? "")
                : items.OrderBy(i => i.Justificativa ?? ""),
            _ => desc
                ? items.OrderByDescending(i => i.Dataabertura ?? DateTime.MinValue)
                : items.OrderBy(i => i.Dataabertura ?? DateTime.MaxValue)
        };

        return ordered.ThenByDescending(i => i.Idreq);
    }

    private static Uri BuildConsultaUri(string endpointTemplate, int? codCol, int? idReq)
    {
        var url = endpointTemplate.Trim();
        if (!url.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
            && !url.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            url = "http://" + url;

        if (codCol.HasValue)
        {
            url = url.Replace("{COLIGADA}", codCol.Value.ToString(System.Globalization.CultureInfo.InvariantCulture), StringComparison.OrdinalIgnoreCase);
            url = Regex.Replace(
                url,
                @"(?i)(COLIGADA=)[^;&]+",
                match => $"{match.Groups[1].Value}{codCol.Value.ToString(System.Globalization.CultureInfo.InvariantCulture)}");
        }

        if (idReq.HasValue)
        {
            url = url.Replace("{IDREQ}", idReq.Value.ToString(System.Globalization.CultureInfo.InvariantCulture), StringComparison.OrdinalIgnoreCase);
            url = Regex.Replace(
                url,
                @"(?i)(IDREQ=)[^;&]+",
                match => $"{match.Groups[1].Value}{idReq.Value.ToString(System.Globalization.CultureInfo.InvariantCulture)}");
        }

        return new Uri(url, UriKind.Absolute);
    }

    private static void ApplyBasicAuthentication(HttpRequestMessage request, ConfiguracaoRmRequisicaoDto config)
    {
        if (string.IsNullOrWhiteSpace(config.Username))
            return;

        var raw = $"{config.Username}:{config.Password ?? string.Empty}";
        var basic = Convert.ToBase64String(Encoding.UTF8.GetBytes(raw));
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", basic);
    }

    private static RmRequisicaoRowDto MapRestRow(JsonElement item)
    {
        return new RmRequisicaoRowDto
        {
            TipoRequisicao = "AUMENTO_QUADRO",
            Codcolrequisicao = JsonInt(item, "CODCOLREQUISICAO"),
            Idreq = JsonInt(item, "IDREQ") ?? 0,
            Justificativa = JsonString(item, "JUSTIFICATIVA"),
            Dataabertura = JsonDate(item, "DATAABERTURA"),
            Dataprevista = JsonDate(item, "DATAPREVISTA"),
            Dataconclusao = JsonDate(item, "DATACONCLUSAO"),
            Datacancelamento = JsonDate(item, "DATACANCELAMENTO"),
            Codstatus = JsonInt(item, "CODSTATUS"),
            Codcolrequisitante = JsonInt(item, "CODCOLREQUISITANTE"),
            Chaparequisitante = JsonString(item, "CHAPAREQUISITANTE"),
            Codatendimento = JsonInt(item, "CODATENDIMENTO"),
            Codlocal = JsonInt(item, "CODLOCAL"),
            Numvagas = JsonInt(item, "NUMVAGAS"),
            Codfilial = JsonString(item, "CODFILIAL"),
            Codsecao = JsonString(item, "CODSECAO"),
            Codfuncao = JsonString(item, "CODFUNCAO"),
            NomeFuncao = FirstNonBlank(
                JsonString(item, "NOMEFUNCAO"),
                JsonString(item, "NOME_FUNCAO")),
            DescricaoFuncao = FirstNonBlank(
                JsonString(item, "DESCRICAOFUNCAO"),
                JsonString(item, "DESCRICAO_FUNCAO")),
            Codtabelasalarial = JsonString(item, "CODTABELASALARIAL"),
            Codnivelsalarial = JsonString(item, "CODNIVELSALARIAL"),
            Codfaixasalarial = JsonString(item, "CODFAIXASALARIAL"),
            Vlrsalario = JsonDecimal(item, "VLRSALARIO"),
            Reccreatedby = JsonString(item, "RECCREATEDBY"),
            Reccreatedon = JsonDate(item, "RECCREATEDON"),
            Recmodifiedby = JsonString(item, "RECMODIFIEDBY"),
            Recmodifiedon = JsonDate(item, "RECMODIFIEDON")
        };
    }

    private static string? JsonString(JsonElement item, string property)
    {
        if (!item.TryGetProperty(property, out var value) || value.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
            return null;
        return value.ValueKind == JsonValueKind.String ? value.GetString() : value.ToString();
    }

    private static int? JsonInt(JsonElement item, string property)
    {
        if (!item.TryGetProperty(property, out var value) || value.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
            return null;
        if (value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var number))
            return number;
        return int.TryParse(value.ToString(), System.Globalization.NumberStyles.Integer, System.Globalization.CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : null;
    }

    private static decimal? JsonDecimal(JsonElement item, string property)
    {
        if (!item.TryGetProperty(property, out var value) || value.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
            return null;
        if (value.ValueKind == JsonValueKind.Number && value.TryGetDecimal(out var number))
            return number;
        return decimal.TryParse(value.ToString(), System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : null;
    }

    private static DateTime? JsonDate(JsonElement item, string property)
    {
        if (!item.TryGetProperty(property, out var value) || value.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
            return null;
        if (value.ValueKind == JsonValueKind.String && value.TryGetDateTimeOffset(out var dto))
            return dto.DateTime;
        return DateTime.TryParse(value.ToString(), System.Globalization.CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : null;
    }

    private static bool ContainsIgnoreCase(string? source, string value)
    {
        return source?.IndexOf(value, StringComparison.OrdinalIgnoreCase) >= 0;
    }

    private static void AddFilterParameters(
        SqlCommand cmd,
        string? tipo,
        DateTime? dataDe,
        DateTime? dataAte,
        string? searchPattern,
        string? codStatusCsv)
    {
        cmd.Parameters.Add(CreateNullableParam("@Tipo", System.Data.SqlDbType.NVarChar, 80, tipo));
        cmd.Parameters.Add(CreateNullableDateParam("@DataDe", dataDe));
        cmd.Parameters.Add(CreateNullableDateParam("@DataAte", dataAte));
        cmd.Parameters.Add(CreateNullableParam("@CodStatusCsv", System.Data.SqlDbType.VarChar, 200, codStatusCsv));
        if (searchPattern is null)
            cmd.Parameters.AddWithValue("@SearchPattern", DBNull.Value);
        else
            cmd.Parameters.AddWithValue("@SearchPattern", searchPattern);
    }

    private static string? BuildCodStatusCsv(int[]? values)
    {
        var normalized = values?
            .Where(v => v >= 0)
            .Distinct()
            .OrderBy(v => v)
            .Select(v => v.ToString(System.Globalization.CultureInfo.InvariantCulture))
            .ToArray();
        return normalized is { Length: > 0 } ? $",{string.Join(",", normalized)}," : null;
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
            Codtabelasalarial = SafeString(r, "CODTABELASALARIAL"),
            Codnivelsalarial = SafeString(r, "CODNIVELSALARIAL"),
            Codfaixasalarial = SafeString(r, "CODFAIXASALARIAL"),
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

    private static string? FirstNonBlank(params string?[] values) =>
        values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v))?.Trim();
}
