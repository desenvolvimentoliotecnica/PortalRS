using System.Net.Http.Headers;
using System.Text;
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

public sealed class GraphCalendarEventWriteRequest
{
    public required string UserUpn { get; init; }
    public required string Subject { get; init; }
    public required DateTime StartAtUtc { get; init; }
    public required DateTime EndAtUtc { get; init; }
    public bool AllDay { get; init; }
    public string? Location { get; init; }
    public string? Body { get; init; }
    public bool IsOnlineMeeting { get; init; }
    public string? RoomEmail { get; init; }
    public string? RoomDisplayName { get; init; }
}

public sealed class GraphMeetingRoomDto
{
    public string Email { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string? Building { get; set; }
    public int? Capacity { get; set; }
}

public sealed class GraphMeetingRoomAvailabilityDto
{
    public string Email { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string? Building { get; set; }
    public int? Capacity { get; set; }
    public bool IsAvailable { get; set; }
}

public sealed record GraphCalendarEventCreateResult(
    string EventId,
    string? OnlineMeetingJoinUrl,
    string? WebLink);

public interface IMicrosoftGraphCalendarService
{
    Task<GraphCalendarConfigView> GetConfigAsync(CancellationToken ct);
    Task<GraphCalendarConfigView> SaveConfigAsync(GraphCalendarConfigRequest request, CancellationToken ct);
    Task<GraphCalendarTestResponse> TestConnectionAsync(CancellationToken ct);
    Task<IReadOnlyList<GraphCalendarEventDto>> ListEventsAsync(DateTimeOffset? startUtc, DateTimeOffset? endUtc, CancellationToken ct);
    Task<GraphCalendarEventCreateResult?> CreateCalendarEventAsync(GraphCalendarEventWriteRequest request, CancellationToken ct);
    Task UpdateCalendarEventAsync(string userUpn, string graphEventId, GraphCalendarEventWriteRequest request, CancellationToken ct);
    Task DeleteCalendarEventAsync(string userUpn, string graphEventId, CancellationToken ct);
    Task<IReadOnlyList<GraphMeetingRoomDto>> ListMeetingRoomsAsync(CancellationToken ct);
    Task<IReadOnlyList<GraphMeetingRoomAvailabilityDto>> GetMeetingRoomAvailabilityAsync(
        string userUpn,
        DateTime startUtc,
        DateTime endUtc,
        CancellationToken ct);
}

public sealed class MicrosoftGraphCalendarService : IMicrosoftGraphCalendarService
{
    private const string GraphBaseUrl = "https://graph.microsoft.com/v1.0";
    private const string TokenEndpointTemplate = "https://login.microsoftonline.com/{0}/oauth2/v2.0/token";
    private const string BrazilTimeZoneId = "America/Sao_Paulo";

    private static readonly JsonSerializerOptions JsonWriteOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
    };

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
            var events = await FetchEventsAsync(credentials, userUpn, start, end, ct);
            var linkedIds = await GetLinkedGraphEventIdsAsync(ct);
            if (linkedIds.Count == 0)
                return events;

