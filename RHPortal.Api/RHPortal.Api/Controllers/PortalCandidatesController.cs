using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using Microsoft.Extensions.Hosting;
using RhPortal.Api.Application.Candidatos;
using RhPortal.Api.Contracts.Portal;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/public/portal-candidates")]
public sealed class PortalCandidatesController : ControllerBase
{
    private readonly IStringLocalizer<ControllerMessages> _localizer;

    public PortalCandidatesController(IStringLocalizer<ControllerMessages> localizer)
    {
        _localizer = localizer;
    }

    public sealed class PortalCandidateUploadFileInput
    {
        public IFormFile? Arquivo { get; set; }
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<PortalCandidateProfileResponse>> GetProfile(
        Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var candidate = await db.Candidatos
            .AsNoTracking()
            .Include(c => c.Documentos)
            .FirstOrDefaultAsync(c => c.Id == id, ct);

        if (candidate is null)
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        var curriculo = candidate.Documentos
            .Where(d => d.Tipo == CandidateDocumentType.Curriculo)
            .OrderByDescending(d => d.CreatedAtUtc)
            .Select(d => new PortalCandidateDocumentoSummary(d.Id, d.NomeArquivo, d.CreatedAtUtc))
            .FirstOrDefault();

        return Ok(new PortalCandidateProfileResponse(
            candidate.Id,
            candidate.Nome,
            candidate.Email,
            candidate.Fone,
            candidate.Cidade,
            candidate.Uf,
            candidate.LinkedinUrl,
            candidate.ResumoProfissional,
            string.IsNullOrWhiteSpace(candidate.AvatarFileName) ? null : BuildAvatarUrl(candidate.Id),
            curriculo
        ));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<PortalCandidateProfileResponse>> UpdateProfile(
        Guid id,
        [FromBody] PortalCandidateProfileUpdateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var candidate = await db.Candidatos
            .FirstOrDefaultAsync(c => c.Id == id, ct);

        if (candidate is null)
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        candidate.Nome = (request.Nome ?? string.Empty).Trim();
        candidate.Fone = NormalizeRequired(request.Fone);
        candidate.Cidade = NormalizeRequired(request.Cidade);
        candidate.Uf = NormalizeUfRequired(request.Uf);
        candidate.LinkedinUrl = NormalizeOptional(request.LinkedinUrl);
        candidate.ResumoProfissional = NormalizeOptional(request.ResumoProfissional);

        await db.SaveChangesAsync(ct);

        var curriculo = await db.CandidatoDocumentos
            .AsNoTracking()
            .Where(d => d.CandidatoId == candidate.Id && d.Tipo == CandidateDocumentType.Curriculo)
            .OrderByDescending(d => d.CreatedAtUtc)
            .Select(d => new PortalCandidateDocumentoSummary(d.Id, d.NomeArquivo, d.CreatedAtUtc))
            .FirstOrDefaultAsync(ct);

        return Ok(new PortalCandidateProfileResponse(
            candidate.Id,
            candidate.Nome,
            candidate.Email,
            candidate.Fone,
            candidate.Cidade,
            candidate.Uf,
            candidate.LinkedinUrl,
            candidate.ResumoProfissional,
            string.IsNullOrWhiteSpace(candidate.AvatarFileName) ? null : BuildAvatarUrl(candidate.Id),
            curriculo
        ));
    }

    [HttpGet("{id:guid}/skills-portfolio")]
    public async Task<ActionResult<PortalCandidateSkillsPortfolioResponse>> GetSkillsPortfolio(
        Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!await CandidateExistsAsync(db, id, ct))
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        var skills = await db.CandidatoCompetencias
            .AsNoTracking()
            .Where(x => x.CandidatoId == id)
            .OrderBy(x => x.Nome)
            .Select(x => new PortalCandidateSkillDto(x.Id, x.Tipo, x.Nome, x.Nivel, x.Evidencia))
            .ToListAsync(ct);

        var certs = await db.CandidatoCertificacoes
            .AsNoTracking()
            .Where(x => x.CandidatoId == id)
            .OrderByDescending(x => x.Ano)
            .ThenBy(x => x.Nome)
            .Select(x => new PortalCandidateCertificationDto(x.Id, x.Nome, x.Instituicao, x.Ano, x.Link))
            .ToListAsync(ct);

        var portfolio = await db.CandidatoPortfolios
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.CandidatoId == id, ct);

        var links = new PortalCandidatePortfolioLinksDto(
            portfolio?.Linkedin,
            portfolio?.Github,
            portfolio?.Portfolio,
            portfolio?.Drive);

