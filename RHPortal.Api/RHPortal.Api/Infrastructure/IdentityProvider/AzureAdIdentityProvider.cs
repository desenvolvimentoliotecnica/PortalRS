using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Infrastructure.IdentityProvider;

/// <summary>
/// Integração com Microsoft Graph API (Azure AD / Entra) para operações de off-boarding.
/// Usa HttpClient diretamente (sem SDK) para manter a dependência mínima.
/// Requer App Registration com permissões:
///   - User.EnableDisableAccount.All (application)
///   - Directory.AccessAsUser.All  (application) — para RevokeSignInSessions
/// </summary>
public sealed class AzureAdIdentityProvider : IIdentityProviderService
{
    private const string GraphBaseUrl = "https://graph.microsoft.com/v1.0";
    private const string TokenEndpointTemplate = "https://login.microsoftonline.com/{0}/oauth2/v2.0/token";

    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ICurrentUserContext _currentUser;

    public AzureAdIdentityProvider(
        AppDbContext db,
        ITenantContext tenantContext,
        IHttpClientFactory httpClientFactory,
        ICurrentUserContext currentUser)
    {
        _db = db;
        _tenantContext = tenantContext;
        _httpClientFactory = httpClientFactory;
        _currentUser = currentUser;
    }

    // ── Public interface ──────────────────────────────────

    public Task<IdentityProviderResult> DisableUserAsync(
        string email, Guid funcionarioId, Guid? workflowId, Guid? etapaId, CancellationToken ct)
        => ExecutarAsync(email, funcionarioId, workflowId, etapaId,
            IdentityProviderOperacao.DisableUser, ct,
            async (http, token, userId) =>
            {
                var patch = JsonSerializer.Serialize(new { accountEnabled = false });
                using var req = new HttpRequestMessage(HttpMethod.Patch, $"{GraphBaseUrl}/users/{userId}");
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
                req.Content = new StringContent(patch, Encoding.UTF8, "application/json");
                var resp = await http.SendAsync(req, ct);
                return resp.IsSuccessStatusCode
                    ? null
                    : $"Graph PATCH /users/{userId}: {resp.StatusCode} — {await resp.Content.ReadAsStringAsync(ct)}";
            });

    public Task<IdentityProviderResult> RevokeSessionsAsync(
        string email, Guid funcionarioId, Guid? workflowId, Guid? etapaId, CancellationToken ct)
        => ExecutarAsync(email, funcionarioId, workflowId, etapaId,
            IdentityProviderOperacao.RevokeSessions, ct,
            async (http, token, userId) =>
            {
                using var req = new HttpRequestMessage(HttpMethod.Post, $"{GraphBaseUrl}/users/{userId}/revokeSignInSessions");
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
                req.Content = new StringContent("{}", Encoding.UTF8, "application/json");
                var resp = await http.SendAsync(req, ct);
                return resp.IsSuccessStatusCode
                    ? null
                    : $"Graph POST /revokeSignInSessions: {resp.StatusCode} — {await resp.Content.ReadAsStringAsync(ct)}";
            });

    public Task<IdentityProviderResult> EnableUserAsync(
        string email, Guid funcionarioId, Guid? workflowId, Guid? etapaId, CancellationToken ct)
        => ExecutarAsync(email, funcionarioId, workflowId, etapaId,
            IdentityProviderOperacao.EnableUser, ct,
            async (http, token, userId) =>
            {
                var patch = JsonSerializer.Serialize(new { accountEnabled = true });
                using var req = new HttpRequestMessage(HttpMethod.Patch, $"{GraphBaseUrl}/users/{userId}");
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
                req.Content = new StringContent(patch, Encoding.UTF8, "application/json");
                var resp = await http.SendAsync(req, ct);
                return resp.IsSuccessStatusCode
                    ? null
                    : $"Graph PATCH /users/{userId}: {resp.StatusCode} — {await resp.Content.ReadAsStringAsync(ct)}";
            });

    // ── Private helpers ───────────────────────────────────

    private async Task<IdentityProviderResult> ExecutarAsync(
        string email,
        Guid funcionarioId,
        Guid? workflowId,
        Guid? etapaId,
        IdentityProviderOperacao operacao,
        CancellationToken ct,
        Func<HttpClient, string, string, Task<string?>> graphCall)
    {
        var config = await _db.Set<TenantConfiguracao>()
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.TenantId == _tenantContext.TenantId, ct);

        if (config is null
            || string.IsNullOrWhiteSpace(config.AzureAdTenantId)
            || string.IsNullOrWhiteSpace(config.AzureAdClientId)
            || string.IsNullOrWhiteSpace(config.AzureAdClientSecret))
        {
            throw new IdentityProviderNotConfiguredException();
        }

        string? errorMessage = null;
        bool sucesso;

        try
        {
            var http = _httpClientFactory.CreateClient("AzureAdGraph");
            var token = await ObterTokenAsync(http, config.AzureAdTenantId, config.AzureAdClientId, config.AzureAdClientSecret, ct);
            var userId = await ResolverObjectIdAsync(http, token, email, ct);
            errorMessage = await graphCall(http, token, userId);
            sucesso = errorMessage is null;
        }
        catch (IdentityProviderNotConfiguredException) { throw; }
        catch (Exception ex)
        {
            sucesso = false;
            errorMessage = ex.Message;
        }

        // Audit log (best-effort)
        try
        {
            _db.Set<IdentityProviderAuditLog>().Add(new IdentityProviderAuditLog
            {
                Id = Guid.NewGuid(),
                TenantId = _tenantContext.TenantId ?? "",
                FuncionarioId = funcionarioId,
                Email = email,
                Operacao = operacao,
                Sucesso = sucesso,
                MensagemErro = errorMessage,
                IniciadoPorId = _currentUser.FuncionarioId,
                WorkflowId = workflowId,
                EtapaId = etapaId,
                ExecutadoEmUtc = DateTimeOffset.UtcNow,
            });
            await _db.SaveChangesAsync(ct);
        }
        catch { /* audit failure is non-fatal */ }

        return new IdentityProviderResult(sucesso, errorMessage);
    }

    private static async Task<string> ObterTokenAsync(
        HttpClient http, string tenantId, string clientId, string clientSecret, CancellationToken ct)
    {
        var url = string.Format(TokenEndpointTemplate, tenantId);
        var body = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"]    = "client_credentials",
            ["client_id"]     = clientId,
            ["client_secret"] = clientSecret,
            ["scope"]         = "https://graph.microsoft.com/.default",
        });

        var resp = await http.PostAsync(url, body, ct);
        resp.EnsureSuccessStatusCode();

        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(ct));
        return doc.RootElement.GetProperty("access_token").GetString()
               ?? throw new InvalidOperationException("Azure AD token response missing access_token.");
    }

    private static async Task<string> ResolverObjectIdAsync(
        HttpClient http, string token, string email, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, $"{GraphBaseUrl}/users/{Uri.EscapeDataString(email)}?$select=id");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var resp = await http.SendAsync(req, ct);
        resp.EnsureSuccessStatusCode();

        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(ct));
        return doc.RootElement.GetProperty("id").GetString()
               ?? throw new InvalidOperationException($"Azure AD object ID não encontrado para {email}.");
    }
}
