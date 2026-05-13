using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using RhPortal.Api.Application.TenantConfiguracao;
using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Infrastructure.Rm;

public sealed class RmRequisicaoCreateRestClient(
    HttpClient httpClient,
    IOptions<RmRequisicaoCreateOptions> options,
    ITenantConfiguracaoService tenantConfiguracaoService) : IRmRequisicaoCreateClient
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly HttpClient _httpClient = httpClient;
    private readonly RmRequisicaoCreateOptions _options = options.Value;
    private readonly ITenantConfiguracaoService _tenantConfiguracaoService = tenantConfiguracaoService;

    public async Task<RmCreateRequisicaoOutcome> EnviarOuObterJaCriadoAsync(
        SolicitacaoVaga solicitacao,
        string idempotencyKey,
        string payloadResumo,
        CancellationToken ct)
    {
        _ = payloadResumo;

        var tenantConfig = await _tenantConfiguracaoService.GetRmRequisicaoConfigAsync(ct);
        var effectiveOptions = BuildEffectiveOptions(_options, tenantConfig);
        var mode = (effectiveOptions.Mode ?? "stub").Trim();
        var tenantForcouRest = !string.IsNullOrWhiteSpace(tenantConfig.EndpointUrl);

        if (mode.Equals("disabled", StringComparison.OrdinalIgnoreCase))
        {
            return new RmCreateRequisicaoOutcome(
                false, false, null, null,
                "Criação de requisição no RM desabilitada (RmRequisicaoCreate:Mode=disabled).",
                503);
        }

        if (!tenantForcouRest && !mode.Equals("rest", StringComparison.OrdinalIgnoreCase))
            return BuildStubOutcome(solicitacao, effectiveOptions);

        var endpoint = ResolveEndpointUri(effectiveOptions);
        var payload = RmAumentoQuadroCreatePayloadBuilder.Build(solicitacao, effectiveOptions, DateTimeOffset.Now);

        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        request.Headers.TryAddWithoutValidation("X-Idempotency-Key", idempotencyKey);
        ApplyAuthentication(request, effectiveOptions);
        request.Content = JsonContent.Create(payload, options: JsonOptions);

        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeoutCts.CancelAfter(TimeSpan.FromSeconds(Math.Max(1, effectiveOptions.RequestTimeoutSeconds)));

        using var response = await _httpClient.SendAsync(request, timeoutCts.Token);
        var body = await response.Content.ReadAsStringAsync(timeoutCts.Token);

        if (!response.IsSuccessStatusCode)
        {
            var mensagem = BuildHttpErrorMessage(response.StatusCode, body);
            return new RmCreateRequisicaoOutcome(false, false, null, null, mensagem, (int)response.StatusCode);
        }

        RmAumentoQuadroCreateEnvelope? envelope;
        try
        {
            envelope = JsonSerializer.Deserialize<RmAumentoQuadroCreateEnvelope>(body, JsonOptions);
        }
        catch (JsonException ex)
        {
            return new RmCreateRequisicaoOutcome(
                false,
                false,
                null,
                null,
                $"Resposta RM inválida: {ex.Message}",
                (int)response.StatusCode);
        }

        var item = envelope?.Data?.FirstOrDefault();
        if (item is null)
        {
            var mensagem = ExtractMessages(envelope?.Messages) ?? "RM retornou sucesso sem dados da requisição criada.";
            return new RmCreateRequisicaoOutcome(false, false, null, null, mensagem, (int)response.StatusCode);
        }

        var codigoRm = RmPortalRequisicaoVinculo.Build(
            RmPortalRequisicaoVinculo.TipoAumentoQuadro,
            item.CODCOLREQUISICAO,
            item.IDREQ);

        return new RmCreateRequisicaoOutcome(
            true,
            false,
            codigoRm,
            (short)item.CODSTATUS,
            null,
            (int)response.StatusCode,
            (short)item.CODCOLREQUISICAO,
            item.IDREQ);
    }

    private static RmRequisicaoCreateOptions BuildEffectiveOptions(
        RmRequisicaoCreateOptions defaults,
        ConfiguracaoRmRequisicaoDto? tenantConfig)
    {
        return new RmRequisicaoCreateOptions
        {
            Mode = defaults.Mode,
            MaxTentativas = defaults.MaxTentativas,
            WorkerEnabled = defaults.WorkerEnabled,
            WorkerIntervalSeconds = defaults.WorkerIntervalSeconds,
            WorkerMaxPerTenant = defaults.WorkerMaxPerTenant,
            EndpointUrl = tenantConfig?.EndpointUrl ?? defaults.EndpointUrl,
            BaseUrl = defaults.BaseUrl,
            EndpointPath = defaults.EndpointPath,
            RequestTimeoutSeconds = defaults.RequestTimeoutSeconds,
            Username = tenantConfig?.Username ?? defaults.Username,
            Password = tenantConfig?.Password ?? defaults.Password,
            BearerToken = defaults.BearerToken,
            CodColRequisicaoDefault = defaults.CodColRequisicaoDefault,
            CodColRequisitanteDefault = defaults.CodColRequisitanteDefault,
            CodStatusInicial = defaults.CodStatusInicial,
            CodLocalDefault = defaults.CodLocalDefault,
            CodFilialDefault = defaults.CodFilialDefault,
            DiasPrevisaoPadrao = defaults.DiasPrevisaoPadrao,
            RecCreatedBy = defaults.RecCreatedBy,
            RecModifiedBy = defaults.RecModifiedBy
        };
    }

    private static RmCreateRequisicaoOutcome BuildStubOutcome(
        SolicitacaoVaga solicitacao,
        RmRequisicaoCreateOptions effectiveOptions)
    {
        if (!string.IsNullOrWhiteSpace(solicitacao.RmRequisicaoCodigo)
            && solicitacao.RmRequisicaoCodigo.StartsWith("STUB-", StringComparison.OrdinalIgnoreCase))
        {
            return new RmCreateRequisicaoOutcome(
                true,
                true,
                solicitacao.RmRequisicaoCodigo,
                solicitacao.RmCodStatus ?? 1,
                null,
                null,
                solicitacao.RmCodColRequisicao,
                solicitacao.RmIdReq);
        }

        var codigo = $"STUB-{solicitacao.Id:N}".ToUpperInvariant();
        if (codigo.Length > 120)
            codigo = codigo[..120];

        return new RmCreateRequisicaoOutcome(
            true,
            false,
            codigo,
            1,
            null,
            null,
            effectiveOptions.CodColRequisicaoDefault,
            Math.Abs(solicitacao.Id.GetHashCode()));
    }

    private static Uri ResolveEndpointUri(RmRequisicaoCreateOptions options)
    {
        var endpointUrl = options.EndpointUrl?.Trim();
        if (!string.IsNullOrWhiteSpace(endpointUrl) && Uri.TryCreate(endpointUrl, UriKind.Absolute, out var absoluteEndpoint))
            return absoluteEndpoint;

        var endpointPath = options.EndpointPath?.Trim();
        if (!string.IsNullOrWhiteSpace(endpointPath) && Uri.TryCreate(endpointPath, UriKind.Absolute, out var absolute))
            return absolute;

        var baseUrl = options.BaseUrl?.Trim();
        if (string.IsNullOrWhiteSpace(baseUrl))
            throw new InvalidOperationException(
                "Configure a URL do endpoint RM na aba Requisições/Solicitações RM ou defina RmRequisicaoCreate:BaseUrl/EndpointPath.");

        var baseUri = new Uri(baseUrl.TrimEnd('/') + "/", UriKind.Absolute);
        return string.IsNullOrWhiteSpace(endpointPath)
            ? baseUri
            : new Uri(baseUri, endpointPath.TrimStart('/'));
    }

    private static void ApplyAuthentication(HttpRequestMessage request, RmRequisicaoCreateOptions options)
    {
        if (!string.IsNullOrWhiteSpace(options.BearerToken))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", options.BearerToken.Trim());
            return;
        }

        if (!string.IsNullOrWhiteSpace(options.Username))
        {
            var raw = $"{options.Username}:{options.Password ?? string.Empty}";
            var basic = Convert.ToBase64String(Encoding.UTF8.GetBytes(raw));
            request.Headers.Authorization = new AuthenticationHeaderValue("Basic", basic);
        }
    }

    private static string BuildHttpErrorMessage(System.Net.HttpStatusCode statusCode, string body)
    {
        var suffix = string.IsNullOrWhiteSpace(body) ? string.Empty : $" Resposta: {body.Trim()}";
        var message = $"RM retornou HTTP {(int)statusCode}.{suffix}";
        return message.Length <= 2000 ? message : message[..2000];
    }

    private static string? ExtractMessages(IReadOnlyList<JsonElement>? messages)
    {
        if (messages is null || messages.Count == 0)
            return null;

        var textos = messages
            .Select(m => m.ValueKind == JsonValueKind.String ? m.GetString() : m.ToString())
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .Take(3)
            .ToArray();

        if (textos.Length == 0)
            return null;

        var joined = string.Join(" | ", textos!);
        return joined.Length <= 2000 ? joined : joined[..2000];
    }

    private sealed record RmAumentoQuadroCreateEnvelope(
        IReadOnlyList<JsonElement>? Messages,
        int? Length,
        IReadOnlyList<RmAumentoQuadroCreateResponseItem>? Data);

    private sealed record RmAumentoQuadroCreateResponseItem(
        string? Id,
        int CODCOLREQUISICAO,
        int CODFILIAL,
        int CODSTATUS,
        int IDREQ);
}