        var prefs = new PortalCandidatePortfolioPrefsDto(
            portfolio?.WorkModel,
            portfolio?.Availability,
            portfolio?.Salary,
            portfolio?.Shift,
            portfolio?.Note);

        return Ok(new PortalCandidateSkillsPortfolioResponse(skills, certs, links, prefs));
    }

    [HttpPut("{id:guid}/skills-portfolio")]
    public async Task<ActionResult<PortalCandidatePortfolioResponse>> UpdateSkillsPortfolio(
        Guid id,
        [FromBody] PortalCandidatePortfolioUpdateRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        if (!await CandidateExistsAsync(db, id, ct))
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        var portfolio = await db.CandidatoPortfolios
            .FirstOrDefaultAsync(x => x.CandidatoId == id, ct);

        if (portfolio is null)
        {
            portfolio = new CandidatoPortfolio
            {
                Id = Guid.NewGuid(),
                CandidatoId = id
            };
            db.CandidatoPortfolios.Add(portfolio);
        }

        portfolio.WorkModel = NormalizeOptional(request.WorkModel);
        portfolio.Availability = NormalizeOptional(request.Availability);
        portfolio.Salary = NormalizeOptional(request.Salary);
        portfolio.Shift = NormalizeOptional(request.Shift);
        portfolio.Note = NormalizeOptional(request.Note);
        portfolio.Linkedin = NormalizeOptional(request.Linkedin);
        portfolio.Github = NormalizeOptional(request.Github);
        portfolio.Portfolio = NormalizeOptional(request.Portfolio);
        portfolio.Drive = NormalizeOptional(request.Drive);

        await db.SaveChangesAsync(ct);

        var links = new PortalCandidatePortfolioLinksDto(
            portfolio.Linkedin,
            portfolio.Github,
            portfolio.Portfolio,
            portfolio.Drive);

        var prefs = new PortalCandidatePortfolioPrefsDto(
            portfolio.WorkModel,
            portfolio.Availability,
            portfolio.Salary,
            portfolio.Shift,
            portfolio.Note);

        return Ok(new PortalCandidatePortfolioResponse(links, prefs));
    }

    [HttpPost("{id:guid}/skills-portfolio/skills")]
    public async Task<ActionResult<PortalCandidateSkillDto>> CreateSkill(
        Guid id,
        [FromBody] PortalCandidateSkillRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        if (!await CandidateExistsAsync(db, id, ct))
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        var entity = new CandidatoCompetencia
        {
            Id = Guid.NewGuid(),
            CandidatoId = id,
            Tipo = NormalizeRequired(request.Tipo),
            Nome = NormalizeRequired(request.Nome),
            Nivel = NormalizeRequired(request.Nivel),
            Evidencia = NormalizeOptional(request.Evidencia)
        };

        db.CandidatoCompetencias.Add(entity);
        await db.SaveChangesAsync(ct);

        return Ok(new PortalCandidateSkillDto(entity.Id, entity.Tipo, entity.Nome, entity.Nivel, entity.Evidencia));
    }

    [HttpPut("{id:guid}/skills-portfolio/skills/{skillId:guid}")]
    public async Task<ActionResult<PortalCandidateSkillDto>> UpdateSkill(
        Guid id,
        Guid skillId,
        [FromBody] PortalCandidateSkillRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var entity = await db.CandidatoCompetencias
            .FirstOrDefaultAsync(x => x.Id == skillId && x.CandidatoId == id, ct);

        if (entity is null)
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        entity.Tipo = NormalizeRequired(request.Tipo);
        entity.Nome = NormalizeRequired(request.Nome);
        entity.Nivel = NormalizeRequired(request.Nivel);
        entity.Evidencia = NormalizeOptional(request.Evidencia);

        await db.SaveChangesAsync(ct);

        return Ok(new PortalCandidateSkillDto(entity.Id, entity.Tipo, entity.Nome, entity.Nivel, entity.Evidencia));
    }

    [HttpDelete("{id:guid}/skills-portfolio/skills/{skillId:guid}")]
    public async Task<IActionResult> DeleteSkill(
        Guid id,
        Guid skillId,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.CandidatoCompetencias
            .FirstOrDefaultAsync(x => x.Id == skillId && x.CandidatoId == id, ct);

        if (entity is null)
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        db.CandidatoCompetencias.Remove(entity);
        await db.SaveChangesAsync(ct);

        return NoContent();
    }

