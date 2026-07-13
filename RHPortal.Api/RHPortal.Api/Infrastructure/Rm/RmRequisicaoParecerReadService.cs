using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Application.RmConfiguracao;
using RhPortal.Api.Application.TenantConfiguracao;
using RhPortal.Api.Contracts.Rm;

namespace RhPortal.Api.Infrastructure.Rm;

public sealed class RmRequisicaoParecerReadService(
    ITenantRmConfiguracaoService rmConfiguracaoService,
    IHttpClientFactory httpClientFactory,
    ILogger<RmRequisicaoParecerReadService> logger) : IRmRequisicaoParecerReadService
{
    public async Task<IReadOnlyList<RmRequisicaoParecerRowDto>> ListAsync(
        string tipoRequisicao,
        int codColRequisicao,
        int idReq,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tipoRequisicao) || codColRequisicao <= 0 || idReq <= 0)
            return [];

        var tipo = tipoRequisicao.Trim().ToUpperInvariant();
        if (!RmRequisicaoTipos.IsImportavelComoSolicitacaoVaga(tipo))
        {
            logger.LogDebug(
                "Pareceres RM ignorados: tipo {Tipo} sem tabela SQL de pareceres para vaga.",
                tipo);
            return [];
        }

        var connectionOptions = await rmConfiguracaoService.GetConnectionOptionsAsync(ct);
        if (connectionOptions.IsConfigured)
        {
            try
            {
                return await ListFromSqlAsync(connectionOptions, tipo, codColRequisicao, idReq, ct);
            }
            catch (Exception ex)
            {
                logger.LogWarning(
                    ex,
                    "Falha ao ler pareceres RM via SQL {Tipo}/{CodCol}/{IdReq}. Tentando REST se configurado.",
                    tipo, codColRequisicao, idReq);
            }
        }
        else
        {
            logger.LogWarning(
                "Conexão SQL RM não configurada; pareceres {Tipo}/{CodCol}/{IdReq} dependerão do endpoint REST.",
                tipo, codColRequisicao, idReq);
        }

        return await ListFromRestAsync(tipo, codColRequisicao, idReq, ct);
    }

    private async Task<IReadOnlyList<RmRequisicaoParecerRowDto>> ListFromSqlAsync(
        RmConnectionOptions connectionOptions,
        string tipo,
        int codColRequisicao,
        int idReq,
        CancellationToken ct)
    {
        var cs = connectionOptions.GetConnectionString();
        await using var conn = new SqlConnection(cs);
        await conn.OpenAsync(ct);

        await using var cmd = new SqlCommand(RmRequisicoesQueries.SqlPareceresPorVinculo(tipo), conn);
        cmd.CommandTimeout = RmRequisicoesQueries.SqlCommandTimeoutSeconds;
        cmd.Parameters.AddWithValue("@CodCol", codColRequisicao);
        cmd.Parameters.AddWithValue("@IdReq", idReq);

        var rows = new List<RmRequisicaoParecerRowDto>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var idParecer = SafeInt(reader, "IDPARECER") ?? 0;
            if (idParecer <= 0)
                continue;

            var codStatus = SafeInt(reader, "CODSTATUS");
            rows.Add(new RmRequisicaoParecerRowDto
            {
                CodColRequisicao = SafeInt(reader, "CODCOLREQUISICAO") ?? codColRequisicao,
                IdReq = SafeInt(reader, "IDREQ") ?? idReq,
                IdParecer = idParecer,
                DataParecer = SafeDateOffset(reader, "DATAPARECER"),
                CodStatus = codStatus,
                Suspensao = SafeInt(reader, "SUSPENSAO"),
                Solicitante = SafeString(reader, "SOLICITANTE"),
                CodColSolicitante = SafeInt(reader, "CODCOLSOLICITANTE"),
                ChapaSolicitante = SafeString(reader, "CHAPASOLICITANTE"),
                Parecer = SafeString(reader, "PARECER"),
                Status = FormatCodStatusLabel(codStatus),
            });
        }

        return rows
            .OrderBy(r => r.DataParecer ?? DateTimeOffset.MinValue)
            .ThenBy(r => r.IdParecer)
            .ToList();
    }

    private async Task<IReadOnlyList<RmRequisicaoParecerRowDto>> ListFromRestAsync(
        string tipo,
        int codColRequisicao,
        int idReq,
        CancellationToken ct)
    {
        var publicConfig = await rmConfiguracaoService.GetAsync(ct);
        var createOptions = await rmConfiguracaoService.GetCreateOptionsAsync(ct);
        var config = new ConfiguracaoRmRequisicaoDto
        {
            ParecerEndpointUrl = publicConfig.ParecerEndpointUrl,
            Username = createOptions.Username,
            Password = createOptions.Password,
        };

        if (string.IsNullOrWhiteSpace(config.ParecerEndpointUrl))
        {
            logger.LogWarning(
                "ParecerEndpointUrl vazio e SQL indisponível/falhou — nenhum parecer para {Tipo}/{CodCol}/{IdReq}.",
                tipo, codColRequisicao, idReq);
            return [];
        }

        var endpoint = BuildConsultaUri(config.ParecerEndpointUrl, codColRequisicao, idReq);
        using var request = new HttpRequestMessage(HttpMethod.Get, endpoint);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        ApplyBasicAuthentication(request, config);

        var timeoutSeconds = Math.Max(
            RmRequisicoesQueries.SqlCommandTimeoutSeconds,
            Math.Clamp(createOptions.RequestTimeoutSeconds, 1, 600));

        var client = httpClientFactory.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(timeoutSeconds);
        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeoutCts.CancelAfter(TimeSpan.FromSeconds(timeoutSeconds));

        using var response = await client.SendAsync(request, timeoutCts.Token);
        var body = await response.Content.ReadAsStringAsync(timeoutCts.Token);
        if (!response.IsSuccessStatusCode)
        {
            var suffix = string.IsNullOrWhiteSpace(body) ? string.Empty : $" Resposta: {body.Trim()}";
            throw new InvalidOperationException($"Falha ao consultar pareceres RM ({(int)response.StatusCode}).{suffix}");
        }

        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;
        if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("data", out var data))
            root = data;

        if (root.ValueKind != JsonValueKind.Array)
            throw new InvalidOperationException("Endpoint de pareceres RM retornou JSON fora do formato esperado.");

        return root.EnumerateArray()
            .Where(e => e.ValueKind == JsonValueKind.Object)
            .Select(MapRestRow)
            .Where(r => r.CodColRequisicao == codColRequisicao && r.IdReq == idReq && r.IdParecer > 0)
            .OrderBy(r => r.DataParecer ?? DateTimeOffset.MinValue)
            .ThenBy(r => r.IdParecer)
            .ToList();
    }

    private static Uri BuildConsultaUri(string endpointTemplate, int codCol, int idReq)
    {
        var url = endpointTemplate.Trim();
        if (!url.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
            && !url.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            url = "http://" + url;

        url = url.Replace("{COLIGADA}", codCol.ToString(System.Globalization.CultureInfo.InvariantCulture), StringComparison.OrdinalIgnoreCase)
            .Replace("{CODCOLREQUISICAO}", codCol.ToString(System.Globalization.CultureInfo.InvariantCulture), StringComparison.OrdinalIgnoreCase)
            .Replace("{IDREQ}", idReq.ToString(System.Globalization.CultureInfo.InvariantCulture), StringComparison.OrdinalIgnoreCase);

        url = Regex.Replace(url, @"""(\d+)""(?=\])", $"\"{codCol.ToString(System.Globalization.CultureInfo.InvariantCulture)}\"");
        url = Regex.Replace(url, @"""(\d+)""(?=,""\d+""\])", $"\"{idReq.ToString(System.Globalization.CultureInfo.InvariantCulture)}\"");

        return new Uri(url, UriKind.Absolute);
    }

    private static void ApplyBasicAuthentication(HttpRequestMessage request, ConfiguracaoRmRequisicaoDto config)
    {
        if (string.IsNullOrWhiteSpace(config.Username))
            return;

        var raw = $"{config.Username}:{config.Password ?? string.Empty}";
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(Encoding.UTF8.GetBytes(raw)));
    }

    private static RmRequisicaoParecerRowDto MapRestRow(JsonElement item)
        => new()
        {
            CodColRequisicao = JsonInt(item, "CODCOLREQUISICAO") ?? 0,
            IdReq = JsonInt(item, "IDREQ") ?? 0,
            IdParecer = JsonInt(item, "IDPARECER") ?? 0,
            DataParecer = JsonDateOffset(item, "DATAPARECER"),
            CodStatus = JsonInt(item, "CODSTATUS"),
            Suspensao = JsonInt(item, "SUSPENSAO"),
            Solicitante = JsonString(item, "SOLICITANTE"),
            Img1 = JsonInt(item, "Img1"),
            CodColSolicitante = JsonInt(item, "CODCOLSOLICITANTE"),
            ChapaSolicitante = JsonString(item, "CHAPASOLICITANTE"),
            Parecer = JsonString(item, "PARECER"),
            Status = JsonString(item, "STATUS") ?? FormatCodStatusLabel(JsonInt(item, "CODSTATUS")),
        };

    private static string? FormatCodStatusLabel(int? codStatus) => codStatus switch
    {
        1 => "Em andamento",
        2 => "Reprovada",
        3 => "Aprovada",
        4 => "Concluída",
        5 => "Pendente aprovação",
        6 => "Cancelada",
        null => null,
        _ => $"CODSTATUS {codStatus}",
    };

    private static string? JsonString(JsonElement item, string property)
    {
        if (!item.TryGetProperty(property, out var value) || value.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
            return null;
        var text = value.ValueKind == JsonValueKind.String ? value.GetString() : value.ToString();
        return string.IsNullOrWhiteSpace(text) ? null : text.Trim();
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

    private static DateTimeOffset? JsonDateOffset(JsonElement item, string property)
    {
        var raw = JsonString(item, property);
        if (string.IsNullOrWhiteSpace(raw))
            return null;
        return DateTimeOffset.TryParse(raw, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.AssumeUniversal, out var parsed)
            ? parsed.ToUniversalTime()
            : null;
    }

    private static string? SafeString(SqlDataReader r, string name)
    {
        var ord = r.GetOrdinal(name);
        if (r.IsDBNull(ord)) return null;
        var text = r.GetValue(ord)?.ToString()?.Trim();
        return string.IsNullOrWhiteSpace(text) ? null : text;
    }

    private static int? SafeInt(SqlDataReader r, string name)
    {
        var ord = r.GetOrdinal(name);
        if (r.IsDBNull(ord)) return null;
        return Convert.ToInt32(r.GetValue(ord), System.Globalization.CultureInfo.InvariantCulture);
    }

    private static DateTimeOffset? SafeDateOffset(SqlDataReader r, string name)
    {
        var ord = r.GetOrdinal(name);
        if (r.IsDBNull(ord)) return null;
        var dt = r.GetDateTime(ord);
        return new DateTimeOffset(DateTime.SpecifyKind(dt, DateTimeKind.Unspecified), TimeSpan.Zero);
    }
}
