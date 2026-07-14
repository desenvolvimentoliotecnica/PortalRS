using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Notifications;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.ProjetosVaga;

// ── DTOs ──

public sealed record ProjetoVagaResponse(
    Guid Id, Guid VagaId, int Numero, string? Descricao,
    StatusProjeto Status, int TotalCandidatos, DateTimeOffset CreatedAtUtc,
    DateOnly? DataInicio, DateOnly? DataEncerramento);

public sealed record ProjetoVagaCreateRequest(
    string? Descricao,
    bool CopiarCandidatosAnterior = false,
    /// <summary>
    /// Cria a rodada com "banco novo": ignora candidatos de projetos anteriores.
    /// </summary>
    bool IgnorarCandidatosAnterior = false,
    /// <summary>
    /// Quando não estiver copiando, reprova automaticamente apenas os candidatos
    /// que já estavam como Reprovado em projetos anteriores.
    /// </summary>
    bool ReprovarApenasReprovadosAnterior = false);

public sealed record ProjetoVagaUpdateRequest(string? Descricao);

public sealed record ProjetoCandidatoResponse(
    Guid Id, Guid ProjetoId, Guid CandidatoId,
    string CandidatoNome, string? CandidatoEmail, string? CandidatoCidade, string? CandidatoUf,
    string? CandidatoLinkedinUrl, bool? CandidatoTrabalhandoAtualmente, decimal? CandidatoPretensaoSalarial,
    StatusCandidatoProjeto Status, Guid? FaseAtualId, string? FaseAtualNome,
    string? Observacoes, DateTimeOffset CreatedAtUtc);

public sealed record ProjetoCandidatoAddRequest(Guid CandidatoId, string? Observacoes);

public sealed record ProjetoCandidatoUpdateRequest(StatusCandidatoProjeto Status, string? Observacoes);

// ── Interface ──

public interface IProjetoVagaService
{
    Task<IReadOnlyList<ProjetoVagaResponse>> ListProjetosAsync(Guid vagaId, CancellationToken ct);
    Task<ProjetoVagaResponse?> GetProjetoAsync(Guid projetoId, CancellationToken ct);
    Task<ProjetoVagaResponse> CreateProjetoAsync(Guid vagaId, ProjetoVagaCreateRequest request, CancellationToken ct);
    Task<ProjetoVagaResponse?> UpdateProjetoAsync(Guid projetoId, ProjetoVagaUpdateRequest request, CancellationToken ct);
    Task<IReadOnlyList<ProjetoCandidatoResponse>> ListCandidatosAsync(Guid projetoId, CancellationToken ct);
    Task<IReadOnlyList<ProjetoCandidatoResponse>> ListDisponiveisAsync(Guid projetoId, CancellationToken ct);
    Task<ProjetoCandidatoResponse?> AddCandidatoAsync(Guid projetoId, ProjetoCandidatoAddRequest request, CancellationToken ct);
    Task<ProjetoCandidatoResponse?> UpdateCandidatoAsync(Guid projetoId, Guid id, ProjetoCandidatoUpdateRequest request, CancellationToken ct);
    /// <summary>Retorna a rodada ativa (Status = Ativo) mais recente para a vaga, ou null se não houver.</summary>
    Task<ProjetoVaga?> GetActiveAsync(Guid vagaId, CancellationToken ct);
    /// <summary>Cria automaticamente uma nova rodada ao publicar a vaga, se não houver rodada ativa.</summary>
    Task<ProjetoVaga> EnsureActiveRodadaAsync(Guid vagaId, CancellationToken ct);
    /// <summary>Finaliza a rodada ativa da vaga (ao encerrar/pausar/cancelar).</summary>
    Task FinalizeActiveRodadaAsync(Guid vagaId, CancellationToken ct);
}

// ── Service ──