    [HttpPost("{id:guid}/skills-portfolio/certifications")]
    public async Task<ActionResult<PortalCandidateCertificationDto>> CreateCertification(
        Guid id,
        [FromBody] PortalCandidateCertificationRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        if (!await CandidateExistsAsync(db, id, ct))
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        var entity = new CandidatoCertificacao
        {
            Id = Guid.NewGuid(),
            CandidatoId = id,
            Nome = NormalizeRequired(request.Nome),
            Instituicao = NormalizeOptional(request.Instituicao),
            Ano = NormalizeOptional(request.Ano),
            Link = NormalizeOptional(request.Link)
        };

        db.CandidatoCertificacoes.Add(entity);
        await db.SaveChangesAsync(ct);

        return Ok(new PortalCandidateCertificationDto(entity.Id, entity.Nome, entity.Instituicao, entity.Ano, entity.Link));
    }

    [HttpPut("{id:guid}/skills-portfolio/certifications/{certId:guid}")]
    public async Task<ActionResult<PortalCandidateCertificationDto>> UpdateCertification(
        Guid id,
        Guid certId,
        [FromBody] PortalCandidateCertificationRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var entity = await db.CandidatoCertificacoes
            .FirstOrDefaultAsync(x => x.Id == certId && x.CandidatoId == id, ct);

        if (entity is null)
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        entity.Nome = NormalizeRequired(request.Nome);
        entity.Instituicao = NormalizeOptional(request.Instituicao);
        entity.Ano = NormalizeOptional(request.Ano);
        entity.Link = NormalizeOptional(request.Link);

        await db.SaveChangesAsync(ct);

        return Ok(new PortalCandidateCertificationDto(entity.Id, entity.Nome, entity.Instituicao, entity.Ano, entity.Link));
    }

    [HttpDelete("{id:guid}/skills-portfolio/certifications/{certId:guid}")]
    public async Task<IActionResult> DeleteCertification(
        Guid id,
        Guid certId,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.CandidatoCertificacoes
            .FirstOrDefaultAsync(x => x.Id == certId && x.CandidatoId == id, ct);

        if (entity is null)
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        db.CandidatoCertificacoes.Remove(entity);
        await db.SaveChangesAsync(ct);

        return NoContent();
    }

