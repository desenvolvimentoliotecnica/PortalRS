using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Contracts.Candidates;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Contracts.Notifications;
using RhPortal.Api.Application.Matching;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Notifications;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Candidatos;

public interface ICandidatoService
{
    Task<CandidatePagedResponse> ListAsync(CandidateListQuery query, CancellationToken ct);
    Task<CandidateResponse?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<CandidateResponse> CreateAsync(CandidateCreateRequest request, CancellationToken ct);
    Task<CandidateResponse?> UpdateAsync(Guid id, CandidateUpdateRequest request, CancellationToken ct);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct);
    Task<IReadOnlyList<CandidateStatusHistoryItemResponse>> ListStatusHistoryAsync(Guid candidatoId, CancellationToken ct);
    Task<CandidateDocumentoResponse?> AddDocumentoAsync(Guid candidatoId, CandidateDocumentType tipo, string? descricao, IFormFile arquivo, CancellationToken ct);
    Task<CandidatoDocumentoFileResult?> GetDocumentoFileAsync(Guid candidatoId, Guid documentoId, CancellationToken ct);
    Task<bool> DeleteDocumentoAsync(Guid candidatoId, Guid documentoId, CancellationToken ct);
}

public sealed record CandidatoDocumentoFileResult(string FilePath, string? ContentType, string FileName);

