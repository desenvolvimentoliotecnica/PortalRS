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
    /// Sessão 31.8 (FASE 3.A) — Funil de conversão de candidaturas.
    /// Filtros opcionais: vaga e período de aplicação.
    /// Calcula taxa de conversão entre etapas adjacentes do funil principal
    /// (Aplicada → EmTriagem → Entrevista → Teste → Proposta → Contratado).
    /// </summary>
    Task<FunilCandidaturasResponse> FunilConversaoAsync(Guid? vagaId, DateTimeOffset? inicioUtc, DateTimeOffset? fimUtc, CancellationToken ct);

    /// <summary>
    /// Sessão 31.8 (FASE 3.B) — Avança N candidaturas de etapa em massa.
    /// Cada item retorna sucesso/falha individual; falha em um não bloqueia os outros.
    /// </summary>
    Task<BulkAvancarEtapaResponse> AvancarEtapaEmMassaAsync(BulkAvancarEtapaRequest request, CancellationToken ct);

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

        var nowSla = DateTimeOffset.UtcNow;
        var colunas = etapas.Select(e =>
        {
            var slaEtapaDefault = SlaDiasPorEtapa(e.Item1);
            var itens = rows
                .Where(r => r.EtapaMacro == e.Item1)
                .Select(r =>
                {
                    var dataRef = r.EtapaAtualDesdeUtc ?? r.AplicadaEmUtc;
                    var dias = Math.Max(0, (int)(nowSla - dataRef).TotalDays);
                    var semaforo = dias <= slaEtapaDefault / 2
                        ? "verde"
                        : (dias <= slaEtapaDefault ? "amarelo" : "vermelho");
                    return new KanbanCandidaturaItem(
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
                        r.MatchScore,
                        dias,
                        slaEtapaDefault,
                        semaforo);
                })
                .ToList();
            return new KanbanColunaResponse(e.Item1, e.Item2, itens.Count, itens);
        }).ToList();

        return new KanbanCandidaturasResponse(colunas, total);
    }

    public async Task<FunilCandidaturasResponse> FunilConversaoAsync(
        Guid? vagaId,
        DateTimeOffset? inicioUtc,
        DateTimeOffset? fimUtc,
        CancellationToken ct)
    {
        var tenantId = _tenant.TenantId;
        var query = _db.Candidaturas.AsNoTracking().Where(c => c.TenantId == tenantId);
        if (vagaId.HasValue) query = query.Where(c => c.VagaId == vagaId.Value);
        if (inicioUtc.HasValue) query = query.Where(c => c.AplicadaEmUtc >= inicioUtc.Value);
        if (fimUtc.HasValue) query = query.Where(c => c.AplicadaEmUtc <= fimUtc.Value);

        var grouped = await query
            .GroupBy(c => c.EtapaMacro)
            .Select(g => new { Etapa = g.Key, Total = g.Count() })
            .ToListAsync(ct);

        var totalGeral = grouped.Sum(g => g.Total);
        var byEtapa = grouped.ToDictionary(g => g.Etapa, g => g.Total);

        // Funil principal (linear): Aplicada → EmTriagem → Entrevista → Teste → Proposta → Contratado
        // Etapas terminais (Recusado, Desistiu) não fazem parte do funil — exibidas separadas no UI se quiser
        var funilOrdenado = new[]
        {
            (EtapaMacroCandidatura.Aplicada,    "Aplicada"),
            (EtapaMacroCandidatura.EmTriagem,   "Em Triagem"),
            (EtapaMacroCandidatura.Entrevista,  "Entrevista"),
            (EtapaMacroCandidatura.Teste,       "Teste"),
            (EtapaMacroCandidatura.Proposta,    "Proposta"),
            (EtapaMacroCandidatura.Contratado,  "Contratado"),
        };

        // Para representar o funil "cumulativo": etapa N = quem ESTÁ ou JÁ PASSOU pela etapa N
        // (porque candidato em "Entrevista" passou por "Aplicada" + "Triagem" antes)
        // Cálculo: total de cada etapa = soma de todos quem está em etapa >= N
        var ordemEtapa = new Dictionary<EtapaMacroCandidatura, int>();
        for (int i = 0; i < funilOrdenado.Length; i++) ordemEtapa[funilOrdenado[i].Item1] = i;

        var totaisCumulativos = new int[funilOrdenado.Length];
        foreach (var g in grouped)
        {
            if (ordemEtapa.TryGetValue(g.Etapa, out var idx))
            {
                // Quem está em etapa idx passou por todas <= idx
                for (int i = 0; i <= idx; i++) totaisCumulativos[i] += g.Total;
            }
            // Recusados/Desistidos: contam como passaram pela Aplicada (entraram no funil)
            else if (g.Etapa == EtapaMacroCandidatura.Recusado || g.Etapa == EtapaMacroCandidatura.Desistiu)
            {
                totaisCumulativos[0] += g.Total;
            }
        }

        var etapas = new List<FunilEtapaItem>();
        for (int i = 0; i < funilOrdenado.Length; i++)
        {
            var total = totaisCumulativos[i];
            decimal? taxa = null;
            if (i < funilOrdenado.Length - 1 && total > 0)
            {
                var proxTotal = totaisCumulativos[i + 1];
                taxa = Math.Round((decimal)proxTotal * 100m / total, 1);
            }
            etapas.Add(new FunilEtapaItem(funilOrdenado[i].Item1, funilOrdenado[i].Item2, total, taxa));
        }

        string? vagaTitulo = null;
        if (vagaId.HasValue)
        {
            vagaTitulo = await _db.Vagas
                .AsNoTracking()
                .Where(v => v.Id == vagaId.Value && v.TenantId == tenantId)
                .Select(v => v.Titulo)
                .FirstOrDefaultAsync(ct);
        }

        return new FunilCandidaturasResponse(
            TotalGeral: totalGeral,
            VagaId: vagaId,
            VagaTitulo: vagaTitulo,
            PeriodoInicioUtc: inicioUtc,
            PeriodoFimUtc: fimUtc,
            Etapas: etapas);
    }

    public async Task<BulkAvancarEtapaResponse> AvancarEtapaEmMassaAsync(
        BulkAvancarEtapaRequest request,
        CancellationToken ct)
    {
        var ids = (request.CandidaturaIds ?? Array.Empty<Guid>()).Distinct().Where(g => g != Guid.Empty).ToList();
        var resultados = new List<BulkAvancarEtapaItemResult>();

        if (ids.Count == 0)
            return new BulkAvancarEtapaResponse(0, 0, 0, resultados);

        if (ids.Count > 200)
            throw new InvalidOperationException("Máximo de 200 candidaturas por operação em massa.");

        // Carrega tudo de uma vez pra reduzir round-trips
        var candidaturas = await _db.Candidaturas
            .Where(c => ids.Contains(c.Id) && c.TenantId == _tenant.TenantId)
            .ToListAsync(ct);
        var byId = candidaturas.ToDictionary(c => c.Id);

        // Nomes dos candidatos pra response (1 query batch)
        var candidatoIds = candidaturas.Select(c => c.CandidatoId).Distinct().ToList();
        var nomesPorCandidato = await _db.Candidatos
            .AsNoTracking()
            .Where(c => candidatoIds.Contains(c.Id) && c.TenantId == _tenant.TenantId)
            .Select(c => new { c.Id, c.Nome })
            .ToDictionaryAsync(x => x.Id, x => x.Nome, ct);

        foreach (var id in ids)
        {
            if (!byId.TryGetValue(id, out var cand))
            {
                resultados.Add(new BulkAvancarEtapaItemResult(id, false, null, "Candidatura não encontrada."));
                continue;
            }

            var nome = nomesPorCandidato.GetValueOrDefault(cand.CandidatoId);

            try
            {
                // Reusa lógica de AvancarEtapaAsync (validações, histórico, notificação)
                var result = await AvancarEtapaAsync(id, request.NovaEtapa, request.Observacao, ct);
                if (result is null)
                {
                    resultados.Add(new BulkAvancarEtapaItemResult(id, false, nome, "Falha ao avançar etapa."));
                }
                else
                {
                    resultados.Add(new BulkAvancarEtapaItemResult(id, true, nome, null));
                }
            }
            catch (Exception ex)
            {
                resultados.Add(new BulkAvancarEtapaItemResult(id, false, nome, ex.Message));
            }
        }

        return new BulkAvancarEtapaResponse(
            Total: ids.Count,
            Sucesso: resultados.Count(r => r.Sucesso),
            Falha: resultados.Count(r => !r.Sucesso),
            Itens: resultados);
    }

    /// <summary>
    /// SLA default em dias por etapa do funil de candidaturas (Sessão 31.8).
    /// Estes thresholds geram o semáforo verde/amarelo/vermelho no kanban.
    /// Etapas terminais (Contratado/Recusado/Desistiu) usam SLA muito alto
    /// (qualquer tempo é aceitável — etapa final).
    /// </summary>
    private static int SlaDiasPorEtapa(EtapaMacroCandidatura etapa) => etapa switch
    {
        EtapaMacroCandidatura.Aplicada    => 2,
        EtapaMacroCandidatura.EmTriagem   => 5,
        EtapaMacroCandidatura.Entrevista  => 10,
        EtapaMacroCandidatura.Teste       => 7,
        EtapaMacroCandidatura.Proposta    => 5,
        EtapaMacroCandidatura.Contratado  => 365, // terminal
        EtapaMacroCandidatura.Recusado    => 365, // terminal
        EtapaMacroCandidatura.Desistiu    => 365, // terminal
        _                                 => 7,
    };
}
