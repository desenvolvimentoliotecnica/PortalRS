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

    public AdmissaoPortalController(IAdmissaoPortalService service)
    {
        _service = service;
    }

    private string? GetCpf() => Request.Headers.TryGetValue("X-Cpf", out var v) ? v.ToString() : null;

    /// <summary>Blip: retorna todos os documentos vinculados ao candidato pelo CPF ou Telefone.</summary>
    [HttpGet("blip/documentos")]
    [ProducesResponseType(typeof(BlipDocumentosResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetDocumentosBlip(
        [FromQuery] string? cpf, [FromQuery] string? telefone, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(cpf) && string.IsNullOrWhiteSpace(telefone))
            return BadRequest(new { message = "Informe cpf ou telefone." });

        var result = await _service.GetDocumentosByIdentificadorAsync(cpf, telefone, ct);
        return result is null
            ? NotFound(new { message = "Nenhuma admissão ativa encontrada para o identificador informado." })
            : Ok(result);
    }

    /// <summary>Blip: candidato envia um documento (base64). Retorna a lista atualizada de pendentes.</summary>
    [HttpPost("blip/documentos")]
    [ProducesResponseType(typeof(BlipDocumentosResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [RequestSizeLimit(15 * 1024 * 1024)]
    public async Task<IActionResult> PostDocumentoBlip(
        [FromBody] BlipUploadDocumentoRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Cpf))
            return BadRequest(new { message = "CPF obrigatório." });
        if (string.IsNullOrWhiteSpace(request.Base64))
            return BadRequest(new { message = "Base64 do documento obrigatório." });

        var result = await _service.UploadDocBlipAsync(request, ct);
        return result is null
            ? NotFound(new { message = "Nenhuma admissão ativa encontrada para o CPF informado." })
            : Ok(result);
    }

    /// <summary>
    /// Blip: valida um documento a partir de uma URL pública (ex: mídia do WhatsApp).
    /// A API baixa o arquivo, converte para base64 e valida com GPT-4o.
    /// Retorna 200 se válido, 400 se inválido (com mensagem clara), 404 se CPF não encontrado.
    /// </summary>
    [HttpPost("blip/documentos/validar")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ValidarDocumentoBlip(
        [FromBody] BlipValidarDocumentoRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Cpf))
            return BadRequest(new { mensagem = "CPF obrigatório." });
        if (string.IsNullOrWhiteSpace(request.UrlArquivo))
            return BadRequest(new { mensagem = "URL do arquivo obrigatória." });

        var (httpStatus, mensagem) = await _service.ValidarDocumentoBlipAsync(request, ct);

        return httpStatus switch
        {
            200 => Ok(new { mensagem }),
            404 => NotFound(new { mensagem }),
            _   => BadRequest(new { mensagem })
        };
    }

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
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<IActionResult> UploadDocumento(
        Guid preAdmissaoId, [FromForm] PortalUploadDocumentoRequest request, CancellationToken ct)
    {
        var cpf = GetCpf();
        if (string.IsNullOrWhiteSpace(cpf)) return Unauthorized(new { message = "Header X-Cpf obrigatório." });

        var ext = Path.GetExtension(request.File.FileName).ToLower();
        if (ext is not (".pdf" or ".jpg" or ".jpeg" or ".png"))
            return BadRequest(new { message = "Tipo de arquivo não permitido. Use PDF, JPG ou PNG." });

        try
        {
            using var stream = request.File.OpenReadStream();
            var result = await _service.UploadDocAsync(
                preAdmissaoId, cpf, request.Tipo, request.Lado,
                request.File.FileName, request.File.ContentType, request.File.Length, stream, ct);

            return result is null
                ? Unauthorized(new { message = "Acesso negado." })
                : Created("", result);
        }
        catch (InvalidOperationException ex)
        {
            // Configuração de storage ausente (S3 não configurado)
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = ex.Message });
        }
        catch (Exception)
        {
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { message = "Erro ao armazenar o documento. Verifique as configurações de armazenamento (S3)." });
        }
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

    /// <summary>Valida um documento via IA (GPT-4o vision) e extrai campos automaticamente.</summary>
    [HttpPost("{preAdmissaoId:guid}/validate-document")]
    [RequestSizeLimit(15 * 1024 * 1024)]
    [ProducesResponseType(typeof(DocumentValidationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> ValidateDocument(
        Guid preAdmissaoId, [FromBody] DocumentValidationRequest request, CancellationToken ct)
    {
        var cpf = GetCpf();
        if (string.IsNullOrWhiteSpace(cpf)) return Unauthorized(new { message = "Header X-Cpf obrigatório." });
        var result = await _service.ValidateDocumentAsync(preAdmissaoId, cpf, request, ct);
        return result is null ? Unauthorized(new { message = "Acesso negado." }) : Ok(result);
    }

    /// <summary>Lista os dependentes da pré-admissão.</summary>
    [HttpGet("{preAdmissaoId:guid}/dependentes")]
    [ProducesResponseType(typeof(IReadOnlyList<PreAdmissaoDependenteResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> ListDependentes(Guid preAdmissaoId, CancellationToken ct)
    {
        var cpf = GetCpf();
        if (string.IsNullOrWhiteSpace(cpf)) return Unauthorized(new { message = "Header X-Cpf obrigatório." });
        var result = await _service.ListDependentesAsync(preAdmissaoId, cpf, ct);
        return Ok(result);
    }

    /// <summary>Adiciona um dependente à pré-admissão.</summary>
    [HttpPost("{preAdmissaoId:guid}/dependentes")]
    [ProducesResponseType(typeof(PreAdmissaoDependenteResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> AddDependente(
        Guid preAdmissaoId, [FromBody] DependenteCreateRequest request, CancellationToken ct)
    {
        var cpf = GetCpf();
        if (string.IsNullOrWhiteSpace(cpf)) return Unauthorized(new { message = "Header X-Cpf obrigatório." });
        var result = await _service.AddDependenteAsync(preAdmissaoId, cpf, request, ct);
        return result is null ? Unauthorized(new { message = "Acesso negado." }) : Created("", result);
    }

    /// <summary>Atualiza um dependente da pré-admissão.</summary>
    [HttpPut("{preAdmissaoId:guid}/dependentes/{dependenteId:guid}")]
    [ProducesResponseType(typeof(PreAdmissaoDependenteResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> UpdateDependente(
        Guid preAdmissaoId, Guid dependenteId, [FromBody] DependenteUpdateRequest request, CancellationToken ct)
    {
        var cpf = GetCpf();
        if (string.IsNullOrWhiteSpace(cpf)) return Unauthorized(new { message = "Header X-Cpf obrigatório." });
        var result = await _service.UpdateDependenteAsync(preAdmissaoId, cpf, dependenteId, request, ct);
        return result is null ? Unauthorized(new { message = "Acesso negado." }) : Ok(result);
    }

    /// <summary>Remove um dependente da pré-admissão.</summary>
    [HttpDelete("{preAdmissaoId:guid}/dependentes/{dependenteId:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> RemoveDependente(Guid preAdmissaoId, Guid dependenteId, CancellationToken ct)
    {
        var cpf = GetCpf();
        if (string.IsNullOrWhiteSpace(cpf)) return Unauthorized(new { message = "Header X-Cpf obrigatório." });
        return await _service.RemoveDependenteAsync(preAdmissaoId, cpf, dependenteId, ct)
            ? Ok(new { ok = true })
            : Unauthorized(new { message = "Acesso negado." });
    }

    /// <summary>Salva o progresso do wizard (step atual e percentual).</summary>
    [HttpPut("{preAdmissaoId:guid}/wizard-progress")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> SaveWizardProgress(
        Guid preAdmissaoId, [FromBody] WizardProgressRequest request, CancellationToken ct)
    {
        var cpf = GetCpf();
        if (string.IsNullOrWhiteSpace(cpf)) return Unauthorized(new { message = "Header X-Cpf obrigatório." });
        return await _service.SaveWizardProgressAsync(preAdmissaoId, cpf, request.CurrentStep, request.CompletionPercent, ct)
            ? Ok(new { ok = true })
            : Unauthorized(new { message = "Acesso negado." });
    }
}
