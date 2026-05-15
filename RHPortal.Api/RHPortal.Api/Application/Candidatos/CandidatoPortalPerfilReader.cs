using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using RhPortal.Api.Contracts.Candidatos;
using RhPortal.Api.Contracts.Portal;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Candidatos;

public interface ICandidatoPortalPerfilReader
{
    /// <summary>Null se o candidato não existir no tenant.</summary>
    Task<CandidatoPortalPerfilCompletoResponse?> GetCompletoAsync(Guid candidatoId, CancellationToken ct);
}

/// <summary>
/// Monta o mesmo conjunto de dados exposto pelos GETs de <see cref="Controllers.PortalCandidatesController"/> (somente leitura).
/// </summary>
public sealed class CandidatoPortalPerfilReader : ICandidatoPortalPerfilReader
{
    private readonly AppDbContext _db;
    private readonly IHostEnvironment _hostEnvironment;
    private readonly ITenantContext _tenantContext;

    public CandidatoPortalPerfilReader(AppDbContext db, IHostEnvironment hostEnvironment, ITenantContext tenantContext)
    {
        _db = db;
        _hostEnvironment = hostEnvironment;
        _tenantContext = tenantContext;
    }

    public async Task<CandidatoPortalPerfilCompletoResponse?> GetCompletoAsync(Guid candidatoId, CancellationToken ct)
    {
        if (!await _db.Candidatos.AnyAsync(c => c.Id == candidatoId, ct))
            return null;

        var perfilTask = LoadPerfilBasicoAsync(candidatoId, ct);
        var skillsTask = LoadSkillsPortfolioAsync(candidatoId, ct);
        var educationTask = LoadEducationAsync(candidatoId, ct);
        var preferencesTask = LoadPreferencesAsync(candidatoId, ct);
        var accessibilityTask = LoadAccessibilityAsync(candidatoId, ct);
        var agendaTask = LoadAgendaAsync(candidatoId, ct);
        var notificationsTask = LoadNotificationsAsync(candidatoId, ct);
        var documentsTask = LoadPortalDocumentsAsync(candidatoId, ct);
        var lgpdTask = LoadLgpdAsync(candidatoId, ct);
        var referencesTask = LoadReferencesAsync(candidatoId, ct);
        var experienceTask = LoadExperienceProjectsAsync(candidatoId, ct);

        await Task.WhenAll(
            perfilTask, skillsTask, educationTask, preferencesTask, accessibilityTask,
            agendaTask, notificationsTask, documentsTask, lgpdTask, referencesTask, experienceTask);

        return new CandidatoPortalPerfilCompletoResponse(
            await perfilTask,
            await skillsTask,
            await educationTask,
            await preferencesTask,
            await accessibilityTask,
            await agendaTask,
            await notificationsTask,
            await documentsTask,
            await lgpdTask,
            await referencesTask,
            await experienceTask);
    }

    private async Task<PortalCandidateProfileResponse> LoadPerfilBasicoAsync(Guid id, CancellationToken ct)
    {
        var candidate = await _db.Candidatos
            .AsNoTracking()
            .Include(c => c.Documentos)
            .FirstAsync(c => c.Id == id, ct);

        var curriculo = candidate.Documentos
            .Where(d => d.Tipo == CandidateDocumentType.Curriculo)
            .OrderByDescending(d => d.CreatedAtUtc)
            .Select(d => new PortalCandidateDocumentoSummary(d.Id, d.NomeArquivo, d.CreatedAtUtc))
            .FirstOrDefault();

        var avatarUrl = ResolveAvatarUrlIfFileExists(id, candidate.AvatarFileName);

        return new PortalCandidateProfileResponse(
            candidate.Id,
            candidate.Nome,
            candidate.Email,
            candidate.Fone,
            candidate.Cidade,
            candidate.Uf,
            candidate.LinkedinUrl,
            candidate.ResumoProfissional,
            avatarUrl,
            curriculo,
            candidate.TrabalhandoAtualmente);
    }

    private async Task<PortalCandidateSkillsPortfolioResponse> LoadSkillsPortfolioAsync(Guid id, CancellationToken ct)
    {
        var skills = await _db.CandidatoCompetencias
            .AsNoTracking()
            .Where(x => x.CandidatoId == id)
            .OrderBy(x => x.Nome)
            .Select(x => new PortalCandidateSkillDto(x.Id, x.Tipo, x.Nome, x.Nivel, x.Evidencia))
            .ToListAsync(ct);

        var certs = await _db.CandidatoCertificacoes
            .AsNoTracking()
            .Where(x => x.CandidatoId == id)
            .OrderByDescending(x => x.Ano)
            .ThenBy(x => x.Nome)
            .Select(x => new PortalCandidateCertificationDto(x.Id, x.Nome, x.Instituicao, x.Ano, x.Link))
            .ToListAsync(ct);

        var portfolio = await _db.CandidatoPortfolios
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

        return new PortalCandidateSkillsPortfolioResponse(skills, certs, links, prefs, portfolio?.Tags);
    }

