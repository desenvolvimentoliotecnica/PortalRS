using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Security;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.MicrosoftGraph;

public sealed class GraphCalendarConfigView
{
    public bool Enabled { get; set; }
    public string? TenantId { get; set; }
    public string? ClientId { get; set; }
    public bool HasClientSecret { get; set; }
    public string? UserPrincipalName { get; set; }
}

public sealed class GraphCalendarConfigRequest
{
    public bool Enabled { get; set; }
    public string? TenantId { get; set; }
    public string? ClientId { get; set; }
    public string? ClientSecret { get; set; }
    public string? UserPrincipalName { get; set; }
}

public sealed class GraphCalendarEventDto
{
    public string Id { get; set; } = "";
    public string Subject { get; set; } = "";
    public DateTimeOffset Start { get; set; }
    public DateTimeOffset End { get; set; }
    public bool IsAllDay { get; set; }
    public string? Location { get; set; }
    public string? BodyPreview { get; set; }
    public string? OrganizerName { get; set; }
    public string? WebLink { get; set; }
    public bool IsOnlineMeeting { get; set; }
    public string Source { get; set; } = "microsoft-graph";
}

public sealed class GraphCalendarTestResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = "";
    public IReadOnlyList<GraphCalendarEventDto> Events { get; set; } = Array.Empty<GraphCalendarEventDto>();
}

public interface IMicrosoftGraphCalendarService
{
    Task<GraphCalendarConfigView> GetConfigAsync(CancellationToken ct);
    Task<GraphCalendarConfigView> SaveConfigAsync(GraphCalendarConfigRequest request, CancellationToken ct);
    Task<GraphCalendarTestResponse> TestConnectionAsync(CancellationToken ct);
    Task<IReadOnlyList<GraphCalendarEventDto>> ListEventsAsync(DateTimeOffset? startUtc, DateTimeOffset? endUtc, CancellationToken ct);
}

public sealed class MicrosoftGraphCalendarService : IMicrosoftGraphCalendarService
{
    private const string GraphBaseUrl = "https://graph.microsoft.com/v1.0";
    private const string TokenEndpointTemplate = "https://login.microsoftonline.com/{0}/oauth2/v2.0/token";

    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly ICurrentUserContext _currentUser;
    private readonly ISecretProtector _protector;
    private readonly IHttpClientFactory _httpClientFactory;

    public MicrosoftGraphCalendarService(
        AppDbContext db,
        ITenantContext tenantContext,
        ICurrentUserContext currentUser,
        ISecretProtector protector,
        IHttpClientFactory httpClientFactory)
    {
        _db = db;
        _tenantContext = tenantContext;
        _currentUser = currentUser;
        _protector = protector;
        _httpClientFactory = httpClientFactory;
    }

    public async Task<GraphCalendarConfigView> GetConfigAsync(CancellationToken ct)
    {
        var config = await GetOrCreateConfigAsync(ct, createIfMissing: false);
        return config is null ? new GraphCalendarConfigView() : MapView(config);
    }

    public async Task<GraphCalendarConfigView> SaveConfigAsync(GraphCalendarConfigRequest request, CancellationToken ct)
    {
        var config = await GetOrCreateConfigAsync(ct, createIfMissing: true)
                     ?? throw new InvalidOperationException("Não foi possível criar configuração do tenant.");

        config.GraphCalendarEnabled = request.Enabled;
        config.GraphCalendarTenantId = NullIfBlank(request.TenantId);
        config.GraphCalendarClientId = NullIfBlank(request.ClientId);
        config.GraphCalendarUserUpn = NullIfBlank(request.UserPrincipalName);

        if (!string.IsNullOrWhiteSpace(request.ClientSecret))
            config.GraphCalendarClientSecretEncrypted = _protector.Encrypt(request.ClientSecret.Trim());

        config.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return MapView(config);
    }

    public async Task<GraphCalendarTestResponse> TestConnectionAsync(CancellationToken ct)
    {
        var credentials = await ResolveCredentialsAsync(ct, requireEnabled: false, requireUserUpn: true);
        if (credentials is null)
        {
            return new GraphCalendarTestResponse
            {
                Success = false,
                Message = "Configure Tenant ID, Client ID, Client Secret e UPN de teste antes de testar.",
            };
        }

        var start = DateTimeOffset.UtcNow.AddDays(-1);
        var end = DateTimeOffset.UtcNow.AddDays(7);

        try
        {
            var app = new GraphAppCredentials(credentials.TenantId, credentials.ClientId, credentials.ClientSecret);
            var events = await FetchEventsAsync(app, credentials.UserUpn, start, end, ct);
            return new GraphCalendarTestResponse
            {
                Success = true,
                Message = $"Conexão OK. {events.Count} evento(s) encontrado(s) entre {start:dd/MM/yyyy} e {end:dd/MM/yyyy}.",
                Events = events,
            };
        }
        catch (Exception ex)
        {
            return new GraphCalendarTestResponse
            {
                Success = false,
                Message = ex.Message,
            };
        }
    }

