using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Contracts.Candidatura;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Candidaturas;

public interface ICandidaturaService
{
    Task<Candidatura> GetOrCreateAsync(Guid candidatoId, Guid vagaId, string? fonte, string? obs, CancellationToken ct);
    Task<IReadOnlyList<CandidaturaResponse>> ListarDoCandidatoAsync(Guid candidatoId, CancellationToken ct);
    Task<CandidaturaResponse?> AvancarEtapaAsync(Guid candidaturaId, EtapaMacroCandidatura novaEtapa, string? observacao, CancellationToken ct);
    Task<KanbanCandidaturasResponse> ListarKanbanAsync(Guid? vagaId, CancellationToken ct);

    /// <summary>
    /// Sincroniza <c>Candidato.VagaId</c> (cache) com a <c>VagaId</c> da
    /// <see cref="Candidatura"/> ativa (Status=Ativa) com maior <c>AplicadaEmUtc</c>.
    /// Se o candidato não tiver candidatura ativa, <c>Candidato.VagaId</c> fica <c>null</c>.
    /// Idempotente — pode ser chamado múltiplas vezes.
    /// </summary>
    Task RecalcularVagaPrincipalAsync(Guid candidatoId, CancellationToken ct);
}

public sealed class CandidaturaService : ICandidaturaService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenant;
    private readonly ICurrentUserContext _currentUser;
    private readonly ICandidaturaNotificacaoService _notificacaoService;
    private readonly ILogger<CandidaturaService> _logger;

    public CandidaturaService(
        AppDbContext db,
        ITenantContext tenant,
        ICurrentUserContext currentUser,
        ICandidaturaNotificacaoService notificacaoService,
        ILogger<CandidaturaService> logger)
    {
        _db = db;
        _tenant = tenant;
        _currentUser = currentUser;
        _notificacaoService = notificacaoService;
        _logger = logger;
    }

    public async Task<Candidatura> GetOrCreateAsync(Guid candidatoId, Guid vagaId, string? fonte, string? obs, CancellationToken ct)
    {
        var existing = await _db.Candidaturas
            .AsTracking()
            .FirstOrDefaultAsync(x => x.CandidatoId == candidatoId && x.VagaId == vagaId, ct);

        if (existing is not null)
        {
            existing.UpdatedAtUtc = DateTimeOffset.UtcNow;
            if (!string.IsNullOrWhiteSpace(obs))
                existing.Observacoes = obs;
            await _db.SaveChangesAsync(ct);
            await RecalcularVagaPrincipalAsync(candidatoId, ct);
            return existing;
        }

        var now = DateTimeOffset.UtcNow;
        var entity = new Candidatura
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant.TenantId ?? string.Empty,
            CandidatoId = candidatoId,
            VagaId = vagaId,
            Status = CandidaturaStatus.Ativa,
            EtapaMacro = EtapaMacroCandidatura.Aplicada,
            Fonte = fonte,
            Observacoes = obs,
            AplicadaEmUtc = now,
            EtapaAtualDesdeUtc = now,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };

        _db.Candidaturas.Add(entity);

        _db.CandidaturaEtapaHistoricos.Add(new CandidaturaEtapaHistorico
        {
            Id = Guid.NewGuid(),
            TenantId = entity.TenantId,
            CandidaturaId = entity.Id,
            EtapaAnterior = EtapaMacroCandidatura.Aplicada,
            EtapaNova = EtapaMacroCandidatura.Aplicada,
            Observacao = "Candidatura registrada",
            UserId = _currentUser.UserId,
            EmUtc = now,
        });

        await _db.SaveChangesAsync(ct);
        await RecalcularVagaPrincipalAsync(candidatoId, ct);
        return entity;
    }

    public async Task RecalcularVagaPrincipalAsync(Guid candidatoId, CancellationToken ct)
    {
        var candidato = await _db.Candidatos
            .AsTracking()
            .FirstOrDefaultAsync(c => c.Id == candidatoId, ct);
        if (candidato is null) return;

        // Regra canônica:
        //  1) preferir a Candidatura ATIVA mais recente (Status=Ativa, maior AplicadaEmUtc).
        //  2) se não houver ativa, preferir a mais recente em qualquer estado
        //     (mantém o cache útil p/ histórico; Reports/Dashboard filtram ativo por conta própria).
        //  3) se não houver candidatura alguma, preservar o VagaId atual (candidato captado
        //     manualmente pelo admin antes de qualquer candidatura registrada).
        var ativa = await _db.Candidaturas
            .AsNoTracking()
            .Where(x => x.CandidatoId == candidatoId && x.Status == CandidaturaStatus.Ativa)
            .OrderByDescending(x => x.AplicadaEmUtc)
            .ThenByDescending(x => x.CreatedAtUtc)
            .Select(x => (Guid?)x.VagaId)
            .FirstOrDefaultAsync(ct);

        if (ativa.HasValue)
        {
            if (candidato.VagaId != ativa.Value)
            {
                candidato.VagaId = ativa.Value;
                candidato.UpdatedAtUtc = DateTimeOffset.UtcNow;
                await _db.SaveChangesAsync(ct);
            }
            return;
        }

        var qualquer = await _db.Candidaturas
            .AsNoTracking()
            .Where(x => x.CandidatoId == candidatoId)
            .OrderByDescending(x => x.AplicadaEmUtc)
            .ThenByDescending(x => x.CreatedAtUtc)
            .Select(x => (Guid?)x.VagaId)
            .FirstOrDefaultAsync(ct);

        if (qualquer.HasValue)
        {
            if (candidato.VagaId != qualquer.Value)
            {
                candidato.VagaId = qualquer.Value;
                candidato.UpdatedAtUtc = DateTimeOffset.UtcNow;
                await _db.SaveChangesAsync(ct);
            }
            return;
        }

        // Sem candidaturas — preserva valor atual (candidato pode ter sido captado
        // diretamente pelo admin; não zera o cache pra não perder referência).
    }

    public async Task<IReadOnlyList<CandidaturaResponse>> ListarDoCandidatoAsync(Guid candidatoId, CancellationToken ct)
    {
        var q = from c in _db.Candidaturas.AsNoTracking()
                where c.CandidatoId == candidatoId
                join v in _db.Vagas.AsNoTracking() on c.VagaId equals v.Id into vj
                from v in vj.DefaultIfEmpty()
                orderby c.AplicadaEmUtc descending
                select new { c, v };

        var rows = await q.ToListAsync(ct);
        var ids = rows.Select(r => r.c.Id).ToList();
        var historicosRaw = await _db.CandidaturaEtapaHistoricos
            .AsNoTracking()
            .Where(h => ids.Contains(h.CandidaturaId))
            .OrderBy(h => h.EmUtc)
            .ToListAsync(ct);

        var historicoPorCand = historicosRaw
            .GroupBy(h => h.CandidaturaId)
            .ToDictionary(g => g.Key, g => g.ToList());

        return rows.Select(r => new CandidaturaResponse(
            r.c.Id,
            r.c.CandidatoId,
            r.c.VagaId,
            r.v?.Codigo,
            r.v?.Titulo,
            BuildLocal(r.v),
            r.c.Status,
            r.c.EtapaMacro,
            r.c.AplicadaEmUtc,
            r.c.EtapaAtualDesdeUtc,
            r.c.UpdatedAtUtc,
            historicoPorCand.TryGetValue(r.c.Id, out var hs)
                ? hs.Select(h => new CandidaturaEtapaHistoricoItem(h.EtapaAnterior, h.EtapaNova, h.EmUtc, h.Observacao)).ToList()
                : new List<CandidaturaEtapaHistoricoItem>()
        )).ToList();
    }

    public async Task<CandidaturaResponse?> AvancarEtapaAsync(Guid candidaturaId, EtapaMacroCandidatura novaEtapa, string? observacao, CancellationToken ct)
    {
        var cand = await _db.Candidaturas.FirstOrDefaultAsync(x => x.Id == candidaturaId, ct);
        if (cand is null) return null;

        if (cand.Status is CandidaturaStatus.Contratado or CandidaturaStatus.Reprovado
            or CandidaturaStatus.Desistiu or CandidaturaStatus.Arquivada)
            throw new InvalidOperationException("Candidatura encerrada — não é possível mudar etapa.");

        if (cand.EtapaMacro == novaEtapa) return await BuildSingle(cand.Id, ct);

        var etapaAnterior = cand.EtapaMacro;
        var now = DateTimeOffset.UtcNow;
        _db.CandidaturaEtapaHistoricos.Add(new CandidaturaEtapaHistorico
        {
            Id = Guid.NewGuid(),
            TenantId = cand.TenantId,
            CandidaturaId = cand.Id,
            EtapaAnterior = etapaAnterior,
            EtapaNova = novaEtapa,
            Observacao = observacao,
            UserId = _currentUser.UserId,
            EmUtc = now,
        });

        cand.EtapaMacro = novaEtapa;
        cand.EtapaAtualDesdeUtc = now;
        cand.UpdatedAtUtc = now;

        cand.Status = novaEtapa switch
        {
            EtapaMacroCandidatura.Contratado => CandidaturaStatus.Contratado,
            EtapaMacroCandidatura.Recusado => CandidaturaStatus.Reprovado,
            EtapaMacroCandidatura.Desistiu => CandidaturaStatus.Desistiu,
            _ => cand.Status,
        };

        await _db.SaveChangesAsync(ct);

        // Mantém o cache Candidato.VagaId alinhado com a candidatura ativa mais recente:
        //  - se esta candidatura acabou de ser encerrada, Candidato aponta pra próxima ativa (ou preserva cache).
        //  - se continua ativa, valida que VagaId do candidato = VagaId desta candidatura mais recente.
        await RecalcularVagaPrincipalAsync(cand.CandidatoId, ct);

        try
        {
            await _notificacaoService.NotificarMudancaEtapaAsync(cand.Id, etapaAnterior, novaEtapa, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha best-effort ao notificar mudança de etapa da candidatura {CandidaturaId} ({EtapaAnterior}→{EtapaNova})", cand.Id, etapaAnterior, novaEtapa);
        }

        return await BuildSingle(cand.Id, ct);
    }

    private async Task<CandidaturaResponse?> BuildSingle(Guid id, CancellationToken ct)
    {
        var cand = await _db.Candidaturas.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (cand is null) return null;
        var list = await ListarDoCandidatoAsync(cand.CandidatoId, ct);
        return list.FirstOrDefault(x => x.Id == id);
    }

    private static string? BuildLocal(RHPortal.Api.Domain.Entities.Vaga? v)
    {
        if (v is null) return null;
        var parts = new List<string>();
        if (!string.IsNullOrWhiteSpace(v.Cidade)) parts.Add(v.Cidade!);
        if (!string.IsNullOrWhiteSpace(v.Uf)) parts.Add(v.Uf!);
        return parts.Count == 0 ? null : string.Join(" - ", parts);
    }

    public async Task<KanbanCandidaturasResponse> ListarKanbanAsync(Guid? vagaId, CancellationToken ct)
    {
        var q = from c in _db.Candidaturas.AsNoTracking()
                join cand in _db.Candidatos.AsNoTracking() on c.CandidatoId equals cand.Id
                join v in _db.Vagas.AsNoTracking() on c.VagaId equals v.Id into vj
                from v in vj.DefaultIfEmpty()
                where !vagaId.HasValue || c.VagaId == vagaId.Value
                select new
                {
                    c.Id,
                    c.CandidatoId,
                    CandidatoNome = cand.Nome,
                    CandidatoEmail = cand.Email,
                    CandidatoAvatar = cand.AvatarFileName,
                    c.VagaId,
                    VagaCodigo = v != null ? v.Codigo : null,
                    VagaTitulo = v != null ? v.Titulo : null,
                    c.Status,
                    c.EtapaMacro,
                    c.AplicadaEmUtc,
                    c.EtapaAtualDesdeUtc,
                    MatchScore = (int?)cand.LastMatchScore,
                };

        var rows = await q.OrderByDescending(x => x.AplicadaEmUtc).ToListAsync(ct);
        var total = rows.Count;

        var etapas = new[]
        {
            (EtapaMacroCandidatura.Aplicada, "Aplicada"),
            (EtapaMacroCandidatura.EmTriagem, "Em triagem"),
            (EtapaMacroCandidatura.Entrevista, "Entrevista"),
            (EtapaMacroCandidatura.Teste, "Teste"),
            (EtapaMacroCandidatura.Proposta, "Proposta"),
            (EtapaMacroCandidatura.Contratado, "Contratado"),
            (EtapaMacroCandidatura.Recusado, "Recusado"),
            (EtapaMacroCandidatura.Desistiu, "Desistiu"),
        };

        var colunas = etapas.Select(e =>
        {
            var itens = rows
                .Where(r => r.EtapaMacro == e.Item1)
                .Select(r => new KanbanCandidaturaItem(
                    r.Id,
                    r.CandidatoId,
                    r.CandidatoNome,
                    r.CandidatoEmail,
                    r.CandidatoAvatar,
                    r.VagaId,
                    r.VagaCodigo,
                    r.VagaTitulo,
                    r.Status,
                    r.EtapaMacro,
                    r.AplicadaEmUtc,
                    r.EtapaAtualDesdeUtc,
                    r.MatchScore))
                .ToList();
            return new KanbanColunaResponse(e.Item1, e.Item2, itens.Count, itens);
        }).ToList();

        return new KanbanCandidaturasResponse(colunas, total);
    }
}
