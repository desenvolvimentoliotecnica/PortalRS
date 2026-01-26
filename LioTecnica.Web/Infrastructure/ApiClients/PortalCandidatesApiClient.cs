using System.Net.Http.Json;
using System.Text.Json;
using LioTecnica.Web.ViewModels.Portal;
using Microsoft.AspNetCore.Http;

namespace LioTecnica.Web.Infrastructure.ApiClients;

public sealed class PortalCandidatesApiClient
{
    private readonly HttpClient _http;

    public PortalCandidatesApiClient(HttpClient http)
    {
        _http = http;
    }

    public async Task<PortalApiResult<PortalCandidateProfileResponse>> GetProfileAsync(
        string tenantId,
        Guid candidateId,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            return PortalApiResult<PortalCandidateProfileResponse>.Fail(System.Net.HttpStatusCode.BadRequest, "Tenant nao informado.");

        var url = $"api/public/portal-candidates/{candidateId}?tenantId={Uri.EscapeDataString(tenantId)}";
        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);

        using var res = await _http.SendAsync(req, ct);
        if (res.IsSuccessStatusCode)
        {
            var data = await res.Content.ReadFromJsonAsync<PortalCandidateProfileResponse>(cancellationToken: ct);
            if (data is not null)
                return PortalApiResult<PortalCandidateProfileResponse>.Ok(data);

            return PortalApiResult<PortalCandidateProfileResponse>.Fail(res.StatusCode, "Resposta invalida da API.");
        }

