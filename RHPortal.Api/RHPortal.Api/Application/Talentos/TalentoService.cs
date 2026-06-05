using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Application.Matching;
using RhPortal.Api.Application.Pessoas;
using RhPortal.Api.Contracts.Pessoas;
using RhPortal.Api.Contracts.Talentos;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Inbox;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Talentos;

public sealed class TalentoService : ITalentoService
{
    private static readonly JsonSerializerOptions CvImportJobJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly IPessoaService _pessoaService;
    private readonly IHostEnvironment _hostEnvironment;
    private readonly ICvGptExtractor _cvGptExtractor;
    private readonly ILogger<TalentoService> _logger;
    private readonly IRHPortalAiMatchClient? _aiMatchClient;

    public TalentoService(
        AppDbContext db,
        ITenantContext tenantContext,
        IPessoaService pessoaService,
        IHostEnvironment hostEnvironment,
        ICvGptExtractor cvGptExtractor,
        ILogger<TalentoService> logger,
        IRHPortalAiMatchClient? aiMatchClient = null)
    {
        _db = db;
        _tenantContext = tenantContext;
        _pessoaService = pessoaService;
        _hostEnvironment = hostEnvironment;
        _cvGptExtractor = cvGptExtractor;
        _logger = logger;
        _aiMatchClient = aiMatchClient;
    }

    public async Task<TalentoPagedResponse> ListAsync(TalentoListQuery query, CancellationToken ct)
    {
        IQueryable<Talento> q = _db.Talentos
            .AsNoTracking()
            .Include(x => x.Pessoa);

        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var term = query.Q.Trim();
            var like = $"%{term}%";
            q = q.Where(t =>
                (t.Pessoa != null && (
                    EF.Functions.Like(t.Pessoa.Nome, like) ||
                    EF.Functions.Like(t.Pessoa.Email, like) ||
                    (t.Pessoa.Fone != null && EF.Functions.Like(t.Pessoa.Fone, like)) ||
                    (t.Pessoa.Cidade != null && EF.Functions.Like(t.Pessoa.Cidade, like)) ||
                    (t.Pessoa.Uf != null && EF.Functions.Like(t.Pessoa.Uf, like)))));
        }

        if (query.Origem.HasValue)
            q = q.Where(t => t.Origem == query.Origem.Value);