    public async Task<IReadOnlyList<GraphCalendarEventDto>> ListEventsAsync(
        DateTimeOffset? startUtc,
        DateTimeOffset? endUtc,
        CancellationToken ct)
    {
        var credentials = await ResolveAppCredentialsAsync(ct, requireEnabled: true);
        if (credentials is null)
            return Array.Empty<GraphCalendarEventDto>();

        var userUpn = _currentUser.Email?.Trim();
        if (string.IsNullOrWhiteSpace(userUpn))
            return Array.Empty<GraphCalendarEventDto>();

        var start = startUtc ?? DateTimeOffset.UtcNow.AddDays(-7);
        var end = endUtc ?? DateTimeOffset.UtcNow.AddDays(30);

        try
        {
            return await FetchEventsAsync(credentials, userUpn, start, end, ct);
        }
        catch
        {
            return Array.Empty<GraphCalendarEventDto>();
        }
    }

    private async Task<GraphAppCredentials?> ResolveAppCredentialsAsync(CancellationToken ct, bool requireEnabled)
    {
        var config = await _db.TenantConfiguracoes.AsNoTracking().FirstOrDefaultAsync(ct);
        if (config is null
            || (requireEnabled && !config.GraphCalendarEnabled)
            || string.IsNullOrWhiteSpace(config.GraphCalendarTenantId)
            || string.IsNullOrWhiteSpace(config.GraphCalendarClientId)
            || string.IsNullOrWhiteSpace(config.GraphCalendarClientSecretEncrypted))
        {
            return null;
        }

        return new GraphAppCredentials(
            config.GraphCalendarTenantId.Trim(),
            config.GraphCalendarClientId.Trim(),
            _protector.Decrypt(config.GraphCalendarClientSecretEncrypted));
    }

    private async Task<GraphCredentials?> ResolveCredentialsAsync(
        CancellationToken ct,
        bool requireEnabled,
        bool requireUserUpn)
    {
        var app = await ResolveAppCredentialsAsync(ct, requireEnabled);
        if (app is null)
            return null;

        var config = await _db.TenantConfiguracoes.AsNoTracking().FirstOrDefaultAsync(ct);
        if (config is null
            || (requireUserUpn && string.IsNullOrWhiteSpace(config.GraphCalendarUserUpn)))
        {
            return null;
        }

        return new GraphCredentials(
            config!.GraphCalendarEnabled,
            app.TenantId,
            app.ClientId,
            app.ClientSecret,
            config.GraphCalendarUserUpn!.Trim());
    }

    private async Task<IReadOnlyList<GraphCalendarEventDto>> FetchEventsAsync(
        GraphAppCredentials credentials,
        string userUpn,
        DateTimeOffset startUtc,
        DateTimeOffset endUtc,
        CancellationToken ct)
    {
        var http = _httpClientFactory.CreateClient("AzureAdGraph");
        var token = await ObtainTokenAsync(http, credentials.TenantId, credentials.ClientId, credentials.ClientSecret, ct);

        var start = Uri.EscapeDataString(startUtc.ToString("o"));
        var end = Uri.EscapeDataString(endUtc.ToString("o"));
        var upn = Uri.EscapeDataString(userUpn.Trim());
        var url =
            $"{GraphBaseUrl}/users/{upn}/calendarView?startDateTime={start}&endDateTime={end}&$$select=id,subject,start,end,isAllDay,location,bodyPreview,organizer,webLink,isOnlineMeeting&$$orderby=start/dateTime&$$top=200";

        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var resp = await http.SendAsync(req, ct);
        var body = await resp.Content.ReadAsStringAsync(ct);

        if (!resp.IsSuccessStatusCode)
            throw new InvalidOperationException($"Microsoft Graph retornou {(int)resp.StatusCode}: {TrimGraphError(body)}");

        return ParseEvents(body);
    }