public sealed class CandidatoService : ICandidatoService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly IHostEnvironment _hostEnvironment;
    private readonly IStringLocalizer<ServiceMessages> _localizer;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly NotificationPublisher _notificationPublisher;
    private readonly IMatchingService _matchingService;

    public CandidatoService(
        AppDbContext db,
        ITenantContext tenantContext,
        IHostEnvironment hostEnvironment,
        IHttpContextAccessor httpContextAccessor,
        IStringLocalizer<ServiceMessages> localizer,
        NotificationPublisher notificationPublisher,
        IMatchingService matchingService)
    {
        _db = db;
        _tenantContext = tenantContext;
        _hostEnvironment = hostEnvironment;
        _httpContextAccessor = httpContextAccessor;
        _localizer = localizer;
        _notificationPublisher = notificationPublisher;
        _matchingService = matchingService;
    }

    public async Task<CandidatePagedResponse> ListAsync(CandidateListQuery query, CancellationToken ct)
    {
        IQueryable<Candidato> q = _db.Candidatos
            .AsNoTracking()
            .Include(x => x.Vaga);

        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var term = query.Q.Trim();
            var like = $"%{term}%";

            q = q.Where(c =>
                EF.Functions.Like(c.Nome, like) ||
                EF.Functions.Like(c.Email, like) ||
                (c.Fone != null && EF.Functions.Like(c.Fone, like)) ||
                (c.Cidade != null && EF.Functions.Like(c.Cidade, like)) ||
                (c.Uf != null && EF.Functions.Like(c.Uf, like)) ||
                (c.Obs != null && EF.Functions.Like(c.Obs, like)) ||
                (c.Vaga != null &&
                    ((c.Vaga.Codigo != null && EF.Functions.Like(c.Vaga.Codigo, like)) ||
                     EF.Functions.Like(c.Vaga.Titulo, like)))
            );
        }

        if (query.Statuses is { Count: > 0 })
            q = q.Where(c => query.Statuses.Contains(c.Status));
        else if (query.Status.HasValue)
            q = q.Where(c => c.Status == query.Status.Value);

        if (query.Fonte.HasValue)
            q = q.Where(c => c.Fonte == query.Fonte.Value);

        if (query.VagaIds is { Count: > 0 })
            q = q.Where(c => c.VagaId.HasValue && query.VagaIds.Contains(c.VagaId.Value));
        else if (query.VagaId.HasValue && query.VagaId.Value != Guid.Empty)
            q = q.Where(c => c.VagaId == query.VagaId.Value);

        if (query.AreaId.HasValue && query.AreaId.Value != Guid.Empty)
            q = q.Where(c => c.Vaga != null && c.Vaga.AreaId == query.AreaId.Value);

        if (query.RecrutadorUserId.HasValue && query.RecrutadorUserId.Value != Guid.Empty)
            q = q.Where(c => c.Vaga != null && c.Vaga.RecrutadorResponsavelUserId == query.RecrutadorUserId.Value);

        var ordered = q
            .OrderByDescending(c => c.UpdatedAtUtc)
            .ThenByDescending(c => c.CreatedAtUtc);

        var totalCount = await ordered.CountAsync(ct);

        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);

        var items = await ordered
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new CandidateListItemResponse(
                c.Id,
                c.Nome,
                c.Email,
                c.Fone,
                c.Cidade,
                c.Uf,
                c.Fonte,
                c.Status,
                c.VagaId,
                c.Vaga != null ? c.Vaga.Codigo : null,
                c.Vaga != null ? c.Vaga.Titulo : null,
                c.Obs,
                c.CvText,
                MapMatch(c),
                c.ApplicationRecruiterUserId,
                c.ApplicationRecruiterUserName,
                c.CreatedAtUtc,
                c.UpdatedAtUtc
            ))
            .ToListAsync(ct);

        return new CandidatePagedResponse(items, totalCount, page, pageSize);
    }

    public async Task<CandidateResponse?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.Candidatos
            .AsNoTracking()
            .Include(x => x.Vaga)
            .Include(x => x.Documentos)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        return entity is null ? null : MapToResponse(entity);
    }

    /// <summary>
    /// Cria um novo candidato. Todo candidato novo entra em Triagem; em seguida passa por avaliação e atualização (dados/status) para análise e demanda.
    /// O status na criação é sempre Triagem (request.Status é ignorado).
    /// </summary>
    public async Task<CandidateResponse> CreateAsync(CandidateCreateRequest request, CancellationToken ct)
    {
        await EnsureVagaAsync(request.VagaId, ct);

        var entity = new Candidato
        {
            Id = Guid.NewGuid(),
            Nome = (request.Nome ?? string.Empty).Trim(),
            Email = NormalizeEmail(request.Email),
            Fone = TrimToMax(request.Fone, 40),
            Cidade = TrimToMax(request.Cidade, 120),
            Uf = NormalizeUf(request.Uf),
            Fonte = request.Fonte,
            Status = CandidateStatus.Triagem,
            VagaId = request.VagaId,
            TalentoId = request.TalentoId,
            Obs = TrimToMax(request.Obs, 2000),
            CvText = TrimOrNull(request.CvText),
            PortalAccessKey = GeneratePortalAccessKey(),
            ApplicationRecruiterUserId = TrimToMax(request.ApplicationRecruiterUserId, 120),
            ApplicationRecruiterUserName = TrimToMax(request.ApplicationRecruiterUserName, 200)
        };

        entity.Documentos = BuildDocumentos(request.Documentos, entity.Id);

        ApplyLastMatch(entity, request.LastMatch);

        _db.Candidatos.Add(entity);
        await _db.SaveChangesAsync(ct);

        if (request.VagaId != Guid.Empty)
            await _matchingService.CalculateAndStoreAsync(entity.Id, request.VagaId, ct);

        await NotifyNewCandidateAsync(entity, ct);

        return (await GetByIdAsync(entity.Id, ct))!;
    }

    public async Task<CandidateResponse?> UpdateAsync(Guid id, CandidateUpdateRequest request, CancellationToken ct)
    {
        var entity = await _db.Candidatos
            .Include(x => x.Documentos)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (entity is null) return null;

        await EnsureVagaAsync(request.VagaId, ct);

        var previousStatus = entity.Status;

        entity.Nome = (request.Nome ?? string.Empty).Trim();
        entity.Email = NormalizeEmail(request.Email);
        entity.Fone = TrimToMax(request.Fone, 40);
        entity.Cidade = TrimToMax(request.Cidade, 120);
        entity.Uf = NormalizeUf(request.Uf);
        entity.Fonte = request.Fonte;
        entity.Status = request.Status;
        entity.VagaId = request.VagaId;
        entity.Obs = TrimToMax(request.Obs, 2000);
        entity.CvText = TrimOrNull(request.CvText);
        entity.ApplicationRecruiterUserId = TrimToMax(request.ApplicationRecruiterUserId, 120);
        entity.ApplicationRecruiterUserName = TrimToMax(request.ApplicationRecruiterUserName, 200);
        entity.TalentoId = request.TalentoId;

        ApplyLastMatch(entity, request.LastMatch);

        if (request.Documentos is not null)
        {
            if (entity.Documentos.Count > 0)
                _db.CandidatoDocumentos.RemoveRange(entity.Documentos);

            entity.Documentos = BuildDocumentos(request.Documentos, entity.Id);
        }

        if (previousStatus != request.Status)
        {
            var (userId, userName) = GetUserInfo();
            var change = request.StatusChange;

            _db.CandidatoStatusHistories.Add(new CandidatoStatusHistory
            {
                Id = Guid.NewGuid(),
                CandidatoId = entity.Id,
                FromStatus = previousStatus,
                ToStatus = request.Status,
                Reason = change?.Reason,
                Note = change?.Note,
                Source = change?.Source,
                UserId = userId,
                UserName = userName
            });
        }

        await _db.SaveChangesAsync(ct);

        if (entity.VagaId.HasValue && entity.VagaId.Value != Guid.Empty)
            await _matchingService.CalculateAndStoreAsync(id, entity.VagaId.Value, ct);

        return await GetByIdAsync(id, ct);
    }

    public async Task<IReadOnlyList<CandidateStatusHistoryItemResponse>> ListStatusHistoryAsync(Guid candidatoId, CancellationToken ct)
    {
        return await _db.CandidatoStatusHistories
            .AsNoTracking()
            .Where(x => x.CandidatoId == candidatoId)
            .OrderByDescending(x => x.CreatedAtUtc)
            .Select(x => new CandidateStatusHistoryItemResponse(
                x.Id,
                x.FromStatus,
                x.ToStatus,
                x.Reason,
                x.Note,
                x.Source,
                x.UserId,
                x.UserName,
                x.CreatedAtUtc
            ))
            .ToListAsync(ct);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.Candidatos
            .Include(x => x.Documentos)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return false;

        var files = entity.Documentos
            .Where(d => !string.IsNullOrWhiteSpace(d.StorageFileName))
            .Select(d => d.StorageFileName!)
            .ToList();

        var folder = GetCandidateFolder(id);

        _db.Candidatos.Remove(entity);
        await _db.SaveChangesAsync(ct);

        DeleteStoredFiles(folder, files);
        TryDeleteFolder(folder);
        return true;
    }

    public async Task<CandidateDocumentoResponse?> AddDocumentoAsync(Guid candidatoId, CandidateDocumentType tipo, string? descricao, IFormFile arquivo, CancellationToken ct)
    {
        if (arquivo is null || arquivo.Length == 0)
            throw new InvalidOperationException(_localizer["ServiceErrors.CandidatoFileInvalid"]);

        var exists = await _db.Candidatos
            .AsNoTracking()
            .AnyAsync(x => x.Id == candidatoId, ct);

        if (!exists) return null;

        var originalName = NormalizeFileName(arquivo.FileName);
        var documentId = Guid.NewGuid();
        var storageFileName = BuildStorageFileName(documentId, originalName);
        var folder = GetCandidateFolder(candidatoId);
        Directory.CreateDirectory(folder);
        var filePath = Path.Combine(folder, storageFileName);

        await using (var stream = new FileStream(filePath, FileMode.Create, FileAccess.Write, FileShare.None))
        {
            await arquivo.CopyToAsync(stream, ct);
        }

        var doc = new CandidatoDocumento
        {
            Id = documentId,
            CandidatoId = candidatoId,
            Tipo = tipo,
            NomeArquivo = originalName,
            ContentType = TrimOrNull(arquivo.ContentType),
            Descricao = TrimOrNull(descricao),
            TamanhoBytes = arquivo.Length,
            StorageFileName = storageFileName,
            Url = null
        };

        try
        {
            _db.CandidatoDocumentos.Add(doc);
            await _db.SaveChangesAsync(ct);
        }
        catch
        {
            TryDeleteFile(filePath);
            throw;
        }

        return MapDocumento(candidatoId, doc);
    }

    public async Task<CandidatoDocumentoFileResult?> GetDocumentoFileAsync(Guid candidatoId, Guid documentoId, CancellationToken ct)
    {
        var doc = await _db.CandidatoDocumentos
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == documentoId && x.CandidatoId == candidatoId, ct);

        if (doc is null || string.IsNullOrWhiteSpace(doc.StorageFileName))
            return null;

        var folder = GetCandidateFolder(candidatoId);
        var path = Path.Combine(folder, doc.StorageFileName);
        if (!File.Exists(path))
            return null;

        return new CandidatoDocumentoFileResult(path, doc.ContentType, doc.NomeArquivo);
    }

    public async Task<bool> DeleteDocumentoAsync(Guid candidatoId, Guid documentoId, CancellationToken ct)
    {
        var doc = await _db.CandidatoDocumentos
            .FirstOrDefaultAsync(x => x.Id == documentoId && x.CandidatoId == candidatoId, ct);

        if (doc is null) return false;

        var filePath = string.IsNullOrWhiteSpace(doc.StorageFileName)
            ? null
            : Path.Combine(GetCandidateFolder(candidatoId), doc.StorageFileName);

        _db.CandidatoDocumentos.Remove(doc);
        await _db.SaveChangesAsync(ct);

        if (filePath is not null)
            TryDeleteFile(filePath);

        return true;
    }

    private async Task EnsureVagaAsync(Guid vagaId, CancellationToken ct)
    {
        var exists = await _db.Vagas.AnyAsync(v => v.Id == vagaId, ct);
        if (!exists) throw new InvalidOperationException(_localizer["ServiceErrors.CandidatoVagaInvalid"]);
    }

    private static string GeneratePortalAccessKey()
    {
        var raw = Convert.ToBase64String(Guid.NewGuid().ToByteArray());
        return raw.TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    private static CandidateResponse MapToResponse(Candidato c)
    {
        return new CandidateResponse(
            c.Id,
            c.Nome,
            c.Email,
            c.Fone,
            c.Cidade,
            c.Uf,
            c.Fonte,
            c.Status,
            c.VagaId,
            c.Vaga != null ? c.Vaga.Codigo : null,
            c.Vaga != null ? c.Vaga.Titulo : null,
            c.Vaga?.AreaId,
            c.Vaga?.RecrutadorResponsavelUserId,
            c.Obs,
            c.CvText,
            MapMatch(c),
            c.Documentos.OrderByDescending(x => x.CreatedAtUtc).Select(doc => MapDocumento(c.Id, doc)).ToList(),
            c.ApplicationRecruiterUserId,
            c.ApplicationRecruiterUserName,
            c.CreatedAtUtc,
            c.UpdatedAtUtc
        );
    }

    private static CandidateDocumentoResponse MapDocumento(Guid candidatoId, CandidatoDocumento d)
    {
        var url = !string.IsNullOrWhiteSpace(d.StorageFileName)
            ? BuildDownloadUrl(candidatoId, d.Id)
            : TrimOrNull(d.Url);

        return new CandidateDocumentoResponse(
            d.Id,
            d.Tipo,
            d.NomeArquivo,
            d.ContentType,
            d.Descricao,
            d.TamanhoBytes,
            url,
            d.CreatedAtUtc,
            d.UpdatedAtUtc
        );
    }

    private static CandidateMatchResponse? MapMatch(Candidato c)
    {
        if (c.LastMatchScore is null && c.LastMatchPass is null && c.LastMatchAtUtc is null && c.LastMatchVagaId is null)
            return null;

        return new CandidateMatchResponse(
            c.LastMatchScore,
            c.LastMatchPass,
            c.LastMatchAtUtc,
            c.LastMatchVagaId
        );
    }

    private static void ApplyLastMatch(Candidato entity, CandidateMatchRequest? match)
    {
        if (match is null)
        {
            entity.LastMatchScore = null;
            entity.LastMatchPass = null;
            entity.LastMatchAtUtc = null;
            entity.LastMatchVagaId = null;
            return;
        }

        entity.LastMatchScore = match.Score;
        entity.LastMatchPass = match.Pass;
        entity.LastMatchAtUtc = match.AtUtc;
        entity.LastMatchVagaId = match.VagaId;
    }

    private static List<CandidatoDocumento> BuildDocumentos(IReadOnlyList<CandidateDocumentoRequest>? items, Guid candidatoId)
    {
        if (items is null || items.Count == 0) return [];

        var list = new List<CandidatoDocumento>(items.Count);
        for (var i = 0; i < items.Count; i++)
        {
            var item = items[i];
            list.Add(new CandidatoDocumento
            {
                Id = Guid.NewGuid(),
                CandidatoId = candidatoId,
                Tipo = item.Tipo,
                NomeArquivo = (item.NomeArquivo ?? string.Empty).Trim(),
                ContentType = TrimOrNull(item.ContentType),
                Descricao = TrimOrNull(item.Descricao),
                TamanhoBytes = item.TamanhoBytes,
                Url = TrimOrNull(item.Url)
            });
        }
        return list;
    }

    private string GetCandidateFolder(Guid candidatoId)
    {
        return Path.Combine(
            _hostEnvironment.ContentRootPath,
            "App_Data",
            "uploads",
            _tenantContext.TenantId,
            "candidatos",
            candidatoId.ToString("N"));
    }

    private static string BuildStorageFileName(Guid documentId, string originalName)
    {
        var extension = Path.GetExtension(originalName);
        if (!string.IsNullOrWhiteSpace(extension))
        {
            extension = new string(extension
                .Where(c => char.IsLetterOrDigit(c) || c == '.')
                .ToArray());

            if (extension.Length > 12)
                extension = extension[..12];
        }
        else
        {
            extension = string.Empty;
        }

        return $"{documentId:N}{extension}";
    }

    private static string NormalizeFileName(string? fileName)
    {
        var name = Path.GetFileName(fileName ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(name))
            name = "documento";

        if (name.Length > 200)
            name = name[..200];

        return name;
    }

    private static string BuildDownloadUrl(Guid candidatoId, Guid documentoId)
        => $"/api/candidatos/{candidatoId}/documentos/{documentoId}/download";

    private static void DeleteStoredFiles(string folder, IEnumerable<string> files)
    {
        foreach (var file in files)
        {
            var path = Path.Combine(folder, file);
            TryDeleteFile(path);
        }
    }

    private static void TryDeleteFolder(string folder)
    {
        try
        {
            if (Directory.Exists(folder))
                Directory.Delete(folder, true);
        }
        catch
        {
            // Ignorar falhas de limpeza.
        }
    }

    private static void TryDeleteFile(string path)
    {
        try
        {
            if (File.Exists(path))
                File.Delete(path);
        }
        catch
        {
            // Ignorar falhas de limpeza.
        }
    }

    private static string NormalizeEmail(string? email)
        => (email ?? string.Empty).Trim().ToLowerInvariant();

    private static string? NormalizeUf(string? uf)
    {
        var text = (uf ?? string.Empty).Trim();
        return string.IsNullOrWhiteSpace(text) ? null : text.ToUpperInvariant();
    }

    private static string? TrimOrNull(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string? TrimToMax(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var trimmed = value.Trim();
        return trimmed.Length <= maxLength ? trimmed : trimmed[..maxLength];
    }

    private (string? userId, string? userName) GetUserInfo()
    {
        var user = _httpContextAccessor.HttpContext?.User;
        if (user is null || user.Identity?.IsAuthenticated != true)
            return (null, null);

        var id = user.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier)?.Value;
        var name = user.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Name)?.Value;
        return (id, name);
    }

    private async Task NotifyNewCandidateAsync(Candidato entity, CancellationToken ct)
    {
        try
        {
            var vagaInfo = await _db.Vagas
                .AsNoTracking()
                .Where(v => v.Id == entity.VagaId)
                .Select(v => new { v.Codigo, v.Titulo })
                .FirstOrDefaultAsync(ct);

            var parts = new List<string>
            {
                $"Nome: {entity.Nome}",
                $"Email: {entity.Email}"
            };

            if (!string.IsNullOrWhiteSpace(entity.Fone))
                parts.Add($"Fone: {entity.Fone}");

            if (vagaInfo is not null)
            {
                var code = string.IsNullOrWhiteSpace(vagaInfo.Codigo) ? "—" : vagaInfo.Codigo;
                parts.Add($"Vaga: {vagaInfo.Titulo} ({code})");
            }

            var message = string.Join(" | ", parts);
            var request = new NotificationSendRequest(
                NotificationScope.Tenant,
                "Novo candidato cadastrado",
                message,
                "info",
                $"/Candidatos?open={entity.Id}",
                _tenantContext.TenantId,
                null);

            await _notificationPublisher.PublishToTenantsAsync(new[] { _tenantContext.TenantId }, request, ct);
        }
        catch
        {
            // best-effort: falha na notificacao nao deve bloquear cadastro
        }
    }
}
