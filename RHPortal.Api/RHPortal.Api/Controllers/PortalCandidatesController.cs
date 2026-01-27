using System.Globalization;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using Microsoft.Extensions.Hosting;
using RhPortal.Api.Application.Candidatos;
using RhPortal.Api.Contracts.Notifications;
using RhPortal.Api.Contracts.Portal;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Notifications;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Perfil do candidato no Portal de Vagas (dados pessoais e secoes do perfil).
/// </summary>
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

    /// <summary>
    /// Consulta o perfil basico do candidato (dados pessoais + curriculo atual).
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(PortalCandidateProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
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

    /// <summary>
    /// Atualiza os dados pessoais do candidato.
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(PortalCandidateProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PortalCandidateProfileResponse>> UpdateProfile(
        Guid id,
        [FromBody] PortalCandidateProfileUpdateRequest request,
        [FromServices] AppDbContext db,
        [FromServices] NotificationPublisher notificationPublisher,
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

        await NotifyProfileUpdatedAsync(db, notificationPublisher, candidate, ct);

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

    /// <summary>
    /// Retorna competencias, certificacoes e links de portfolio do candidato.
    /// </summary>
    [HttpGet("{id:guid}/skills-portfolio")]
    [ProducesResponseType(typeof(PortalCandidateSkillsPortfolioResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
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

        return Ok(new PortalCandidateSkillsPortfolioResponse(skills, certs, links, prefs, portfolio?.Tags));
    }

    /// <summary>
    /// Atualiza preferencias e links do portfolio (sem alterar competencias).
    /// </summary>
    [HttpPut("{id:guid}/skills-portfolio")]
    [ProducesResponseType(typeof(PortalCandidatePortfolioResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
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
        portfolio.Tags = NormalizeOptional(request.Tags);

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

        return Ok(new PortalCandidatePortfolioResponse(links, prefs, portfolio.Tags));
    }

    /// <summary>
    /// Adiciona uma competencia ao candidato.
    /// </summary>
    [HttpPost("{id:guid}/skills-portfolio/skills")]
    [ProducesResponseType(typeof(PortalCandidateSkillDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
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

    /// <summary>
    /// Atualiza uma competencia existente.
    /// </summary>
    [HttpPut("{id:guid}/skills-portfolio/skills/{skillId:guid}")]
    [ProducesResponseType(typeof(PortalCandidateSkillDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
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

    /// <summary>
    /// Remove uma competencia.
    /// </summary>
    [HttpDelete("{id:guid}/skills-portfolio/skills/{skillId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
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

    /// <summary>
    /// Adiciona uma certificacao/curso.
    /// </summary>
    [HttpPost("{id:guid}/skills-portfolio/certifications")]
    [ProducesResponseType(typeof(PortalCandidateCertificationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
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

    /// <summary>
    /// Atualiza uma certificacao/curso.
    /// </summary>
    [HttpPut("{id:guid}/skills-portfolio/certifications/{certId:guid}")]
    [ProducesResponseType(typeof(PortalCandidateCertificationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
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

    /// <summary>
    /// Remove uma certificacao/curso.
    /// </summary>
    [HttpDelete("{id:guid}/skills-portfolio/certifications/{certId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
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

    /// <summary>
    /// Retorna formacao e itens de educacao do candidato.
    /// </summary>
    [HttpGet("{id:guid}/education")]
    [ProducesResponseType(typeof(PortalCandidateEducationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
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

    /// <summary>
    /// Retorna preferencias de vaga/objetivos.
    /// </summary>
    [HttpGet("{id:guid}/preferences")]
    [ProducesResponseType(typeof(PortalCandidatePreferencesResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PortalCandidatePreferencesResponse>> GetPreferences(
        Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!await CandidateExistsAsync(db, id, ct))
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        var prefs = await db.CandidatoPreferenciasVaga
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.CandidatoId == id, ct);

        return Ok(new PortalCandidatePreferencesResponse(
            prefs?.CargoAlvo,
            prefs?.Senioridade,
            prefs?.InicioDisponivel,
            prefs?.Resumo,
            prefs?.AreasInteresse,
            prefs?.ModeloTrabalho,
            prefs?.Jornada,
            prefs?.TipoContrato,
            prefs?.Viagens,
            prefs?.Mudanca,
            prefs?.CidadePreferida,
            prefs?.DistanciaMaxKm,
            prefs?.ObsDeslocamento,
            prefs?.PretensaoSalarial,
            prefs?.PretensaoNegociavel,
            prefs?.BeneficiosDesejados,
            prefs?.NaoAbreMaoDe,
            prefs?.UpdatedAtUtc
        ));
    }

    /// <summary>
    /// Atualiza preferencias de vaga/objetivos.
    /// </summary>
    [HttpPut("{id:guid}/preferences")]
    [ProducesResponseType(typeof(PortalCandidatePreferencesResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PortalCandidatePreferencesResponse>> UpdatePreferences(
        Guid id,
        [FromBody] PortalCandidatePreferencesRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var candidate = await db.Candidatos
            .FirstOrDefaultAsync(c => c.Id == id, ct);

        if (candidate is null)
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        var prefs = await db.CandidatoPreferenciasVaga
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.CandidatoId == id, ct);

        if (prefs is null)
        {
            prefs = new CandidatoPreferenciasVaga
            {
                Id = Guid.NewGuid(),
                TenantId = candidate.TenantId,
                CandidatoId = candidate.Id
            };
            db.CandidatoPreferenciasVaga.Add(prefs);
        }

        prefs.CargoAlvo = NormalizeOptional(request.CargoAlvo);
        prefs.Senioridade = NormalizeOptional(request.Senioridade);
        prefs.InicioDisponivel = NormalizeOptional(request.InicioDisponivel);
        prefs.Resumo = NormalizeOptional(request.Resumo);
        prefs.AreasInteresse = NormalizeOptional(request.AreasInteresse);
        prefs.ModeloTrabalho = NormalizeOptional(request.ModeloTrabalho);
        prefs.Jornada = NormalizeOptional(request.Jornada);
        prefs.TipoContrato = NormalizeOptional(request.TipoContrato);
        prefs.Viagens = NormalizeOptional(request.Viagens);
        prefs.Mudanca = NormalizeOptional(request.Mudanca);
        prefs.CidadePreferida = NormalizeOptional(request.CidadePreferida);
        prefs.DistanciaMaxKm = NormalizeOptional(request.DistanciaMaxKm);
        prefs.ObsDeslocamento = NormalizeOptional(request.ObsDeslocamento);
        prefs.PretensaoSalarial = NormalizeOptional(request.PretensaoSalarial);
        prefs.PretensaoNegociavel = NormalizeOptional(request.PretensaoNegociavel);
        prefs.BeneficiosDesejados = NormalizeOptional(request.BeneficiosDesejados);
        prefs.NaoAbreMaoDe = NormalizeOptional(request.NaoAbreMaoDe);

        await db.SaveChangesAsync(ct);

        return Ok(new PortalCandidatePreferencesResponse(
            prefs.CargoAlvo,
            prefs.Senioridade,
            prefs.InicioDisponivel,
            prefs.Resumo,
            prefs.AreasInteresse,
            prefs.ModeloTrabalho,
            prefs.Jornada,
            prefs.TipoContrato,
            prefs.Viagens,
            prefs.Mudanca,
            prefs.CidadePreferida,
            prefs.DistanciaMaxKm,
            prefs.ObsDeslocamento,
            prefs.PretensaoSalarial,
            prefs.PretensaoNegociavel,
            prefs.BeneficiosDesejados,
            prefs.NaoAbreMaoDe,
            prefs.UpdatedAtUtc
        ));
    }

    /// <summary>
    /// Retorna dados de acessibilidade e inclusao.
    /// </summary>
    [HttpGet("{id:guid}/accessibility")]
    [ProducesResponseType(typeof(PortalCandidateAccessibilityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PortalCandidateAccessibilityDto>> GetAccessibility(
        Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!await CandidateExistsAsync(db, id, ct))
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        var entity = await db.CandidatoAcessibilidades
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.CandidatoId == id, ct);

        return Ok(new PortalCandidateAccessibilityDto(
            entity?.Idioma,
            entity?.Canal,
            entity?.MelhorHorario,
            entity?.ObservacoesComunicacao,
            entity?.PrecisaLegendas ?? false,
            entity?.PrecisaInterprete ?? false,
            entity?.PrecisaLeitorTela ?? false,
            entity?.PrecisaBaixaEstimulo ?? false,
            entity?.PrecisaMobilidade ?? false,
            entity?.PrecisaTempoExtra ?? false,
            entity?.DetalhesNecessidades,
            entity?.ConsentimentoPcd ?? false,
            entity?.PcdIdentificacao,
            entity?.PcdTipo,
            entity?.PcdComprovacao,
            entity?.PcdObservacoes,
            entity?.UpdatedAtUtc ?? DateTimeOffset.MinValue
        ));
    }

    /// <summary>
    /// Atualiza dados de acessibilidade e inclusao.
    /// </summary>
    [HttpPut("{id:guid}/accessibility")]
    [ProducesResponseType(typeof(PortalCandidateAccessibilityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PortalCandidateAccessibilityDto>> UpdateAccessibility(
        Guid id,
        [FromBody] PortalCandidateAccessibilityRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var candidate = await db.Candidatos
            .FirstOrDefaultAsync(c => c.Id == id, ct);
        if (candidate is null)
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        var entity = await db.CandidatoAcessibilidades
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.CandidatoId == id, ct);

        if (entity is null)
        {
            entity = new CandidatoAcessibilidade
            {
                Id = Guid.NewGuid(),
                TenantId = candidate.TenantId,
                CandidatoId = candidate.Id
            };
            db.CandidatoAcessibilidades.Add(entity);
        }

        entity.Idioma = NormalizeOptional(request.Idioma);
        entity.Canal = NormalizeOptional(request.Canal);
        entity.MelhorHorario = NormalizeOptional(request.MelhorHorario);
        entity.ObservacoesComunicacao = NormalizeOptional(request.ObservacoesComunicacao);
        entity.PrecisaLegendas = request.PrecisaLegendas;
        entity.PrecisaInterprete = request.PrecisaInterprete;
        entity.PrecisaLeitorTela = request.PrecisaLeitorTela;
        entity.PrecisaBaixaEstimulo = request.PrecisaBaixaEstimulo;
        entity.PrecisaMobilidade = request.PrecisaMobilidade;
        entity.PrecisaTempoExtra = request.PrecisaTempoExtra;
        entity.DetalhesNecessidades = NormalizeOptional(request.DetalhesNecessidades);
        entity.ConsentimentoPcd = request.ConsentimentoPcd;
        entity.PcdIdentificacao = NormalizeOptional(request.PcdIdentificacao);
        entity.PcdTipo = NormalizeOptional(request.PcdTipo);
        entity.PcdComprovacao = NormalizeOptional(request.PcdComprovacao);
        entity.PcdObservacoes = NormalizeOptional(request.PcdObservacoes);

        await db.SaveChangesAsync(ct);

        return Ok(new PortalCandidateAccessibilityDto(
            entity.Idioma,
            entity.Canal,
            entity.MelhorHorario,
            entity.ObservacoesComunicacao,
            entity.PrecisaLegendas,
            entity.PrecisaInterprete,
            entity.PrecisaLeitorTela,
            entity.PrecisaBaixaEstimulo,
            entity.PrecisaMobilidade,
            entity.PrecisaTempoExtra,
            entity.DetalhesNecessidades,
            entity.ConsentimentoPcd,
            entity.PcdIdentificacao,
            entity.PcdTipo,
            entity.PcdComprovacao,
            entity.PcdObservacoes,
            entity.UpdatedAtUtc
        ));
    }

    /// <summary>
    /// Retorna disponibilidade e agenda do candidato.
    /// </summary>
    [HttpGet("{id:guid}/agenda")]
    [ProducesResponseType(typeof(PortalCandidateAgendaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PortalCandidateAgendaResponse>> GetAgenda(
        Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!await CandidateExistsAsync(db, id, ct))
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        var prefs = await db.CandidatoAgendaPreferencias
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.CandidatoId == id, ct);

        var blocks = await db.CandidatoAgendaBloqueios
            .AsNoTracking()
            .Where(x => x.CandidatoId == id)
            .OrderByDescending(x => x.UpdatedAtUtc)
            .ToListAsync(ct);

        var prefsDto = new PortalCandidateAgendaPreferencesDto(
            prefs?.FormatoEntrevista,
            prefs?.InicioDisponivel,
            prefs?.AvisoPrevio,
            prefs?.Observacoes,
            prefs?.DiaSeg ?? false,
            prefs?.DiaTer ?? false,
            prefs?.DiaQua ?? false,
            prefs?.DiaQui ?? false,
            prefs?.DiaSex ?? false,
            prefs?.DiaSab ?? false,
            prefs?.DiaDom ?? false,
            prefs?.PeriodoManha ?? false,
            prefs?.PeriodoTarde ?? false,
            prefs?.PeriodoNoite ?? false,
            prefs?.HorarioPreferido,
            prefs?.FusoHorario,
            prefs?.UpdatedAtUtc ?? DateTimeOffset.MinValue
        );

        var blockDtos = blocks.Select(b => new PortalCandidateAgendaBlockDto(
            b.Id,
            b.Tipo,
            b.Titulo,
            b.Data,
            b.Horario,
            b.Observacoes,
            b.UpdatedAtUtc
        )).ToList();

        return Ok(new PortalCandidateAgendaResponse(prefsDto, blockDtos));
    }

    /// <summary>
    /// Atualiza preferencias gerais de agenda.
    /// </summary>
    [HttpPut("{id:guid}/agenda")]
    [ProducesResponseType(typeof(PortalCandidateAgendaPreferencesDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PortalCandidateAgendaPreferencesDto>> UpdateAgenda(
        Guid id,
        [FromBody] PortalCandidateAgendaPreferencesRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var candidate = await db.Candidatos
            .FirstOrDefaultAsync(c => c.Id == id, ct);
        if (candidate is null)
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        var prefs = await db.CandidatoAgendaPreferencias
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.CandidatoId == id, ct);

        if (prefs is null)
        {
            prefs = new CandidatoAgendaPreferencia
            {
                Id = Guid.NewGuid(),
                TenantId = candidate.TenantId,
                CandidatoId = candidate.Id
            };
            db.CandidatoAgendaPreferencias.Add(prefs);
        }

        prefs.FormatoEntrevista = NormalizeOptional(request.FormatoEntrevista);
        prefs.InicioDisponivel = NormalizeOptional(request.InicioDisponivel);
        prefs.AvisoPrevio = NormalizeOptional(request.AvisoPrevio);
        prefs.Observacoes = NormalizeOptional(request.Observacoes);
        prefs.DiaSeg = request.DiaSeg;
        prefs.DiaTer = request.DiaTer;
        prefs.DiaQua = request.DiaQua;
        prefs.DiaQui = request.DiaQui;
        prefs.DiaSex = request.DiaSex;
        prefs.DiaSab = request.DiaSab;
        prefs.DiaDom = request.DiaDom;
        prefs.PeriodoManha = request.PeriodoManha;
        prefs.PeriodoTarde = request.PeriodoTarde;
        prefs.PeriodoNoite = request.PeriodoNoite;
        prefs.HorarioPreferido = NormalizeOptional(request.HorarioPreferido);
        prefs.FusoHorario = NormalizeOptional(request.FusoHorario);

        await db.SaveChangesAsync(ct);

        return Ok(new PortalCandidateAgendaPreferencesDto(
            prefs.FormatoEntrevista,
            prefs.InicioDisponivel,
            prefs.AvisoPrevio,
            prefs.Observacoes,
            prefs.DiaSeg,
            prefs.DiaTer,
            prefs.DiaQua,
            prefs.DiaQui,
            prefs.DiaSex,
            prefs.DiaSab,
            prefs.DiaDom,
            prefs.PeriodoManha,
            prefs.PeriodoTarde,
            prefs.PeriodoNoite,
            prefs.HorarioPreferido,
            prefs.FusoHorario,
            prefs.UpdatedAtUtc
        ));
    }

    /// <summary>
    /// Adiciona um bloqueio de agenda.
    /// </summary>
    [HttpPost("{id:guid}/agenda/blocks")]
    [ProducesResponseType(typeof(PortalCandidateAgendaBlockDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PortalCandidateAgendaBlockDto>> CreateAgendaBlock(
        Guid id,
        [FromBody] PortalCandidateAgendaBlockRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var candidate = await db.Candidatos
            .FirstOrDefaultAsync(c => c.Id == id, ct);
        if (candidate is null)
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        var block = new CandidatoAgendaBloqueio
        {
            Id = Guid.NewGuid(),
            TenantId = candidate.TenantId,
            CandidatoId = candidate.Id,
            Tipo = NormalizeOptional(request.Tipo),
            Titulo = NormalizeOptional(request.Titulo),
            Data = NormalizeOptional(request.Data),
            Horario = NormalizeOptional(request.Horario),
            Observacoes = NormalizeOptional(request.Observacoes)
        };

        db.CandidatoAgendaBloqueios.Add(block);
        await db.SaveChangesAsync(ct);

        return Ok(new PortalCandidateAgendaBlockDto(
            block.Id,
            block.Tipo,
            block.Titulo,
            block.Data,
            block.Horario,
            block.Observacoes,
            block.UpdatedAtUtc
        ));
    }

    /// <summary>
    /// Atualiza um bloqueio de agenda.
    /// </summary>
    [HttpPut("{id:guid}/agenda/blocks/{blockId:guid}")]
    [ProducesResponseType(typeof(PortalCandidateAgendaBlockDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PortalCandidateAgendaBlockDto>> UpdateAgendaBlock(
        Guid id,
        Guid blockId,
        [FromBody] PortalCandidateAgendaBlockRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var block = await db.CandidatoAgendaBloqueios
            .FirstOrDefaultAsync(b => b.Id == blockId && b.CandidatoId == id, ct);
        if (block is null)
            return NotFound(new { message = "Bloqueio nao encontrado." });

        block.Tipo = NormalizeOptional(request.Tipo);
        block.Titulo = NormalizeOptional(request.Titulo);
        block.Data = NormalizeOptional(request.Data);
        block.Horario = NormalizeOptional(request.Horario);
        block.Observacoes = NormalizeOptional(request.Observacoes);

        await db.SaveChangesAsync(ct);

        return Ok(new PortalCandidateAgendaBlockDto(
            block.Id,
            block.Tipo,
            block.Titulo,
            block.Data,
            block.Horario,
            block.Observacoes,
            block.UpdatedAtUtc
        ));
    }

    /// <summary>
    /// Remove um bloqueio de agenda.
    /// </summary>
    [HttpDelete("{id:guid}/agenda/blocks/{blockId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteAgendaBlock(
        Guid id,
        Guid blockId,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var block = await db.CandidatoAgendaBloqueios
            .FirstOrDefaultAsync(b => b.Id == blockId && b.CandidatoId == id, ct);
        if (block is null)
            return NotFound(new { message = "Bloqueio nao encontrado." });

        db.CandidatoAgendaBloqueios.Remove(block);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>
    /// Retorna preferencias de notificacao e comunicacao.
    /// </summary>
    [HttpGet("{id:guid}/notifications")]
    [ProducesResponseType(typeof(PortalCandidateNotificationsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PortalCandidateNotificationsResponse>> GetNotifications(
        Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!await CandidateExistsAsync(db, id, ct))
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        var prefs = await db.CandidatoNotificacaoPreferencias
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.CandidatoId == id, ct);

        return Ok(new PortalCandidateNotificationsResponse(
            prefs?.CanalEmail ?? false,
            prefs?.CanalWhatsapp ?? false,
            prefs?.CanalSms ?? false,
            prefs?.CanalPush ?? false,
            prefs?.Frequencia,
            prefs?.Idioma,
            prefs?.Email,
            prefs?.Telefone,
            prefs?.PermiteContato ?? false,
            prefs?.AlertaNovasVagas ?? false,
            prefs?.AlertaAtualizacoes ?? false,
            prefs?.AlertaEntrevistas ?? false,
            prefs?.AlertaMensagens ?? false,
            prefs?.AlertaDocumentos ?? false,
            prefs?.AlertaLembretes ?? false,
            prefs?.SilencioAtivo,
            prefs?.SilencioInicio,
            prefs?.SilencioFim,
            prefs?.SilencioPrioridade,
            prefs?.Assinatura,
            prefs?.UpdatedAtUtc
        ));
    }

    /// <summary>
    /// Atualiza preferencias de notificacao e comunicacao.
    /// </summary>
    [HttpPut("{id:guid}/notifications")]
    [ProducesResponseType(typeof(PortalCandidateNotificationsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PortalCandidateNotificationsResponse>> UpdateNotifications(
        Guid id,
        [FromBody] PortalCandidateNotificationsRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var candidate = await db.Candidatos
            .FirstOrDefaultAsync(c => c.Id == id, ct);
        if (candidate is null)
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        var prefs = await db.CandidatoNotificacaoPreferencias
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.CandidatoId == id, ct);

        if (prefs is null)
        {
            prefs = new CandidatoNotificacaoPreferencia
            {
                Id = Guid.NewGuid(),
                TenantId = candidate.TenantId,
                CandidatoId = candidate.Id
            };
            db.CandidatoNotificacaoPreferencias.Add(prefs);
        }

        prefs.CanalEmail = request.CanalEmail;
        prefs.CanalWhatsapp = request.CanalWhatsapp;
        prefs.CanalSms = request.CanalSms;
        prefs.CanalPush = request.CanalPush;
        prefs.Frequencia = NormalizeOptional(request.Frequencia);
        prefs.Idioma = NormalizeOptional(request.Idioma);
        prefs.Email = NormalizeOptional(request.Email);
        prefs.Telefone = NormalizeOptional(request.Telefone);
        prefs.PermiteContato = request.PermiteContato;
        prefs.AlertaNovasVagas = request.AlertaNovasVagas;
        prefs.AlertaAtualizacoes = request.AlertaAtualizacoes;
        prefs.AlertaEntrevistas = request.AlertaEntrevistas;
        prefs.AlertaMensagens = request.AlertaMensagens;
        prefs.AlertaDocumentos = request.AlertaDocumentos;
        prefs.AlertaLembretes = request.AlertaLembretes;
        prefs.SilencioAtivo = NormalizeOptional(request.SilencioAtivo);
        prefs.SilencioInicio = NormalizeOptional(request.SilencioInicio);
        prefs.SilencioFim = NormalizeOptional(request.SilencioFim);
        prefs.SilencioPrioridade = NormalizeOptional(request.SilencioPrioridade);
        prefs.Assinatura = NormalizeOptional(request.Assinatura);

        await db.SaveChangesAsync(ct);

        return Ok(new PortalCandidateNotificationsResponse(
            prefs.CanalEmail,
            prefs.CanalWhatsapp,
            prefs.CanalSms,
            prefs.CanalPush,
            prefs.Frequencia,
            prefs.Idioma,
            prefs.Email,
            prefs.Telefone,
            prefs.PermiteContato,
            prefs.AlertaNovasVagas,
            prefs.AlertaAtualizacoes,
            prefs.AlertaEntrevistas,
            prefs.AlertaMensagens,
            prefs.AlertaDocumentos,
            prefs.AlertaLembretes,
            prefs.SilencioAtivo,
            prefs.SilencioInicio,
            prefs.SilencioFim,
            prefs.SilencioPrioridade,
            prefs.Assinatura,
            prefs.UpdatedAtUtc
        ));
    }

    /// <summary>
    /// Lista documentos anexos do candidato.
    /// </summary>
    [HttpGet("{id:guid}/documents")]
    [ProducesResponseType(typeof(PortalCandidateDocumentsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PortalCandidateDocumentsResponse>> GetDocuments(
        Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!await CandidateExistsAsync(db, id, ct))
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        var docs = await db.CandidatoDocumentos
            .AsNoTracking()
            .Where(d => d.CandidatoId == id)
            .OrderByDescending(d => d.UpdatedAtUtc)
            .ToListAsync(ct);

        var items = docs.Select(MapDocumentDto).ToList();
        return Ok(new PortalCandidateDocumentsResponse(items));
    }

    /// <summary>
    /// Retorna preferencias LGPD (consentimentos).
    /// </summary>
    [HttpGet("{id:guid}/lgpd")]
    [ProducesResponseType(typeof(PortalCandidateLgpdResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PortalCandidateLgpdResponse>> GetLgpd(
        Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!await CandidateExistsAsync(db, id, ct))
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        var consent = await db.CandidatoLgpdConsents
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.CandidatoId == id, ct);

        return Ok(new PortalCandidateLgpdResponse(
            consent?.ProcessarCandidatura ?? false,
            consent?.PermitirContato ?? false,
            consent?.BancoTalentos ?? false,
            consent?.RetencaoMeses,
            consent?.Compartilhamento,
            consent?.DadosSensiveis ?? false,
            consent?.Comunicacoes ?? false,
            consent?.ConsentidoEmUtc,
            consent?.RevogadoEmUtc,
            consent?.UpdatedAtUtc
        ));
    }

    /// <summary>
    /// Atualiza preferencias LGPD (consentimentos).
    /// </summary>
    [HttpPut("{id:guid}/lgpd")]
    [ProducesResponseType(typeof(PortalCandidateLgpdResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PortalCandidateLgpdResponse>> UpdateLgpd(
        Guid id,
        [FromBody] PortalCandidateLgpdRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var candidate = await db.Candidatos
            .FirstOrDefaultAsync(c => c.Id == id, ct);
        if (candidate is null)
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        var consent = await db.CandidatoLgpdConsents
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.CandidatoId == id, ct);

        if (consent is null)
        {
            consent = new CandidatoLgpdConsent
            {
                Id = Guid.NewGuid(),
                TenantId = candidate.TenantId,
                CandidatoId = candidate.Id
            };
            db.CandidatoLgpdConsents.Add(consent);
        }

        consent.ProcessarCandidatura = request.ProcessarCandidatura;
        consent.PermitirContato = request.PermitirContato;
        consent.BancoTalentos = request.BancoTalentos;
        consent.RetencaoMeses = request.RetencaoMeses;
        consent.Compartilhamento = request.Compartilhamento;
        consent.DadosSensiveis = request.DadosSensiveis;
        consent.Comunicacoes = request.Comunicacoes;

        if (request.ProcessarCandidatura)
        {
            consent.RevogadoEmUtc = null;
            consent.ConsentidoEmUtc ??= DateTimeOffset.UtcNow;
        }
        else
        {
            consent.RevogadoEmUtc = DateTimeOffset.UtcNow;
        }

        await db.SaveChangesAsync(ct);

        return Ok(new PortalCandidateLgpdResponse(
            consent.ProcessarCandidatura,
            consent.PermitirContato,
            consent.BancoTalentos,
            consent.RetencaoMeses,
            consent.Compartilhamento,
            consent.DadosSensiveis,
            consent.Comunicacoes,
            consent.ConsentidoEmUtc,
            consent.RevogadoEmUtc,
            consent.UpdatedAtUtc
        ));
    }

    /// <summary>
    /// Gera o comprovante de consentimentos LGPD.
    /// </summary>
    [HttpGet("{id:guid}/lgpd/receipt")]
    [ProducesResponseType(typeof(PortalCandidateLgpdReceiptResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PortalCandidateLgpdReceiptResponse>> GetLgpdReceipt(
        Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!await CandidateExistsAsync(db, id, ct))
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        var consent = await db.CandidatoLgpdConsents
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.CandidatoId == id, ct);

        var html = $@"
<html lang=""pt-br"">
<head>
  <meta charset=""utf-8"" />
  <title>Comprovante LGPD</title>
  <style>
    body {{ font-family: Arial, sans-serif; padding: 24px; color: #1f2937; }}
    h1 {{ font-size: 20px; margin-bottom: 6px; }}
    .muted {{ color: #6b7280; font-size: 12px; }}
    .box {{ margin-top: 16px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }}
    .row {{ margin-bottom: 8px; }}
    .label {{ font-weight: 600; }}
  </style>
</head>
<body>
  <h1>Comprovante de Consentimentos (LGPD)</h1>
  <div class=""muted"">Gerado em {DateTimeOffset.UtcNow:dd/MM/yyyy HH:mm} (UTC)</div>
  <div class=""box"">
    <div class=""row""><span class=""label"">Candidatura:</span> {(consent?.ProcessarCandidatura == true ? "SIM" : "NAO")}</div>
    <div class=""row""><span class=""label"">Contato:</span> {(consent?.PermitirContato == true ? "SIM" : "NAO")}</div>
    <div class=""row""><span class=""label"">Banco de talentos:</span> {(consent?.BancoTalentos == true ? "SIM" : "NAO")}</div>
    <div class=""row""><span class=""label"">Retencao (meses):</span> {(consent?.RetencaoMeses?.ToString() ?? "-")}</div>
    <div class=""row""><span class=""label"">Compartilhamento:</span> {(consent?.Compartilhamento?.ToString() ?? "-")}</div>
    <div class=""row""><span class=""label"">Dados sensiveis:</span> {(consent?.DadosSensiveis == true ? "SIM" : "NAO")}</div>
    <div class=""row""><span class=""label"">Comunicacoes:</span> {(consent?.Comunicacoes == true ? "SIM" : "NAO")}</div>
    <div class=""row""><span class=""label"">Consentido em:</span> {(consent?.ConsentidoEmUtc?.ToString("dd/MM/yyyy HH:mm") ?? "-")}</div>
    <div class=""row""><span class=""label"">Revogado em:</span> {(consent?.RevogadoEmUtc?.ToString("dd/MM/yyyy HH:mm") ?? "-")}</div>
    <div class=""row""><span class=""label"">Ultima atualizacao:</span> {(consent is null ? "-" : consent.UpdatedAtUtc.ToString("dd/MM/yyyy HH:mm"))}</div>
  </div>
</body>
</html>";

        return Ok(new PortalCandidateLgpdReceiptResponse(html));
    }

    /// <summary>
    /// Adiciona um documento anexo.
    /// </summary>
    [HttpPost("{id:guid}/documents")]
    [ProducesResponseType(typeof(PortalCandidateDocumentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PortalCandidateDocumentDto>> CreateDocument(
        Guid id,
        [FromBody] PortalCandidateDocumentRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var candidate = await db.Candidatos
            .FirstOrDefaultAsync(c => c.Id == id, ct);
        if (candidate is null)
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        var doc = new CandidatoDocumento
        {
            Id = Guid.NewGuid(),
            TenantId = candidate.TenantId,
            CandidatoId = candidate.Id,
            Tipo = ParseDocumentType(request.Tipo),
            NomeArquivo = NormalizeRequired(request.Nome),
            Url = NormalizeOptional(request.Link),
            Descricao = NormalizeOptional(request.Observacoes),
            DataReferencia = NormalizeOptional(request.Data),
            ArquivoNome = NormalizeOptional(request.FileName)
        };

        db.CandidatoDocumentos.Add(doc);
        await db.SaveChangesAsync(ct);

        return Ok(MapDocumentDto(doc));
    }

    /// <summary>
    /// Atualiza um documento anexo.
    /// </summary>
    [HttpPut("{id:guid}/documents/{documentId:guid}")]
    [ProducesResponseType(typeof(PortalCandidateDocumentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PortalCandidateDocumentDto>> UpdateDocument(
        Guid id,
        Guid documentId,
        [FromBody] PortalCandidateDocumentRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var doc = await db.CandidatoDocumentos
            .FirstOrDefaultAsync(d => d.Id == documentId && d.CandidatoId == id, ct);
        if (doc is null)
            return NotFound(new { message = "Documento nao encontrado." });

        doc.Tipo = ParseDocumentType(request.Tipo);
        doc.NomeArquivo = NormalizeRequired(request.Nome);
        doc.Url = NormalizeOptional(request.Link);
        doc.Descricao = NormalizeOptional(request.Observacoes);
        doc.DataReferencia = NormalizeOptional(request.Data);
        doc.ArquivoNome = NormalizeOptional(request.FileName);

        await db.SaveChangesAsync(ct);
        return Ok(MapDocumentDto(doc));
    }

    /// <summary>
    /// Remove um documento anexo.
    /// </summary>
    [HttpDelete("{id:guid}/documents/{documentId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteDocument(
        Guid id,
        Guid documentId,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var doc = await db.CandidatoDocumentos
            .FirstOrDefaultAsync(d => d.Id == documentId && d.CandidatoId == id, ct);
        if (doc is null)
            return NotFound(new { message = "Documento nao encontrado." });

        db.CandidatoDocumentos.Remove(doc);
        await db.SaveChangesAsync(ct);
        return Ok();
    }

    /// <summary>
    /// Lista referencias profissionais do candidato.
    /// </summary>
    [HttpGet("{id:guid}/references")]
    [ProducesResponseType(typeof(PortalCandidateReferencesResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PortalCandidateReferencesResponse>> GetReferences(
        Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!await CandidateExistsAsync(db, id, ct))
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        var items = await db.CandidatoReferencias
            .AsNoTracking()
            .Where(r => r.CandidatoId == id)
            .OrderByDescending(r => r.UpdatedAtUtc)
            .Select(r => new PortalCandidateReferenceDto(
                r.Id,
                r.Nome,
                r.Relacao,
                r.Empresa,
                r.Cargo,
                r.Contato,
                r.Periodo,
                r.Linkedin,
                r.Observacoes,
                r.PodeContatar,
                r.UpdatedAtUtc
            ))
            .ToListAsync(ct);

        return Ok(new PortalCandidateReferencesResponse(items));
    }

    /// <summary>
    /// Adiciona uma referencia profissional.
    /// </summary>
    [HttpPost("{id:guid}/references")]
    [ProducesResponseType(typeof(PortalCandidateReferenceDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PortalCandidateReferenceDto>> CreateReference(
        Guid id,
        [FromBody] PortalCandidateReferenceRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var candidate = await db.Candidatos
            .FirstOrDefaultAsync(c => c.Id == id, ct);
        if (candidate is null)
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        var entity = new CandidatoReferencia
        {
            Id = Guid.NewGuid(),
            TenantId = candidate.TenantId,
            CandidatoId = candidate.Id,
            Nome = NormalizeRequired(request.Nome),
            Relacao = NormalizeOptional(request.Relacao),
            Empresa = NormalizeOptional(request.Empresa),
            Cargo = NormalizeOptional(request.Cargo),
            Contato = NormalizeOptional(request.Contato),
            Periodo = NormalizeOptional(request.Periodo),
            Linkedin = NormalizeOptional(request.Linkedin),
            Observacoes = NormalizeOptional(request.Observacoes),
            PodeContatar = request.PodeContatar
        };

        db.CandidatoReferencias.Add(entity);
        await db.SaveChangesAsync(ct);

        return Ok(new PortalCandidateReferenceDto(
            entity.Id,
            entity.Nome,
            entity.Relacao,
            entity.Empresa,
            entity.Cargo,
            entity.Contato,
            entity.Periodo,
            entity.Linkedin,
            entity.Observacoes,
            entity.PodeContatar,
            entity.UpdatedAtUtc
        ));
    }

    /// <summary>
    /// Atualiza uma referencia profissional.
    /// </summary>
    [HttpPut("{id:guid}/references/{referenceId:guid}")]
    [ProducesResponseType(typeof(PortalCandidateReferenceDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PortalCandidateReferenceDto>> UpdateReference(
        Guid id,
        Guid referenceId,
        [FromBody] PortalCandidateReferenceRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var entity = await db.CandidatoReferencias
            .FirstOrDefaultAsync(r => r.Id == referenceId && r.CandidatoId == id, ct);
        if (entity is null)
            return NotFound(new { message = "Referencia nao encontrada." });

        entity.Nome = NormalizeRequired(request.Nome);
        entity.Relacao = NormalizeOptional(request.Relacao);
        entity.Empresa = NormalizeOptional(request.Empresa);
        entity.Cargo = NormalizeOptional(request.Cargo);
        entity.Contato = NormalizeOptional(request.Contato);
        entity.Periodo = NormalizeOptional(request.Periodo);
        entity.Linkedin = NormalizeOptional(request.Linkedin);
        entity.Observacoes = NormalizeOptional(request.Observacoes);
        entity.PodeContatar = request.PodeContatar;

        await db.SaveChangesAsync(ct);

        return Ok(new PortalCandidateReferenceDto(
            entity.Id,
            entity.Nome,
            entity.Relacao,
            entity.Empresa,
            entity.Cargo,
            entity.Contato,
            entity.Periodo,
            entity.Linkedin,
            entity.Observacoes,
            entity.PodeContatar,
            entity.UpdatedAtUtc
        ));
    }

    /// <summary>
    /// Remove uma referencia profissional.
    /// </summary>
    [HttpDelete("{id:guid}/references/{referenceId:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteReference(
        Guid id,
        Guid referenceId,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.CandidatoReferencias
            .FirstOrDefaultAsync(r => r.Id == referenceId && r.CandidatoId == id, ct);
        if (entity is null)
            return NotFound(new { message = "Referencia nao encontrada." });

        db.CandidatoReferencias.Remove(entity);
        await db.SaveChangesAsync(ct);

        return Ok();
    }

    /// <summary>
    /// Atualiza resumo de formacao (nivel/area/situacao).
    /// </summary>
    [HttpPut("{id:guid}/education")]
    [ProducesResponseType(typeof(PortalCandidateEducationSummaryDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
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

    /// <summary>
    /// Adiciona um item de formacao.
    /// </summary>
    [HttpPost("{id:guid}/education/items")]
    [ProducesResponseType(typeof(PortalCandidateEducationItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
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

    /// <summary>
    /// Atualiza um item de formacao.
    /// </summary>
    [HttpPut("{id:guid}/education/items/{itemId:guid}")]
    [ProducesResponseType(typeof(PortalCandidateEducationItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
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

    /// <summary>
    /// Remove um item de formacao.
    /// </summary>
    [HttpDelete("{id:guid}/education/items/{itemId:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
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

    /// <summary>
    /// Retorna experiencias e projetos do candidato.
    /// </summary>
    [HttpGet("{id:guid}/experience-projects")]
    [ProducesResponseType(typeof(PortalCandidateExperienceProjectResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PortalCandidateExperienceProjectResponse>> GetExperienceProjects(
        Guid id,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!await CandidateExistsAsync(db, id, ct))
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        var experiences = await db.CandidatoExperiencias
            .AsNoTracking()
            .Where(x => x.CandidatoId == id)
            .OrderByDescending(x => x.Fim)
            .ThenByDescending(x => x.Inicio)
            .ThenBy(x => x.Empresa)
            .Select(x => new PortalCandidateExperienceDto(
                x.Id,
                x.Empresa,
                x.Cargo,
                x.Inicio,
                x.Fim,
                x.Local,
                x.Atividades))
            .ToListAsync(ct);

        var projects = await db.CandidatoProjetos
            .AsNoTracking()
            .Where(x => x.CandidatoId == id)
            .OrderByDescending(x => x.Periodo)
            .ThenBy(x => x.Nome)
            .Select(x => new PortalCandidateProjectDto(
                x.Id,
                x.Nome,
                x.Periodo,
                x.Descricao,
                x.Link,
                x.Stack,
                x.Destaques))
            .ToListAsync(ct);

        return Ok(new PortalCandidateExperienceProjectResponse(experiences, projects));
    }

    /// <summary>
    /// Adiciona uma experiencia profissional.
    /// </summary>
    [HttpPost("{id:guid}/experiences")]
    [ProducesResponseType(typeof(PortalCandidateExperienceDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PortalCandidateExperienceDto>> CreateExperience(
        Guid id,
        [FromBody] PortalCandidateExperienceRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        if (!await CandidateExistsAsync(db, id, ct))
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        var entity = new CandidatoExperiencia
        {
            Id = Guid.NewGuid(),
            CandidatoId = id,
            Empresa = NormalizeRequired(request.Empresa),
            Cargo = NormalizeRequired(request.Cargo),
            Inicio = NormalizeOptional(request.Inicio),
            Fim = NormalizeOptional(request.Fim),
            Local = NormalizeOptional(request.Local),
            Atividades = NormalizeOptional(request.Atividades)
        };

        db.CandidatoExperiencias.Add(entity);
        await db.SaveChangesAsync(ct);

        return Ok(new PortalCandidateExperienceDto(
            entity.Id,
            entity.Empresa,
            entity.Cargo,
            entity.Inicio,
            entity.Fim,
            entity.Local,
            entity.Atividades));
    }

    /// <summary>
    /// Atualiza uma experiencia profissional.
    /// </summary>
    [HttpPut("{id:guid}/experiences/{experienceId:guid}")]
    [ProducesResponseType(typeof(PortalCandidateExperienceDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PortalCandidateExperienceDto>> UpdateExperience(
        Guid id,
        Guid experienceId,
        [FromBody] PortalCandidateExperienceRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var entity = await db.CandidatoExperiencias
            .FirstOrDefaultAsync(x => x.Id == experienceId && x.CandidatoId == id, ct);

        if (entity is null)
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        entity.Empresa = NormalizeRequired(request.Empresa);
        entity.Cargo = NormalizeRequired(request.Cargo);
        entity.Inicio = NormalizeOptional(request.Inicio);
        entity.Fim = NormalizeOptional(request.Fim);
        entity.Local = NormalizeOptional(request.Local);
        entity.Atividades = NormalizeOptional(request.Atividades);

        await db.SaveChangesAsync(ct);

        return Ok(new PortalCandidateExperienceDto(
            entity.Id,
            entity.Empresa,
            entity.Cargo,
            entity.Inicio,
            entity.Fim,
            entity.Local,
            entity.Atividades));
    }

    /// <summary>
    /// Remove uma experiencia profissional.
    /// </summary>
    [HttpDelete("{id:guid}/experiences/{experienceId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteExperience(
        Guid id,
        Guid experienceId,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.CandidatoExperiencias
            .FirstOrDefaultAsync(x => x.Id == experienceId && x.CandidatoId == id, ct);

        if (entity is null)
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        db.CandidatoExperiencias.Remove(entity);
        await db.SaveChangesAsync(ct);

        return NoContent();
    }

    /// <summary>
    /// Adiciona um projeto.
    /// </summary>
    [HttpPost("{id:guid}/projects")]
    [ProducesResponseType(typeof(PortalCandidateProjectDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PortalCandidateProjectDto>> CreateProject(
        Guid id,
        [FromBody] PortalCandidateProjectRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        if (!await CandidateExistsAsync(db, id, ct))
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        var entity = new CandidatoProjeto
        {
            Id = Guid.NewGuid(),
            CandidatoId = id,
            Nome = NormalizeRequired(request.Nome),
            Periodo = NormalizeOptional(request.Periodo),
            Descricao = NormalizeOptional(request.Descricao),
            Link = NormalizeOptional(request.Link),
            Stack = NormalizeOptional(request.Stack),
            Destaques = NormalizeOptional(request.Destaques)
        };

        db.CandidatoProjetos.Add(entity);
        await db.SaveChangesAsync(ct);

        return Ok(new PortalCandidateProjectDto(
            entity.Id,
            entity.Nome,
            entity.Periodo,
            entity.Descricao,
            entity.Link,
            entity.Stack,
            entity.Destaques));
    }

    /// <summary>
    /// Atualiza um projeto.
    /// </summary>
    [HttpPut("{id:guid}/projects/{projectId:guid}")]
    [ProducesResponseType(typeof(PortalCandidateProjectDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PortalCandidateProjectDto>> UpdateProject(
        Guid id,
        Guid projectId,
        [FromBody] PortalCandidateProjectRequest request,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var entity = await db.CandidatoProjetos
            .FirstOrDefaultAsync(x => x.Id == projectId && x.CandidatoId == id, ct);

        if (entity is null)
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        entity.Nome = NormalizeRequired(request.Nome);
        entity.Periodo = NormalizeOptional(request.Periodo);
        entity.Descricao = NormalizeOptional(request.Descricao);
        entity.Link = NormalizeOptional(request.Link);
        entity.Stack = NormalizeOptional(request.Stack);
        entity.Destaques = NormalizeOptional(request.Destaques);

        await db.SaveChangesAsync(ct);

        return Ok(new PortalCandidateProjectDto(
            entity.Id,
            entity.Nome,
            entity.Periodo,
            entity.Descricao,
            entity.Link,
            entity.Stack,
            entity.Destaques));
    }

    /// <summary>
    /// Remove um projeto.
    /// </summary>
    [HttpDelete("{id:guid}/projects/{projectId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteProject(
        Guid id,
        Guid projectId,
        [FromServices] AppDbContext db,
        CancellationToken ct)
    {
        var entity = await db.CandidatoProjetos
            .FirstOrDefaultAsync(x => x.Id == projectId && x.CandidatoId == id, ct);

        if (entity is null)
            return NotFound(new { message = _localizer["ControllerErrors.CandidatoNotFound"] });

        db.CandidatoProjetos.Remove(entity);
        await db.SaveChangesAsync(ct);

        return NoContent();
    }

    /// <summary>
    /// Faz upload da foto de perfil do candidato.
    /// </summary>
    [HttpPost("{id:guid}/avatar")]
    [ProducesResponseType(typeof(PortalCandidateAvatarResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
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

    /// <summary>
    /// Download/visualizacao da foto de perfil do candidato.
    /// </summary>
    [HttpGet("{id:guid}/avatar")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
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

    /// <summary>
    /// Faz upload do curriculo (documento principal).
    /// </summary>
    [HttpPost("{id:guid}/curriculos")]
    [ProducesResponseType(typeof(PortalCandidateDocumentoSummary), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
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

    /// <summary>
    /// Download do curriculo do candidato.
    /// </summary>
    [HttpGet("{id:guid}/curriculos/{documentoId:guid}/download")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
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

    private static async Task NotifyProfileUpdatedAsync(
        AppDbContext db,
        NotificationPublisher notificationPublisher,
        Candidato candidate,
        CancellationToken ct)
    {
        try
        {
            var vagaInfo = await db.Vagas
                .AsNoTracking()
                .Where(v => v.Id == candidate.VagaId)
                .Select(v => new { v.Codigo, v.Titulo })
                .FirstOrDefaultAsync(ct);

            var parts = new List<string>
            {
                $"Nome: {candidate.Nome}",
                $"Email: {candidate.Email}"
            };

            if (!string.IsNullOrWhiteSpace(candidate.Fone))
                parts.Add($"Fone: {candidate.Fone}");

            if (vagaInfo is not null)
            {
                var code = string.IsNullOrWhiteSpace(vagaInfo.Codigo) ? "—" : vagaInfo.Codigo;
                parts.Add($"Vaga: {vagaInfo.Titulo} ({code})");
            }

            var message = string.Join(" | ", parts);
            var request = new NotificationSendRequest(
                NotificationScope.Tenant,
                "Perfil atualizado pelo candidato",
                message,
                "info",
                $"/Candidatos?open={candidate.Id}",
                candidate.TenantId,
                null);

            await notificationPublisher.PublishToTenantsAsync(new[] { candidate.TenantId }, request, ct);
        }
        catch
        {
            // best-effort
        }
    }

    private static CandidateDocumentType ParseDocumentType(string? value)
    {
        var normalized = NormalizeDocumentType(value);
        return normalized switch
        {
            "curriculo" => CandidateDocumentType.Curriculo,
            "certificado" => CandidateDocumentType.Certificado,
            "diplomadeclaracao" => CandidateDocumentType.DiplomaDeclaracao,
            "portfolio" => CandidateDocumentType.Portfolio,
            "carteiraregistro" => CandidateDocumentType.CarteiraRegistro,
            "outros" => CandidateDocumentType.Outros,
            "documento" => CandidateDocumentType.Documento,
            _ => CandidateDocumentType.Documento
        };
    }

    private static string NormalizeDocumentType(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return string.Empty;

        var cleaned = value.Trim().ToLowerInvariant();
        cleaned = cleaned.Replace("/", string.Empty)
            .Replace("-", string.Empty)
            .Replace(" ", string.Empty);

        cleaned = cleaned.Normalize(NormalizationForm.FormD);
        var chars = cleaned.Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark);
        return new string(chars.ToArray());
    }

    private static string MapDocumentTypeLabel(CandidateDocumentType tipo)
    {
        return tipo switch
        {
            CandidateDocumentType.Curriculo => "Currículo",
            CandidateDocumentType.Certificado => "Certificado",
            CandidateDocumentType.DiplomaDeclaracao => "Diploma/Declaração",
            CandidateDocumentType.Portfolio => "Portfólio",
            CandidateDocumentType.CarteiraRegistro => "Carteira/Registro",
            CandidateDocumentType.Outros => "Outros",
            CandidateDocumentType.Documento => "Documento",
            _ => "Outros"
        };
    }

    private static PortalCandidateDocumentDto MapDocumentDto(CandidatoDocumento doc)
    {
        return new PortalCandidateDocumentDto(
            doc.Id,
            MapDocumentTypeLabel(doc.Tipo),
            doc.NomeArquivo,
            doc.Url,
            doc.DataReferencia,
            doc.Descricao,
            doc.ArquivoNome,
            doc.CreatedAtUtc
        );
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