    private static IReadOnlyList<GraphCalendarEventDto> ParseEvents(string json)
    {
        using var doc = JsonDocument.Parse(json);
        if (!doc.RootElement.TryGetProperty("value", out var value) || value.ValueKind != JsonValueKind.Array)
            return Array.Empty<GraphCalendarEventDto>();

        var list = new List<GraphCalendarEventDto>();
        foreach (var item in value.EnumerateArray())
        {
            var subject = item.TryGetProperty("subject", out var subj) ? subj.GetString() ?? "(Sem título)" : "(Sem título)";
            var id = item.TryGetProperty("id", out var idEl) ? idEl.GetString() ?? Guid.NewGuid().ToString("N") : Guid.NewGuid().ToString("N");
            var isAllDay = item.TryGetProperty("isAllDay", out var allDay) && allDay.GetBoolean();
            var location = item.TryGetProperty("location", out var loc)
                && loc.TryGetProperty("displayName", out var displayName)
                ? displayName.GetString()
                : null;
            var bodyPreview = item.TryGetProperty("bodyPreview", out var preview) ? preview.GetString() : null;
            var webLink = item.TryGetProperty("webLink", out var link) ? link.GetString() : null;
            var isOnlineMeeting = item.TryGetProperty("isOnlineMeeting", out var online) && online.GetBoolean();
            string? organizerName = null;
            if (item.TryGetProperty("organizer", out var organizer)
                && organizer.TryGetProperty("emailAddress", out var email)
                && email.TryGetProperty("name", out var name))
            {
                organizerName = name.GetString();
            }

            if (!TryReadDateTimeOffset(item, "start", out var start)
                || !TryReadDateTimeOffset(item, "end", out var end))
                continue;

            list.Add(new GraphCalendarEventDto
            {
                Id = $"graph:{id}",
                Subject = subject,
                Start = start,
                End = end,
                IsAllDay = isAllDay,
                Location = location,
                BodyPreview = bodyPreview,
                OrganizerName = organizerName,
                WebLink = webLink,
                IsOnlineMeeting = isOnlineMeeting,
            });
        }

        return list;
    }

    private static bool TryReadDateTimeOffset(JsonElement item, string property, out DateTimeOffset value)
    {
        value = default;
        if (!item.TryGetProperty(property, out var node))
            return false;

        if (node.TryGetProperty("dateTime", out var dateTimeEl))
        {
            var raw = dateTimeEl.GetString();
            if (string.IsNullOrWhiteSpace(raw))
                return false;

            if (DateTimeOffset.TryParse(raw, out var parsed))
            {
                if (node.TryGetProperty("timeZone", out var tzEl))
                {
                    var tz = tzEl.GetString();
                    if (string.Equals(tz, "UTC", StringComparison.OrdinalIgnoreCase))
                        value = parsed.ToUniversalTime();
                    else
                        value = parsed;
                }
                else
                {
                    value = parsed;
                }

                return true;
            }
        }

        return false;
    }

    private static async Task<string> ObtainTokenAsync(
        HttpClient http,
        string tenantId,
        string clientId,
        string clientSecret,
        CancellationToken ct)
    {
        var url = string.Format(TokenEndpointTemplate, tenantId);
        var body = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "client_credentials",
            ["client_id"] = clientId,
            ["client_secret"] = clientSecret,
            ["scope"] = "https://graph.microsoft.com/.default",
        });

        var resp = await http.PostAsync(url, body, ct);
        var payload = await resp.Content.ReadAsStringAsync(ct);
        if (!resp.IsSuccessStatusCode)
            throw new InvalidOperationException($"Falha ao obter token Azure AD: {TrimGraphError(payload)}");

        using var doc = JsonDocument.Parse(payload);
        return doc.RootElement.GetProperty("access_token").GetString()
               ?? throw new InvalidOperationException("Resposta do Azure AD sem access_token.");
    }

    private static string TrimGraphError(string body)
    {
        if (string.IsNullOrWhiteSpace(body))
            return "sem detalhes";

        try
        {
            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("error_description", out var desc))
                return desc.GetString() ?? body;
            if (doc.RootElement.TryGetProperty("error", out var err)
                && err.TryGetProperty("message", out var msg))
                return msg.GetString() ?? body;
        }
        catch
        {
            // ignore parse errors
        }

        return body.Length > 300 ? body[..300] + "…" : body;
    }

    private async Task<Domain.Entities.TenantConfiguracao?> GetOrCreateConfigAsync(CancellationToken ct, bool createIfMissing)
    {
        var config = await _db.TenantConfiguracoes.FirstOrDefaultAsync(ct);
        if (config is not null || !createIfMissing)
            return config;

        config = new Domain.Entities.TenantConfiguracao
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId ?? "",
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        _db.TenantConfiguracoes.Add(config);
        await _db.SaveChangesAsync(ct);
        return config;
    }

    private static GraphCalendarConfigView MapView(Domain.Entities.TenantConfiguracao config) => new()
    {
        Enabled = config.GraphCalendarEnabled,
        TenantId = config.GraphCalendarTenantId,
        ClientId = config.GraphCalendarClientId,
        HasClientSecret = !string.IsNullOrWhiteSpace(config.GraphCalendarClientSecretEncrypted),
        UserPrincipalName = config.GraphCalendarUserUpn,
    };

    private static string? NullIfBlank(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private sealed record GraphAppCredentials(
        string TenantId,
        string ClientId,
        string ClientSecret);

    private sealed record GraphCredentials(
        bool Enabled,
        string TenantId,
        string ClientId,
        string ClientSecret,
        string UserUpn);
}