        var message = await TryReadMessageAsync(res, ct);
        return PortalApiResult<PortalCandidateProfileResponse>.Fail(res.StatusCode, message ?? "Falha ao carregar perfil.");
    }

    public async Task<PortalApiResult<PortalCandidateProfileResponse>> UpdateProfileAsync(
        string tenantId,
        Guid candidateId,
        PortalCandidateProfileUpdateRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            return PortalApiResult<PortalCandidateProfileResponse>.Fail(System.Net.HttpStatusCode.BadRequest, "Tenant nao informado.");

        var url = $"api/public/portal-candidates/{candidateId}?tenantId={Uri.EscapeDataString(tenantId)}";
        using var req = new HttpRequestMessage(HttpMethod.Put, url)
        {
            Content = JsonContent.Create(request)
        };
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);

        using var res = await _http.SendAsync(req, ct);
        if (res.IsSuccessStatusCode)
        {
            var data = await res.Content.ReadFromJsonAsync<PortalCandidateProfileResponse>(cancellationToken: ct);
            if (data is not null)
                return PortalApiResult<PortalCandidateProfileResponse>.Ok(data);

            return PortalApiResult<PortalCandidateProfileResponse>.Fail(res.StatusCode, "Resposta invalida da API.");
        }

        var message = await TryReadMessageAsync(res, ct);
        return PortalApiResult<PortalCandidateProfileResponse>.Fail(res.StatusCode, message ?? "Falha ao atualizar perfil.");
    }

    public async Task<PortalApiResult<PortalCandidateAvatarResponse>> UploadAvatarAsync(
        string tenantId,
        Guid candidateId,
        IFormFile file,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            return PortalApiResult<PortalCandidateAvatarResponse>.Fail(System.Net.HttpStatusCode.BadRequest, "Tenant nao informado.");

        if (file is null || file.Length == 0)
            return PortalApiResult<PortalCandidateAvatarResponse>.Fail(System.Net.HttpStatusCode.BadRequest, "Arquivo invalido.");

        var url = $"api/public/portal-candidates/{candidateId}/avatar?tenantId={Uri.EscapeDataString(tenantId)}";
        using var content = new MultipartFormDataContent();
        using var stream = file.OpenReadStream();
        content.Add(new StreamContent(stream), "arquivo", file.FileName);

        using var req = new HttpRequestMessage(HttpMethod.Post, url) { Content = content };
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);

        using var res = await _http.SendAsync(req, ct);
        if (res.IsSuccessStatusCode)
        {
            var data = await res.Content.ReadFromJsonAsync<PortalCandidateAvatarResponse>(cancellationToken: ct);
            if (data is not null)
                return PortalApiResult<PortalCandidateAvatarResponse>.Ok(data);

            return PortalApiResult<PortalCandidateAvatarResponse>.Fail(res.StatusCode, "Resposta invalida da API.");
        }

        var message = await TryReadMessageAsync(res, ct);
        return PortalApiResult<PortalCandidateAvatarResponse>.Fail(res.StatusCode, message ?? "Falha ao enviar avatar.");
    }

    public async Task<PortalApiResult<PortalCandidateDocumentoSummary>> UploadCurriculoAsync(
        string tenantId,
        Guid candidateId,
        IFormFile file,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            return PortalApiResult<PortalCandidateDocumentoSummary>.Fail(System.Net.HttpStatusCode.BadRequest, "Tenant nao informado.");

        if (file is null || file.Length == 0)
            return PortalApiResult<PortalCandidateDocumentoSummary>.Fail(System.Net.HttpStatusCode.BadRequest, "Arquivo invalido.");

        var url = $"api/public/portal-candidates/{candidateId}/curriculos?tenantId={Uri.EscapeDataString(tenantId)}";
        using var content = new MultipartFormDataContent();
        using var stream = file.OpenReadStream();
        content.Add(new StreamContent(stream), "arquivo", file.FileName);

        using var req = new HttpRequestMessage(HttpMethod.Post, url) { Content = content };
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);

        using var res = await _http.SendAsync(req, ct);
        if (res.IsSuccessStatusCode)
        {
            var data = await res.Content.ReadFromJsonAsync<PortalCandidateDocumentoSummary>(cancellationToken: ct);
            if (data is not null)
                return PortalApiResult<PortalCandidateDocumentoSummary>.Ok(data);

            return PortalApiResult<PortalCandidateDocumentoSummary>.Fail(res.StatusCode, "Resposta invalida da API.");
        }

        var message = await TryReadMessageAsync(res, ct);
        return PortalApiResult<PortalCandidateDocumentoSummary>.Fail(res.StatusCode, message ?? "Falha ao enviar curriculo.");
    }

    public async Task<PortalApiResult<PortalCandidateSkillsPortfolioResponse>> GetSkillsPortfolioAsync(
        string tenantId,
        Guid candidateId,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            return PortalApiResult<PortalCandidateSkillsPortfolioResponse>.Fail(System.Net.HttpStatusCode.BadRequest, "Tenant nao informado.");

        var url = $"api/public/portal-candidates/{candidateId}/skills-portfolio?tenantId={Uri.EscapeDataString(tenantId)}";
        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);

        using var res = await _http.SendAsync(req, ct);
        if (res.IsSuccessStatusCode)
        {
            var data = await res.Content.ReadFromJsonAsync<PortalCandidateSkillsPortfolioResponse>(cancellationToken: ct);
            if (data is not null)
                return PortalApiResult<PortalCandidateSkillsPortfolioResponse>.Ok(data);

            return PortalApiResult<PortalCandidateSkillsPortfolioResponse>.Fail(res.StatusCode, "Resposta invalida da API.");
        }

        var message = await TryReadMessageAsync(res, ct);
        return PortalApiResult<PortalCandidateSkillsPortfolioResponse>.Fail(res.StatusCode, message ?? "Falha ao carregar competencias.");
    }

    public async Task<PortalApiResult<PortalCandidatePortfolioResponse>> UpdateSkillsPortfolioAsync(
        string tenantId,
        Guid candidateId,
        PortalCandidatePortfolioUpdateRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            return PortalApiResult<PortalCandidatePortfolioResponse>.Fail(System.Net.HttpStatusCode.BadRequest, "Tenant nao informado.");

        var url = $"api/public/portal-candidates/{candidateId}/skills-portfolio?tenantId={Uri.EscapeDataString(tenantId)}";
        using var req = new HttpRequestMessage(HttpMethod.Put, url)
        {
            Content = JsonContent.Create(request)
        };
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);

        using var res = await _http.SendAsync(req, ct);
        if (res.IsSuccessStatusCode)
        {
            var data = await res.Content.ReadFromJsonAsync<PortalCandidatePortfolioResponse>(cancellationToken: ct);
            if (data is not null)
                return PortalApiResult<PortalCandidatePortfolioResponse>.Ok(data);

            return PortalApiResult<PortalCandidatePortfolioResponse>.Fail(res.StatusCode, "Resposta invalida da API.");
        }

        var message = await TryReadMessageAsync(res, ct);
        return PortalApiResult<PortalCandidatePortfolioResponse>.Fail(res.StatusCode, message ?? "Falha ao salvar preferencias.");
    }

    public async Task<PortalApiResult<PortalCandidateSkillDto>> CreateSkillAsync(
        string tenantId,
        Guid candidateId,
        PortalCandidateSkillRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            return PortalApiResult<PortalCandidateSkillDto>.Fail(System.Net.HttpStatusCode.BadRequest, "Tenant nao informado.");

        var url = $"api/public/portal-candidates/{candidateId}/skills-portfolio/skills?tenantId={Uri.EscapeDataString(tenantId)}";
        using var req = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = JsonContent.Create(request)
        };
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);

        using var res = await _http.SendAsync(req, ct);
        if (res.IsSuccessStatusCode)
        {
            var data = await res.Content.ReadFromJsonAsync<PortalCandidateSkillDto>(cancellationToken: ct);
            if (data is not null)
                return PortalApiResult<PortalCandidateSkillDto>.Ok(data);

            return PortalApiResult<PortalCandidateSkillDto>.Fail(res.StatusCode, "Resposta invalida da API.");
        }

        var message = await TryReadMessageAsync(res, ct);
        return PortalApiResult<PortalCandidateSkillDto>.Fail(res.StatusCode, message ?? "Falha ao salvar competencia.");
    }

    public async Task<PortalApiResult<PortalCandidateSkillDto>> UpdateSkillAsync(
        string tenantId,
        Guid candidateId,
        Guid skillId,
        PortalCandidateSkillRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            return PortalApiResult<PortalCandidateSkillDto>.Fail(System.Net.HttpStatusCode.BadRequest, "Tenant nao informado.");

        var url = $"api/public/portal-candidates/{candidateId}/skills-portfolio/skills/{skillId}?tenantId={Uri.EscapeDataString(tenantId)}";
        using var req = new HttpRequestMessage(HttpMethod.Put, url)
        {
            Content = JsonContent.Create(request)
        };
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);

        using var res = await _http.SendAsync(req, ct);
        if (res.IsSuccessStatusCode)
        {
            var data = await res.Content.ReadFromJsonAsync<PortalCandidateSkillDto>(cancellationToken: ct);
            if (data is not null)
                return PortalApiResult<PortalCandidateSkillDto>.Ok(data);

            return PortalApiResult<PortalCandidateSkillDto>.Fail(res.StatusCode, "Resposta invalida da API.");
        }

        var message = await TryReadMessageAsync(res, ct);
        return PortalApiResult<PortalCandidateSkillDto>.Fail(res.StatusCode, message ?? "Falha ao salvar competencia.");
    }

    public async Task<PortalApiResult<bool>> DeleteSkillAsync(
        string tenantId,
        Guid candidateId,
        Guid skillId,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            return PortalApiResult<bool>.Fail(System.Net.HttpStatusCode.BadRequest, "Tenant nao informado.");

        var url = $"api/public/portal-candidates/{candidateId}/skills-portfolio/skills/{skillId}?tenantId={Uri.EscapeDataString(tenantId)}";
        using var req = new HttpRequestMessage(HttpMethod.Delete, url);
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);

        using var res = await _http.SendAsync(req, ct);
        if (res.IsSuccessStatusCode)
            return PortalApiResult<bool>.Ok(true);

        var message = await TryReadMessageAsync(res, ct);
        return PortalApiResult<bool>.Fail(res.StatusCode, message ?? "Falha ao remover competencia.");
    }

    public async Task<PortalApiResult<PortalCandidateCertificationDto>> CreateCertificationAsync(
        string tenantId,
        Guid candidateId,
        PortalCandidateCertificationRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            return PortalApiResult<PortalCandidateCertificationDto>.Fail(System.Net.HttpStatusCode.BadRequest, "Tenant nao informado.");

        var url = $"api/public/portal-candidates/{candidateId}/skills-portfolio/certifications?tenantId={Uri.EscapeDataString(tenantId)}";
        using var req = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = JsonContent.Create(request)
        };
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);

        using var res = await _http.SendAsync(req, ct);
        if (res.IsSuccessStatusCode)
        {
            var data = await res.Content.ReadFromJsonAsync<PortalCandidateCertificationDto>(cancellationToken: ct);
            if (data is not null)
                return PortalApiResult<PortalCandidateCertificationDto>.Ok(data);

            return PortalApiResult<PortalCandidateCertificationDto>.Fail(res.StatusCode, "Resposta invalida da API.");
        }

        var message = await TryReadMessageAsync(res, ct);
        return PortalApiResult<PortalCandidateCertificationDto>.Fail(res.StatusCode, message ?? "Falha ao salvar certificacao.");
    }

    public async Task<PortalApiResult<PortalCandidateCertificationDto>> UpdateCertificationAsync(
        string tenantId,
        Guid candidateId,
        Guid certId,
        PortalCandidateCertificationRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            return PortalApiResult<PortalCandidateCertificationDto>.Fail(System.Net.HttpStatusCode.BadRequest, "Tenant nao informado.");

        var url = $"api/public/portal-candidates/{candidateId}/skills-portfolio/certifications/{certId}?tenantId={Uri.EscapeDataString(tenantId)}";
        using var req = new HttpRequestMessage(HttpMethod.Put, url)
        {
            Content = JsonContent.Create(request)
        };
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);

        using var res = await _http.SendAsync(req, ct);
        if (res.IsSuccessStatusCode)
        {
            var data = await res.Content.ReadFromJsonAsync<PortalCandidateCertificationDto>(cancellationToken: ct);
            if (data is not null)
                return PortalApiResult<PortalCandidateCertificationDto>.Ok(data);

            return PortalApiResult<PortalCandidateCertificationDto>.Fail(res.StatusCode, "Resposta invalida da API.");
        }

        var message = await TryReadMessageAsync(res, ct);
        return PortalApiResult<PortalCandidateCertificationDto>.Fail(res.StatusCode, message ?? "Falha ao salvar certificacao.");
    }

    public async Task<PortalApiResult<bool>> DeleteCertificationAsync(
        string tenantId,
        Guid candidateId,
        Guid certId,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            return PortalApiResult<bool>.Fail(System.Net.HttpStatusCode.BadRequest, "Tenant nao informado.");

        var url = $"api/public/portal-candidates/{candidateId}/skills-portfolio/certifications/{certId}?tenantId={Uri.EscapeDataString(tenantId)}";
        using var req = new HttpRequestMessage(HttpMethod.Delete, url);
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);

        using var res = await _http.SendAsync(req, ct);
        if (res.IsSuccessStatusCode)
            return PortalApiResult<bool>.Ok(true);

        var message = await TryReadMessageAsync(res, ct);
        return PortalApiResult<bool>.Fail(res.StatusCode, message ?? "Falha ao remover certificacao.");
    }

    public async Task<PortalApiResult<PortalCandidateEducationResponse>> GetEducationAsync(
        string tenantId,
        Guid candidateId,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            return PortalApiResult<PortalCandidateEducationResponse>.Fail(System.Net.HttpStatusCode.BadRequest, "Tenant nao informado.");

        var url = $"api/public/portal-candidates/{candidateId}/education?tenantId={Uri.EscapeDataString(tenantId)}";
        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);

        using var res = await _http.SendAsync(req, ct);
        if (res.IsSuccessStatusCode)
        {
            var data = await res.Content.ReadFromJsonAsync<PortalCandidateEducationResponse>(cancellationToken: ct);
            if (data is not null)
                return PortalApiResult<PortalCandidateEducationResponse>.Ok(data);

            return PortalApiResult<PortalCandidateEducationResponse>.Fail(res.StatusCode, "Resposta invalida da API.");
        }

        var message = await TryReadMessageAsync(res, ct);
        return PortalApiResult<PortalCandidateEducationResponse>.Fail(res.StatusCode, message ?? "Falha ao carregar formacao.");
    }

    public async Task<PortalApiResult<PortalCandidateEducationSummaryDto>> UpdateEducationSummaryAsync(
        string tenantId,
        Guid candidateId,
        PortalCandidateEducationSummaryRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            return PortalApiResult<PortalCandidateEducationSummaryDto>.Fail(System.Net.HttpStatusCode.BadRequest, "Tenant nao informado.");

        var url = $"api/public/portal-candidates/{candidateId}/education?tenantId={Uri.EscapeDataString(tenantId)}";
        using var req = new HttpRequestMessage(HttpMethod.Put, url)
        {
            Content = JsonContent.Create(request)
        };
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);

        using var res = await _http.SendAsync(req, ct);
        if (res.IsSuccessStatusCode)
        {
            var data = await res.Content.ReadFromJsonAsync<PortalCandidateEducationSummaryDto>(cancellationToken: ct);
            if (data is not null)
                return PortalApiResult<PortalCandidateEducationSummaryDto>.Ok(data);

            return PortalApiResult<PortalCandidateEducationSummaryDto>.Fail(res.StatusCode, "Resposta invalida da API.");
        }

        var message = await TryReadMessageAsync(res, ct);
        return PortalApiResult<PortalCandidateEducationSummaryDto>.Fail(res.StatusCode, message ?? "Falha ao salvar resumo.");
    }

    public async Task<PortalApiResult<PortalCandidateEducationItemDto>> CreateEducationItemAsync(
        string tenantId,
        Guid candidateId,
        PortalCandidateEducationItemRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            return PortalApiResult<PortalCandidateEducationItemDto>.Fail(System.Net.HttpStatusCode.BadRequest, "Tenant nao informado.");

        var url = $"api/public/portal-candidates/{candidateId}/education/items?tenantId={Uri.EscapeDataString(tenantId)}";
        using var req = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = JsonContent.Create(request)
        };
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);

        using var res = await _http.SendAsync(req, ct);
        if (res.IsSuccessStatusCode)
        {
            var data = await res.Content.ReadFromJsonAsync<PortalCandidateEducationItemDto>(cancellationToken: ct);
            if (data is not null)
                return PortalApiResult<PortalCandidateEducationItemDto>.Ok(data);

            return PortalApiResult<PortalCandidateEducationItemDto>.Fail(res.StatusCode, "Resposta invalida da API.");
        }

        var message = await TryReadMessageAsync(res, ct);
        return PortalApiResult<PortalCandidateEducationItemDto>.Fail(res.StatusCode, message ?? "Falha ao salvar formacao.");
    }

    public async Task<PortalApiResult<PortalCandidateEducationItemDto>> UpdateEducationItemAsync(
        string tenantId,
        Guid candidateId,
        Guid itemId,
        PortalCandidateEducationItemRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            return PortalApiResult<PortalCandidateEducationItemDto>.Fail(System.Net.HttpStatusCode.BadRequest, "Tenant nao informado.");

        var url = $"api/public/portal-candidates/{candidateId}/education/items/{itemId}?tenantId={Uri.EscapeDataString(tenantId)}";
        using var req = new HttpRequestMessage(HttpMethod.Put, url)
        {
            Content = JsonContent.Create(request)
        };
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);

        using var res = await _http.SendAsync(req, ct);
        if (res.IsSuccessStatusCode)
        {
            var data = await res.Content.ReadFromJsonAsync<PortalCandidateEducationItemDto>(cancellationToken: ct);
            if (data is not null)
                return PortalApiResult<PortalCandidateEducationItemDto>.Ok(data);

            return PortalApiResult<PortalCandidateEducationItemDto>.Fail(res.StatusCode, "Resposta invalida da API.");
        }

        var message = await TryReadMessageAsync(res, ct);
        return PortalApiResult<PortalCandidateEducationItemDto>.Fail(res.StatusCode, message ?? "Falha ao salvar formacao.");
    }

    public async Task<PortalApiResult<bool>> DeleteEducationItemAsync(
        string tenantId,
        Guid candidateId,
        Guid itemId,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            return PortalApiResult<bool>.Fail(System.Net.HttpStatusCode.BadRequest, "Tenant nao informado.");

        var url = $"api/public/portal-candidates/{candidateId}/education/items/{itemId}?tenantId={Uri.EscapeDataString(tenantId)}";
        using var req = new HttpRequestMessage(HttpMethod.Delete, url);
        req.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);

        using var res = await _http.SendAsync(req, ct);
        if (res.IsSuccessStatusCode)
            return PortalApiResult<bool>.Ok(true);

        var message = await TryReadMessageAsync(res, ct);
        return PortalApiResult<bool>.Fail(res.StatusCode, message ?? "Falha ao remover formacao.");
    }

    private static async Task<string?> TryReadMessageAsync(HttpResponseMessage response, CancellationToken ct)
    {
        var body = await response.Content.ReadAsStringAsync(ct);
        if (string.IsNullOrWhiteSpace(body)) return null;

        try
        {
            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("message", out var msg))
                return msg.GetString();
        }
        catch
        {
            return body;
        }

        return body;
    }
}
