using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Contracts.Candidates;
using RhPortal.Api.Contracts.Talentos;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Contracts.Notifications;
using RhPortal.Api.Application.Ai;
using RhPortal.Api.Application.Candidaturas;
using RhPortal.Api.Application.Matching;
using RhPortal.Api.Application.Talentos;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Inbox;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Notifications;
using RhPortal.Api.Infrastructure.Tenancy;
using RHPortal.Api.Domain.Enums;

namespace RhPortal.Api.Application.Candidatos;

public interface ICandidatoService
{
    Task<CandidatePagedResponse> ListAsync(CandidateListQuery query, CancellationToken ct);
    Task<CandidateResponse?> GetByIdAsync(Guid id, CancellationToken ct, Guid? documentosFiltrarPorVagaId = null);
    Task<CandidateResponse> CreateAsync(CandidateCreateRequest request, CancellationToken ct);
    Task<CandidateResponse?> UpdateAsync(Guid id, CandidateUpdateRequest request, CancellationToken ct);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct);
    /// <summary>Remove todos os candidatos do tenant atual (inclui documentos em disco). Retorna o número removido.</summary>
    Task<int> DeleteAllForTenantAsync(CancellationToken ct);
    /// <summary>Desvincula todos os candidatos de uma vaga (VagaId = null), mantendo os dados na base como talentos.</summary>
    Task<int> DesvincularDaVagaAsync(Guid vagaId, CancellationToken ct);
    Task<IReadOnlyList<CandidateStatusHistoryItemResponse>> ListStatusHistoryAsync(Guid candidatoId, CancellationToken ct);
    Task<CandidateDocumentoResponse?> AddDocumentoAsync(Guid candidatoId, CandidateDocumentType tipo, string? descricao, IFormFile arquivo, CancellationToken ct, Guid? vagaId = null);
    /// <summary>Upload de currículo (PDF), extração de texto e opcionalmente dados sugeridos pela LLM para o usuário revisar na tela.</summary>
    Task<CandidatoCurriculoExtrairResponse?> UploadCurriculoEExtrairAsync(Guid candidatoId, IFormFile arquivo, bool enviarParaGpt, CancellationToken ct);
    /// <summary>Extrai texto e campos via IA (sem heurística) para pré-preencher o Novo Candidato.</summary>
    Task<CandidatoCurriculoParseResponse> ParseCurriculoAsync(IFormFile arquivo, Guid? vagaId, CancellationToken ct);
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
    private readonly ICvGptExtractor _cvGptExtractor;
    private readonly ITenantAiSettingsResolver _aiSettingsResolver;
    private readonly IRHPortalAiMatchClient? _aiMatchClient;
    private readonly ICandidatoVagaMatchingScoreService? _matchingScoreService;
    private readonly ICandidaturaService? _candidaturaService;
    private readonly ICurrentUserContext _currentUser;

    public CandidatoService(
        AppDbContext db,
        ITenantContext tenantContext,
        IHostEnvironment hostEnvironment,
        IHttpContextAccessor httpContextAccessor,
        IStringLocalizer<ServiceMessages> localizer,
        NotificationPublisher notificationPublisher,
        IMatchingService matchingService,
        ICvGptExtractor cvGptExtractor,
        ITenantAiSettingsResolver aiSettingsResolver,
        ICurrentUserContext currentUser,
        IRHPortalAiMatchClient? aiMatchClient = null,
        ICandidatoVagaMatchingScoreService? matchingScoreService = null,
        ICandidaturaService? candidaturaService = null)
    {
        _db = db;
        _tenantContext = tenantContext;
        _hostEnvironment = hostEnvironment;
        _httpContextAccessor = httpContextAccessor;
        _localizer = localizer;
        _notificationPublisher = notificationPublisher;
        _matchingService = matchingService;
        _cvGptExtractor = cvGptExtractor;
        _aiSettingsResolver = aiSettingsResolver;
        _currentUser = currentUser;
        _aiMatchClient = aiMatchClient;
        _matchingScoreService = matchingScoreService;
        _candidaturaService = candidaturaService;
    }

    /// <summary>
    /// Garante que exista uma <see cref="Candidatura"/> (Candidato↔Vaga) e sincroniza o cache
    /// <c>Candidato.VagaId</c>. Best-effort em ambientes onde <c>ICandidaturaService</c> não está
    /// injetado (testes legados que usam o overload sem o serviço).
    /// </summary>
    private async Task EnsureCandidaturaAndSyncAsync(Guid candidatoId, Guid vagaId, string? fonte, string? obs, CancellationToken ct)
    {
        if (vagaId == Guid.Empty) return;
        if (_candidaturaService is null) return;
        try
        {
            await _candidaturaService.GetOrCreateAsync(candidatoId, vagaId, fonte, obs, ct);
        }
        catch
        {
            // best-effort: não falha criação/atualização do candidato por causa da candidatura.
        }
    }

    public async Task<int> DesvincularDaVagaAsync(Guid vagaId, CancellationToken ct)
    {
        var candidatos = await _db.Candidatos
            .Where(c => c.VagaId == vagaId)
            .ToListAsync(ct);

        foreach (var c in candidatos)
            c.VagaId = null;

        await _db.SaveChangesAsync(ct);
        return candidatos.Count;
    }

    public async Task<CandidatePagedResponse> ListAsync(CandidateListQuery query, CancellationToken ct)
    {
        IQueryable<Candidato> q = _db.Candidatos
            .AsNoTracking()
            // Não usar Include aqui: a tela usa apenas projeções de campos da Vaga
            // (ex.: Codigo/Titulo). O Include carregaria a entidade inteira e pode
            // quebrar se o schema do tenant não tiver todas as colunas mais novas.
            ;

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

        // Carteira de vagas: espelha VagaService.ApplyVagasDataScopeFilter — a lista de candidatos
        // não pode ser mais restritiva que a de vagas (ex.: analista só em SolicitacaoVaga ou vaga
        // Aberta sem RecrutadorResponsavel na fila comum).
        if (query.AreaId.HasValue && query.AreaId.Value != Guid.Empty)
        {
            var areaId = query.AreaId.Value;
            var analystId = _currentUser.UserId;
            q = q.Where(c =>
                (c.VagaId.HasValue
                 && _db.Vagas.Any(v => v.Id == c.VagaId!.Value
                     && (v.CentroCustoId == areaId
                         || (analystId.HasValue && _db.SolicitacoesVaga.Any(s =>
                             s.VagaId == v.Id && s.AnalistaRhResponsavelUserId == analystId.Value)))))
                || _db.Candidaturas.Any(cand => cand.CandidatoId == c.Id
                    && _db.Vagas.Any(v => v.Id == cand.VagaId
                        && (v.CentroCustoId == areaId
                            || (analystId.HasValue && _db.SolicitacoesVaga.Any(s =>
                                s.VagaId == v.Id && s.AnalistaRhResponsavelUserId == analystId.Value))))));
        }

        if (query.RecrutadorUserId.HasValue && query.RecrutadorUserId.Value != Guid.Empty)
        {
            var rid = query.RecrutadorUserId.Value;
            q = q.Where(c =>
                (c.VagaId.HasValue
                 && _db.Vagas.Any(v => v.Id == c.VagaId!.Value
                     && (v.RecrutadorResponsavelUserId == rid
                         || _db.SolicitacoesVaga.Any(s => s.VagaId == v.Id && s.AnalistaRhResponsavelUserId == rid)
                         || (v.Status == VagaStatus.Aberta && v.RecrutadorResponsavelUserId == null))))
                || _db.Candidaturas.Any(cand => cand.CandidatoId == c.Id
                    && _db.Vagas.Any(v => v.Id == cand.VagaId
                        && (v.RecrutadorResponsavelUserId == rid
                            || _db.SolicitacoesVaga.Any(s => s.VagaId == v.Id && s.AnalistaRhResponsavelUserId == rid)
                            || (v.Status == VagaStatus.Aberta && v.RecrutadorResponsavelUserId == null)))));
        }

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
                c.Celular,
                c.Cidade,
                c.Uf,
                c.LinkedinUrl,
                c.Fonte,
                c.Status,
                c.TrabalhandoAtualmente,
                c.PretensaoSalarial,
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

        if (!_currentUser.CanViewCandidatoContato)
        {
            items = items
                .Select(i => i with { Email = string.Empty, Fone = null, Celular = null })
                .ToList();
        }

        return new CandidatePagedResponse(items, totalCount, page, pageSize);
    }

    public async Task<CandidateResponse?> GetByIdAsync(Guid id, CancellationToken ct, Guid? documentosFiltrarPorVagaId = null)
    {
        var entity = await _db.Candidatos
            .AsNoTracking()
            .Include(x => x.Documentos)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (entity is null) return null;

        IEnumerable<CandidatoDocumento> docsEnum = entity.Documentos;
        if (documentosFiltrarPorVagaId is { } vf && vf != Guid.Empty)
        {
            // Inclui anexos da vaga e legados/genéricos (VagaId null), como CV do portal sem vaga no upload.
            docsEnum = docsEnum.Where(d => d.VagaId == null || d.VagaId == vf);
        }

        var documentos = docsEnum
            .OrderByDescending(x => x.CreatedAtUtc)
            .Select(doc => MapDocumento(entity.Id, doc))
            .ToList();

        // Buscar apenas os campos necessários da Vaga para evitar dependência
        // de colunas novas que podem não existir em todos os tenants.
        string? vagaCodigo = null;
        string? vagaTitulo = null;
        Guid? vagaAreaId = null;
        Guid? vagaRecrutadorResponsavelUserId = null;

        if (entity.VagaId is { } vagaId && vagaId != Guid.Empty)
        {
            var vaga = await _db.Vagas
                .AsNoTracking()
                .Where(v => v.Id == vagaId)
                .Select(v => new
                {
                    v.Codigo,
                    v.Titulo,
                    v.CentroCustoId,
                    v.RecrutadorResponsavelUserId
                })
                .FirstOrDefaultAsync(ct);

            vagaCodigo = vaga?.Codigo;
            vagaTitulo = vaga?.Titulo;
            vagaAreaId = vaga?.CentroCustoId;
            vagaRecrutadorResponsavelUserId = vaga?.RecrutadorResponsavelUserId;
        }

        return new CandidateResponse(
            entity.Id,
            entity.Nome,
            _currentUser.CanViewCandidatoContato ? entity.Email : string.Empty,
            _currentUser.CanViewCandidatoContato ? entity.Fone : null,
            _currentUser.CanViewCandidatoContato ? entity.Celular : null,
            entity.Cidade,
            entity.Uf,
            entity.LinkedinUrl,
            entity.Fonte,
            entity.Status,
            entity.TrabalhandoAtualmente,
            entity.PretensaoSalarial,
            entity.VagaId,
            vagaCodigo,
            vagaTitulo,
            vagaAreaId,
            vagaRecrutadorResponsavelUserId,
            entity.TalentoId,
            entity.Obs,
            entity.ResumoProfissional,
            entity.CvText,
            MapMatch(entity),
            documentos,
            entity.ApplicationRecruiterUserId,
            entity.ApplicationRecruiterUserName,
            entity.CreatedAtUtc,
            entity.UpdatedAtUtc,
            entity.FitIaNivel,
            entity.FitIaMotivo
        );
    }

    /// <summary>
    /// Cria um novo candidato. Todo candidato novo entra em Triagem; em seguida passa por avaliação e atualização (dados/status) para análise e demanda.
    /// O status na criação é sempre Triagem (request.Status é ignorado).
    /// </summary>
    public async Task<CandidateResponse> CreateAsync(CandidateCreateRequest request, CancellationToken ct)
    {
        await EnsureVagaAsync(request.VagaId, ct);

        var tenantId = _tenantContext.TenantId ?? "";
        // Deduplicate by email: if candidate with same email exists in tenant, update instead of creating duplicate.
        var normalizedEmail = NormalizeEmail(request.Email);
        var existing = await _db.Candidatos
            .AsTracking()
            .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.Email == normalizedEmail, ct);

        if (existing != null)
        {
            // Update fields with incoming data
            existing.Nome = (request.Nome ?? string.Empty).Trim();
            existing.Fone = TrimToMax(request.Fone, 40);
            existing.Celular = TrimToMax(request.Celular, 40);
            existing.Cidade = TrimToMax(request.Cidade, 120);
            existing.Uf = NormalizeUf(request.Uf);
            existing.LinkedinUrl = TrimToMax(request.LinkedinUrl, 260);
            existing.Fonte = request.Fonte;
            existing.Status = CandidateStatus.Triagem;
            existing.TrabalhandoAtualmente = request.TrabalhandoAtualmente;
            existing.PretensaoSalarial = request.PretensaoSalarial;
            existing.VagaId = request.VagaId;
            existing.TalentoId = request.TalentoId;
            existing.Obs = TrimToMax(request.Obs, 2000);
            existing.FitIaNivel = NormalizeFitIaNivel(request.FitIaNivel);
            existing.FitIaMotivo = TrimToMax(request.FitIaMotivo, 240);
            existing.CvText = TrimOrNull(request.CvText);
            existing.ApplicationRecruiterUserId = TrimToMax(request.ApplicationRecruiterUserId, 120);
            existing.ApplicationRecruiterUserName = TrimToMax(request.ApplicationRecruiterUserName, 200);
            existing.UpdatedAtUtc = DateTimeOffset.UtcNow;

            // Merge/replace documentos if provided
            if (request.Documentos != null && request.Documentos.Count > 0)
            {
                await _db.Entry(existing).Collection(x => x.Documentos).LoadAsync(ct);
                existing.Documentos = BuildDocumentos(request.Documentos, existing.Id, tenantId);
            }

            ApplyLastMatch(existing, request.LastMatch);

            await _db.SaveChangesAsync(ct);

            if (request.VagaId != Guid.Empty)
            {
                await EnsureCandidaturaAndSyncAsync(existing.Id, request.VagaId, request.Fonte.ToString(), null, ct);

                _ = Task.Run(async () => {
                    try { await _matchingService.CalculateAndStoreAsync(existing.Id, request.VagaId, CancellationToken.None); } catch { }
                    try { await TrySaveAiScoreAsync(existing.Id, request.VagaId, CancellationToken.None); } catch { }
                });
            }

            TryGenerateCandidatoEmbeddingAsync(existing.Id, ct);

            return (await GetByIdAsync(existing.Id, ct))!;
        }

        var entity = new Candidato
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Nome = (request.Nome ?? string.Empty).Trim(),
            Email = normalizedEmail,
            Fone = TrimToMax(request.Fone, 40),
            Celular = TrimToMax(request.Celular, 40),
            Cidade = TrimToMax(request.Cidade, 120),
            Uf = NormalizeUf(request.Uf),
            LinkedinUrl = TrimToMax(request.LinkedinUrl, 260),
            Fonte = request.Fonte,
            Status = CandidateStatus.Triagem,
            TrabalhandoAtualmente = request.TrabalhandoAtualmente,
            PretensaoSalarial = request.PretensaoSalarial,
            VagaId = request.VagaId,
            TalentoId = request.TalentoId,
            Obs = TrimToMax(request.Obs, 2000),
            FitIaNivel = NormalizeFitIaNivel(request.FitIaNivel),
            FitIaMotivo = TrimToMax(request.FitIaMotivo, 240),
            CvText = TrimOrNull(request.CvText),
            PortalAccessKey = GeneratePortalAccessKey(),
            ApplicationRecruiterUserId = TrimToMax(request.ApplicationRecruiterUserId, 120),
            ApplicationRecruiterUserName = TrimToMax(request.ApplicationRecruiterUserName, 200)
        };

        entity.Documentos = BuildDocumentos(request.Documentos, entity.Id, tenantId);

        ApplyLastMatch(entity, request.LastMatch);

        _db.Candidatos.Add(entity);
        await _db.SaveChangesAsync(ct);

        // ── Auto-criar Pessoa + Talento se não informado ──
        if (entity.TalentoId == null && !string.IsNullOrWhiteSpace(entity.Email))
        {
            try
            {
                // Buscar pessoa existente pelo email
                var pessoa = await _db.Set<Pessoa>()
                    .FirstOrDefaultAsync(p => p.TenantId == tenantId && p.Email == normalizedEmail, ct);

                if (pessoa == null)
                {
                    pessoa = new Pessoa
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        Nome = entity.Nome,
                        Email = entity.Email,
                        Fone = entity.Fone,
                        Cidade = entity.Cidade,
                        Uf = entity.Uf,
                        Origem = OrigemPessoa.Candidatura,
                        CreatedAtUtc = DateTimeOffset.UtcNow,
                        UpdatedAtUtc = DateTimeOffset.UtcNow,
                    };
                    _db.Set<Pessoa>().Add(pessoa);
                    await _db.SaveChangesAsync(ct);
                }

                // Buscar talento existente pela pessoa
                var talento = await _db.Set<Talento>()
                    .FirstOrDefaultAsync(t => t.TenantId == tenantId && t.PessoaId == pessoa.Id, ct);

                if (talento == null)
                {
                    talento = new Talento
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        PessoaId = pessoa.Id,
                        Origem = OrigemTalento.Candidatura,
                        CreatedAtUtc = DateTimeOffset.UtcNow,
                        UpdatedAtUtc = DateTimeOffset.UtcNow,
                    };
                    _db.Set<Talento>().Add(talento);
                    await _db.SaveChangesAsync(ct);
                }

                entity.TalentoId = talento.Id;
                await _db.SaveChangesAsync(ct);
            }
            catch (Exception ex)
            {
                // Não impedir criação do candidato se Pessoa/Talento falhar
                Console.Error.WriteLine($"[CandidatoService] Auto-criar Pessoa/Talento falhou: {ex.Message}");
            }
        }

        // Garante Candidatura + sincronização do cache Candidato.VagaId
        if (request.VagaId != Guid.Empty)
        {
            await EnsureCandidaturaAndSyncAsync(entity.Id, request.VagaId, request.Fonte.ToString(), null, ct);
        }

        // ── Auto-vincular ao ProjetoVaga ativo (candidato aparece no Pipeline) ──
        if (request.VagaId != Guid.Empty)
        {
            var projeto = await _db.Set<ProjetoVaga>()
                .Where(p => p.VagaId == request.VagaId && p.Status == StatusProjeto.Ativo)
                .OrderByDescending(p => p.Numero)
                .FirstOrDefaultAsync(ct);

            if (projeto != null)
            {
                var jaExiste = await _db.Set<ProjetoCandidato>()
                    .AnyAsync(pc => pc.ProjetoId == projeto.Id && pc.CandidatoId == entity.Id, ct);

                if (!jaExiste)
                {
                    var primeiraFase = await _db.Set<FaseProcesso>()
                        .Where(f => f.ProjetoId == projeto.Id)
                        .OrderBy(f => f.Ordem)
                        .Select(f => (Guid?)f.Id)
                        .FirstOrDefaultAsync(ct);

                    _db.Set<ProjetoCandidato>().Add(new ProjetoCandidato
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        ProjetoId = projeto.Id,
                        CandidatoId = entity.Id,
                        Status = StatusCandidatoProjeto.Ativo,
                        FaseAtualId = primeiraFase,
                        CreatedAtUtc = DateTimeOffset.UtcNow,
                        UpdatedAtUtc = DateTimeOffset.UtcNow,
                    });
                    await _db.SaveChangesAsync(ct);
                }
            }

            // Matching em background (não bloqueia criação)
            _ = Task.Run(async () => {
                try { await _matchingService.CalculateAndStoreAsync(entity.Id, request.VagaId, CancellationToken.None); } catch { }
                try { await TrySaveAiScoreAsync(entity.Id, request.VagaId, CancellationToken.None); } catch { }
            });
        }

        // Gera embedding do candidato em background (fire-and-forget)
        TryGenerateCandidatoEmbeddingAsync(entity.Id, ct);

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
        entity.Celular = TrimToMax(request.Celular, 40);
        entity.Cidade = TrimToMax(request.Cidade, 120);
        entity.Uf = NormalizeUf(request.Uf);
        entity.LinkedinUrl = TrimToMax(request.LinkedinUrl, 260);
        entity.Fonte = request.Fonte;
        entity.Status = request.Status;
        entity.TrabalhandoAtualmente = request.TrabalhandoAtualmente;
        entity.PretensaoSalarial = request.PretensaoSalarial;
        entity.VagaId = request.VagaId;
        entity.Obs = TrimToMax(request.Obs, 2000);
        entity.FitIaNivel = NormalizeFitIaNivel(request.FitIaNivel);
        entity.FitIaMotivo = TrimToMax(request.FitIaMotivo, 240);
        entity.CvText = TrimOrNull(request.CvText);
        entity.ApplicationRecruiterUserId = TrimToMax(request.ApplicationRecruiterUserId, 120);
        entity.ApplicationRecruiterUserName = TrimToMax(request.ApplicationRecruiterUserName, 200);
        entity.TalentoId = request.TalentoId;

        ApplyLastMatch(entity, request.LastMatch);

        var tenantId = _tenantContext.TenantId ?? "";
        if (request.Documentos is not null)
        {
            if (entity.Documentos.Count > 0)
                _db.CandidatoDocumentos.RemoveRange(entity.Documentos);

            entity.Documentos = BuildDocumentos(request.Documentos, entity.Id, tenantId);
        }

        if (previousStatus != request.Status)
        {
            var (userId, userName) = GetUserInfo();
            var change = request.StatusChange;

            _db.CandidatoStatusHistories.Add(new CandidatoStatusHistory
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
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
        {
            await EnsureCandidaturaAndSyncAsync(id, entity.VagaId.Value, request.Fonte.ToString(), null, ct);
            await _matchingService.CalculateAndStoreAsync(id, entity.VagaId.Value, ct);
            await TrySaveAiScoreAsync(id, entity.VagaId.Value, ct);
        }

        // Atualiza embedding do candidato em background (fire-and-forget)
        TryGenerateCandidatoEmbeddingAsync(id, ct);

        return await GetByIdAsync(id, ct);
    }

    private void TryGenerateCandidatoEmbeddingAsync(Guid candidatoId, CancellationToken ct)
    {
        if (_aiMatchClient == null) return;
        
        // Fire-and-forget: executa em background sem bloquear
        _ = Task.Run(async () =>
        {
            try
            {
                var tenantId = _tenantContext.TenantId ?? "";
                await _aiMatchClient.GenerateCandidatoEmbeddingAsync(candidatoId, tenantId, ct);
            }
            catch
            {
                // best-effort: ignora falhas silenciosamente em background
            }
        }, CancellationToken.None);
    }

    /// <summary>
    /// Extrai texto de currículo (PDF/DOCX/TXT) e persiste em <see cref="Candidato.CvText"/> quando o tipo é Currículo.
    /// </summary>
    private async Task<string?> TryExtractAndPersistCvTextAsync(
        Guid candidatoId,
        string filePath,
        CandidateDocumentType tipo,
        CancellationToken ct)
    {
        if (tipo != CandidateDocumentType.Curriculo)
            return null;

        var ext = Path.GetExtension(filePath)?.ToLowerInvariant() ?? string.Empty;
        if (ext is not ".pdf" and not ".docx" and not ".txt")
            return null;

        string extracted;
        try
        {
            extracted = await ResumeTextExtractor.ExtractAsync(filePath, ct);
        }
        catch
        {
            return null;
        }

        if (string.IsNullOrWhiteSpace(extracted))
            return null;

        var trimmed = extracted.Trim();
        var candidato = await _db.Candidatos.FirstOrDefaultAsync(x => x.Id == candidatoId, ct);
        if (candidato is null)
            return trimmed;

        candidato.CvText = trimmed;
        candidato.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        TryGenerateCandidatoEmbeddingAsync(candidatoId, ct);
        ScheduleMatchRecalcIfVaga(candidato);

        return trimmed;
    }

    private void ScheduleMatchRecalcIfVaga(Candidato candidato)
    {
        if (candidato.VagaId is not { } vagaId || vagaId == Guid.Empty)
            return;

        var candidatoId = candidato.Id;
        _ = Task.Run(async () =>
        {
            try
            {
                await _matchingService.CalculateAndStoreAsync(candidatoId, vagaId, CancellationToken.None);
                await TrySaveAiScoreAsync(candidatoId, vagaId, CancellationToken.None);
            }
            catch
            {
                /* best-effort */
            }
        });
    }

    private async Task TrySaveAiScoreAsync(Guid candidatoId, Guid vagaId, CancellationToken ct)
    {
        if (_aiMatchClient == null || _matchingScoreService == null) return;
        try
        {
            var tenantId = _tenantContext.TenantId ?? "";
            // Usa evaluate-one unificado (LLM 80/20); fallback para legado se falhar
            var result = await _aiMatchClient.EvaluateOneUnifiedAsync(vagaId, candidatoId, "candidato", tenantId, ct);
            if (!result.HasValue)
                result = await _aiMatchClient.GetScoreForOneAsync(vagaId, candidatoId, tenantId, ct);
            if (result.HasValue)
                await _matchingScoreService.SaveAiScoreAsync(candidatoId, vagaId, result.Value.Score, ct);
        }
        catch { /* best-effort */ }
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

        // Pre-check das FKs configuradas como Restrict no AppDbContext — sem isso
        // o SaveChanges lança DbUpdateException (Postgres 23503) com mensagem bruta
        // que o frontend descarta, e o usuário fica sem saber por que "falhou ao
        // excluir N candidato(s)". As demais FKs (Candidaturas, StatusHistory,
        // MatchingScores, competências, educação, etc) são Cascade ou SetNull — não
        // bloqueiam. Só PropostaVaga e ProjetoCandidato travam.
        var propostas = await _db.Set<PropostaVaga>().CountAsync(p => p.CandidatoId == id, ct);
        var projetos  = await _db.Set<ProjetoCandidato>().CountAsync(p => p.CandidatoId == id, ct);

        if (propostas > 0 || projetos > 0)
        {
            var blocos = new List<string>();
            if (propostas > 0) blocos.Add($"{propostas} proposta(s) de vaga");
            if (projetos  > 0) blocos.Add($"{projetos} participação(ões) em projeto de seleção");
            var nome = entity.Nome ?? entity.Email ?? id.ToString();
            throw new InvalidOperationException(
                $"Não é possível excluir o candidato \"{nome}\" — há vínculos: "
                + string.Join(", ", blocos)
                + ". Cancele ou remova esses vínculos antes.");
        }

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

    public async Task<int> DeleteAllForTenantAsync(CancellationToken ct)
    {
        var ids = await _db.Candidatos.AsNoTracking().Select(x => x.Id).ToListAsync(ct);
        var count = 0;
        foreach (var id in ids)
        {
            if (await DeleteAsync(id, ct))
                count++;
        }
        return count;
    }

    public async Task<CandidateDocumentoResponse?> AddDocumentoAsync(Guid candidatoId, CandidateDocumentType tipo, string? descricao, IFormFile arquivo, CancellationToken ct, Guid? vagaId = null)
    {
        if (arquivo is null || arquivo.Length == 0)
            throw new InvalidOperationException(_localizer["ServiceErrors.CandidatoFileInvalid"]);

        var exists = await _db.Candidatos
            .AsNoTracking()
            .AnyAsync(x => x.Id == candidatoId, ct);

        if (!exists) return null;

        Guid? resolvedVagaId = null;
        if (vagaId is { } v && v != Guid.Empty &&
            await _db.Vagas.AsNoTracking().AnyAsync(x => x.Id == v, ct))
            resolvedVagaId = v;

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

        var tenantId = _tenantContext.TenantId ?? "";
        var doc = new CandidatoDocumento
        {
            Id = documentId,
            TenantId = tenantId,
            CandidatoId = candidatoId,
            Tipo = tipo,
            NomeArquivo = originalName,
            ContentType = TrimOrNull(arquivo.ContentType),
            Descricao = TrimOrNull(descricao),
            TamanhoBytes = arquivo.Length,
            StorageFileName = storageFileName,
            Url = null,
            VagaId = resolvedVagaId
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

        await TryExtractAndPersistCvTextAsync(candidatoId, filePath, tipo, ct);

        return MapDocumento(candidatoId, doc);
    }

    public async Task<CandidatoCurriculoExtrairResponse?> UploadCurriculoEExtrairAsync(Guid candidatoId, IFormFile arquivo, bool enviarParaGpt, CancellationToken ct)
    {
        if (arquivo is null || arquivo.Length == 0)
            throw new InvalidOperationException(_localizer["ServiceErrors.CandidatoFileInvalid"]);

        var ext = Path.GetExtension(arquivo.FileName)?.ToLowerInvariant() ?? string.Empty;
        if (ext != ".pdf")
            throw new InvalidOperationException("Apenas arquivos PDF são aceitos para extração de currículo.");

        var exists = await _db.Candidatos.AsNoTracking().AnyAsync(x => x.Id == candidatoId, ct);
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

        var tenantId = _tenantContext.TenantId ?? "";
        var doc = new CandidatoDocumento
        {
            Id = documentId,
            TenantId = tenantId,
            CandidatoId = candidatoId,
            Tipo = CandidateDocumentType.Curriculo,
            NomeArquivo = originalName,
            ContentType = TrimOrNull(arquivo.ContentType),
            Descricao = "Currículo enviado pela tela",
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

        var cvText = await TryExtractAndPersistCvTextAsync(candidatoId, filePath, CandidateDocumentType.Curriculo, ct);
        TalentoImportPdfSuggestedData? suggestedData = null;
        if (!string.IsNullOrWhiteSpace(cvText))
        {
            if (enviarParaGpt)
            {
                try
                {
                    suggestedData = await _cvGptExtractor.ExtractSuggestedDataAsync(cvText, ct);
                }
                catch
                {
                    /* best-effort */
                }
            }

            if (suggestedData is null)
            {
                var h = CvHeuristicExtractor.Extract(cvText, originalName);
                suggestedData = new TalentoImportPdfSuggestedData(
                    h.Nome,
                    h.Email,
                    h.Celular ?? h.Fone,
                    h.Cidade,
                    h.Uf,
                    h.LinkedinUrl,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    Array.Empty<TalentoCompetenciaItem>(),
                    Array.Empty<TalentoExperienciaItem>(),
                    Array.Empty<TalentoTreinamentoItem>(),
                    Array.Empty<TalentoFormacaoItem>());
            }
        }

        var documentoResponse = MapDocumento(candidatoId, doc);
        return new CandidatoCurriculoExtrairResponse(documentoResponse, cvText, suggestedData);
    }

    public async Task<CandidatoCurriculoParseResponse> ParseCurriculoAsync(IFormFile arquivo, Guid? vagaId, CancellationToken ct)
    {
        if (arquivo is null || arquivo.Length == 0)
            throw new InvalidOperationException(_localizer["ServiceErrors.CandidatoFileInvalid"]);

        var ext = Path.GetExtension(arquivo.FileName)?.ToLowerInvariant() ?? string.Empty;
        if (ext is not (".pdf" or ".docx" or ".txt"))
            throw new InvalidOperationException("Apenas arquivos PDF, DOCX ou TXT são aceitos para análise de currículo.");

        var tempPath = Path.Combine(Path.GetTempPath(), $"cv-parse-{Guid.NewGuid():N}{ext}");
        try
        {
            await using (var stream = new FileStream(tempPath, FileMode.Create, FileAccess.Write, FileShare.None))
            {
                await arquivo.CopyToAsync(stream, ct);
            }

            var cvText = await ResumeTextExtractor.ExtractAsync(tempPath, ct);
            if (string.IsNullOrWhiteSpace(cvText))
            {
                return CvParseFieldMerger.FromAi(
                    null, null, null, aiTentou: false,
                    "Não foi possível extrair texto do arquivo (PDF pode ser imagem/scan). Preencha os dados manualmente.");
            }

            var tenantConfig = await _db.TenantConfiguracoes.AsNoTracking().FirstOrDefaultAsync(ct);
            var usarIa = tenantConfig?.UsarIaParseCurriculo ?? true;
            if (!usarIa)
            {
                return CvParseFieldMerger.FromAi(
                    cvText, null, null, aiTentou: false,
                    "O preenchimento automático por IA está desligado nas configurações do tenant. Preencha os dados manualmente.");
            }

            if (!await _aiSettingsResolver.IsAiEnabledAsync(ct))
            {
                return CvParseFieldMerger.FromAi(
                    cvText, null, null, aiTentou: false,
                    "O módulo de IA está desabilitado para este tenant. Preencha os dados manualmente.");
            }

            string? vagaTitulo = null;
            string? vagaContexto = null;
            if (vagaId is Guid vid && vid != Guid.Empty)
            {
                var vaga = await _db.Vagas.AsNoTracking()
                    .Include(v => v.Requisitos)
                    .FirstOrDefaultAsync(v => v.Id == vid, ct);
                if (vaga is not null)
                {
                    vagaTitulo = string.IsNullOrWhiteSpace(vaga.FuncaoNomeRm)
                        ? vaga.Titulo
                        : $"{vaga.Titulo} ({vaga.FuncaoNomeRm})";
                    var reqLines = (vaga.Requisitos ?? [])
                        .Where(r => !string.IsNullOrWhiteSpace(r.Nome))
                        .Select(r => $"- {r.Nome}");
                    vagaContexto = string.Join("\n", new[]
                        {
                            vaga.DescricaoInterna,
                            vaga.DescricaoPublica,
                            reqLines.Any() ? "Requisitos:\n" + string.Join("\n", reqLines) : null
                        }.Where(s => !string.IsNullOrWhiteSpace(s)));
                }
            }

            try
            {
                var aiResult = await _cvGptExtractor.ExtractForNovoCandidatoAsync(cvText, vagaTitulo, vagaContexto, ct);
                return CvParseFieldMerger.FromAi(cvText, aiResult.Data, aiResult.RawContent, aiTentou: true, aiResult.Error);
            }
            catch (Exception ex)
            {
                return CvParseFieldMerger.FromAi(
                    cvText, null, null, aiTentou: true,
                    $"Falha ao consultar a IA: {ex.Message}. Preencha os dados manualmente.");
            }
        }
        finally
        {
            TryDeleteFile(tempPath);
        }
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

    private CandidateResponse MapToResponse(Candidato c)
    {
        var exposeContato = _currentUser.CanViewCandidatoContato;
        return new CandidateResponse(
            c.Id,
            c.Nome,
            exposeContato ? c.Email : string.Empty,
            exposeContato ? c.Fone : null,
            exposeContato ? c.Celular : null,
            c.Cidade,
            c.Uf,
            c.LinkedinUrl,
            c.Fonte,
            c.Status,
            c.TrabalhandoAtualmente,
            c.PretensaoSalarial,
            c.VagaId,
            c.Vaga != null ? c.Vaga.Codigo : null,
            c.Vaga != null ? c.Vaga.Titulo : null,
            c.Vaga?.CentroCustoId,
            c.Vaga?.RecrutadorResponsavelUserId,
            c.TalentoId,
            c.Obs,
            c.ResumoProfissional,
            c.CvText,
            MapMatch(c),
            c.Documentos.OrderByDescending(x => x.CreatedAtUtc).Select(doc => MapDocumento(c.Id, doc)).ToList(),
            c.ApplicationRecruiterUserId,
            c.ApplicationRecruiterUserName,
            c.CreatedAtUtc,
            c.UpdatedAtUtc,
            c.FitIaNivel,
            c.FitIaMotivo
        );
    }

    private CandidateDocumentoResponse MapDocumento(Guid candidatoId, CandidatoDocumento d)
    {
        var temArquivo = CandidatoDocumentoStorage.ExistsOnDisk(_hostEnvironment, _tenantContext, candidatoId, d);
        var url = temArquivo
            ? CandidatoDocumentoStorage.BuildRhDownloadUrl(candidatoId, d.Id)
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
            d.UpdatedAtUtc,
            d.VagaId,
            temArquivo);
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

    private static List<CandidatoDocumento> BuildDocumentos(IReadOnlyList<CandidateDocumentoRequest>? items, Guid candidatoId, string tenantId)
    {
        if (items is null || items.Count == 0) return [];

        var list = new List<CandidatoDocumento>(items.Count);
        for (var i = 0; i < items.Count; i++)
        {
            var item = items[i];
            list.Add(new CandidatoDocumento
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CandidatoId = candidatoId,
                Tipo = item.Tipo,
                NomeArquivo = (item.NomeArquivo ?? string.Empty).Trim(),
                ContentType = TrimOrNull(item.ContentType),
                Descricao = TrimOrNull(item.Descricao),
                TamanhoBytes = item.TamanhoBytes,
                Url = TrimOrNull(item.Url),
                VagaId = item.VagaId is { } ev && ev != Guid.Empty ? ev : null
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

    private static string? NormalizeFitIaNivel(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var v = raw.Trim().ToLowerInvariant();
        return v switch
        {
            "baixo" or "parcial" or "adequado" or "bom" or "excelente" => v,
            _ => null
        };
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
