using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.Colaborador;
using RhPortal.Api.Contracts.Colaborador;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Portal do Colaborador — self-service para o funcionário logado.
/// </summary>
[ApiController]
[Route("api/colaborador")]
public sealed class ColaboradorController : ControllerBase
{
    private readonly IColaboradorService _service;
    private readonly ICurrentUserContext _userContext;

    public ColaboradorController(IColaboradorService service, ICurrentUserContext userContext)
    {
        _service = service;
        _userContext = userContext;
    }

    private Guid? TryGetFuncionarioId() => _userContext.FuncionarioId;

    private Guid GetFuncionarioId() =>
        _userContext.FuncionarioId ?? throw new InvalidOperationException("Usuário não possui funcionário vinculado.");

    // ── Perfil ──

    /// <summary>Retorna o perfil do colaborador logado.</summary>
    [HttpGet("perfil")]
    [ProducesResponseType(typeof(ColaboradorPerfilResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPerfil(CancellationToken ct)
    {
        var fid = TryGetFuncionarioId();
        if (fid is null) return NotFound(new { message = "Usuário não possui funcionário vinculado." });
        var perfil = await _service.GetPerfilAsync(fid.Value, ct);
        return perfil is null ? NotFound() : Ok(perfil);
    }

    /// <summary>Atualiza o perfil do colaborador logado.</summary>
    [HttpPut("perfil")]
    [ProducesResponseType(typeof(ColaboradorPerfilResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdatePerfil([FromBody] ColaboradorPerfilUpdateRequest request, CancellationToken ct)
    {
        var fid = TryGetFuncionarioId();
        if (fid is null) return NotFound(new { message = "Usuário não possui funcionário vinculado." });
        var perfil = await _service.UpdatePerfilAsync(fid.Value, request, ct);
        return perfil is null ? NotFound() : Ok(perfil);
    }

    // ── Dependentes ──

    /// <summary>Lista os dependentes do colaborador logado.</summary>
    [HttpGet("dependentes")]
    [ProducesResponseType(typeof(IReadOnlyList<DependenteResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListDependentes(CancellationToken ct)
    {
        var fid = TryGetFuncionarioId();
        if (fid is null) return Ok(Array.Empty<DependenteResponse>());
        return Ok(await _service.ListDependentesAsync(fid.Value, ct));
    }

    /// <summary>Adiciona um dependente.</summary>
    [HttpPost("dependentes")]
    [ProducesResponseType(typeof(DependenteResponse), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateDependente([FromBody] DependenteCreateRequest request, CancellationToken ct)
    {
        var dep = await _service.CreateDependenteAsync(GetFuncionarioId(), request, ct);
        return Created($"/api/colaborador/dependentes/{dep.Id}", dep);
    }

    /// <summary>Edita um dependente.</summary>
    [HttpPut("dependentes/{id:guid}")]
    [ProducesResponseType(typeof(DependenteResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateDependente(Guid id, [FromBody] DependenteUpdateRequest request, CancellationToken ct)
    {
        var dep = await _service.UpdateDependenteAsync(GetFuncionarioId(), id, request, ct);
        return dep is null ? NotFound() : Ok(dep);
    }

    /// <summary>Remove um dependente.</summary>
    [HttpDelete("dependentes/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteDependente(Guid id, CancellationToken ct)
    {
        var ok = await _service.DeleteDependenteAsync(GetFuncionarioId(), id, ct);
        return ok ? NoContent() : NotFound();
    }

    // ── Documentos ──

    /// <summary>Lista os documentos do colaborador logado.</summary>
    [HttpGet("documentos")]
    [ProducesResponseType(typeof(IReadOnlyList<DocumentoResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListDocumentos(CancellationToken ct)
    {
        var fid = TryGetFuncionarioId();
        if (fid is null) return Ok(Array.Empty<DocumentoResponse>());
        return Ok(await _service.ListDocumentosAsync(fid.Value, ct));
    }

    /// <summary>Upload de documento (multipart/form-data).</summary>
    [HttpPost("documentos")]
    [ProducesResponseType(typeof(DocumentoResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [RequestSizeLimit(10 * 1024 * 1024)] // 10 MB
    public async Task<IActionResult> UploadDocumento(
        [FromForm] TipoDocumento tipo,
        IFormFile file,
        CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "Arquivo não enviado." });

        var allowed = new[] { ".pdf", ".jpg", ".jpeg", ".png" };
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!allowed.Contains(ext))
            return BadRequest(new { message = $"Extensão '{ext}' não permitida. Use: {string.Join(", ", allowed)}" });

        using var stream = file.OpenReadStream();
        var doc = await _service.UploadDocumentoAsync(
            GetFuncionarioId(), tipo, file.FileName, file.ContentType, file.Length, stream, ct);
        return Created($"/api/colaborador/documentos/{doc.Id}", doc);
    }

    /// <summary>Remove um documento.</summary>
    [HttpDelete("documentos/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteDocumento(Guid id, CancellationToken ct)
    {
        var ok = await _service.DeleteDocumentoAsync(GetFuncionarioId(), id, ct);
        return ok ? NoContent() : NotFound();
    }

    // ── Senha ──

    /// <summary>Altera a senha do colaborador logado.</summary>
    [HttpPost("senha")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AlterarSenha([FromBody] AlterarSenhaRequest request, CancellationToken ct)
    {
        var userId = _userContext.UserId
            ?? throw new InvalidOperationException("Usuário não autenticado.");

        var result = await _service.AlterarSenhaAsync(userId, request.SenhaAtual, request.NovaSenha, ct);
        if (result.Succeeded)
            return NoContent();

        var errors = result.Errors.Select(e => e.Description).ToList();
        return BadRequest(new { message = string.Join("; ", errors) });
    }

    // ── Avatar ──

    /// <summary>Retorna a foto do colaborador logado.</summary>
    [HttpGet("perfil/avatar")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetAvatar(CancellationToken ct)
    {
        var fid = TryGetFuncionarioId();
        if (fid is null) return NotFound();
        var result = await _service.GetAvatarAsync(fid.Value, ct);
        if (result is null) return NotFound();
        var (stream, contentType, fileName) = result.Value;
        return File(stream, contentType, fileName);
    }

    /// <summary>Upload da foto do colaborador (multipart/form-data).</summary>
    [HttpPost("perfil/avatar")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [RequestSizeLimit(5 * 1024 * 1024)] // 5 MB
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> UploadAvatar(IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "Arquivo não enviado." });

        var allowed = new[] { ".jpg", ".jpeg", ".png", ".webp", ".gif" };
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!allowed.Contains(ext))
            return BadRequest(new { message = $"Extensão '{ext}' não permitida. Use: {string.Join(", ", allowed)}" });

        using var stream = file.OpenReadStream();
        var avatarUrl = await _service.UploadAvatarAsync(GetFuncionarioId(), file.FileName, file.ContentType, stream, ct);
        if (avatarUrl is null) return NotFound();
        return Ok(new { avatarUrl });
    }

    /// <summary>Remove a foto do colaborador logado.</summary>
    [HttpDelete("perfil/avatar")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteAvatar(CancellationToken ct)
    {
        var ok = await _service.DeleteAvatarAsync(GetFuncionarioId(), ct);
        return ok ? NoContent() : NotFound();
    }
}