            return events
                .Where(e => !linkedIds.Contains(StripGraphPrefix(e.Id)))
                .ToList();
        }
        catch
        {
            return Array.Empty<GraphCalendarEventDto>();
        }
    }

    public async Task<GraphCalendarEventCreateResult?> CreateCalendarEventAsync(GraphCalendarEventWriteRequest request, CancellationToken ct)
    {
        var credentials = await ResolveAppCredentialsAsync(ct, requireEnabled: true);
        if (credentials is null)
            return null;

        var http = _httpClientFactory.CreateClient("AzureAdGraph");
        var token = await ObtainTokenAsync(http, credentials.TenantId, credentials.ClientId, credentials.ClientSecret, ct);
        var upn = Uri.EscapeDataString(request.UserUpn.Trim());
        var url = $"{GraphBaseUrl}/users/{upn}/events";
        var payload = BuildEventJson(request);

        using var req = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(payload, Encoding.UTF8, "application/json"),
        };
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var resp = await http.SendAsync(req, ct);
        var body = await resp.Content.ReadAsStringAsync(ct);
        if (!resp.IsSuccessStatusCode)
            throw new InvalidOperationException($"Microsoft Graph retornou {(int)resp.StatusCode}: {TrimGraphError(body)}");

        var created = ParseCreateResponse(body);
        if (string.IsNullOrWhiteSpace(created.EventId))
            return null;

        if (request.IsOnlineMeeting && string.IsNullOrWhiteSpace(created.OnlineMeetingJoinUrl))
        {
            var fetched = await FetchEventMeetingLinksAsync(http, token, request.UserUpn.Trim(), created.EventId, ct);
            return created with
            {
                OnlineMeetingJoinUrl = fetched.JoinUrl ?? created.OnlineMeetingJoinUrl,
                WebLink = fetched.WebLink ?? created.WebLink,
            };
        }

        return created;
    }

    public async Task UpdateCalendarEventAsync(
        string userUpn,
        string graphEventId,
        GraphCalendarEventWriteRequest request,
        CancellationToken ct)
    {
        var credentials = await ResolveAppCredentialsAsync(ct, requireEnabled: true);
        if (credentials is null)
            return;

        var http = _httpClientFactory.CreateClient("AzureAdGraph");
        var token = await ObtainTokenAsync(http, credentials.TenantId, credentials.ClientId, credentials.ClientSecret, ct);
        var upn = Uri.EscapeDataString(userUpn.Trim());
        var eventId = Uri.EscapeDataString(graphEventId.Trim());
        var url = $"{GraphBaseUrl}/users/{upn}/events/{eventId}";
        var payload = BuildEventJson(request);

        using var req = new HttpRequestMessage(HttpMethod.Patch, url)
        {
            Content = new StringContent(payload, Encoding.UTF8, "application/json"),
        };
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var resp = await http.SendAsync(req, ct);
        var body = await resp.Content.ReadAsStringAsync(ct);
        if (!resp.IsSuccessStatusCode)
            throw new InvalidOperationException($"Microsoft Graph retornou {(int)resp.StatusCode}: {TrimGraphError(body)}");
    }

    public async Task DeleteCalendarEventAsync(string userUpn, string graphEventId, CancellationToken ct)
    {
        var credentials = await ResolveAppCredentialsAsync(ct, requireEnabled: true);
        if (credentials is null)
            return;

        var http = _httpClientFactory.CreateClient("AzureAdGraph");
        var token = await ObtainTokenAsync(http, credentials.TenantId, credentials.ClientId, credentials.ClientSecret, ct);
        var upn = Uri.EscapeDataString(userUpn.Trim());
        var eventId = Uri.EscapeDataString(graphEventId.Trim());
        var url = $"{GraphBaseUrl}/users/{upn}/events/{eventId}";

        using var req = new HttpRequestMessage(HttpMethod.Delete, url);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var resp = await http.SendAsync(req, ct);
        if (resp.IsSuccessStatusCode || resp.StatusCode == System.Net.HttpStatusCode.NotFound)
            return;

        var body = await resp.Content.ReadAsStringAsync(ct);
        throw new InvalidOperationException($"Microsoft Graph retornou {(int)resp.StatusCode}: {TrimGraphError(body)}");
    }

    public async Task<IReadOnlyList<GraphMeetingRoomDto>> ListMeetingRoomsAsync(CancellationToken ct)
    {
        var credentials = await ResolveAppCredentialsAsync(ct, requireEnabled: true)
                          ?? throw new InvalidOperationException(
                              "Integração com Outlook não está configurada ou habilitada para este tenant.");

        var http = _httpClientFactory.CreateClient("AzureAdGraph");
        var token = await ObtainTokenAsync(http, credentials.TenantId, credentials.ClientId, credentials.ClientSecret, ct);

        var rooms = new List<GraphMeetingRoomDto>();
        var url =
            $"{GraphBaseUrl}/places/microsoft.graph.room?$select=displayName,emailAddress,building,capacity&$top=100";

        while (!string.IsNullOrWhiteSpace(url))
        {
            using var req = new HttpRequestMessage(HttpMethod.Get, url);
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            var resp = await http.SendAsync(req, ct);
            var body = await resp.Content.ReadAsStringAsync(ct);
            if (!resp.IsSuccessStatusCode)
                throw new InvalidOperationException(
                    $"Não foi possível listar salas no Microsoft Graph ({(int)resp.StatusCode}): {TrimGraphError(body)}");

            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            if (root.TryGetProperty("value", out var value) && value.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in value.EnumerateArray())
                {
                    try
                    {
                        var room = ParseMeetingRoom(item);
                        if (!string.IsNullOrWhiteSpace(room.Email))
                            rooms.Add(room);
                    }
                    catch
                    {
                        // Ignora entradas malformadas do Graph sem expor erro técnico ao usuário.
                    }
                }
            }

            url = root.TryGetProperty("@odata.nextLink", out var next) ? next.GetString() : null;
        }

        if (rooms.Count == 0)
            throw new InvalidOperationException(
                "Nenhuma sala de reunião encontrada no Microsoft 365. Verifique room mailboxes e permissão Place.Read.All.");

        return rooms
            .Where(r => !string.IsNullOrWhiteSpace(r.Email))
            .OrderBy(r => r.DisplayName, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    public async Task<IReadOnlyList<GraphMeetingRoomAvailabilityDto>> GetMeetingRoomAvailabilityAsync(
        string userUpn,
        DateTime startUtc,
        DateTime endUtc,
        CancellationToken ct)
    {
        var organizerUpn = userUpn.Trim();
        if (string.IsNullOrWhiteSpace(organizerUpn))
            throw new InvalidOperationException("UPN do responsável é obrigatório para consultar disponibilidade de salas.");

        if (endUtc <= startUtc)
            throw new InvalidOperationException("O horário de fim deve ser posterior ao início.");

        var rooms = await ListMeetingRoomsAsync(ct);
        var credentials = await ResolveAppCredentialsAsync(ct, requireEnabled: true)
                          ?? throw new InvalidOperationException(
                              "Integração com Outlook não está configurada ou habilitada para este tenant.");

        var http = _httpClientFactory.CreateClient("AzureAdGraph");
        var token = await ObtainTokenAsync(http, credentials.TenantId, credentials.ClientId, credentials.ClientSecret, ct);
        var availabilityByEmail = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);

        foreach (var batch in rooms.Select(r => r.Email).Chunk(20))
        {
            var batchAvailability = await FetchRoomAvailabilityBatchAsync(
                http,
                token,
                organizerUpn,
                batch,
                startUtc,
                endUtc,
                ct);
            foreach (var pair in batchAvailability)
                availabilityByEmail[pair.Key] = pair.Value;
        }

        return rooms
            .Select(room => new GraphMeetingRoomAvailabilityDto
            {
                Email = room.Email,
                DisplayName = room.DisplayName,
                Building = room.Building,
                Capacity = room.Capacity,
                IsAvailable = availabilityByEmail.TryGetValue(room.Email, out var available) && available,
            })
            .OrderBy(r => r.DisplayName, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static GraphMeetingRoomDto ParseMeetingRoom(JsonElement item)
    {
        var email = ReadEmailAddress(item);

        var displayName = item.TryGetProperty("displayName", out var nameEl) && nameEl.ValueKind == JsonValueKind.String
            ? nameEl.GetString() ?? email
            : email;

        string? building = null;
        if (item.TryGetProperty("building", out var buildingEl) && buildingEl.ValueKind == JsonValueKind.String)
            building = buildingEl.GetString();

        int? capacity = null;
        if (item.TryGetProperty("capacity", out var capacityEl) && capacityEl.ValueKind == JsonValueKind.Number
            && capacityEl.TryGetInt32(out var cap))
            capacity = cap;

        return new GraphMeetingRoomDto
        {
            Email = email.Trim(),
            DisplayName = string.IsNullOrWhiteSpace(displayName) ? email.Trim() : displayName.Trim(),
            Building = string.IsNullOrWhiteSpace(building) ? null : building.Trim(),
            Capacity = capacity,
        };
    }

    private static string ReadEmailAddress(JsonElement item)
    {
        if (!item.TryGetProperty("emailAddress", out var emailNode))
            return "";

        if (emailNode.ValueKind == JsonValueKind.String)
            return emailNode.GetString() ?? "";

        if (emailNode.ValueKind == JsonValueKind.Object
            && emailNode.TryGetProperty("address", out var addressEl)
            && addressEl.ValueKind == JsonValueKind.String)
            return addressEl.GetString() ?? "";

        return "";
    }

    private static async Task<IReadOnlyDictionary<string, bool>> FetchRoomAvailabilityBatchAsync(
        HttpClient http,
        string token,
        string organizerUpn,
        IEnumerable<string> roomEmails,
        DateTime startUtc,
        DateTime endUtc,
        CancellationToken ct)
    {
        var schedules = roomEmails
            .Where(e => !string.IsNullOrWhiteSpace(e))
            .Select(e => e.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (schedules.Length == 0)
            return new Dictionary<string, bool>();

        var startLocal = ToBrazilLocal(startUtc);
        var endLocal = ToBrazilLocal(endUtc);
        var upn = Uri.EscapeDataString(organizerUpn.Trim());
        var url = $"{GraphBaseUrl}/users/{upn}/calendar/getSchedule";

        var payload = JsonSerializer.Serialize(new
        {
            schedules,
            startTime = new
            {
                dateTime = startLocal.ToString("yyyy-MM-ddTHH:mm:ss"),
                timeZone = BrazilTimeZoneId,
            },
            endTime = new
            {
                dateTime = endLocal.ToString("yyyy-MM-ddTHH:mm:ss"),
                timeZone = BrazilTimeZoneId,
            },
            availabilityViewInterval = 15,
        }, JsonWriteOptions);

        using var req = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(payload, Encoding.UTF8, "application/json"),
        };
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var resp = await http.SendAsync(req, ct);
        var body = await resp.Content.ReadAsStringAsync(ct);
        if (!resp.IsSuccessStatusCode)
            throw new InvalidOperationException(
                $"Não foi possível consultar disponibilidade de salas ({(int)resp.StatusCode}): {TrimGraphError(body)}");

        var result = schedules.ToDictionary(s => s, _ => false, StringComparer.OrdinalIgnoreCase);
        using var doc = JsonDocument.Parse(body);
        if (!doc.RootElement.TryGetProperty("value", out var value) || value.ValueKind != JsonValueKind.Array)
            return result;

        foreach (var item in value.EnumerateArray())
        {
            var scheduleId = item.TryGetProperty("scheduleId", out var scheduleEl)
                ? scheduleEl.GetString() ?? ""
                : "";
            if (string.IsNullOrWhiteSpace(scheduleId))
                continue;

            var availabilityView = item.TryGetProperty("availabilityView", out var viewEl)
                ? viewEl.GetString()
                : null;

            result[scheduleId.Trim()] = IsAvailabilityViewFree(availabilityView);
        }

        return result;
    }

    private static bool IsAvailabilityViewFree(string? availabilityView)
    {
        if (string.IsNullOrWhiteSpace(availabilityView))
            return false;

        // 0 = livre; demais códigos indicam indisponibilidade parcial ou total.
        return availabilityView.All(static c => c == '0');
    }

    private static GraphCalendarEventCreateResult ParseCreateResponse(string body)
    {
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;
        var id = root.TryGetProperty("id", out var idEl) ? idEl.GetString() ?? "" : "";
        var joinUrl = root.TryGetProperty("onlineMeeting", out var om)
                      && om.TryGetProperty("joinUrl", out var ju)
            ? ju.GetString()
            : null;
        var webLink = root.TryGetProperty("webLink", out var wl) ? wl.GetString() : null;
        return new GraphCalendarEventCreateResult(id, joinUrl, webLink);
    }

    private static async Task<(string? JoinUrl, string? WebLink)> FetchEventMeetingLinksAsync(
        HttpClient http,
        string token,
        string userUpn,
        string graphEventId,
        CancellationToken ct)
    {
        var upn = Uri.EscapeDataString(userUpn.Trim());
        var eventId = Uri.EscapeDataString(graphEventId.Trim());
        var url =
            $"{GraphBaseUrl}/users/{upn}/events/{eventId}?$select=onlineMeeting,webLink";

        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var resp = await http.SendAsync(req, ct);
        var body = await resp.Content.ReadAsStringAsync(ct);
        if (!resp.IsSuccessStatusCode)
            return (null, null);

        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;
        var joinUrl = root.TryGetProperty("onlineMeeting", out var om)
                      && om.TryGetProperty("joinUrl", out var ju)
            ? ju.GetString()
            : null;
        var webLink = root.TryGetProperty("webLink", out var wl) ? wl.GetString() : null;
        return (joinUrl, webLink);
    }

    private async Task<HashSet<string>> GetLinkedGraphEventIdsAsync(CancellationToken ct)
    {
        var ids = await _db.AgendaEvents.AsNoTracking()
            .Where(e => e.GraphCalendarEventId != null && e.GraphCalendarEventId != "")
            .Select(e => e.GraphCalendarEventId!)
            .ToListAsync(ct);

        return ids.ToHashSet(StringComparer.Ordinal);
    }

    private static string StripGraphPrefix(string graphPrefixedId)
    {
        const string prefix = "graph:";
        return graphPrefixedId.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
            ? graphPrefixedId[prefix.Length..]
            : graphPrefixedId;
    }

    private static string BuildEventJson(GraphCalendarEventWriteRequest request)
    {
        var startLocal = ToBrazilLocal(request.StartAtUtc);
        var endLocal = ToBrazilLocal(request.EndAtUtc);

        if (request.AllDay)
        {
            var allDayPayload = new Dictionary<string, object?>
            {
                ["subject"] = request.Subject,
                ["body"] = new { contentType = "text", content = request.Body ?? string.Empty },
                ["start"] = new { dateTime = startLocal.ToString("yyyy-MM-dd"), timeZone = BrazilTimeZoneId },
                ["end"] = new { dateTime = endLocal.ToString("yyyy-MM-dd"), timeZone = BrazilTimeZoneId },
                ["isAllDay"] = true,
            };

            if (!string.IsNullOrWhiteSpace(request.Location))
                allDayPayload["location"] = new { displayName = request.Location };

            return JsonSerializer.Serialize(allDayPayload, JsonWriteOptions);
        }

        var payload = new Dictionary<string, object?>
        {
            ["subject"] = request.Subject,
            ["body"] = new { contentType = "text", content = request.Body ?? string.Empty },
            ["start"] = new { dateTime = startLocal.ToString("yyyy-MM-ddTHH:mm:ss"), timeZone = BrazilTimeZoneId },
            ["end"] = new { dateTime = endLocal.ToString("yyyy-MM-ddTHH:mm:ss"), timeZone = BrazilTimeZoneId },
            ["isAllDay"] = false,
        };

        if (!string.IsNullOrWhiteSpace(request.Location))
            payload["location"] = new { displayName = request.Location };

        if (request.IsOnlineMeeting)
        {
            payload["isOnlineMeeting"] = true;
            payload["onlineMeetingProvider"] = "teamsForBusiness";
        }

        if (!string.IsNullOrWhiteSpace(request.RoomEmail))
        {
            payload["attendees"] = new[]
            {
                new
                {
                    emailAddress = new
                    {
                        address = request.RoomEmail.Trim(),
                        name = string.IsNullOrWhiteSpace(request.RoomDisplayName)
                            ? request.RoomEmail.Trim()
                            : request.RoomDisplayName.Trim(),
                    },
                    type = "resource",
                },
            };
        }

        return JsonSerializer.Serialize(payload, JsonWriteOptions);
    }

    private static DateTime ToBrazilLocal(DateTime utc)
    {
        var normalized = utc.Kind == DateTimeKind.Utc
            ? utc
            : DateTime.SpecifyKind(utc, DateTimeKind.Utc);
        var tz = TimeZoneInfo.FindSystemTimeZoneById("E. South America Standard Time");
        return TimeZoneInfo.ConvertTimeFromUtc(normalized, tz);
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