        var ordered = q.OrderByDescending(t => t.UpdatedAtUtc).ThenByDescending(t => t.CreatedAtUtc);
        var totalCount = await ordered.CountAsync(ct);

        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);

        var pageData = await ordered
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var talentoIds = pageData.Select(x => x.Id).ToList();
        var latestJobs = await _db.TalentoCvImportJobs
            .AsNoTracking()
            .Where(j => talentoIds.Contains(j.TalentoId))
            .OrderByDescending(j => j.CreatedAtUtc)
            .ToListAsync(ct);
        var jobByTalento = latestJobs
            .GroupBy(j => j.TalentoId)
            .ToDictionary(g => g.Key, g => g.First());
        var items = pageData.Select(t => new TalentoListItemResponse(
            t.Id,
            t.PessoaId,
            t.Pessoa!.Nome,
            t.Pessoa.Email,
            t.Pessoa.Fone,
            t.Pessoa.Cpf,
            t.Pessoa.Cidade,
            t.Pessoa.Uf,
            t.Origem,
            t.CreatedAtUtc,
            t.UpdatedAtUtc,
            t.Versao,
            jobByTalento.GetValueOrDefault(t.Id)?.Status,
            jobByTalento.GetValueOrDefault(t.Id)?.Id)).ToList();

        return new TalentoPagedResponse(items, totalCount, page, pageSize);
    }

    public async Task<TalentoResponse?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.Talentos
            .AsNoTracking()
            .Include(x => x.Pessoa)
            .Include(x => x.Competencias)
            .Include(x => x.Experiencias)
            .Include(x => x.Treinamentos)
            .Include(x => x.Formacao)
            .Include(x => x.Documentos)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity?.Pessoa is null) return null;

        PendingCvImportJobResponse? pendingJob = null;
        var pendingCvJob = await _db.TalentoCvImportJobs
            .AsNoTracking()
            .Where(j => j.TalentoId == id && j.Status == CvImportStatus.PendenteValidacao)
            .OrderByDescending(j => j.CreatedAtUtc)
            .FirstOrDefaultAsync(ct);
        if (pendingCvJob != null)
        {
            SimilarPessoaSummary? similarSummary = null;
            if (pendingCvJob.SimilarTalentoId.HasValue && !string.IsNullOrWhiteSpace(pendingCvJob.SuggestedDataJson))
            {
            try
            {
                var payload = JsonSerializer.Deserialize<CvImportJobValidationPayload>(pendingCvJob.SuggestedDataJson, CvImportJobJsonOptions);
                similarSummary = payload?.SimilarPessoaSummary;
            }
            catch { /* ignore */ }
            }
            pendingJob = new PendingCvImportJobResponse(pendingCvJob.Id, pendingCvJob.SimilarTalentoId, similarSummary);
        }

        return MapToResponse(entity, pendingJob);
    }

    public async Task<CreateTalentoResult> CreateAsync(TalentoCreateRequest request, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(PessoaService.NormalizeCpf(request.Cpf)))
        {
            var existingPessoa = await _pessoaService.FindByCpfAsync(request.Cpf ?? string.Empty, ct);
            if (existingPessoa != null)
            {
                var updateReq = BuildPessoaUpdateRequestFromCreateRequest(request, existingPessoa);
                await _pessoaService.UpdateAsync(existingPessoa.Id, updateReq, ct);
                var existingTalento = await _db.Talentos
                    .AsTracking()
                    .Include(t => t.Pessoa)
                    .FirstOrDefaultAsync(t => t.TenantId == _tenantContext.TenantId && t.PessoaId == existingPessoa.Id, ct);
                if (existingTalento is null)
                {
                    existingTalento = new Talento
                    {
                        Id = Guid.NewGuid(),
                        TenantId = _tenantContext.TenantId,
                        PessoaId = existingPessoa.Id,
                        Origem = request.Origem,
                        CreatedAtUtc = DateTimeOffset.UtcNow,
                        UpdatedAtUtc = DateTimeOffset.UtcNow,
                        Versao = 1
                    };
                    _db.Talentos.Add(existingTalento);
                    await _db.SaveChangesAsync(ct);
                }
                else
                {
                    await _db.Entry(existingTalento).Collection(x => x.Competencias).LoadAsync(ct);
                    await _db.Entry(existingTalento).Collection(x => x.Experiencias).LoadAsync(ct);
                    await _db.Entry(existingTalento).Collection(x => x.Treinamentos).LoadAsync(ct);
                    await _db.Entry(existingTalento).Collection(x => x.Formacao).LoadAsync(ct);
                    existingTalento.Competencias?.Clear();
                    existingTalento.Experiencias?.Clear();
                    existingTalento.Treinamentos?.Clear();
                    existingTalento.Formacao?.Clear();
                    ApplyCompetencias(existingTalento, request.Competencias);
                    ApplyExperiencias(existingTalento, request.Experiencias);
                    ApplyTreinamentos(existingTalento, request.Treinamentos);
                    ApplyFormacao(existingTalento, request.Formacao);
                    existingTalento.Origem = request.Origem;
                    existingTalento.UpdatedAtUtc = DateTimeOffset.UtcNow;
                    existingTalento.Versao++;
                    await _db.Entry(existingTalento).Reference(x => x.Pessoa).LoadAsync(ct);
                    existingTalento.CvProfileJson = BuildCvProfileJson(existingTalento);
                    await _db.SaveChangesAsync(ct);
                }
                TryGenerateTalentoEmbeddingAsync(existingTalento.Id);
                var response = (await GetByIdAsync(existingTalento.Id, ct))!;
                return new CreateTalentoResult(response, false, null, null);
            }
        }

        if (!request.ForceCreate)
        {
            var similar = await _pessoaService.FindSimilarAsync(request.Email, request.Fone, request.Nome, request.Cep, request.Logradouro, request.Numero, ct);
            if (similar.HasValue)
            {
                // Se já existe Talento para a Pessoa similar, retorna 409 para o cliente decidir.
                if (similar.Value.Talento != null)
                {
                    // #region agent log
                    // #endregion
                    var summary = new SimilarPessoaSummary(similar.Value.Talento.Id, similar.Value.Pessoa.Nome, similar.Value.Pessoa.Email, similar.Value.Pessoa.Fone);
                    return new CreateTalentoResult(null, true, similar.Value.Talento.Id, summary);
                }
                // Pessoa similar existe mas não tem Talento: cria o Talento e retorna 201 (integração RM/portal pode ver o talento na lista).
                var similarPessoa = similar.Value.Pessoa;
                var similarPessoaUpdate = BuildPessoaUpdateRequestFromCreateRequest(request, similarPessoa);
                await _pessoaService.UpdateAsync(similarPessoa.Id, similarPessoaUpdate, ct);
                var similarEntity = new Talento
                {
                    Id = Guid.NewGuid(),
                    TenantId = _tenantContext.TenantId,
                    PessoaId = similarPessoa.Id,
                    Origem = request.Origem,
                    CreatedAtUtc = DateTimeOffset.UtcNow,
                    UpdatedAtUtc = DateTimeOffset.UtcNow,
                    Versao = 1
                };
                _db.Talentos.Add(similarEntity);
                await _db.SaveChangesAsync(ct);
                await _db.Entry(similarEntity).Reference(x => x.Pessoa).LoadAsync(ct);
                similarEntity.Pessoa = similarPessoa;
                ApplyCompetencias(similarEntity, request.Competencias);
                ApplyExperiencias(similarEntity, request.Experiencias);
                ApplyTreinamentos(similarEntity, request.Treinamentos);
                ApplyFormacao(similarEntity, request.Formacao);
                ApplyDocumentos(similarEntity, request.Documentos);
                similarEntity.CvProfileJson = BuildCvProfileJson(similarEntity);
                await _db.SaveChangesAsync(ct);
                TryGenerateTalentoEmbeddingAsync(similarEntity.Id);
                var similarCreated = (await GetByIdAsync(similarEntity.Id, ct))!;
                return new CreateTalentoResult(similarCreated, false, null, null);
            }
        }

        var pessoa = await _pessoaService.GetOrCreateByEmailAsync(
            request.Email,
            request.Nome,
            request.Fone,
            request.Cidade,
            request.Uf,
            request.LinkedinUrl,
            request.ResumoProfissional,
            request.Obs,
            MapToOrigemPessoa(request.Origem),
            ct);

        var existingTalentoForPessoa = await _db.Talentos
            .AsTracking()
            .Include(t => t.Pessoa)
            .FirstOrDefaultAsync(t => t.TenantId == _tenantContext.TenantId && t.PessoaId == pessoa.Id, ct);
        if (existingTalentoForPessoa is not null)
        {
            await UpdateExistingTalentoFromCreateRequestAsync(existingTalentoForPessoa, request, ct);
            TryGenerateTalentoEmbeddingAsync(existingTalentoForPessoa.Id);
            var existingResponse = (await GetByIdAsync(existingTalentoForPessoa.Id, ct))!;
            return new CreateTalentoResult(existingResponse, false, null, null);
        }

        var entity = new Talento
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            PessoaId = pessoa.Id,
            Origem = request.Origem,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
            Versao = 1
        };
        _db.Talentos.Add(entity);
        await _db.SaveChangesAsync(ct);

        entity.Pessoa = pessoa;
        var pessoaUpdate = BuildPessoaUpdateRequestFromCreateRequest(request, pessoa);
        await _pessoaService.UpdateAsync(pessoa.Id, pessoaUpdate, ct);
        ApplyCompetencias(entity, request.Competencias);
        ApplyExperiencias(entity, request.Experiencias);
        ApplyTreinamentos(entity, request.Treinamentos);
        ApplyFormacao(entity, request.Formacao);
        ApplyDocumentos(entity, request.Documentos);
        await _db.SaveChangesAsync(ct);
        entity.CvProfileJson = BuildCvProfileJson(entity);
        await _db.SaveChangesAsync(ct);

        TryGenerateTalentoEmbeddingAsync(entity.Id);
        var created = (await GetByIdAsync(entity.Id, ct))!;
        return new CreateTalentoResult(created, false, null, null);
    }

    private async Task UpdateExistingTalentoFromCreateRequestAsync(Talento existingTalento, TalentoCreateRequest request, CancellationToken ct)
    {
        await _db.Entry(existingTalento).Collection(x => x.Competencias).LoadAsync(ct);
        await _db.Entry(existingTalento).Collection(x => x.Experiencias).LoadAsync(ct);
        await _db.Entry(existingTalento).Collection(x => x.Treinamentos).LoadAsync(ct);
        await _db.Entry(existingTalento).Collection(x => x.Formacao).LoadAsync(ct);

        existingTalento.Competencias.Clear();
        existingTalento.Experiencias.Clear();
        existingTalento.Treinamentos.Clear();
        existingTalento.Formacao.Clear();

        ApplyCompetencias(existingTalento, request.Competencias);
        ApplyExperiencias(existingTalento, request.Experiencias);
        ApplyTreinamentos(existingTalento, request.Treinamentos);
        ApplyFormacao(existingTalento, request.Formacao);

        existingTalento.Origem = request.Origem;
        existingTalento.UpdatedAtUtc = DateTimeOffset.UtcNow;
        existingTalento.Versao++;
        if (existingTalento.Pessoa is null)
            await _db.Entry(existingTalento).Reference(x => x.Pessoa).LoadAsync(ct);
        existingTalento.CvProfileJson = BuildCvProfileJson(existingTalento);

        await _db.SaveChangesAsync(ct);
    }

    private void ApplyDocumentos(Talento entity, IReadOnlyList<TalentoDocumentoMetaItem>? documentos)
    {
        if (documentos == null || documentos.Count == 0) return;
        foreach (var item in documentos)
        {
            var nome = TrimMax(item.NomeArquivo, 200);
            if (string.IsNullOrWhiteSpace(nome)) continue;
            var doc = new TalentoDocumento
            {
                Id = Guid.NewGuid(),
                TenantId = _tenantContext.TenantId,
                TalentoId = entity.Id,
                NomeArquivo = nome,
                Descricao = TrimMax(item.Descricao, 240),
                StorageFileName = null,
                ContentType = null,
                TamanhoBytes = null,
                CreatedAtUtc = DateTimeOffset.UtcNow,
                UpdatedAtUtc = DateTimeOffset.UtcNow
            };
            _db.TalentoDocumentos.Add(doc);
            if (entity.Documentos is null) entity.Documentos = new List<TalentoDocumento>();
            entity.Documentos.Add(doc);
        }
    }

    private static PessoaUpdateRequest BuildPessoaUpdateRequestFromCreateRequest(TalentoCreateRequest request, Pessoa pessoa)
    {
        return new PessoaUpdateRequest(
            Nome: TrimMax(request.Nome, 160),
            Email: NormalizeEmail(request.Email),
            Fone: TrimMax(request.Fone, 40),
            Cidade: TrimMax(request.Cidade, 120),
            Uf: TrimMax(request.Uf, 2),
            LinkedinUrl: TrimMax(request.LinkedinUrl, 260),
            ResumoProfissional: TrimMax(request.ResumoProfissional, 2000),
            Obs: TrimMax(request.Obs, 2000),
            Cep: TrimMax(request.Cep ?? pessoa.Cep, 20),
            Logradouro: TrimMax(request.Logradouro ?? pessoa.Logradouro, 200),
            Numero: TrimMax(request.Numero ?? pessoa.Numero, 40),
            Bairro: TrimMax(request.Bairro ?? pessoa.Bairro, 120),
            Complemento: TrimMax(pessoa.Complemento, 120),
            Cpf: TrimMax(request.Cpf ?? pessoa.Cpf, 14),
            Rg: TrimMax(pessoa.Rg, 20),
            FoneContato: TrimMax(pessoa.FoneContato, 40),
            DataNascimento: request.DataNascimento ?? pessoa.DataNascimento,
            Origem: pessoa.Origem);
    }

    public async Task<TalentoResponse?> UpdateAsync(Guid id, TalentoUpdateRequest request, CancellationToken ct)
    {
        var entity = await _db.Talentos
            .AsNoTracking()
            .Include(x => x.Pessoa)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null || entity.Pessoa is null) return null;

        var pessoaId = entity.Pessoa.Id;
        var now = DateTimeOffset.UtcNow;
        var cvJson = BuildCvProfileJsonFromUpdateRequest(request);

        // Deletar filhos direto no banco (evita change tracker e concurrency).
        await _db.TalentoCompetencias.Where(c => c.TalentoId == id).ExecuteDeleteAsync(ct);
        await _db.TalentoExperiencias.Where(e => e.TalentoId == id).ExecuteDeleteAsync(ct);
        await _db.TalentoTreinamentos.Where(t => t.TalentoId == id).ExecuteDeleteAsync(ct);
        await _db.TalentoFormacoes.Where(f => f.TalentoId == id).ExecuteDeleteAsync(ct);

        // Atualizar Talento e Pessoa por Id (sem usar change tracker).
        await _db.Talentos.IgnoreQueryFilters()
            .Where(t => t.Id == id && t.TenantId == _tenantContext.TenantId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(t => t.Versao, t => t.Versao + 1)
                .SetProperty(t => t.UpdatedAtUtc, now)
                .SetProperty(t => t.CvProfileJson, cvJson), ct);

        await _db.Pessoas.IgnoreQueryFilters()
            .Where(p => p.Id == pessoaId && p.TenantId == _tenantContext.TenantId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(p => p.Nome, (request.Nome ?? string.Empty).Trim())
                .SetProperty(p => p.Email, (request.Email ?? string.Empty).Trim().ToLowerInvariant())
                .SetProperty(p => p.Fone, TrimToMax(request.Fone, 40))
                .SetProperty(p => p.Cidade, TrimToMax(request.Cidade, 120))
                .SetProperty(p => p.Uf, TrimToMax(request.Uf, 2))
                .SetProperty(p => p.LinkedinUrl, TrimToMax(request.LinkedinUrl, 260))
                .SetProperty(p => p.ResumoProfissional, TrimToMax(request.ResumoProfissional, 2000))
                .SetProperty(p => p.Obs, TrimToMax(request.Obs, 2000))
                .SetProperty(p => p.Cpf, TrimToMax(request.Cpf, 14))
                .SetProperty(p => p.DataNascimento, request.DataNascimento)
                .SetProperty(p => p.Cep, TrimToMax(request.Cep, 20))
                .SetProperty(p => p.Logradouro, TrimToMax(request.Logradouro, 200))
                .SetProperty(p => p.Numero, TrimToMax(request.Numero, 40))
                .SetProperty(p => p.Bairro, TrimToMax(request.Bairro, 120))
                .SetProperty(p => p.UpdatedAtUtc, now), ct);

        // Inserir novos filhos (sem carregar Talento/Pessoa no tracker).
        AddUpdateRequestChildrenToContext(id, request);

        await _db.SaveChangesAsync(ct);
        TryGenerateTalentoEmbeddingAsync(id);
        return (await GetByIdAsync(id, ct))!;
    }

    private void TryGenerateTalentoEmbeddingAsync(Guid talentoId)
    {
        if (_aiMatchClient == null) return;
        _ = Task.Run(async () =>
        {
            try
            {
                var tenantId = _tenantContext.TenantId ?? "";
                await _aiMatchClient.GenerateTalentoEmbeddingAsync(talentoId, tenantId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha ao gerar embedding do talento {TalentoId}", talentoId);
            }
        }, CancellationToken.None);
    }

    private void ApplyUpdateRequestToEntity(Talento entity, TalentoUpdateRequest request)
    {
        entity.Pessoa!.Nome = (request.Nome ?? string.Empty).Trim();
        entity.Pessoa.Email = (request.Email ?? string.Empty).Trim().ToLowerInvariant();
        entity.Pessoa.Fone = TrimToMax(request.Fone, 40);
        entity.Pessoa.Cidade = TrimToMax(request.Cidade, 120);
        entity.Pessoa.Uf = TrimToMax(request.Uf, 2);
        entity.Pessoa.LinkedinUrl = TrimToMax(request.LinkedinUrl, 260);
        entity.Pessoa.ResumoProfissional = TrimToMax(request.ResumoProfissional, 2000);
        entity.Pessoa.Obs = TrimToMax(request.Obs, 2000);
        entity.Pessoa.Cpf = TrimToMax(request.Cpf, 14);
        entity.Pessoa.DataNascimento = request.DataNascimento;
        entity.Pessoa.Cep = TrimToMax(request.Cep, 20);
        entity.Pessoa.Logradouro = TrimToMax(request.Logradouro, 200);
        entity.Pessoa.Numero = TrimToMax(request.Numero, 40);
        entity.Pessoa.Bairro = TrimToMax(request.Bairro, 120);
        entity.Pessoa.UpdatedAtUtc = DateTimeOffset.UtcNow;

        entity.Origem = request.Origem;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
        entity.Versao++;

        _db.TalentoCompetencias.RemoveRange(entity.Competencias);
        _db.TalentoExperiencias.RemoveRange(entity.Experiencias);
        _db.TalentoTreinamentos.RemoveRange(entity.Treinamentos);
        _db.TalentoFormacoes.RemoveRange(entity.Formacao);
        entity.Competencias.Clear();
        entity.Experiencias.Clear();
        entity.Treinamentos.Clear();
        entity.Formacao.Clear();

        ApplyCompetencias(entity, request.Competencias);
        ApplyExperiencias(entity, request.Experiencias);
        ApplyTreinamentos(entity, request.Treinamentos);
        ApplyFormacao(entity, request.Formacao);
        entity.CvProfileJson = BuildCvProfileJson(entity);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var entity = await _db.Talentos.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return false;
        _db.Talentos.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<int> DeleteAllForTenantAsync(CancellationToken ct)
    {
        var ids = await _db.Talentos.AsNoTracking().Select(x => x.Id).ToListAsync(ct);
        var count = 0;
        foreach (var id in ids)
        {
            if (await DeleteAsync(id, ct))
                count++;
        }
        return count;
    }

    public async Task<TalentoImportPdfResponse> ImportPdfAsync(Guid? talentoId, Stream pdfStream, string fileName, bool enviarParaGpt, CancellationToken ct)
    {
        Talento entity;
        if (talentoId.HasValue)
        {
            entity = await _db.Talentos
                .Include(x => x.Pessoa)
                .Include(x => x.Competencias)
                .Include(x => x.Experiencias)
                .Include(x => x.Treinamentos)
                .Include(x => x.Formacao)
                .FirstOrDefaultAsync(x => x.Id == talentoId.Value, ct)
                ?? throw new InvalidOperationException("Talento não encontrado.");
        }
        else
        {
            var pessoa = await _pessoaService.GetOrCreateByEmailAsync(
                "aguardando@talento.local",
                "Aguardando dados",
                null,
                null,
                null,
                null,
                null,
                null,
                OrigemPessoa.Manual,
                ct);
            entity = new Talento
            {
                Id = Guid.NewGuid(),
                TenantId = _tenantContext.TenantId,
                PessoaId = pessoa.Id,
                Origem = OrigemTalento.Manual,
                CreatedAtUtc = DateTimeOffset.UtcNow,
                UpdatedAtUtc = DateTimeOffset.UtcNow,
                Versao = 1
            };
            _db.Talentos.Add(entity);
            await _db.SaveChangesAsync(ct);
            entity.Pessoa = pessoa;
        }

        var folder = GetTalentoFolder(entity.Id);
        Directory.CreateDirectory(folder);
        var docId = Guid.NewGuid();
        var storageFileName = BuildStorageFileName(docId, fileName);
        var filePath = Path.Combine(folder, storageFileName);

        await using (var fs = File.Create(filePath))
            await pdfStream.CopyToAsync(fs, ct);

        var tamanhoBytes = new FileInfo(filePath).Length;
        var contentType = GetContentType(Path.GetExtension(fileName));

        var doc = new TalentoDocumento
        {
            Id = docId,
            TenantId = _tenantContext.TenantId,
            TalentoId = entity.Id,
            NomeArquivo = NormalizeFileName(fileName),
            ContentType = contentType,
            Descricao = "Currículo importado",
            StorageFileName = storageFileName,
            TamanhoBytes = tamanhoBytes,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow
        };
        _db.TalentoDocumentos.Add(doc);
        await _db.SaveChangesAsync(ct);
        var docSummary = new TalentoDocumentoSummary(doc.Id, doc.NomeArquivo, doc.ContentType, doc.TamanhoBytes, doc.CreatedAtUtc);

        TalentoImportPdfSuggestedData? suggestedData = null;
        var text = await ResumeTextExtractor.ExtractAsync(filePath, ct);
        if (enviarParaGpt && !string.IsNullOrWhiteSpace(text))
            suggestedData = await _cvGptExtractor.ExtractSuggestedDataAsync(text, ct);

        var extracaoGptSemDados = enviarParaGpt && suggestedData is null;
        if (extracaoGptSemDados)
            _logger.LogInformation("ImportPdf: extração via GPT solicitada mas não retornou dados (talentoId={TalentoId}).", talentoId);

        if (!talentoId.HasValue && suggestedData is not null && !string.IsNullOrWhiteSpace(PessoaService.NormalizeCpf(suggestedData.Cpf)))
        {
            var existingPessoa = await _pessoaService.FindByCpfAsync(suggestedData.Cpf ?? string.Empty, ct);
            if (existingPessoa != null)
            {
                var existingTalento = await _db.Talentos
                    .AsTracking()
                    .Include(t => t.Pessoa)
                    .FirstOrDefaultAsync(t => t.TenantId == _tenantContext.TenantId && t.PessoaId == existingPessoa.Id, ct);
                if (existingTalento is null)
                {
                    existingTalento = new Talento
                    {
                        Id = Guid.NewGuid(),
                        TenantId = _tenantContext.TenantId,
                        PessoaId = existingPessoa.Id,
                        Origem = OrigemTalento.Manual,
                        CreatedAtUtc = DateTimeOffset.UtcNow,
                        UpdatedAtUtc = DateTimeOffset.UtcNow,
                        Versao = 1
                    };
                    _db.Talentos.Add(existingTalento);
                    await _db.SaveChangesAsync(ct);
                }

                var sourceFolder = GetTalentoFolder(entity.Id);
                var destFolder = GetTalentoFolder(existingTalento.Id);
                Directory.CreateDirectory(destFolder);
                var sourcePath = Path.Combine(sourceFolder, doc.StorageFileName);
                var destPath = Path.Combine(destFolder, doc.StorageFileName);
                if (File.Exists(sourcePath))
                    File.Move(sourcePath, destPath);
                doc.TalentoId = existingTalento.Id;
                await _db.SaveChangesAsync(ct);

                var req = BuildPessoaUpdateRequestFromSuggestedData(suggestedData, existingPessoa);
                await _pessoaService.UpdateAsync(existingPessoa.Id, req, ct);

                await _db.Entry(existingTalento).Collection(x => x.Competencias).LoadAsync(ct);
                await _db.Entry(existingTalento).Collection(x => x.Experiencias).LoadAsync(ct);
                await _db.Entry(existingTalento).Collection(x => x.Treinamentos).LoadAsync(ct);
                await _db.Entry(existingTalento).Collection(x => x.Formacao).LoadAsync(ct);
                _db.TalentoCompetencias.RemoveRange(existingTalento.Competencias);
                _db.TalentoExperiencias.RemoveRange(existingTalento.Experiencias);
                _db.TalentoTreinamentos.RemoveRange(existingTalento.Treinamentos);
                _db.TalentoFormacoes.RemoveRange(existingTalento.Formacao);
                existingTalento.Competencias.Clear();
                existingTalento.Experiencias.Clear();
                existingTalento.Treinamentos.Clear();
                existingTalento.Formacao.Clear();
                await _db.SaveChangesAsync(ct);

                ApplyCompetencias(existingTalento, suggestedData.Competencias);
                ApplyExperiencias(existingTalento, suggestedData.Experiencias);
                ApplyTreinamentos(existingTalento, suggestedData.Treinamentos);
                ApplyFormacao(existingTalento, suggestedData.Formacao);
                existingTalento.UpdatedAtUtc = DateTimeOffset.UtcNow;
                existingTalento.Versao++;
                await _db.Entry(existingTalento).Reference(x => x.Pessoa).LoadAsync(ct);
                existingTalento.CvProfileJson = BuildCvProfileJson(existingTalento);
                await _db.SaveChangesAsync(ct);

                _db.Talentos.Remove(entity);
                await _db.SaveChangesAsync(ct);
                var anyOtherTalentoForPlaceholder = await _db.Talentos.AnyAsync(t => t.PessoaId == entity.PessoaId, ct);
                if (!anyOtherTalentoForPlaceholder)
                {
                    var placeholderPessoa = await _db.Pessoas.FirstOrDefaultAsync(p => p.Id == entity.PessoaId, ct);
                    if (placeholderPessoa != null)
                    {
                        _db.Pessoas.Remove(placeholderPessoa);
                        await _db.SaveChangesAsync(ct);
                    }
                }

                await _db.Entry(existingTalento).Collection(x => x.Documentos).LoadAsync(ct);
                var responseTalento = MapToResponse(existingTalento);
                return new TalentoImportPdfResponse(responseTalento, docSummary, suggestedData, false, null, null, extracaoGptSemDados);
            }
        }

        var pessoaToUpdate = await _db.Pessoas.FirstOrDefaultAsync(x => x.Id == entity.PessoaId, ct);
        if (pessoaToUpdate is not null)
        {
            if (suggestedData is not null && (!string.IsNullOrWhiteSpace(suggestedData.Nome) || !string.IsNullOrWhiteSpace(suggestedData.Email)))
            {
                var req = BuildPessoaUpdateRequestFromSuggestedData(suggestedData, pessoaToUpdate);
                await _pessoaService.UpdateAsync(entity.PessoaId, req, ct);
            }
        }

        TalentoResponse talentoResponse;
        if (suggestedData is not null)
        {
            if (entity.Competencias is null) await _db.Entry(entity).Collection(x => x.Competencias).LoadAsync(ct);
            if (entity.Experiencias is null) await _db.Entry(entity).Collection(x => x.Experiencias).LoadAsync(ct);
            if (entity.Treinamentos is null) await _db.Entry(entity).Collection(x => x.Treinamentos).LoadAsync(ct);
            if (entity.Formacao is null) await _db.Entry(entity).Collection(x => x.Formacao).LoadAsync(ct);
            _db.TalentoCompetencias.RemoveRange(entity.Competencias!);
            _db.TalentoExperiencias.RemoveRange(entity.Experiencias!);
            _db.TalentoTreinamentos.RemoveRange(entity.Treinamentos!);
            _db.TalentoFormacoes.RemoveRange(entity.Formacao!);
            entity.Competencias!.Clear();
            entity.Experiencias!.Clear();
            entity.Treinamentos!.Clear();
            entity.Formacao!.Clear();
            await _db.SaveChangesAsync(ct);

            ApplyCompetencias(entity, suggestedData.Competencias);
            ApplyExperiencias(entity, suggestedData.Experiencias);
            ApplyTreinamentos(entity, suggestedData.Treinamentos);
            ApplyFormacao(entity, suggestedData.Formacao);
            entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
            entity.Versao++;
            await _db.Entry(entity).Reference(x => x.Pessoa).LoadAsync(ct);
            entity.CvProfileJson = BuildCvProfileJson(entity);
            try
            {
                await _db.SaveChangesAsync(ct);
            }
            catch (DbUpdateConcurrencyException)
            {
                _db.ChangeTracker.Clear();
                var refreshed = await _db.Talentos.IgnoreQueryFilters()
                    .Include(x => x.Competencias)
                    .Include(x => x.Experiencias)
                    .Include(x => x.Treinamentos)
                    .Include(x => x.Formacao)
                    .FirstOrDefaultAsync(x => x.Id == entity.Id, ct);
                if (refreshed is null || refreshed.TenantId != _tenantContext.TenantId)
                    throw;
                _db.TalentoCompetencias.RemoveRange(refreshed.Competencias);
                _db.TalentoExperiencias.RemoveRange(refreshed.Experiencias);
                _db.TalentoTreinamentos.RemoveRange(refreshed.Treinamentos);
                _db.TalentoFormacoes.RemoveRange(refreshed.Formacao);
                refreshed.Competencias.Clear();
                refreshed.Experiencias.Clear();
                refreshed.Treinamentos.Clear();
                refreshed.Formacao.Clear();
                await _db.SaveChangesAsync(ct);
                _db.Entry(refreshed).State = EntityState.Detached;
                AddSuggestedDataToContext(entity.Id, suggestedData);
                await _db.SaveChangesAsync(ct);
                var updatedAt = DateTimeOffset.UtcNow;
                var newVersao = refreshed.Versao + 1;
                var cvProfileJson = BuildCvProfileJsonFromSuggestedData(suggestedData);
                await _db.Talentos.IgnoreQueryFilters()
                    .Where(x => x.Id == entity.Id && x.TenantId == _tenantContext.TenantId)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(t => t.UpdatedAtUtc, updatedAt)
                        .SetProperty(t => t.Versao, newVersao)
                        .SetProperty(t => t.CvProfileJson, cvProfileJson), ct);
                entity = (await _db.Talentos.AsTracking().Include(x => x.Pessoa).Include(x => x.Competencias).Include(x => x.Experiencias).Include(x => x.Treinamentos).Include(x => x.Formacao).Include(x => x.Documentos).FirstOrDefaultAsync(x => x.Id == entity.Id, ct))!;
            }
            await _db.Entry(entity).Collection(x => x.Documentos).LoadAsync(ct);
            talentoResponse = MapToResponse(entity);
        }
        else
        {
            talentoResponse = (await GetByIdAsync(entity.Id, ct))!;
        }

        bool similarFound = false;
        Guid? similarTalentoId = null;
        SimilarPessoaSummary? similarPessoaSummary = null;
        if (!talentoId.HasValue && suggestedData is not null)
        {
            var similar = await _pessoaService.FindSimilarAsync(suggestedData.Email, suggestedData.Fone, suggestedData.Nome, suggestedData.Cep, suggestedData.Logradouro, suggestedData.Numero, ct);
            if (similar.HasValue && similar.Value.Pessoa.Id != entity.PessoaId)
            {
                similarFound = true;
                similarTalentoId = similar.Value.Talento?.Id;
                similarPessoaSummary = new SimilarPessoaSummary(similar.Value.Talento?.Id ?? Guid.Empty, similar.Value.Pessoa.Nome, similar.Value.Pessoa.Email, similar.Value.Pessoa.Fone);
            }
        }

        return new TalentoImportPdfResponse(talentoResponse, docSummary, suggestedData, similarFound, similarTalentoId, similarPessoaSummary, extracaoGptSemDados);
    }

    public async Task<TalentoStartImportPdfResponse> StartImportPdfAsync(Guid? talentoId, Stream pdfStream, string fileName, bool enviarParaGpt, CancellationToken ct)
    {
        Talento entity;
        if (talentoId.HasValue)
        {
            entity = await _db.Talentos
                .Include(x => x.Pessoa)
                .Include(x => x.Competencias)
                .Include(x => x.Experiencias)
                .Include(x => x.Treinamentos)
                .Include(x => x.Formacao)
                .FirstOrDefaultAsync(x => x.Id == talentoId.Value, ct)
                ?? throw new InvalidOperationException("Talento não encontrado.");
        }
        else
        {
            var pessoa = await _pessoaService.GetOrCreateByEmailAsync(
                "aguardando@talento.local",
                "Aguardando dados",
                null,
                null,
                null,
                null,
                null,
                null,
                OrigemPessoa.Manual,
                ct);
            entity = new Talento
            {
                Id = Guid.NewGuid(),
                TenantId = _tenantContext.TenantId,
                PessoaId = pessoa.Id,
                Origem = OrigemTalento.Manual,
                CreatedAtUtc = DateTimeOffset.UtcNow,
                UpdatedAtUtc = DateTimeOffset.UtcNow,
                Versao = 1
            };
            _db.Talentos.Add(entity);
            entity.Pessoa = pessoa;
        }

        var folder = GetTalentoFolder(entity.Id);
        Directory.CreateDirectory(folder);
        var docId = Guid.NewGuid();
        var storageFileName = BuildStorageFileName(docId, fileName);
        var filePath = Path.Combine(folder, storageFileName);

        await using (var fs = File.Create(filePath))
            await pdfStream.CopyToAsync(fs, ct);
        var tamanhoBytes = new FileInfo(filePath).Length;
        var contentType = GetContentType(Path.GetExtension(fileName));

        var doc = new TalentoDocumento
        {
            Id = docId,
            TenantId = _tenantContext.TenantId,
            TalentoId = entity.Id,
            NomeArquivo = NormalizeFileName(fileName),
            ContentType = contentType,
            Descricao = "Currículo importado",
            StorageFileName = storageFileName,
            TamanhoBytes = tamanhoBytes,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow
        };
        _db.TalentoDocumentos.Add(doc);

        var jobId = Guid.NewGuid();
        var job = new TalentoCvImportJob
        {
            Id = jobId,
            TenantId = _tenantContext.TenantId,
            TalentoId = entity.Id,
            TalentoDocumentoId = doc.Id,
            Status = CvImportStatus.Pendente,
            EnviarParaGpt = enviarParaGpt,
            CreatedAtUtc = DateTimeOffset.UtcNow
        };
        _db.TalentoCvImportJobs.Add(job);

        await _db.SaveChangesAsync(ct);
        var docSummary = new TalentoDocumentoSummary(doc.Id, doc.NomeArquivo, doc.ContentType, doc.TamanhoBytes, doc.CreatedAtUtc);
        if (entity.Documentos is null) entity.Documentos = new List<TalentoDocumento>();
        entity.Documentos.Add(doc);
        var talentoResponse = MapToResponse(entity);
        var importJobSummary = new TalentoCvImportJobSummary(job.Id, job.Status);
        return new TalentoStartImportPdfResponse(talentoResponse, docSummary, importJobSummary);
    }

    public async Task<TalentoCurriculoExtrairResponse?> UploadCurriculoEExtrairAsync(Guid talentoId, Stream pdfStream, string fileName, bool enviarParaGpt, CancellationToken ct)
    {
        var entity = await _db.Talentos
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == talentoId && x.TenantId == _tenantContext.TenantId, ct);
        if (entity is null)
            return null;

        var folder = GetTalentoFolder(entity.Id);
        Directory.CreateDirectory(folder);
        var docId = Guid.NewGuid();
        var storageFileName = BuildStorageFileName(docId, fileName);
        var filePath = Path.Combine(folder, storageFileName);

        await using (var fs = File.Create(filePath))
            await pdfStream.CopyToAsync(fs, ct);
        var tamanhoBytes = new FileInfo(filePath).Length;
        var contentType = GetContentType(Path.GetExtension(fileName));

        var doc = new TalentoDocumento
        {
            Id = docId,
            TenantId = _tenantContext.TenantId,
            TalentoId = entity.Id,
            NomeArquivo = NormalizeFileName(fileName),
            ContentType = contentType,
            Descricao = "Currículo enviado pela tela",
            StorageFileName = storageFileName,
            TamanhoBytes = tamanhoBytes,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow
        };
        _db.TalentoDocumentos.Add(doc);
        await _db.SaveChangesAsync(ct);

        string? cvText = null;
        TalentoImportPdfSuggestedData? suggestedData = null;
        try
        {
            cvText = await ResumeTextExtractor.ExtractAsync(filePath, ct);
            if (enviarParaGpt && !string.IsNullOrWhiteSpace(cvText))
                suggestedData = await _cvGptExtractor.ExtractSuggestedDataAsync(cvText, ct);
        }
        catch
        {
            cvText ??= string.Empty;
        }

        var docSummary = new TalentoDocumentoSummary(doc.Id, doc.NomeArquivo, doc.ContentType, doc.TamanhoBytes, doc.CreatedAtUtc);
        return new TalentoCurriculoExtrairResponse(docSummary, cvText, suggestedData);
    }

    private static PessoaUpdateRequest BuildPessoaUpdateRequestFromSuggestedData(TalentoImportPdfSuggestedData suggestedData, Pessoa pessoa)
    {
        var logradouro = !string.IsNullOrWhiteSpace(suggestedData.Logradouro)
            ? suggestedData.Logradouro.Trim()
            : !string.IsNullOrWhiteSpace(suggestedData.Endereco)
                ? suggestedData.Endereco.Trim()
                : pessoa.Logradouro;
        return new PessoaUpdateRequest(
            Nome: TrimMax(!string.IsNullOrWhiteSpace(suggestedData.Nome) ? suggestedData.Nome.Trim() : pessoa.Nome, 160),
            Email: NormalizeEmail(!string.IsNullOrWhiteSpace(suggestedData.Email) ? suggestedData.Email : pessoa.Email),
            Fone: TrimMax(!string.IsNullOrWhiteSpace(suggestedData.Fone) ? suggestedData.Fone.Trim() : pessoa.Fone, 40),
            Cidade: TrimMax(suggestedData.Cidade?.Trim() ?? pessoa.Cidade, 120),
            Uf: TrimMax(NormalizeUf(suggestedData.Uf) ?? pessoa.Uf, 2),
            LinkedinUrl: TrimMax(suggestedData.LinkedinUrl?.Trim() ?? pessoa.LinkedinUrl, 260),
            ResumoProfissional: TrimMax(suggestedData.ResumoProfissional?.Trim() ?? pessoa.ResumoProfissional, 2000),
            Obs: TrimMax(pessoa.Obs, 2000),
            Cep: TrimMax(!string.IsNullOrWhiteSpace(suggestedData.Cep) ? suggestedData.Cep.Trim() : pessoa.Cep, 20),
            Logradouro: TrimMax(logradouro, 200),
            Numero: TrimMax(!string.IsNullOrWhiteSpace(suggestedData.Numero) ? suggestedData.Numero.Trim() : pessoa.Numero, 40),
            Bairro: TrimMax(!string.IsNullOrWhiteSpace(suggestedData.Bairro) ? suggestedData.Bairro.Trim() : pessoa.Bairro, 120),
            Complemento: TrimMax(pessoa.Complemento, 120),
            Cpf: TrimMax(!string.IsNullOrWhiteSpace(suggestedData.Cpf) ? suggestedData.Cpf.Trim() : pessoa.Cpf, 14),
            Rg: TrimMax(pessoa.Rg, 20),
            FoneContato: TrimMax(pessoa.FoneContato, 40),
            DataNascimento: suggestedData.DataNascimento ?? pessoa.DataNascimento,
            Origem: pessoa.Origem);
    }

    public async Task<TalentoDocumentoFileResult?> GetDocumentoFileAsync(Guid talentoId, Guid documentoId, CancellationToken ct)
    {
        var doc = await _db.TalentoDocumentos
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.TalentoId == talentoId && x.Id == documentoId && x.TenantId == _tenantContext.TenantId, ct);
        if (doc is null || string.IsNullOrWhiteSpace(doc.StorageFileName))
            return null;
        var folder = GetTalentoFolder(talentoId);
        var path = Path.Combine(folder, doc.StorageFileName);
        if (!File.Exists(path))
            return null;
        return new TalentoDocumentoFileResult(path, doc.ContentType ?? "application/octet-stream", doc.NomeArquivo);
    }

    public async Task ProcessImportJobAsync(Guid jobId, CancellationToken ct)
    {
        var job = await _db.TalentoCvImportJobs
            .AsTracking()
            .FirstOrDefaultAsync(j => j.Id == jobId && j.TenantId == _tenantContext.TenantId && j.Status == CvImportStatus.Pendente, ct);
        if (job is null) return;

        job.Status = CvImportStatus.EmProcessamento;
        job.StartedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        var doc = await _db.TalentoDocumentos.FirstOrDefaultAsync(d => d.Id == job.TalentoDocumentoId && d.TenantId == _tenantContext.TenantId, ct);
        // Carregar Talento SEM Include das coleções (Competencias, Experiencias, Treinamentos, Formacao)
        // para que, após ExecuteDeleteAsync no ProcessCvImportFromFileAsync, não haja entidades filhas
        // rastreadas; assim SaveChangesAsync só fará INSERT das novas e não tentará atualizar/deletar as antigas.
        var entity = await _db.Talentos
            .AsTracking()
            .Include(x => x.Pessoa)
            .FirstOrDefaultAsync(x => x.Id == job.TalentoId && x.TenantId == _tenantContext.TenantId, ct);
        if (doc is null || entity is null || string.IsNullOrWhiteSpace(doc.StorageFileName))
        {
            job.Status = CvImportStatus.Concluido;
            job.FinishedAtUtc = DateTimeOffset.UtcNow;
            job.ErrorMessage = "Documento ou talento não encontrado.";
            await _db.SaveChangesAsync(ct);
            return;
        }

        var filePath = Path.Combine(GetTalentoFolder(entity.Id), doc.StorageFileName);
        if (!File.Exists(filePath))
        {
            job.Status = CvImportStatus.Concluido;
            job.FinishedAtUtc = DateTimeOffset.UtcNow;
            job.ErrorMessage = "Arquivo do currículo não encontrado em disco.";
            await _db.SaveChangesAsync(ct);
            return;
        }

        try
        {
            await ProcessCvImportFromFileAsync(job, entity, doc, filePath, job.EnviarParaGpt, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ProcessImportJob failed for jobId={JobId}.", jobId);
            job.Status = CvImportStatus.Concluido;
            job.FinishedAtUtc = DateTimeOffset.UtcNow;
            job.ErrorMessage = ex.Message.Length > 1998 ? ex.Message[..1998] : ex.Message;
            // Usar ExecuteUpdateAsync em vez de SaveChanges para evitar DbUpdateConcurrencyException (atualiza só a linha do job por Id+TenantId)
            try
            {
                var errMsg = job.ErrorMessage ?? "";
                var finished = job.FinishedAtUtc ?? DateTimeOffset.UtcNow;
                var updated = await _db.TalentoCvImportJobs
                    .Where(j => j.Id == jobId && j.TenantId == _tenantContext.TenantId)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(j => j.Status, CvImportStatus.Concluido)
                        .SetProperty(j => j.FinishedAtUtc, finished)
                        .SetProperty(j => j.ErrorMessage, errMsg), ct);
            }
            catch (Exception saveEx) { _logger.LogError(saveEx, "ProcessImportJob: failed to save job status for jobId={JobId}.", jobId); }
        }
        finally
        {
            // Sempre forçar update do job no banco: se SaveChanges do catch falhou, o job em memória está Concluído mas não foi persistido
            var errMsg = string.IsNullOrWhiteSpace(job.ErrorMessage) ? "Processamento interrompido ou falhou sem atualizar status." : (job.ErrorMessage.Length > 1998 ? job.ErrorMessage[..1998] : job.ErrorMessage);
            var finished = job.FinishedAtUtc ?? DateTimeOffset.UtcNow;
            try
            {
                var updated = await _db.TalentoCvImportJobs
                    .Where(j => j.Id == jobId && j.TenantId == _tenantContext.TenantId && j.Status == CvImportStatus.EmProcessamento)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(j => j.Status, CvImportStatus.Concluido)
                        .SetProperty(j => j.FinishedAtUtc, finished)
                        .SetProperty(j => j.ErrorMessage, errMsg), ct);
            }
            catch (Exception saveEx) { _logger.LogError(saveEx, "ProcessImportJob: finally failed to save job status for jobId={JobId}.", jobId); }
        }
    }

    private async Task ProcessCvImportFromFileAsync(TalentoCvImportJob job, Talento entity, TalentoDocumento doc, string filePath, bool enviarParaGpt, CancellationToken ct)
    {
        TalentoImportPdfSuggestedData? suggestedData = null;
        string? warning = null;
        var text = await ResumeTextExtractor.ExtractAsync(filePath, ct);
        if (enviarParaGpt)
        {
            if (string.IsNullOrWhiteSpace(text))
            {
                warning = "Documento sem texto extraível. Pode ser um PDF escaneado/imagem ou um arquivo em branco. Re-suba um currículo com texto selecionável.";
                _logger.LogWarning("CvImport: empty text extracted from {File} (jobId={JobId}).", doc.NomeArquivo, job.Id);
            }
            else
            {
                suggestedData = await _cvGptExtractor.ExtractSuggestedDataAsync(text, ct);
                if (suggestedData is null)
                {
                    warning = "A IA não retornou dados estruturados. Verifique se o modelo/chave em /Owner/IA estão válidos (logs do servidor têm o detalhe).";
                    _logger.LogWarning("CvImport: AI extractor returned null for jobId={JobId}.", job.Id);
                }
            }
        }

        var isPlaceholder = entity.Pessoa?.Email == "aguardando@talento.local";

        if (isPlaceholder && suggestedData is not null && !string.IsNullOrWhiteSpace(PessoaService.NormalizeCpf(suggestedData.Cpf)))
        {
            var existingPessoa = await _pessoaService.FindByCpfAsync(suggestedData.Cpf ?? string.Empty, ct);
            if (existingPessoa != null)
            {
                var existingTalento = await _db.Talentos
                    .AsTracking()
                    .Include(t => t.Pessoa)
                    .FirstOrDefaultAsync(t => t.TenantId == _tenantContext.TenantId && t.PessoaId == existingPessoa.Id, ct);
                if (existingTalento is null)
                {
                    existingTalento = new Talento
                    {
                        Id = Guid.NewGuid(),
                        TenantId = _tenantContext.TenantId,
                        PessoaId = existingPessoa.Id,
                        Origem = OrigemTalento.Manual,
                        CreatedAtUtc = DateTimeOffset.UtcNow,
                        UpdatedAtUtc = DateTimeOffset.UtcNow,
                        Versao = 1
                    };
                    _db.Talentos.Add(existingTalento);
                    await _db.SaveChangesAsync(ct);
                }

                var sourceFolder = GetTalentoFolder(entity.Id);
                var destFolder = GetTalentoFolder(existingTalento.Id);
                Directory.CreateDirectory(destFolder);
                var sourcePath = Path.Combine(sourceFolder, doc.StorageFileName!);
                var destPath = Path.Combine(destFolder, doc.StorageFileName!);
                if (File.Exists(sourcePath))
                    File.Move(sourcePath, destPath);
                doc.TalentoId = existingTalento.Id;
                await _db.SaveChangesAsync(ct);

                var req = BuildPessoaUpdateRequestFromSuggestedData(suggestedData, existingPessoa);
                await _pessoaService.UpdateAsync(existingPessoa.Id, req, ct);

                await _db.Entry(existingTalento).Collection(x => x.Competencias).LoadAsync(ct);
                await _db.Entry(existingTalento).Collection(x => x.Experiencias).LoadAsync(ct);
                await _db.Entry(existingTalento).Collection(x => x.Treinamentos).LoadAsync(ct);
                await _db.Entry(existingTalento).Collection(x => x.Formacao).LoadAsync(ct);
                _db.TalentoCompetencias.RemoveRange(existingTalento.Competencias);
                _db.TalentoExperiencias.RemoveRange(existingTalento.Experiencias);
                _db.TalentoTreinamentos.RemoveRange(existingTalento.Treinamentos);
                _db.TalentoFormacoes.RemoveRange(existingTalento.Formacao);
                existingTalento.Competencias.Clear();
                existingTalento.Experiencias.Clear();
                existingTalento.Treinamentos.Clear();
                existingTalento.Formacao.Clear();
                await _db.SaveChangesAsync(ct);

                ApplyCompetencias(existingTalento, suggestedData.Competencias);
                ApplyExperiencias(existingTalento, suggestedData.Experiencias);
                ApplyTreinamentos(existingTalento, suggestedData.Treinamentos);
                ApplyFormacao(existingTalento, suggestedData.Formacao);
                existingTalento.UpdatedAtUtc = DateTimeOffset.UtcNow;
                existingTalento.Versao++;
                await _db.Entry(existingTalento).Reference(x => x.Pessoa).LoadAsync(ct);
                existingTalento.CvProfileJson = BuildCvProfileJson(existingTalento);
                await _db.SaveChangesAsync(ct);

                _db.Talentos.Remove(entity);
                await _db.SaveChangesAsync(ct);
                var anyOtherTalentoForPlaceholder = await _db.Talentos.AnyAsync(t => t.PessoaId == entity.PessoaId, ct);
                if (!anyOtherTalentoForPlaceholder)
                {
                    var placeholderPessoa = await _db.Pessoas.FirstOrDefaultAsync(p => p.Id == entity.PessoaId, ct);
                    if (placeholderPessoa != null)
                    {
                        _db.Pessoas.Remove(placeholderPessoa);
                        await _db.SaveChangesAsync(ct);
                    }
                }

                job.Status = CvImportStatus.Concluido;
                job.FinishedAtUtc = DateTimeOffset.UtcNow;
                job.TalentoId = existingTalento.Id;
                await _db.SaveChangesAsync(ct);
                return;
            }
        }

        if (isPlaceholder && suggestedData is not null)
        {
            var similar = await _pessoaService.FindSimilarAsync(suggestedData.Email, suggestedData.Fone, suggestedData.Nome, suggestedData.Cep, suggestedData.Logradouro, suggestedData.Numero, ct);
            // Só pedir validação quando o similar for outro talento existente; pessoa órfã (sem talento) = base “limpa” → concluir direto
            if (similar.HasValue && similar.Value.Pessoa.Id != entity.PessoaId && similar.Value.Talento != null)
            {
                var similarTalentoId = similar.Value.Talento.Id;
                var similarSummary = new SimilarPessoaSummary(
                    similarTalentoId,
                    similar.Value.Pessoa.Nome,
                    similar.Value.Pessoa.Email,
                    similar.Value.Pessoa.Fone);
                var talentoUpdate = BuildTalentoUpdateRequestFromSuggestedData(suggestedData, entity);
                var payload = new CvImportJobValidationPayload(similarSummary, suggestedData, talentoUpdate);
                job.Status = CvImportStatus.PendenteValidacao;
                job.SimilarTalentoId = similarTalentoId;
                job.SuggestedDataJson = JsonSerializer.Serialize(payload, CvImportJobJsonOptions);
                job.FinishedAtUtc = DateTimeOffset.UtcNow;
                await _db.SaveChangesAsync(ct);
                return;
            }
        }

        var pessoaToUpdate = await _db.Pessoas.FirstOrDefaultAsync(x => x.Id == entity.PessoaId, ct);
        if (pessoaToUpdate is not null && suggestedData is not null && (!string.IsNullOrWhiteSpace(suggestedData.Nome) || !string.IsNullOrWhiteSpace(suggestedData.Email)))
        {
            var req = BuildPessoaUpdateRequestFromSuggestedData(suggestedData, pessoaToUpdate);
            await _pessoaService.UpdateAsync(entity.PessoaId, req, ct);
        }

        if (suggestedData is not null)
        {
            // Remover filhos por ExecuteDeleteAsync (evita DbUpdateConcurrencyException ao deletar entidades rastreadas)
            await _db.TalentoCompetencias.Where(c => c.TalentoId == entity.Id).ExecuteDeleteAsync(ct);
            await _db.TalentoExperiencias.Where(e => e.TalentoId == entity.Id).ExecuteDeleteAsync(ct);
            await _db.TalentoTreinamentos.Where(t => t.TalentoId == entity.Id).ExecuteDeleteAsync(ct);
            await _db.TalentoFormacoes.Where(f => f.TalentoId == entity.Id).ExecuteDeleteAsync(ct);
            // Carregar coleções após o delete (ficam vazias); entity foi carregado sem Include destas coleções,
            // então não há entidades filhas rastreadas e SaveChangesAsync só fará INSERT das novas.
            await _db.Entry(entity).Collection(x => x.Competencias).LoadAsync(ct);
            await _db.Entry(entity).Collection(x => x.Experiencias).LoadAsync(ct);
            await _db.Entry(entity).Collection(x => x.Treinamentos).LoadAsync(ct);
            await _db.Entry(entity).Collection(x => x.Formacao).LoadAsync(ct);
            entity.Competencias.Clear();
            entity.Experiencias.Clear();
            entity.Treinamentos.Clear();
            entity.Formacao.Clear();

            ApplyCompetencias(entity, suggestedData.Competencias);
            ApplyExperiencias(entity, suggestedData.Experiencias);
            ApplyTreinamentos(entity, suggestedData.Treinamentos);
            ApplyFormacao(entity, suggestedData.Formacao);
            var updatedAt = DateTimeOffset.UtcNow;
            var newVersao = entity.Versao + 1;
            await _db.Entry(entity).Reference(x => x.Pessoa).LoadAsync(ct);
            var cvProfileJson = BuildCvProfileJson(entity);
            // Evitar DbUpdateConcurrencyException: só persistir os filhos (Added). Forçar outras entradas a Unchanged.
            foreach (var entry in _db.ChangeTracker.Entries())
            {
                if (entry.State == EntityState.Added) continue;
                if (entry.State == EntityState.Modified || entry.State == EntityState.Deleted)
                    entry.State = EntityState.Unchanged;
            }
            // Garantir que os filhos continuem Added (evitar que Unchanged no pai afete os filhos no EF).
            foreach (var e in entity.Experiencias)
                _db.Entry(e).State = EntityState.Added;
            foreach (var t in entity.Treinamentos)
                _db.Entry(t).State = EntityState.Added;
            foreach (var f in entity.Formacao)
                _db.Entry(f).State = EntityState.Added;
            foreach (var c in entity.Competencias)
                _db.Entry(c).State = EntityState.Added;
            await _db.SaveChangesAsync(ct);
            // Atualizar Talento (UpdatedAtUtc, Versao, CvProfileJson) por ExecuteUpdateAsync para evitar concurrency no change tracker
            await _db.Talentos
                .Where(t => t.Id == entity.Id && t.TenantId == _tenantContext.TenantId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(t => t.UpdatedAtUtc, updatedAt)
                    .SetProperty(t => t.Versao, newVersao)
                    .SetProperty(t => t.CvProfileJson, cvProfileJson), ct);
        }

        job.Status = CvImportStatus.Concluido;
        job.FinishedAtUtc = DateTimeOffset.UtcNow;
        job.ErrorMessage = warning;
        await _db.TalentoCvImportJobs
            .Where(j => j.Id == job.Id && j.TenantId == _tenantContext.TenantId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(j => j.Status, CvImportStatus.Concluido)
                .SetProperty(j => j.FinishedAtUtc, job.FinishedAtUtc!.Value)
                .SetProperty(j => j.ErrorMessage, warning), ct);
    }

    private static TalentoUpdateRequest BuildTalentoUpdateRequestFromSuggestedData(TalentoImportPdfSuggestedData suggestedData, Talento entity)
    {
        var p = entity.Pessoa!;
        var logradouro = !string.IsNullOrWhiteSpace(suggestedData.Logradouro)
            ? suggestedData.Logradouro.Trim()
            : !string.IsNullOrWhiteSpace(suggestedData.Endereco)
                ? suggestedData.Endereco.Trim()
                : p.Logradouro;
        return new TalentoUpdateRequest(
            Nome: TrimMax(!string.IsNullOrWhiteSpace(suggestedData.Nome) ? suggestedData.Nome.Trim() : p.Nome, 160),
            Email: NormalizeEmail(!string.IsNullOrWhiteSpace(suggestedData.Email) ? suggestedData.Email : p.Email),
            Fone: TrimMax(suggestedData.Fone?.Trim() ?? p.Fone, 40),
            Cidade: TrimMax(suggestedData.Cidade?.Trim() ?? p.Cidade, 120),
            Uf: TrimMax(NormalizeUf(suggestedData.Uf) ?? p.Uf, 2),
            LinkedinUrl: TrimMax(suggestedData.LinkedinUrl?.Trim() ?? p.LinkedinUrl, 260),
            ResumoProfissional: TrimMax(suggestedData.ResumoProfissional?.Trim() ?? p.ResumoProfissional, 2000),
            Obs: TrimMax(p.Obs, 2000),
            Cpf: TrimMax(!string.IsNullOrWhiteSpace(suggestedData.Cpf) ? suggestedData.Cpf.Trim() : p.Cpf, 14),
            DataNascimento: suggestedData.DataNascimento ?? p.DataNascimento,
            Cep: TrimMax(!string.IsNullOrWhiteSpace(suggestedData.Cep) ? suggestedData.Cep.Trim() : p.Cep, 20),
            Logradouro: TrimMax(logradouro, 200),
            Numero: TrimMax(!string.IsNullOrWhiteSpace(suggestedData.Numero) ? suggestedData.Numero.Trim() : p.Numero, 40),
            Bairro: TrimMax(!string.IsNullOrWhiteSpace(suggestedData.Bairro) ? suggestedData.Bairro.Trim() : p.Bairro, 120),
            Origem: entity.Origem,
            Competencias: suggestedData.Competencias,
            Experiencias: suggestedData.Experiencias,
            Treinamentos: suggestedData.Treinamentos,
            Formacao: suggestedData.Formacao);
    }

    public async Task AprovarCvImportJobAsync(Guid jobId, CancellationToken ct)
    {
        var job = await _db.TalentoCvImportJobs
            .AsTracking()
            .FirstOrDefaultAsync(j => j.Id == jobId && j.TenantId == _tenantContext.TenantId && j.Status == CvImportStatus.PendenteValidacao, ct);
        if (job is null || !job.SimilarTalentoId.HasValue || string.IsNullOrWhiteSpace(job.SuggestedDataJson))
            throw new InvalidOperationException("Job não encontrado ou não está pendente de validação.");

        var payload = JsonSerializer.Deserialize<CvImportJobValidationPayload>(job.SuggestedDataJson, CvImportJobJsonOptions);
        if (payload?.TalentoUpdate is null)
            throw new InvalidOperationException("Dados do job inválidos.");

        // Atualiza o talento existente com os dados do CV
        await UpdateAsync(job.SimilarTalentoId.Value, payload.TalentoUpdate, ct);

        // Move o documento do PDF do placeholder para o talento existente, antes de remover o placeholder
        var placeholderTalentoId = job.TalentoId;
        var similarTalentoId = job.SimilarTalentoId.Value;
        var docs = await _db.TalentoDocumentos
            .Where(d => d.TalentoId == placeholderTalentoId && d.TenantId == _tenantContext.TenantId)
            .ToListAsync(ct);
        foreach (var d in docs)
        {
            var src = Path.Combine(GetTalentoFolder(placeholderTalentoId), d.StorageFileName ?? "");
            var dstFolder = GetTalentoFolder(similarTalentoId);
            Directory.CreateDirectory(dstFolder);
            var dst = Path.Combine(dstFolder, d.StorageFileName ?? "");
            if (!string.IsNullOrEmpty(d.StorageFileName) && File.Exists(src))
            {
                try { File.Move(src, dst, overwrite: true); } catch { }
            }
            d.TalentoId = similarTalentoId;
        }
        await _db.SaveChangesAsync(ct);

        // Reaponta o job para o talento mesclado (mantendo histórico) e fecha
        job.TalentoId = similarTalentoId;
        job.Status = CvImportStatus.Concluido;
        job.FinishedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        // Remove o placeholder Talento + Pessoa órfã (se ninguém mais usa)
        var placeholder = await _db.Talentos.AsTracking().FirstOrDefaultAsync(t => t.Id == placeholderTalentoId && t.TenantId == _tenantContext.TenantId, ct);
        if (placeholder is not null)
        {
            var placeholderPessoaId = placeholder.PessoaId;
            _db.Talentos.Remove(placeholder);
            await _db.SaveChangesAsync(ct);
            var stillUsed = await _db.Talentos.AnyAsync(t => t.PessoaId == placeholderPessoaId, ct);
            if (!stillUsed)
            {
                var placeholderPessoa = await _db.Pessoas.AsTracking().FirstOrDefaultAsync(p => p.Id == placeholderPessoaId, ct);
                if (placeholderPessoa is not null)
                {
                    _db.Pessoas.Remove(placeholderPessoa);
                    await _db.SaveChangesAsync(ct);
                }
            }
        }
    }

    public async Task RecusarCvImportJobAsync(Guid jobId, CancellationToken ct)
    {
        var job = await _db.TalentoCvImportJobs
            .AsTracking()
            .FirstOrDefaultAsync(j => j.Id == jobId && j.TenantId == _tenantContext.TenantId && j.Status == CvImportStatus.PendenteValidacao, ct);
        if (job is null)
            throw new InvalidOperationException("Job não encontrado ou não está pendente de validação.");

        // Aplica os dados extraídos no placeholder Talento, transformando-o em um talento independente
        // (não mais "Aguardando dados") — usuário decidiu que é OUTRA pessoa, então mantemos o cadastro novo.
        if (!string.IsNullOrWhiteSpace(job.SuggestedDataJson))
        {
            var payload = JsonSerializer.Deserialize<CvImportJobValidationPayload>(job.SuggestedDataJson, CvImportJobJsonOptions);
            if (payload?.SuggestedData is not null)
            {
                var placeholderTalento = await _db.Talentos
                    .AsTracking()
                    .Include(t => t.Pessoa)
                    .FirstOrDefaultAsync(t => t.Id == job.TalentoId && t.TenantId == _tenantContext.TenantId, ct);
                if (placeholderTalento is not null)
                {
                    if (placeholderTalento.Pessoa is not null)
                    {
                        var req = BuildPessoaUpdateRequestFromSuggestedData(payload.SuggestedData, placeholderTalento.Pessoa);
                        await _pessoaService.UpdateAsync(placeholderTalento.PessoaId, req, ct);
                    }
                    await _db.TalentoCompetencias.Where(c => c.TalentoId == placeholderTalento.Id).ExecuteDeleteAsync(ct);
                    await _db.TalentoExperiencias.Where(e => e.TalentoId == placeholderTalento.Id).ExecuteDeleteAsync(ct);
                    await _db.TalentoTreinamentos.Where(t => t.TalentoId == placeholderTalento.Id).ExecuteDeleteAsync(ct);
                    await _db.TalentoFormacoes.Where(f => f.TalentoId == placeholderTalento.Id).ExecuteDeleteAsync(ct);
                    await _db.Entry(placeholderTalento).Collection(x => x.Competencias).LoadAsync(ct);
                    await _db.Entry(placeholderTalento).Collection(x => x.Experiencias).LoadAsync(ct);
                    await _db.Entry(placeholderTalento).Collection(x => x.Treinamentos).LoadAsync(ct);
                    await _db.Entry(placeholderTalento).Collection(x => x.Formacao).LoadAsync(ct);
                    placeholderTalento.Competencias.Clear();
                    placeholderTalento.Experiencias.Clear();
                    placeholderTalento.Treinamentos.Clear();
                    placeholderTalento.Formacao.Clear();
                    ApplyCompetencias(placeholderTalento, payload.SuggestedData.Competencias);
                    ApplyExperiencias(placeholderTalento, payload.SuggestedData.Experiencias);
                    ApplyTreinamentos(placeholderTalento, payload.SuggestedData.Treinamentos);
                    ApplyFormacao(placeholderTalento, payload.SuggestedData.Formacao);
                    placeholderTalento.UpdatedAtUtc = DateTimeOffset.UtcNow;
                    placeholderTalento.Versao++;
                    await _db.Entry(placeholderTalento).Reference(x => x.Pessoa).LoadAsync(ct);
                    placeholderTalento.CvProfileJson = BuildCvProfileJson(placeholderTalento);
                    await _db.SaveChangesAsync(ct);
                }
            }
        }

        job.Status = CvImportStatus.Concluido;
        job.FinishedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    public async Task<CvImportJobValidationResponse?> GetCvImportJobAsync(Guid jobId, CancellationToken ct)
    {
        var job = await _db.TalentoCvImportJobs
            .AsNoTracking()
            .FirstOrDefaultAsync(j => j.Id == jobId && j.TenantId == _tenantContext.TenantId && j.Status == CvImportStatus.PendenteValidacao, ct);
        if (job is null || !job.SimilarTalentoId.HasValue || string.IsNullOrWhiteSpace(job.SuggestedDataJson))
            return null;

        var payload = JsonSerializer.Deserialize<CvImportJobValidationPayload>(job.SuggestedDataJson, CvImportJobJsonOptions);
        var existing = await GetByIdAsync(job.SimilarTalentoId.Value, ct);
        return new CvImportJobValidationResponse(
            JobId: job.Id,
            PlaceholderTalentoId: job.TalentoId,
            SimilarTalentoId: job.SimilarTalentoId.Value,
            ExistingTalento: existing,
            SuggestedData: payload?.SuggestedData,
            CreatedAtUtc: job.CreatedAtUtc);
    }

    public async Task<(Talento Talento, bool Created)> GetOrCreateByEmailAsync(string email, string? nome, string? fone, string? cidade, string? uf, string? linkedinUrl, string? resumoProfissional, string? obs, OrigemTalento origem, CancellationToken ct)
    {
        var normalized = (email ?? string.Empty).Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(normalized))
            throw new ArgumentException("Email is required.", nameof(email));

        var existingTalento = await _db.Talentos
            .AsTracking()
            .Include(x => x.Pessoa)
            .FirstOrDefaultAsync(x => x.TenantId == _tenantContext.TenantId && x.Pessoa != null && x.Pessoa.Email == normalized, ct);

        if (existingTalento is not null)
        {
            var pessoa = await _pessoaService.GetOrCreateByEmailAsync(email!, nome, fone, cidade, uf, linkedinUrl, resumoProfissional, obs, MapToOrigemPessoa(origem), ct);
            existingTalento.Pessoa = pessoa;
            return (existingTalento, false);
        }

        var pessoaNew = await _pessoaService.GetOrCreateByEmailAsync(email!, nome, fone, cidade, uf, linkedinUrl, resumoProfissional, obs, MapToOrigemPessoa(origem), ct);

        var talento = await _db.Talentos
            .AsTracking()
            .Include(x => x.Pessoa)
            .FirstOrDefaultAsync(x => x.TenantId == _tenantContext.TenantId && x.PessoaId == pessoaNew.Id, ct);

        if (talento is not null)
        {
            talento.Pessoa = pessoaNew;
            return (talento, false);
        }

        var newTalento = new Talento
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            PessoaId = pessoaNew.Id,
            Origem = origem,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
            Versao = 1
        };
        _db.Talentos.Add(newTalento);
        await _db.SaveChangesAsync(ct);
        newTalento.Pessoa = pessoaNew;
        return (newTalento, true);
    }

    private static TalentoResponse MapToResponse(Talento t, PendingCvImportJobResponse? pendingCvImportJob = null)
    {
        var p = t.Pessoa!;
        var comp = (t.Competencias ?? new List<TalentoCompetencia>()).Select(c => new TalentoCompetenciaItem(c.Id, c.Tipo, c.Nome, c.Nivel, c.Evidencia, c.TempoAtuacao)).ToList();
        var exp = (t.Experiencias ?? new List<TalentoExperiencia>()).Select(e => new TalentoExperienciaItem(e.Id, e.Empresa, e.Cargo, e.Inicio, e.Fim, e.TipoContratacao, e.Local, e.Atividades, e.ResumoAtividades, e.NivelSenioridade, e.NivelHierarquico)).ToList();
        var trein = (t.Treinamentos ?? new List<TalentoTreinamento>()).Select(tr => new TalentoTreinamentoItem(tr.Id, tr.Nome, tr.Instituicao, tr.Ano, tr.Link)).ToList();
        var form = (t.Formacao ?? new List<TalentoFormacao>()).Select(f => new TalentoFormacaoItem(f.Id, f.Curso, f.Instituicao, f.Tipo, f.Status, f.Inicio, f.Fim, f.Observacoes, f.Link)).ToList();
        var docs = (t.Documentos ?? new List<TalentoDocumento>()).Select(d => new TalentoDocumentoSummary(d.Id, d.NomeArquivo, d.ContentType, d.TamanhoBytes, d.CreatedAtUtc)).ToList();
        return new TalentoResponse(
            t.Id,
            t.PessoaId,
            p.Nome,
            p.Email,
            p.Fone,
            p.Cidade,
            p.Uf,
            p.LinkedinUrl,
            p.ResumoProfissional,
            p.Obs,
            p.Cpf,
            p.DataNascimento,
            p.Cep,
            p.Logradouro,
            p.Numero,
            p.Bairro,
            t.Origem,
            comp,
            exp,
            trein,
            form,
            docs,
            t.CreatedAtUtc,
            t.UpdatedAtUtc,
            t.Versao,
            pendingCvImportJob);
    }

    private void ApplyCompetencias(Talento entity, IReadOnlyList<TalentoCompetenciaItem>? items)
    {
        if (items is null) return;
        var tenantId = _tenantContext.TenantId;
        var now = DateTimeOffset.UtcNow;
        foreach (var item in items)
        {
            entity.Competencias.Add(new TalentoCompetencia
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                TalentoId = entity.Id,
                Tipo = (TrimToMax(item.Tipo, 40) ?? string.Empty).Length > 40 ? (item.Tipo ?? "").Trim().Substring(0, 40) : (item.Tipo ?? "").Trim(),
                Nome = (TrimToMax(item.Nome, 120) ?? string.Empty).Length > 120 ? (item.Nome ?? "").Trim().Substring(0, 120) : (item.Nome ?? "").Trim(),
                Nivel = (TrimToMax(item.Nivel, 40) ?? string.Empty).Length > 40 ? (item.Nivel ?? "").Trim().Substring(0, 40) : (item.Nivel ?? "").Trim(),
                Evidencia = TrimToMax(item.Evidencia, 300),
                TempoAtuacao = TrimToMax(item.TempoAtuacao, 80),
                CreatedAtUtc = now,
                UpdatedAtUtc = now
            });
        }
    }

    private void ApplyExperiencias(Talento entity, IReadOnlyList<TalentoExperienciaItem>? items)
    {
        if (items is null) return;
        var tenantId = _tenantContext.TenantId;
        var now = DateTimeOffset.UtcNow;
        foreach (var item in items)
        {
            entity.Experiencias.Add(new TalentoExperiencia
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                TalentoId = entity.Id,
                Empresa = (TrimToMax(item.Empresa, 160) ?? string.Empty).Length > 160 ? (item.Empresa ?? "").Trim().Substring(0, 160) : (item.Empresa ?? "").Trim(),
                Cargo = (TrimToMax(item.Cargo, 160) ?? string.Empty).Length > 160 ? (item.Cargo ?? "").Trim().Substring(0, 160) : (item.Cargo ?? "").Trim(),
                Inicio = TrimToMax(item.Inicio, 20),
                Fim = TrimToMax(item.Fim, 20),
                TipoContratacao = TrimToMax(item.TipoContratacao, 40),
                Local = TrimToMax(item.Local, 160),
                Atividades = TrimToMax(item.Atividades, 2400),
                ResumoAtividades = TrimToMax(item.ResumoAtividades, 800),
                NivelSenioridade = TrimToMax(item.NivelSenioridade, 40),
                NivelHierarquico = TrimToMax(item.NivelHierarquico, 80),
                CreatedAtUtc = now,
                UpdatedAtUtc = now
            });
        }
    }

    private void ApplyTreinamentos(Talento entity, IReadOnlyList<TalentoTreinamentoItem>? items)
    {
        if (items is null) return;
        var tenantId = _tenantContext.TenantId;
        var now = DateTimeOffset.UtcNow;
        foreach (var item in items)
        {
            entity.Treinamentos.Add(new TalentoTreinamento
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                TalentoId = entity.Id,
                Nome = (TrimToMax(item.Nome, 160) ?? string.Empty).Length > 160 ? (item.Nome ?? "").Trim().Substring(0, 160) : (item.Nome ?? "").Trim(),
                Instituicao = TrimToMax(item.Instituicao, 160),
                Ano = TrimToMax(item.Ano, 10),
                Link = TrimToMax(item.Link, 260),
                CreatedAtUtc = now,
                UpdatedAtUtc = now
            });
        }
    }

    private void ApplyFormacao(Talento entity, IReadOnlyList<TalentoFormacaoItem>? items)
    {
        if (items is null) return;
        var tenantId = _tenantContext.TenantId;
        var now = DateTimeOffset.UtcNow;
        foreach (var item in items)
        {
            entity.Formacao.Add(new TalentoFormacao
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                TalentoId = entity.Id,
                Curso = (TrimToMax(item.Curso, 160) ?? string.Empty).Length > 160 ? (item.Curso ?? "").Trim().Substring(0, 160) : (item.Curso ?? "").Trim(),
                Instituicao = TrimToMax(item.Instituicao, 160),
                Tipo = TrimToMax(item.Tipo, 40),
                Status = TrimToMax(item.Status, 40),
                Inicio = TrimToMax(item.Inicio, 20),
                Fim = TrimToMax(item.Fim, 20),
                Observacoes = TrimToMax(item.Observacoes, 800),
                Link = TrimToMax(item.Link, 260),
                CreatedAtUtc = now,
                UpdatedAtUtc = now
            });
        }
    }

    private void AddSuggestedDataToContext(Guid talentoId, TalentoImportPdfSuggestedData suggestedData)
    {
        var tenantId = _tenantContext.TenantId;
        var now = DateTimeOffset.UtcNow;
        if (suggestedData.Competencias?.Count > 0)
        {
            var list = new List<TalentoCompetencia>();
            foreach (var item in suggestedData.Competencias)
            {
                list.Add(new TalentoCompetencia
                {
                    Id = item.Id ?? Guid.NewGuid(),
                    TenantId = tenantId,
                    TalentoId = talentoId,
                    Tipo = (TrimToMax(item.Tipo, 40) ?? string.Empty).Length > 40 ? (item.Tipo ?? "").Trim().Substring(0, 40) : (item.Tipo ?? "").Trim(),
                    Nome = (TrimToMax(item.Nome, 120) ?? string.Empty).Length > 120 ? (item.Nome ?? "").Trim().Substring(0, 120) : (item.Nome ?? "").Trim(),
                    Nivel = (TrimToMax(item.Nivel, 40) ?? string.Empty).Length > 40 ? (item.Nivel ?? "").Trim().Substring(0, 40) : (item.Nivel ?? "").Trim(),
                    Evidencia = TrimToMax(item.Evidencia, 300),
                    TempoAtuacao = TrimToMax(item.TempoAtuacao, 80),
                    CreatedAtUtc = now,
                    UpdatedAtUtc = now
                });
            }
            _db.TalentoCompetencias.AddRange(list);
        }
        if (suggestedData.Experiencias?.Count > 0)
        {
            var list = new List<TalentoExperiencia>();
            foreach (var item in suggestedData.Experiencias)
            {
                list.Add(new TalentoExperiencia
                {
                    Id = item.Id ?? Guid.NewGuid(),
                    TenantId = tenantId,
                    TalentoId = talentoId,
                    Empresa = (TrimToMax(item.Empresa, 160) ?? string.Empty).Length > 160 ? (item.Empresa ?? "").Trim().Substring(0, 160) : (item.Empresa ?? "").Trim(),
                    Cargo = (TrimToMax(item.Cargo, 160) ?? string.Empty).Length > 160 ? (item.Cargo ?? "").Trim().Substring(0, 160) : (item.Cargo ?? "").Trim(),
                    Inicio = TrimToMax(item.Inicio, 20),
                    Fim = TrimToMax(item.Fim, 20),
                    TipoContratacao = TrimToMax(item.TipoContratacao, 40),
                    Local = TrimToMax(item.Local, 160),
                    Atividades = TrimToMax(item.Atividades, 2400),
                    ResumoAtividades = TrimToMax(item.ResumoAtividades, 800),
                    NivelSenioridade = TrimToMax(item.NivelSenioridade, 40),
                    NivelHierarquico = TrimToMax(item.NivelHierarquico, 80),
                    CreatedAtUtc = now,
                    UpdatedAtUtc = now
                });
            }
            _db.TalentoExperiencias.AddRange(list);
        }
        if (suggestedData.Treinamentos?.Count > 0)
        {
            var list = new List<TalentoTreinamento>();
            foreach (var item in suggestedData.Treinamentos)
            {
                list.Add(new TalentoTreinamento
                {
                    Id = item.Id ?? Guid.NewGuid(),
                    TenantId = tenantId,
                    TalentoId = talentoId,
                    Nome = (TrimToMax(item.Nome, 160) ?? string.Empty).Length > 160 ? (item.Nome ?? "").Trim().Substring(0, 160) : (item.Nome ?? "").Trim(),
                    Instituicao = TrimToMax(item.Instituicao, 160),
                    Ano = TrimToMax(item.Ano, 10),
                    Link = TrimToMax(item.Link, 260),
                    CreatedAtUtc = now,
                    UpdatedAtUtc = now
                });
            }
            _db.TalentoTreinamentos.AddRange(list);
        }
        if (suggestedData.Formacao?.Count > 0)
        {
            var list = new List<TalentoFormacao>();
            foreach (var item in suggestedData.Formacao)
            {
                list.Add(new TalentoFormacao
                {
                    Id = item.Id ?? Guid.NewGuid(),
                    TenantId = tenantId,
                    TalentoId = talentoId,
                    Curso = (TrimToMax(item.Curso, 160) ?? string.Empty).Length > 160 ? (item.Curso ?? "").Trim().Substring(0, 160) : (item.Curso ?? "").Trim(),
                    Instituicao = TrimToMax(item.Instituicao, 160),
                    Tipo = TrimToMax(item.Tipo, 40),
                    Status = TrimToMax(item.Status, 40),
                    Inicio = TrimToMax(item.Inicio, 20),
                    Fim = TrimToMax(item.Fim, 20),
                    Observacoes = TrimToMax(item.Observacoes, 800),
                    Link = TrimToMax(item.Link, 260),
                    CreatedAtUtc = now,
                    UpdatedAtUtc = now
                });
            }
            _db.TalentoFormacoes.AddRange(list);
        }
    }

    private static string BuildCvProfileJsonFromSuggestedData(TalentoImportPdfSuggestedData data)
    {
        var comp = (data.Competencias ?? new List<TalentoCompetenciaItem>()).Select(c => new { tipo = c.Tipo, nome = c.Nome, nivel = c.Nivel, evidencia = c.Evidencia, tempoAtuacao = c.TempoAtuacao }).ToList();
        var exp = (data.Experiencias ?? new List<TalentoExperienciaItem>()).Select(e => new { empresa = e.Empresa, cargo = e.Cargo, inicio = e.Inicio, fim = e.Fim, tipoContratacao = e.TipoContratacao, local = e.Local, atividades = e.Atividades, resumoAtividades = e.ResumoAtividades, nivelSenioridade = e.NivelSenioridade, nivelHierarquico = e.NivelHierarquico }).ToList();
        var trein = (data.Treinamentos ?? new List<TalentoTreinamentoItem>()).Select(tr => new { nome = tr.Nome, instituicao = tr.Instituicao, ano = tr.Ano, link = tr.Link }).ToList();
        var form = (data.Formacao ?? new List<TalentoFormacaoItem>()).Select(f => new { curso = f.Curso, instituicao = f.Instituicao, tipo = f.Tipo, status = f.Status, inicio = f.Inicio, fim = f.Fim, observacoes = f.Observacoes, link = f.Link }).ToList();
        var profile = new { resumoProfissional = data.ResumoProfissional, competencias = comp, experiencias = exp, treinamentos = trein, formacao = form };
        return JsonSerializer.Serialize(profile, new JsonSerializerOptions { WriteIndented = false });
    }

    private static string? BuildCvProfileJson(Talento t)
    {
        var resumo = t.Pessoa?.ResumoProfissional;
        var comp = (t.Competencias ?? new List<TalentoCompetencia>()).Select(c => new { c.Tipo, c.Nome, c.Nivel, c.Evidencia, c.TempoAtuacao }).ToList();
        var exp = (t.Experiencias ?? new List<TalentoExperiencia>()).Select(e => new { e.Empresa, e.Cargo, e.Inicio, e.Fim, e.TipoContratacao, e.Local, e.Atividades, e.ResumoAtividades, e.NivelSenioridade, e.NivelHierarquico }).ToList();
        var trein = (t.Treinamentos ?? new List<TalentoTreinamento>()).Select(tr => new { tr.Nome, tr.Instituicao, tr.Ano, tr.Link }).ToList();
        var form = (t.Formacao ?? new List<TalentoFormacao>()).Select(f => new { f.Curso, f.Instituicao, f.Tipo, f.Status, f.Inicio, f.Fim, f.Observacoes, f.Link }).ToList();
        var profile = new
        {
            resumoProfissional = resumo,
            competencias = comp,
            experiencias = exp,
            treinamentos = trein,
            formacao = form
        };
        return JsonSerializer.Serialize(profile, new JsonSerializerOptions { WriteIndented = false });
    }

    private static string BuildCvProfileJsonFromUpdateRequest(TalentoUpdateRequest request)
    {
        var comp = (request.Competencias ?? new List<TalentoCompetenciaItem>()).Select(c => new { c.Tipo, c.Nome, c.Nivel, c.Evidencia, c.TempoAtuacao }).ToList();
        var exp = (request.Experiencias ?? new List<TalentoExperienciaItem>()).Select(e => new { e.Empresa, e.Cargo, e.Inicio, e.Fim, e.TipoContratacao, e.Local, e.Atividades, e.ResumoAtividades, e.NivelSenioridade, e.NivelHierarquico }).ToList();
        var trein = (request.Treinamentos ?? new List<TalentoTreinamentoItem>()).Select(tr => new { tr.Nome, tr.Instituicao, tr.Ano, tr.Link }).ToList();
        var form = (request.Formacao ?? new List<TalentoFormacaoItem>()).Select(f => new { f.Curso, f.Instituicao, f.Tipo, f.Status, f.Inicio, f.Fim, f.Observacoes, f.Link }).ToList();
        var profile = new { resumoProfissional = request.ResumoProfissional, competencias = comp, experiencias = exp, treinamentos = trein, formacao = form };
        return JsonSerializer.Serialize(profile, new JsonSerializerOptions { WriteIndented = false });
    }

    private void AddUpdateRequestChildrenToContext(Guid talentoId, TalentoUpdateRequest request)
    {
        var tenantId = _tenantContext.TenantId;
        var now = DateTimeOffset.UtcNow;
        if (request.Competencias?.Count > 0)
        {
            var list = new List<TalentoCompetencia>();
            foreach (var item in request.Competencias)
            {
                list.Add(new TalentoCompetencia
                {
                    Id = item.Id ?? Guid.NewGuid(),
                    TenantId = tenantId,
                    TalentoId = talentoId,
                    Tipo = (TrimToMax(item.Tipo, 40) ?? string.Empty).Length > 40 ? (item.Tipo ?? "").Trim().Substring(0, 40) : (item.Tipo ?? "").Trim(),
                    Nome = (TrimToMax(item.Nome, 120) ?? string.Empty).Length > 120 ? (item.Nome ?? "").Trim().Substring(0, 120) : (item.Nome ?? "").Trim(),
                    Nivel = (TrimToMax(item.Nivel, 40) ?? string.Empty).Length > 40 ? (item.Nivel ?? "").Trim().Substring(0, 40) : (item.Nivel ?? "").Trim(),
                    Evidencia = TrimToMax(item.Evidencia, 300),
                    TempoAtuacao = TrimToMax(item.TempoAtuacao, 80),
                    CreatedAtUtc = now,
                    UpdatedAtUtc = now
                });
            }
            _db.TalentoCompetencias.AddRange(list);
        }
        if (request.Experiencias?.Count > 0)
        {
            var list = new List<TalentoExperiencia>();
            foreach (var item in request.Experiencias)
            {
                list.Add(new TalentoExperiencia
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    TalentoId = talentoId,
                    Empresa = (TrimToMax(item.Empresa, 160) ?? string.Empty).Length > 160 ? (item.Empresa ?? "").Trim().Substring(0, 160) : (item.Empresa ?? "").Trim(),
                    Cargo = (TrimToMax(item.Cargo, 160) ?? string.Empty).Length > 160 ? (item.Cargo ?? "").Trim().Substring(0, 160) : (item.Cargo ?? "").Trim(),
                    Inicio = TrimToMax(item.Inicio, 20),
                    Fim = TrimToMax(item.Fim, 20),
                    TipoContratacao = TrimToMax(item.TipoContratacao, 40),
                    Local = TrimToMax(item.Local, 160),
                    Atividades = TrimToMax(item.Atividades, 2400),
                    ResumoAtividades = TrimToMax(item.ResumoAtividades, 800),
                    NivelSenioridade = TrimToMax(item.NivelSenioridade, 40),
                    NivelHierarquico = TrimToMax(item.NivelHierarquico, 80),
                    CreatedAtUtc = now,
                    UpdatedAtUtc = now
                });
            }
            _db.TalentoExperiencias.AddRange(list);
        }
        if (request.Treinamentos?.Count > 0)
        {
            var list = new List<TalentoTreinamento>();
            foreach (var item in request.Treinamentos)
            {
                list.Add(new TalentoTreinamento
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    TalentoId = talentoId,
                    Nome = (TrimToMax(item.Nome, 160) ?? string.Empty).Length > 160 ? (item.Nome ?? "").Trim().Substring(0, 160) : (item.Nome ?? "").Trim(),
                    Instituicao = TrimToMax(item.Instituicao, 160),
                    Ano = TrimToMax(item.Ano, 10),
                    Link = TrimToMax(item.Link, 260),
                    CreatedAtUtc = now,
                    UpdatedAtUtc = now
                });
            }
            _db.TalentoTreinamentos.AddRange(list);
        }
        if (request.Formacao?.Count > 0)
        {
            var list = new List<TalentoFormacao>();
            foreach (var item in request.Formacao)
            {
                list.Add(new TalentoFormacao
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    TalentoId = talentoId,
                    Curso = (TrimToMax(item.Curso, 160) ?? string.Empty).Length > 160 ? (item.Curso ?? "").Trim().Substring(0, 160) : (item.Curso ?? "").Trim(),
                    Instituicao = TrimToMax(item.Instituicao, 160),
                    Tipo = TrimToMax(item.Tipo, 40),
                    Status = TrimToMax(item.Status, 40),
                    Inicio = TrimToMax(item.Inicio, 20),
                    Fim = TrimToMax(item.Fim, 20),
                    Observacoes = TrimToMax(item.Observacoes, 800),
                    Link = TrimToMax(item.Link, 260),
                    CreatedAtUtc = now,
                    UpdatedAtUtc = now
                });
            }
            _db.TalentoFormacoes.AddRange(list);
        }
    }

    private string GetTalentoFolder(Guid talentoId) =>
        Path.Combine(
            _hostEnvironment.ContentRootPath,
            "App_Data",
            "uploads",
            _tenantContext.TenantId,
            "talentos",
            talentoId.ToString("N"));

    private static string BuildStorageFileName(Guid documentId, string originalName)
    {
        var extension = Path.GetExtension(originalName);
        if (!string.IsNullOrWhiteSpace(extension))
        {
            extension = new string(extension.Where(c => char.IsLetterOrDigit(c) || c == '.').ToArray());
            if (extension.Length > 12) extension = extension[..12];
        }
        else
            extension = string.Empty;
        return $"{documentId:N}{extension}";
    }

    private static string NormalizeFileName(string? fileName)
    {
        var name = Path.GetFileName(fileName ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(name)) name = "documento";
        if (name.Length > 200) name = name[..200];
        return name;
    }

    private static string GetContentType(string? ext) =>
        (ext?.ToLowerInvariant()) switch
        {
            ".pdf" => "application/pdf",
            ".doc" => "application/msword",
            ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            _ => "application/octet-stream"
        };

    private static OrigemPessoa MapToOrigemPessoa(OrigemTalento origem) =>
        origem switch
        {
            OrigemTalento.Manual => OrigemPessoa.Manual,
            OrigemTalento.Email => OrigemPessoa.Email,
            OrigemTalento.Site => OrigemPessoa.Site,
            OrigemTalento.Candidatura => OrigemPessoa.Vaga,
            OrigemTalento.Pasta => OrigemPessoa.Pasta,
            _ => OrigemPessoa.Outro
        };

    private static string? TrimToMax(string? value, int max) => string.IsNullOrWhiteSpace(value) ? null : (value.Length <= max ? value.Trim() : value.Trim().Substring(0, max));

    private static string TrimMax(string? value, int max)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;
        var t = value.Trim();
        return t.Length <= max ? t : t.Substring(0, max);
    }

    private static string NormalizeEmail(string? email) => (email ?? string.Empty).Trim().ToLowerInvariant();

    private static readonly Dictionary<string, string> UfByName = new(StringComparer.OrdinalIgnoreCase)
    {
        ["acre"] = "AC", ["alagoas"] = "AL", ["amapá"] = "AP", ["amapa"] = "AP", ["amazonas"] = "AM",
        ["bahia"] = "BA", ["ceará"] = "CE", ["ceara"] = "CE", ["distrito federal"] = "DF",
        ["espírito santo"] = "ES", ["espirito santo"] = "ES", ["goiás"] = "GO", ["goias"] = "GO",
        ["maranhão"] = "MA", ["maranhao"] = "MA", ["mato grosso"] = "MT", ["mato grosso do sul"] = "MS",
        ["minas gerais"] = "MG", ["pará"] = "PA", ["para"] = "PA", ["paraíba"] = "PB", ["paraiba"] = "PB",
        ["paraná"] = "PR", ["parana"] = "PR", ["pernambuco"] = "PE", ["piauí"] = "PI", ["piaui"] = "PI",
        ["rio de janeiro"] = "RJ", ["rio grande do norte"] = "RN", ["rio grande do sul"] = "RS",
        ["rondônia"] = "RO", ["rondonia"] = "RO", ["roraima"] = "RR", ["santa catarina"] = "SC",
        ["são paulo"] = "SP", ["sao paulo"] = "SP", ["sergipe"] = "SE", ["tocantins"] = "TO"
    };

    /// <summary>Aceita "SP" ou "São Paulo" e devolve sempre "SP". Trata caso o Gemini volte o nome completo.</summary>
    private static string? NormalizeUf(string? uf)
    {
        if (string.IsNullOrWhiteSpace(uf)) return null;
        var t = uf.Trim();
        if (UfByName.TryGetValue(t, out var code)) return code;
        // Já é sigla? — mantém só se forem 2 letras ASCII
        if (t.Length == 2 && char.IsLetter(t[0]) && char.IsLetter(t[1]))
            return t.ToUpperInvariant();
        // Fallback: pega as primeiras 2 letras ASCII (evita corte UTF-8 que gera "SÃ")
        var letters = new string(t.Where(char.IsLetter).Where(c => c < 128).Take(2).ToArray());
        return letters.Length == 2 ? letters.ToUpperInvariant() : null;
    }
}
