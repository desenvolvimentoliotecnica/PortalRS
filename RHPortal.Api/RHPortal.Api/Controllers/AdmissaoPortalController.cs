using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.AdmissaoPortal;
using RhPortal.Api.Contracts.AdmissaoPortal;
using RhPortal.Api.Contracts.PreAdmissao;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Portal público de admissão — candidato preenche dados e sobe documentos solicitados pelo RH.
/// Autenticação: X-Tenant-Id (header) + CPF (header X-Cpf ou body).
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("api/public/admissao-portal")]
public sealed class AdmissaoPortalController : ControllerBase
{
    private readonly IAdmissaoPortalService _service;

    public AdmissaoPortalController(IAdmissaoPortalService service) => _service = service;

    private string? GetCpf() => Request.Headers.TryGetValue("X-Cpf", out var v) ? v.ToString() : null;

    /// <summary>Candidato faz login com CPF para acessar o portal de documentos.</summary>
    [HttpPost("login")]
    [ProducesResponseType(typeof(AdmissaoPortalLoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login([FromBody] AdmissaoPortalLoginRequest request, CancellationToken ct)
    {
        var result = await _service.LoginAsync(request, ct);
        return result is null ? Unauthorized(new { message = "CPF não reconhecido ou acesso não liberado." }) : Ok(result);
    }

    /// <summary>Retorna documentos solicitados, documentos já enviados e dados pessoais pré-preenchidos.</summary>
    [HttpGet("{preAdmissaoId:guid}")]
    [ProducesResponseType(typeof(AdmissaoPortalDataResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetData(Guid preAdmissaoId, CancellationToken ct)
    {
        var cpf = GetCpf();
        if (string.IsNullOrWhiteSpace(cpf)) return Unauthorized(new { message = "Header X-Cpf obrigatório." });
        var result = await _service.GetDataAsync(preAdmissaoId, cpf, ct);
        return result is null ? Unauthorized(new { message = "Acesso negado." }) : Ok(result);
    }

    /// <summary>Candidato salva dados pessoais (endereço, bancário, etc.).</summary>
    [HttpPut("{preAdmissaoId:guid}/dados")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> SaveDados(
        Guid preAdmissaoId, [FromBody] PortalSalvarDadosRequest request, CancellationToken ct)
    {
        var cpf = GetCpf();
        if (string.IsNullOrWhiteSpace(cpf)) return Unauthorized(new { message = "Header X-Cpf obrigatório." });
        return await _service.SaveDadosAsync(preAdmissaoId, cpf, request, ct)
            ? Ok(new { ok = true })
            : Unauthorized(new { message = "Acesso negado." });
    }

    /// <summary>Candidato faz upload de um documento solicitado.</summary>
    [HttpPost("{preAdmissaoId:guid}/documentos")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(PreAdmissaoDocumentoResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<IActionResult> UploadDocumento(
        Guid preAdmissaoId, [FromForm] PortalUploadDocumentoRequest request, CancellationToken ct)
    {
        var cpf = GetCpf();
        if (string.IsNullOrWhiteSpace(cpf)) return Unauthorized(new { message = "Header X-Cpf obrigatório." });

        var ext = Path.GetExtension(request.File.FileName).ToLower();
        if (ext is not (".pdf" or ".jpg" or ".jpeg" or ".png"))
            return BadRequest(new { message = "Tipo de arquivo não permitido. Use PDF, JPG ou PNG." });

        using var stream = request.File.OpenReadStream();
        var result = await _service.UploadDocAsync(
            preAdmissaoId, cpf, request.Tipo,
            request.File.FileName, request.File.ContentType, request.File.Length, stream, ct);

        return result is null
            ? Unauthorized(new { message = "Acesso negado." })
            : Created("", result);
    }

    /// <summary>Candidato submete dados e documentos para revisão do RH.</summary>
    [HttpPost("{preAdmissaoId:guid}/submit")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Submit(Guid preAdmissaoId, CancellationToken ct)
    {
        var cpf = GetCpf();
        if (string.IsNullOrWhiteSpace(cpf)) return Unauthorized(new { message = "Header X-Cpf obrigatório." });
        return await _service.SubmitAsync(preAdmissaoId, cpf, ct)
            ? Ok(new { ok = true, message = "Dados enviados para revisão do RH." })
            : BadRequest(new { message = "Não foi possível submeter. Verifique se já foi enviado ou se o acesso está ativo." });
    }
}