    [HttpGet("{id:guid}/education")]
    public async Task<ActionResult<PortalCandidateEducationResponse>> GetEducation(
        Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!await CandidateExistsAsync(db, id, ct))
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        var summary = await db.CandidatoEducacaoResumos
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.CandidatoId == id, ct);

        var items = await db.CandidatoEducacaoItens
            .AsNoTracking()
            .Where(x => x.CandidatoId == id)
            .OrderByDescending(x => x.Fim)
            .ThenByDescending(x => x.Inicio)
            .ThenBy(x => x.Curso)
            .Select(x => new PortalCandidateEducationItemDto(
                x.Id,
                x.Curso,
                x.Instituicao,
                x.Tipo,
                x.Status,
                x.Inicio,
                x.Fim,
                x.Observacoes,
                x.Link))
            .ToListAsync(ct);

        var summaryDto = new PortalCandidateEducationSummaryDto(
            summary?.Nivel,
            summary?.AreaPrincipal,
            summary?.Situacao,
            summary?.Destaques);

        return Ok(new PortalCandidateEducationResponse(summaryDto, items));
    }

    [HttpPut("{id:guid}/education")]
    public async Task<ActionResult<PortalCandidateEducationSummaryDto>> UpdateEducationSummary(
        Guid id,
        [FromBody] PortalCandidateEducationSummaryRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        if (!await CandidateExistsAsync(db, id, ct))
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        var summary = await db.CandidatoEducacaoResumos
            .FirstOrDefaultAsync(x => x.CandidatoId == id, ct);

        if (summary is null)
        {
            summary = new CandidatoEducacaoResumo
            {
                Id = Guid.NewGuid(),
                CandidatoId = id
            };
            db.CandidatoEducacaoResumos.Add(summary);
        }

        summary.Nivel = NormalizeOptional(request.Nivel);
        summary.AreaPrincipal = NormalizeOptional(request.AreaPrincipal);
        summary.Situacao = NormalizeOptional(request.Situacao);
        summary.Destaques = NormalizeOptional(request.Destaques);

        await db.SaveChangesAsync(ct);

        return Ok(new PortalCandidateEducationSummaryDto(
            summary.Nivel,
            summary.AreaPrincipal,
            summary.Situacao,
            summary.Destaques));
    }

    [HttpPost("{id:guid}/education/items")]
    public async Task<ActionResult<PortalCandidateEducationItemDto>> CreateEducationItem(
        Guid id,
        [FromBody] PortalCandidateEducationItemRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        if (!await CandidateExistsAsync(db, id, ct))
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        var entity = new CandidatoEducacaoItem
        {
            Id = Guid.NewGuid(),
            CandidatoId = id,
            Curso = NormalizeRequired(request.Curso),
            Instituicao = NormalizeOptional(request.Instituicao),
            Tipo = NormalizeOptional(request.Tipo),
            Status = NormalizeOptional(request.Status),
            Inicio = NormalizeOptional(request.Inicio),
            Fim = NormalizeOptional(request.Fim),
            Observacoes = NormalizeOptional(request.Observacoes),
            Link = NormalizeOptional(request.Link)
        };

        db.CandidatoEducacaoItens.Add(entity);
        await db.SaveChangesAsync(ct);

        return Ok(new PortalCandidateEducationItemDto(
            entity.Id,
            entity.Curso,
            entity.Instituicao,
            entity.Tipo,
            entity.Status,
            entity.Inicio,
            entity.Fim,
            entity.Observacoes,
            entity.Link));
    }

    [HttpPut("{id:guid}/education/items/{itemId:guid}")]
    public async Task<ActionResult<PortalCandidateEducationItemDto>> UpdateEducationItem(
        Guid id,
        Guid itemId,
        [FromBody] PortalCandidateEducationItemRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var entity = await db.CandidatoEducacaoItens
            .FirstOrDefaultAsync(x => x.Id == itemId && x.CandidatoId == id, ct);

        if (entity is null)
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        entity.Curso = NormalizeRequired(request.Curso);
        entity.Instituicao = NormalizeOptional(request.Instituicao);
        entity.Tipo = NormalizeOptional(request.Tipo);
        entity.Status = NormalizeOptional(request.Status);
        entity.Inicio = NormalizeOptional(request.Inicio);
        entity.Fim = NormalizeOptional(request.Fim);
        entity.Observacoes = NormalizeOptional(request.Observacoes);
        entity.Link = NormalizeOptional(request.Link);

        await db.SaveChangesAsync(ct);

        return Ok(new PortalCandidateEducationItemDto(
            entity.Id,
            entity.Curso,
            entity.Instituicao,
            entity.Tipo,
            entity.Status,
            entity.Inicio,
            entity.Fim,
            entity.Observacoes,
            entity.Link));
    }

    [HttpDelete("{id:guid}/education/items/{itemId:guid}")]
    public async Task<IActionResult> DeleteEducationItem(
        Guid id,
        Guid itemId,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.CandidatoEducacaoItens
            .FirstOrDefaultAsync(x => x.Id == itemId && x.CandidatoId == id, ct);

        if (entity is null)
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        db.CandidatoEducacaoItens.Remove(entity);
        await db.SaveChangesAsync(ct);

        return NoContent();
    }

    [HttpPost("{id:guid}/avatar")]
    [RequestSizeLimit(8_388_608)]
    [RequestFormLimits(MultipartBodyLengthLimit = 8_388_608)]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<PortalCandidateAvatarResponse>> UploadAvatar(
        Guid id,
        [FromForm] PortalCandidateUploadFileInput input,
        [FromServices] AppDbContext db,
        [FromServices] ITenantContext tenantContext,
        [FromServices] IHostEnvironment hostEnvironment,
        CancellationToken ct)
    {
        var arquivo = input?.Arquivo;
        if (arquivo is null || arquivo.Length == 0)
            return BadRequest(new { message = _localizer["ControllerErrors.CandidatoDocumentoFileInvalid"] });

        var candidate = await db.Candidatos
            .FirstOrDefaultAsync(c => c.Id == id, ct);

        if (candidate is null)
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        var folder = GetCandidateFolder(hostEnvironment, tenantContext, id);
        Directory.CreateDirectory(folder);

        var extension = Path.GetExtension(arquivo.FileName);
        if (string.IsNullOrWhiteSpace(extension)) extension = ".png";
        var safeExt = new string(extension.Where(c => char.IsLetterOrDigit(c) || c == '.').ToArray());
        if (safeExt.Length > 12) safeExt = safeExt[..12];
        var fileName = $"avatar{safeExt}";
        var filePath = Path.Combine(folder, fileName);

        if (!string.IsNullOrWhiteSpace(candidate.AvatarFileName))
        {
            var oldPath = Path.Combine(folder, candidate.AvatarFileName);
            TryDeleteFile(oldPath);
        }

        await using (var stream = new FileStream(filePath, FileMode.Create, FileAccess.Write, FileShare.None))
        {
            await arquivo.CopyToAsync(stream, ct);
        }

        candidate.AvatarFileName = fileName;
        candidate.AvatarContentType = NormalizeOptional(arquivo.ContentType);
        await db.SaveChangesAsync(ct);

        return Ok(new PortalCandidateAvatarResponse(BuildAvatarUrl(id)));
    }

    [HttpGet("{id:guid}/avatar")]
    public async Task<IActionResult> GetAvatar(
        Guid id,
        [FromServices] AppDbContext db,
        [FromServices] ITenantContext tenantContext,
        [FromServices] IHostEnvironment hostEnvironment,
        CancellationToken ct)
    {
        var candidate = await db.Candidatos
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == id, ct);

        if (candidate is null || string.IsNullOrWhiteSpace(candidate.AvatarFileName))
            return NotFound();

        var folder = GetCandidateFolder(hostEnvironment, tenantContext, id);
        var path = Path.Combine(folder, candidate.AvatarFileName);
        if (!System.IO.File.Exists(path))
            return NotFound();

        var contentType = string.IsNullOrWhiteSpace(candidate.AvatarContentType)
            ? "application/octet-stream"
            : candidate.AvatarContentType;

        return PhysicalFile(path, contentType);
    }

    [HttpPost("{id:guid}/curriculos")]
    [RequestSizeLimit(52_428_800)]
    [RequestFormLimits(MultipartBodyLengthLimit = 52_428_800)]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<PortalCandidateDocumentoSummary>> UploadCurriculo(
        Guid id,
        [FromForm] PortalCandidateUploadFileInput input,
        [FromServices] AppDbContext db,
        [FromServices] ICandidatoService service,
        CancellationToken ct)
    {
        var arquivo = input?.Arquivo;
        if (arquivo is null || arquivo.Length == 0)
            return BadRequest(new { message = _localizer["ControllerErrors.CandidatoDocumentoFileInvalid"] });

        var existing = await db.CandidatoDocumentos
            .Where(d => d.CandidatoId == id && d.Tipo == CandidateDocumentType.Curriculo)
            .Select(d => d.Id)
            .ToListAsync(ct);

        foreach (var docId in existing)
        {
            await service.DeleteDocumentoAsync(id, docId, ct);
        }

        var created = await service.AddDocumentoAsync(id, CandidateDocumentType.Curriculo, "Curriculo", arquivo, ct);
        if (created is null)
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        return Ok(new PortalCandidateDocumentoSummary(created.Id, created.NomeArquivo, created.CreatedAtUtc));
    }

    [HttpGet("{id:guid}/curriculos/{documentoId:guid}/download")]
    public async Task<IActionResult> DownloadCurriculo(
        Guid id,
        Guid documentoId,
        [FromServices] ICandidatoService service,
        CancellationToken ct)
    {
        var file = await service.GetDocumentoFileAsync(id, documentoId, ct);
        if (file is null) return NotFound();

        var contentType = string.IsNullOrWhiteSpace(file.ContentType)
            ? "application/octet-stream"
            : file.ContentType;

        return PhysicalFile(file.FilePath, contentType, file.FileName);
    }

    private static string NormalizeUfRequired(string? uf)
        => (uf ?? string.Empty).Trim().ToUpperInvariant();

    private static string NormalizeRequired(string? value)
        => (value ?? string.Empty).Trim();

    private static string? NormalizeOptional(string? value)
    {
        var trimmed = (value ?? string.Empty).Trim();
        return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed;
    }

    private async Task<bool> CandidateExistsAsync(AppDbContext db, Guid id, CancellationToken ct)
        => await db.Candidatos.AnyAsync(x => x.Id == id, ct);

    private static string BuildAvatarUrl(Guid candidatoId)
        => $"/api/public/portal-candidates/{candidatoId}/avatar";

    private static string GetCandidateFolder(IHostEnvironment hostEnvironment, ITenantContext tenantContext, Guid candidatoId)
    {
        return Path.Combine(
            hostEnvironment.ContentRootPath,
            "App_Data",
            "uploads",
            tenantContext.TenantId,
            "candidatos",
            candidatoId.ToString("N"));
    }

    private static void TryDeleteFile(string filePath)
    {
        try
        {
            if (System.IO.File.Exists(filePath))
                System.IO.File.Delete(filePath);
        }
        catch
        {
            // ignore
        }
    }
}