public sealed class ProjetoVagaService : IProjetoVagaService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly NotificationPublisher _notifications;
    private readonly ICurrentUserContext _currentUser;

    public ProjetoVagaService(
        AppDbContext db,
        ITenantContext tenantContext,
        NotificationPublisher notifications,
        ICurrentUserContext currentUser)
    {
        _db = db;
        _tenantContext = tenantContext;
        _notifications = notifications;
        _currentUser = currentUser;
    }

    public async Task<IReadOnlyList<ProjetoVagaResponse>> ListProjetosAsync(Guid vagaId, CancellationToken ct)
    {
        return await _db.Set<ProjetoVaga>().AsNoTracking()
            .Where(p => p.VagaId == vagaId)
            .OrderByDescending(p => p.Numero)
            .Select(p => new ProjetoVagaResponse(
                p.Id, p.VagaId, p.Numero, p.Descricao, p.Status,
                _db.Set<ProjetoCandidato>().Count(pc => pc.ProjetoId == p.Id),
                p.CreatedAtUtc, p.DataInicio, p.DataEncerramento))
            .ToListAsync(ct);
    }

    public async Task<ProjetoVagaResponse?> GetProjetoAsync(Guid projetoId, CancellationToken ct)
    {
        var p = await _db.Set<ProjetoVaga>().AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == projetoId, ct);
        if (p is null) return null;

        var total = await _db.Set<ProjetoCandidato>().CountAsync(pc => pc.ProjetoId == projetoId, ct);
        return new ProjetoVagaResponse(p.Id, p.VagaId, p.Numero, p.Descricao, p.Status, total, p.CreatedAtUtc, p.DataInicio, p.DataEncerramento);
    }

    public async Task<ProjetoVagaResponse> CreateProjetoAsync(Guid vagaId, ProjetoVagaCreateRequest request, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var now = DateTimeOffset.UtcNow;

        // Determina o próximo número e pré-busca candidatos anteriores — tudo antes do Save,
        // para que entidade + registros de rejeição sejam gravados em um único SaveChangesAsync.
        var maxNumero = await _db.Set<ProjetoVaga>()
            .Where(p => p.VagaId == vagaId)
            .MaxAsync(p => (int?)p.Numero, ct) ?? 0;

        var novoNumero = maxNumero + 1;

        // Candidatos únicos de rodadas anteriores da mesma vaga.
        List<Guid> candidatosAnteriores = [];
        if (!request.IgnorarCandidatosAnterior && novoNumero > 1)
        {
            var baseQuery = _db.Set<ProjetoCandidato>()
                .Where(pc =>
                    _db.Set<ProjetoVaga>()
                        .Where(p => p.VagaId == vagaId && p.Numero < novoNumero)
                        .Select(p => p.Id)
                        .Contains(pc.ProjetoId));

            // Quando for "reprovação automática de reprovados", limita ao que já era Reprovado.
            if (!request.CopiarCandidatosAnterior && request.ReprovarApenasReprovadosAnterior)
            {
                baseQuery = baseQuery.Where(pc => pc.Status == StatusCandidatoProjeto.Reprovado);
            }

            candidatosAnteriores = await baseQuery
                .Select(pc => pc.CandidatoId)
                .Distinct()
                .ToListAsync(ct);
        }

        var entityId = Guid.NewGuid();
        var entity = new ProjetoVaga
        {
            Id = entityId,
            TenantId = tenantId,
            VagaId = vagaId,
            Numero = novoNumero,
            Descricao = request.Descricao?.Trim(),
            Status = StatusProjeto.Ativo,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };
        _db.Set<ProjetoVaga>().Add(entity);

        if (candidatosAnteriores.Count > 0)
        {
            if (request.CopiarCandidatosAnterior)
            {
                // Copiar candidatos da rodada anterior como "Disponivel" para nova triagem
                var copiados = candidatosAnteriores.Select(candidatoId => new ProjetoCandidato
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    ProjetoId = entityId,
                    CandidatoId = candidatoId,
                    Status = StatusCandidatoProjeto.Disponivel,
                    Observacoes = "Copiado da rodada anterior.",
                    CreatedAtUtc = now,
                    UpdatedAtUtc = now,
                });
                _db.Set<ProjetoCandidato>().AddRange(copiados);
            }
            else
            {
                // Auto-rejeição: marcar candidatos anteriores como Reprovado na nova rodada.
                var reprovados = candidatosAnteriores.Select(candidatoId => new ProjetoCandidato
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    ProjetoId = entityId,
                    CandidatoId = candidatoId,
                    Status = StatusCandidatoProjeto.Reprovado,
                    Observacoes = "Reprovado automaticamente (rodada anterior).",
                    CreatedAtUtc = now,
                    UpdatedAtUtc = now,
                });
                _db.Set<ProjetoCandidato>().AddRange(reprovados);
            }
        }

        await _db.SaveChangesAsync(ct);

        // Notificar recrutador responsável pela vaga sobre nova rodada
        if (novoNumero > 1)
        {
            var vagaInfo = await _db.Vagas.AsNoTracking()
                .Where(v => v.Id == vagaId)
                .Select(v => new { v.Titulo, v.RecrutadorResponsavelUserId })
                .FirstOrDefaultAsync(ct);

            if (vagaInfo?.RecrutadorResponsavelUserId != null)
            {
                await _notifications.PublishToUsersAsync(
                    tenantId,
                    [vagaInfo.RecrutadorResponsavelUserId.Value],
                    $"Nova rodada #{novoNumero} iniciada",
                    $"Uma nova rodada de seleção foi aberta para a vaga \"{vagaInfo.Titulo}\".",
                    $"/rs/vagas/{vagaId}/projetos",
                    ct: ct);
            }
        }

        return new ProjetoVagaResponse(entity.Id, entity.VagaId, entity.Numero, entity.Descricao, entity.Status, candidatosAnteriores.Count, entity.CreatedAtUtc, entity.DataInicio, entity.DataEncerramento);
    }

    public async Task<ProjetoVagaResponse?> UpdateProjetoAsync(Guid projetoId, ProjetoVagaUpdateRequest request, CancellationToken ct)
    {
        var entity = await _db.Set<ProjetoVaga>().FirstOrDefaultAsync(x => x.Id == projetoId, ct);
        if (entity is null) return null;

        entity.Descricao = request.Descricao?.Trim();
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        var total = await _db.Set<ProjetoCandidato>().CountAsync(pc => pc.ProjetoId == projetoId, ct);
        return new ProjetoVagaResponse(entity.Id, entity.VagaId, entity.Numero, entity.Descricao, entity.Status, total, entity.CreatedAtUtc, entity.DataInicio, entity.DataEncerramento);
    }

    /// <summary>
    /// Lista candidatos DO projeto atual com dados enriquecidos para exibição tipo Excel.
    /// </summary>
    public async Task<IReadOnlyList<ProjetoCandidatoResponse>> ListCandidatosAsync(Guid projetoId, CancellationToken ct)
    {
        var items = await _db.Set<ProjetoCandidato>().AsNoTracking()
            .Include(pc => pc.Candidato)
            .Include(pc => pc.FaseAtual)
            .Where(pc => pc.ProjetoId == projetoId)
            .OrderBy(pc => pc.Status).ThenBy(pc => pc.CreatedAtUtc)
            .Select(pc => new ProjetoCandidatoResponse(
                pc.Id, pc.ProjetoId, pc.CandidatoId,
                pc.Candidato!.Nome, pc.Candidato.Email, pc.Candidato.Cidade, pc.Candidato.Uf,
                pc.Candidato.LinkedinUrl, pc.Candidato.TrabalhandoAtualmente, pc.Candidato.PretensaoSalarial,
                pc.Status, pc.FaseAtualId, pc.FaseAtual != null ? pc.FaseAtual.Nome : null,
                pc.Observacoes, pc.CreatedAtUtc))
            .ToListAsync(ct);
        return RedactContato(items);
    }

    /// <summary>
    /// Lista candidatos REPROVADOS em projetos anteriores da mesma vaga (aba "Disponíveis").
    /// Esses NÃO aparecem automaticamente, são apenas consulta.
    /// </summary>
    public async Task<IReadOnlyList<ProjetoCandidatoResponse>> ListDisponiveisAsync(Guid projetoId, CancellationToken ct)
    {
        // Uma query: junta o projeto atual com os projetos anteriores da mesma vaga.
        var projetosAnterioresIds = await (
            from cur in _db.Set<ProjetoVaga>().AsNoTracking()
            join prev in _db.Set<ProjetoVaga>().AsNoTracking()
                on cur.VagaId equals prev.VagaId
            where cur.Id == projetoId && prev.Numero < cur.Numero
            select prev.Id
        ).ToListAsync(ct);

        if (projetosAnterioresIds.Count == 0) return Array.Empty<ProjetoCandidatoResponse>();

        // Candidatos reprovados em projetos anteriores (aba Disponíveis)
        var items = await _db.Set<ProjetoCandidato>().AsNoTracking()
            .Include(pc => pc.Candidato)
            .Include(pc => pc.FaseAtual)
            .Where(pc => projetosAnterioresIds.Contains(pc.ProjetoId) && pc.Status == StatusCandidatoProjeto.Reprovado)
            .OrderBy(pc => pc.Candidato!.Nome)
            .Select(pc => new ProjetoCandidatoResponse(
                pc.Id, pc.ProjetoId, pc.CandidatoId,
                pc.Candidato!.Nome, pc.Candidato.Email, pc.Candidato.Cidade, pc.Candidato.Uf,
                pc.Candidato.LinkedinUrl, pc.Candidato.TrabalhandoAtualmente, pc.Candidato.PretensaoSalarial,
                pc.Status, pc.FaseAtualId, pc.FaseAtual != null ? pc.FaseAtual.Nome : null,
                pc.Observacoes, pc.CreatedAtUtc))
            .ToListAsync(ct);
        return RedactContato(items);
    }

    /// <summary>
    /// Adiciona candidato ao projeto. Impede se ele foi reprovado em projeto anterior da mesma vaga.
    /// </summary>
    public async Task<ProjetoCandidatoResponse?> AddCandidatoAsync(Guid projetoId, ProjetoCandidatoAddRequest request, CancellationToken ct)
    {
        var projeto = await _db.Set<ProjetoVaga>().AsNoTracking().FirstOrDefaultAsync(x => x.Id == projetoId, ct);
        if (projeto is null) return null;

        // Verificar se já está no projeto
        var exists = await _db.Set<ProjetoCandidato>().AnyAsync(
            pc => pc.ProjetoId == projetoId && pc.CandidatoId == request.CandidatoId, ct);
        if (exists)
            throw new InvalidOperationException("Candidato já está neste projeto.");

        // Verificar se foi reprovado em projeto anterior da mesma vaga
        var reprovado = await _db.Set<ProjetoCandidato>().AsNoTracking()
            .AnyAsync(pc =>
                pc.CandidatoId == request.CandidatoId
                && pc.Status == StatusCandidatoProjeto.Reprovado
                && pc.Projeto!.VagaId == projeto.VagaId
                && pc.Projeto.Numero < projeto.Numero,
                ct);
        if (reprovado)
            throw new InvalidOperationException("Candidato foi reprovado em rodada anterior desta vaga.");

        var candidato = await _db.Candidatos.AsNoTracking().FirstOrDefaultAsync(c => c.Id == request.CandidatoId, ct);
        if (candidato is null) return null;

        var entity = new ProjetoCandidato
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            ProjetoId = projetoId,
            CandidatoId = request.CandidatoId,
            Status = StatusCandidatoProjeto.Ativo,
            Observacoes = request.Observacoes?.Trim(),
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        _db.Set<ProjetoCandidato>().Add(entity);
        await _db.SaveChangesAsync(ct);

        return RedactContato(new ProjetoCandidatoResponse(
            entity.Id, entity.ProjetoId, entity.CandidatoId,
            candidato.Nome, candidato.Email, candidato.Cidade, candidato.Uf,
            candidato.LinkedinUrl, candidato.TrabalhandoAtualmente, candidato.PretensaoSalarial,
            entity.Status, entity.FaseAtualId, null,
            entity.Observacoes, entity.CreatedAtUtc));
    }

    public async Task<ProjetoCandidatoResponse?> UpdateCandidatoAsync(Guid projetoId, Guid id, ProjetoCandidatoUpdateRequest request, CancellationToken ct)
    {
        var entity = await _db.Set<ProjetoCandidato>()
            .Include(pc => pc.Candidato)
            .Include(pc => pc.FaseAtual)
            .FirstOrDefaultAsync(pc => pc.Id == id && pc.ProjetoId == projetoId, ct);
        if (entity is null) return null;

        entity.Status = request.Status;
        entity.Observacoes = request.Observacoes?.Trim();
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        return RedactContato(new ProjetoCandidatoResponse(
            entity.Id, entity.ProjetoId, entity.CandidatoId,
            entity.Candidato!.Nome, entity.Candidato.Email, entity.Candidato.Cidade, entity.Candidato.Uf,
            entity.Candidato.LinkedinUrl, entity.Candidato.TrabalhandoAtualmente, entity.Candidato.PretensaoSalarial,
            entity.Status, entity.FaseAtualId, entity.FaseAtual?.Nome,
            entity.Observacoes, entity.CreatedAtUtc));
    }

    /// <inheritdoc/>
    public async Task<ProjetoVaga?> GetActiveAsync(Guid vagaId, CancellationToken ct)
    {
        return await _db.Set<ProjetoVaga>()
            .Where(p => p.VagaId == vagaId && p.Status == StatusProjeto.Ativo)
            .OrderByDescending(p => p.Numero)
            .FirstOrDefaultAsync(ct);
    }

    /// <inheritdoc/>
    public async Task<ProjetoVaga> EnsureActiveRodadaAsync(Guid vagaId, CancellationToken ct)
    {
        // Se já existe rodada ativa, retorna sem criar nova
        var existing = await GetActiveAsync(vagaId, ct);
        if (existing is not null) return existing;

        var tenantId = _tenantContext.TenantId;
        var now = DateTimeOffset.UtcNow;
        var today = DateOnly.FromDateTime(now.UtcDateTime);

        var maxNumero = await _db.Set<ProjetoVaga>()
            .Where(p => p.VagaId == vagaId)
            .MaxAsync(p => (int?)p.Numero, ct) ?? 0;

        var rodada = new ProjetoVaga
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            VagaId = vagaId,
            Numero = maxNumero + 1,
            Descricao = maxNumero == 0 ? "Publicação inicial" : $"Rodada {maxNumero + 1}",
            Status = StatusProjeto.Ativo,
            DataInicio = today,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };
        _db.Set<ProjetoVaga>().Add(rodada);
        await _db.SaveChangesAsync(ct);
        return rodada;
    }

    /// <inheritdoc/>
    public async Task FinalizeActiveRodadaAsync(Guid vagaId, CancellationToken ct)
    {
        var rodada = await GetActiveAsync(vagaId, ct);
        if (rodada is null) return;

        rodada.Status = StatusProjeto.Finalizado;
        rodada.DataEncerramento = DateOnly.FromDateTime(DateTime.UtcNow);
        rodada.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    private IReadOnlyList<ProjetoCandidatoResponse> RedactContato(IReadOnlyList<ProjetoCandidatoResponse> items)
    {
        if (_currentUser.CanViewCandidatoContato) return items;
        return items.Select(RedactContato).ToList();
    }

    private ProjetoCandidatoResponse RedactContato(ProjetoCandidatoResponse item)
    {
        if (_currentUser.CanViewCandidatoContato) return item;
        return item with { CandidatoEmail = null };
    }
}