    private async Task<PortalCandidateEducationResponse> LoadEducationAsync(Guid id, CancellationToken ct)
    {
        var summary = await _db.CandidatoEducacaoResumos
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.CandidatoId == id, ct);

        var items = await _db.CandidatoEducacaoItens
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
            summary?.DataConclusao,
            summary?.Destaques);

        return new PortalCandidateEducationResponse(summaryDto, items);
    }

    private async Task<PortalCandidatePreferencesResponse> LoadPreferencesAsync(Guid id, CancellationToken ct)
    {
        var prefs = await _db.CandidatoPreferenciasVaga
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.CandidatoId == id, ct);

        return new PortalCandidatePreferencesResponse(
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
            prefs?.UpdatedAtUtc);
    }

    private async Task<PortalCandidateAccessibilityDto> LoadAccessibilityAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.CandidatoAcessibilidades
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.CandidatoId == id, ct);

        return new PortalCandidateAccessibilityDto(
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
            entity?.UpdatedAtUtc ?? DateTimeOffset.MinValue);
    }

    private async Task<PortalCandidateAgendaResponse> LoadAgendaAsync(Guid id, CancellationToken ct)
    {
        var prefs = await _db.CandidatoAgendaPreferencias
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.CandidatoId == id, ct);

        var blocks = await _db.CandidatoAgendaBloqueios
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
            prefs?.UpdatedAtUtc ?? DateTimeOffset.MinValue);

        var blockDtos = blocks.Select(b => new PortalCandidateAgendaBlockDto(
            b.Id,
            b.Tipo,
            b.Titulo,
            b.Data,
            b.Horario,
            b.Observacoes,
            b.UpdatedAtUtc)).ToList();

        return new PortalCandidateAgendaResponse(prefsDto, blockDtos);
    }

    private async Task<PortalCandidateNotificationsResponse> LoadNotificationsAsync(Guid id, CancellationToken ct)
    {
        var prefs = await _db.CandidatoNotificacaoPreferencias
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.CandidatoId == id, ct);

        return new PortalCandidateNotificationsResponse(
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
            prefs?.UpdatedAtUtc);
    }

    private async Task<PortalCandidateDocumentsResponse> LoadPortalDocumentsAsync(Guid id, CancellationToken ct)
    {
        var docs = await _db.CandidatoDocumentos
            .AsNoTracking()
            .Where(d => d.CandidatoId == id)
            .OrderByDescending(d => d.UpdatedAtUtc)
            .ToListAsync(ct);

        var items = docs.Select(MapDocumentDto).ToList();
        return new PortalCandidateDocumentsResponse(items);
    }

    private async Task<PortalCandidateLgpdResponse> LoadLgpdAsync(Guid id, CancellationToken ct)
    {
        var consent = await _db.CandidatoLgpdConsents
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.CandidatoId == id, ct);

        return new PortalCandidateLgpdResponse(
            consent?.ProcessarCandidatura ?? false,
            consent?.PermitirContato ?? false,
            consent?.BancoTalentos ?? false,
            consent?.RetencaoMeses,
            consent?.Compartilhamento,
            consent?.DadosSensiveis ?? false,
            consent?.Comunicacoes ?? false,
            consent?.ConsentidoEmUtc,
            consent?.RevogadoEmUtc,
            consent?.UpdatedAtUtc);
    }

    private async Task<PortalCandidateReferencesResponse> LoadReferencesAsync(Guid id, CancellationToken ct)
    {
        var items = await _db.CandidatoReferencias
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
                r.UpdatedAtUtc))
            .ToListAsync(ct);

        return new PortalCandidateReferencesResponse(items);
    }

    private async Task<PortalCandidateExperienceProjectResponse> LoadExperienceProjectsAsync(Guid id, CancellationToken ct)
    {
        var experiences = await _db.CandidatoExperiencias
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

        var projects = await _db.CandidatoProjetos
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

        return new PortalCandidateExperienceProjectResponse(experiences, projects);
    }

    private static PortalCandidateDocumentDto MapDocumentDto(CandidatoDocumento doc)
        => new(
            doc.Id,
            MapDocumentTypeLabel(doc.Tipo),
            doc.NomeArquivo,
            doc.Url,
            doc.DataReferencia,
            doc.Descricao,
            doc.ArquivoNome,
            doc.CreatedAtUtc);

    private static string MapDocumentTypeLabel(CandidateDocumentType tipo)
        => tipo switch
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

    private string? ResolveAvatarUrlIfFileExists(Guid candidatoId, string? avatarFileName)
    {
        if (string.IsNullOrWhiteSpace(avatarFileName))
            return null;

        var folder = GetCandidateFolder(candidatoId);
        var path = Path.Combine(folder, avatarFileName);
        if (!File.Exists(path))
            return null;

        return $"/api/public/portal-candidates/{candidatoId}/avatar";
    }

    private string GetCandidateFolder(Guid candidatoId)
        => Path.Combine(
            _hostEnvironment.ContentRootPath,
            "App_Data",
            "uploads",
            _tenantContext.TenantId ?? "",
            "candidatos",
            candidatoId.ToString("N"));
}
