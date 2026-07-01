using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Contracts.Candidatura;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Application.Matching;
using RhPortal.Api.Application.Agenda;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Candidaturas;

public interface ICandidaturaService
{
    Task<Candidatura> GetOrCreateAsync(Guid candidatoId, Guid vagaId, string? fonte, string? obs, CancellationToken ct);
    Task<IReadOnlyList<CandidaturaResponse>> ListarDoCandidatoAsync(Guid candidatoId, CancellationToken ct);
    Task<CandidaturaResponse?> AvancarEtapaAsync(Guid candidaturaId, EtapaMacroCandidatura novaEtapa, string? observacao, CancellationToken ct);
    Task<CandidaturaResponse?> AvancarEtapaAsync(Guid candidaturaId, EtapaMacroCandidatura novaEtapa, string? observacao, AgendarEntrevistaCandidaturaRequest? entrevista, CancellationToken ct);
    Task<CandidaturaResponse?> RegistrarObservacaoAsync(Guid candidaturaId, string observacao, CancellationToken ct);
    Task<KanbanCandidaturasResponse> ListarKanbanAsync(Guid? vagaId, CancellationToken ct);
    Task<IReadOnlyList<KanbanVagaFiltroItem>> ListarVagasKanbanAsync(CancellationToken ct);

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
    private readonly IAgendaGraphSyncService _agendaGraphSync;
    private readonly ILogger<CandidaturaService> _logger;
    private readonly HybridMatchingService? _hybridMatchingService;

    public CandidaturaService(
        AppDbContext db,
        ITenantContext tenant,
        ICurrentUserContext currentUser,
        ICandidaturaNotificacaoService notificacaoService,
        IAgendaGraphSyncService agendaGraphSync,
        ILogger<CandidaturaService> logger,
        HybridMatchingService? hybridMatchingService = null)
    {
        _db = db;
        _tenant = tenant;
        _currentUser = currentUser;
        _notificacaoService = notificacaoService;
        _agendaGraphSync = agendaGraphSync;
        _logger = logger;
        _hybridMatchingService = hybridMatchingService;
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

    public Task<CandidaturaResponse?> AvancarEtapaAsync(Guid candidaturaId, EtapaMacroCandidatura novaEtapa, string? observacao, CancellationToken ct)
        => AvancarEtapaAsync(candidaturaId, novaEtapa, observacao, null, ct);

    public async Task<CandidaturaResponse?> AvancarEtapaAsync(Guid candidaturaId, EtapaMacroCandidatura novaEtapa, string? observacao, AgendarEntrevistaCandidaturaRequest? entrevista, CancellationToken ct)
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
            EtapaMacroCandidatura.ReprovadoRh => CandidaturaStatus.Reprovado,
            EtapaMacroCandidatura.ReprovadoGestor => CandidaturaStatus.Reprovado,
            EtapaMacroCandidatura.Recusado => CandidaturaStatus.Reprovado,
            EtapaMacroCandidatura.Desistiu => CandidaturaStatus.Desistiu,
            _ => cand.Status,
        };

        AgendaEvent? agendaEntrevista = null;
        if (IsEtapaComAgendaEntrevista(novaEtapa) && entrevista is not null)
        {
            agendaEntrevista = await CriarEventoEntrevistaAsync(cand, novaEtapa, entrevista, ct);
        }

        await _db.SaveChangesAsync(ct);

        if (agendaEntrevista is not null)
            await _agendaGraphSync.TrySyncCreateAsync(agendaEntrevista.Id, ct);

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

    private async Task<AgendaEvent> CriarEventoEntrevistaAsync(Candidatura cand, EtapaMacroCandidatura etapa, AgendarEntrevistaCandidaturaRequest request, CancellationToken ct)
    {
        if (request.DuracaoMinutos < 15 || request.DuracaoMinutos > 480)
            throw new InvalidOperationException("Informe uma duração de entrevista entre 15 e 480 minutos.");

        var formato = request.Formato.Trim();
        if (!string.Equals(formato, "Presencial", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(formato, "Online", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Formato da entrevista deve ser Presencial ou Online.");

        var responsavel = request.Responsavel.Trim();
        if (string.IsNullOrWhiteSpace(responsavel))
            throw new InvalidOperationException("Informe o responsável pela entrevista.");
        var participantes = request.ParticipantesOpcionais?
            .Select(x => x.Trim())
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(20)
            .ToList() ?? [];

        var inicioUtc = request.InicioUtc.Kind == DateTimeKind.Utc
            ? request.InicioUtc
            : DateTime.SpecifyKind(request.InicioUtc, DateTimeKind.Local).ToUniversalTime();
        var fimUtc = inicioUtc.AddMinutes(request.DuracaoMinutos);

        var type = await _db.AgendaEventTypes.FirstOrDefaultAsync(x => x.Code == "entrevista", ct);
        if (type is null)
        {
            type = new AgendaEventType
            {
                Id = Guid.NewGuid(),
                Code = "entrevista",
                Label = "Entrevista",
                Color = "#1f6feb",
                Icon = "bi-camera-video",
                SortOrder = 1,
                IsActive = true,
            };
            _db.AgendaEventTypes.Add(type);
        }

        var details = await (
            from c in _db.Candidaturas.AsNoTracking()
            join candidato in _db.Candidatos.AsNoTracking() on c.CandidatoId equals candidato.Id
            join vaga in _db.Vagas.AsNoTracking() on c.VagaId equals vaga.Id into vagaJoin
            from vaga in vagaJoin.DefaultIfEmpty()
            where c.Id == cand.Id
            select new
            {
                CandidatoNome = candidato.Nome,
                CandidatoId = candidato.Id,
                VagaTitulo = vaga != null ? vaga.Titulo : null,
                VagaCodigo = vaga != null ? vaga.Codigo : null,
                VagaId = vaga != null ? vaga.Id : (Guid?)null,
            }
        ).FirstOrDefaultAsync(ct);

        var nomeCandidato = details?.CandidatoNome ?? "candidato";
        var local = string.Equals(formato, "Online", StringComparison.OrdinalIgnoreCase)
            ? (string.IsNullOrWhiteSpace(request.Local) ? "Online" : request.Local.Trim())
            : (string.IsNullOrWhiteSpace(request.Local) ? "Presencial" : request.Local.Trim());

        var notes = string.Join("\n", new[]
        {
            $"CandidaturaId: {cand.Id}",
            $"Formato: {formato}",
            $"Responsável: {responsavel}",
            participantes.Count == 0 ? null : $"Participantes opcionais: {string.Join(", ", participantes)}",
            $"Duração: {request.DuracaoMinutos} minutos",
            string.IsNullOrWhiteSpace(request.Observacao) ? null : $"Observação: {request.Observacao.Trim()}",
        }.Where(x => !string.IsNullOrWhiteSpace(x)));

        var tituloEtapa = etapa == EtapaMacroCandidatura.EntrevistaTecnica
            ? "Entrevista Técnica/Gestão"
            : "Entrevista RH";

        var entity = new AgendaEvent
        {
            Id = Guid.NewGuid(),
            Type = type,
            Title = $"{tituloEtapa} - {nomeCandidato}",
            StartAtUtc = inicioUtc,
            EndAtUtc = fimUtc,
            AllDay = false,
            Status = "confirmado",
            Location = local,
            Owner = responsavel,
            Candidate = nomeCandidato,
            VagaTitle = details?.VagaTitulo,
            VagaCode = details?.VagaCodigo,
            Notes = notes,
            CandidaturaId = cand.Id,
            CandidatoId = details?.CandidatoId ?? cand.CandidatoId,
            VagaId = details?.VagaId ?? cand.VagaId,
            CandidateConfirmationToken = Convert.ToHexString(Guid.NewGuid().ToByteArray()).ToLowerInvariant(),
            CandidateResponseStatus = "pendente",
        };

        _db.AgendaEvents.Add(entity);
        return entity;
    }

    public async Task<CandidaturaResponse?> RegistrarObservacaoAsync(Guid candidaturaId, string observacao, CancellationToken ct)
    {
        var text = observacao.Trim();
        if (string.IsNullOrWhiteSpace(text))
            throw new InvalidOperationException("Informe uma observação.");

        var cand = await _db.Candidaturas.FirstOrDefaultAsync(x => x.Id == candidaturaId, ct);
        if (cand is null) return null;

        var now = DateTimeOffset.UtcNow;
        _db.CandidaturaEtapaHistoricos.Add(new CandidaturaEtapaHistorico
        {
            Id = Guid.NewGuid(),
            TenantId = cand.TenantId,
            CandidaturaId = cand.Id,
            EtapaAnterior = cand.EtapaMacro,
            EtapaNova = cand.EtapaMacro,
            Observacao = text,
            UserId = _currentUser.UserId,
            EmUtc = now,
        });

        cand.UpdatedAtUtc = now;
        await _db.SaveChangesAsync(ct);

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
                join llmScore in _db.CandidatoVagaLlmScores.AsNoTracking()
                    on new { c.CandidatoId, c.VagaId } equals new { llmScore.CandidatoId, llmScore.VagaId } into llmScoreJoin
                from llmScore in llmScoreJoin.DefaultIfEmpty()
                join matchingScore in _db.CandidatoVagaMatchingScores.AsNoTracking()
                    on new { c.CandidatoId, c.VagaId } equals new { matchingScore.CandidatoId, matchingScore.VagaId } into matchingScoreJoin
                from matchingScore in matchingScoreJoin.DefaultIfEmpty()
                where !vagaId.HasValue || c.VagaId == vagaId.Value
                select new
                {
                    c.Id,
                    c.CandidatoId,
                    CandidatoNome = cand.Nome,
                    CandidatoEmail = cand.Email,
                    CandidatoFone = cand.Fone,
                    CandidatoCelular = cand.Celular,
                    CandidatoAvatar = cand.AvatarFileName,
                    c.VagaId,
                    VagaCodigo = v != null ? v.Codigo : null,
                    VagaTitulo = v != null ? v.Titulo : null,
                    c.Status,
                    c.EtapaMacro,
                    c.AplicadaEmUtc,
                    c.EtapaAtualDesdeUtc,
                    MatchScore = llmScore != null
                        ? (int?)llmScore.ScoreFinal
                        : matchingScore != null
                            ? (int?)matchingScore.Score
                            : cand.LastMatchVagaId == c.VagaId
                                ? cand.LastMatchScore
                                : null,
                };

        if (!_currentUser.IsAdmin && !_currentUser.IsInRole("Owner"))
        {
            if (!_currentUser.UserId.HasValue)
            {
                q = q.Where(_ => false);
            }
            else
            {
                var userId = _currentUser.UserId.Value;
                q = q.Where(x => _db.SolicitacoesVaga
                    .AsNoTracking()
                    .Any(s => s.VagaId == x.VagaId && s.AnalistaRhResponsavelUserId == userId));
            }
        }

        var rows = await q.OrderByDescending(x => x.AplicadaEmUtc).ToListAsync(ct);
        var total = rows.Count;
        var hybridScores = await CalcularScoresHybridKanbanAsync(
            rows.Select(r => (r.CandidatoId, r.VagaId, r.MatchScore)),
            ct);

        var etapas = KanbanColunasDefinicao();

        var nowSla = DateTimeOffset.UtcNow;
        var colunas = etapas.Select(def =>
        {
            var slaEtapaDefault = SlaDiasPorEtapa(def.EtapaChave);
            var itens = rows
                .Where(r => def.IncluirEtapa(r.EtapaMacro))
                .Select(r =>
                {
                    var dataRef = r.EtapaAtualDesdeUtc ?? r.AplicadaEmUtc;
                    var dias = Math.Max(0, (int)(nowSla - dataRef).TotalDays);
                    var semaforo = dias <= slaEtapaDefault / 2
                        ? "verde"
                        : (dias <= slaEtapaDefault ? "amarelo" : "vermelho");
                    var matchScore = hybridScores.TryGetValue((r.CandidatoId, r.VagaId), out var hybridScore)
                        ? hybridScore
                        : r.MatchScore;
                    return new KanbanCandidaturaItem(
                        r.Id,
                        r.CandidatoId,
                        r.CandidatoNome,
                        r.CandidatoEmail,
                        r.CandidatoFone,
                        r.CandidatoCelular,
                        r.CandidatoAvatar,
                        r.VagaId,
                        r.VagaCodigo,
                        r.VagaTitulo,
                        r.Status,
                        r.EtapaMacro,
                        r.AplicadaEmUtc,
                        r.EtapaAtualDesdeUtc,
                        matchScore,
                        dias,
                        slaEtapaDefault,
                        semaforo);
                })
                .ToList();
            return new KanbanColunaResponse(def.EtapaChave, def.Titulo, itens.Count, itens);
        }).ToList();

        return new KanbanCandidaturasResponse(colunas, total);
    }

    public async Task<IReadOnlyList<KanbanVagaFiltroItem>> ListarVagasKanbanAsync(CancellationToken ct)
    {
        var candidaturaVagaIds = AplicarEscopoKanban(_db.Candidaturas.AsNoTracking())
            .Select(c => c.VagaId);

        IQueryable<Guid> vagaIds = candidaturaVagaIds;

        if (!_currentUser.IsAdmin && !_currentUser.IsInRole("Owner") && _currentUser.UserId.HasValue)
        {
            var userId = _currentUser.UserId.Value;
            var vagasAtribuidas = _db.SolicitacoesVaga
                .AsNoTracking()
                .Where(s => s.VagaId.HasValue && s.AnalistaRhResponsavelUserId == userId)
                .Select(s => s.VagaId!.Value);

            vagaIds = vagaIds.Union(vagasAtribuidas);
        }

        var ids = await vagaIds.Distinct().ToListAsync(ct);
        if (ids.Count == 0)
        {
            return Array.Empty<KanbanVagaFiltroItem>();
        }

        var totaisPorVaga = await AplicarEscopoKanban(_db.Candidaturas.AsNoTracking())
            .Where(c => ids.Contains(c.VagaId))
            .GroupBy(c => c.VagaId)
            .Select(g => new { VagaId = g.Key, Total = g.Count() })
            .ToDictionaryAsync(x => x.VagaId, x => x.Total, ct);

        var vagas = await _db.Vagas
            .AsNoTracking()
            .Where(v => ids.Contains(v.Id))
            .OrderBy(v => v.Titulo)
            .ToListAsync(ct);

        return vagas
            .Select(v => new KanbanVagaFiltroItem(
                v.Id,
                v.Titulo,
                v.Codigo,
                totaisPorVaga.GetValueOrDefault(v.Id)))
            .ToList();
    }

    private IQueryable<Candidatura> AplicarEscopoKanban(IQueryable<Candidatura> query)
    {
        if (_currentUser.IsAdmin || _currentUser.IsInRole("Owner"))
        {
            return query;
        }

        if (!_currentUser.UserId.HasValue)
        {
            return query.Where(_ => false);
        }

        var userId = _currentUser.UserId.Value;
        return query.Where(c => _db.SolicitacoesVaga
            .AsNoTracking()
            .Any(s => s.VagaId == c.VagaId && s.AnalistaRhResponsavelUserId == userId));
    }

    private async Task<Dictionary<(Guid CandidatoId, Guid VagaId), int?>> CalcularScoresHybridKanbanAsync(
        IEnumerable<(Guid CandidatoId, Guid VagaId, int? FallbackScore)> pares,
        CancellationToken ct)
    {
        var scores = new Dictionary<(Guid CandidatoId, Guid VagaId), int?>();
        if (_hybridMatchingService is null)
        {
            return scores;
        }

        foreach (var par in pares.Distinct())
        {
            var key = (par.CandidatoId, par.VagaId);
            try
            {
                var breakdown = await _hybridMatchingService.CalcularHybridAsync(par.CandidatoId, par.VagaId, ct);
                scores[key] = breakdown?.ScoreFinal ?? par.FallbackScore;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Falha ao calcular score híbrido do Kanban para candidato {CandidatoId} e vaga {VagaId}; usando fallback.",
                    par.CandidatoId,
                    par.VagaId);
                scores[key] = par.FallbackScore;
            }
        }

        return scores;
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
            (EtapaMacroCandidatura.Aplicada,    "Candidatura"),
            (EtapaMacroCandidatura.EmTriagem,   "Triagem"),
            (EtapaMacroCandidatura.Entrevista,  "Entrevista RH"),
            (EtapaMacroCandidatura.EntrevistaTecnica, "Entrevista Técnica/Gestão"),
            (EtapaMacroCandidatura.Teste,       "Testes"),
            (EtapaMacroCandidatura.Proposta,    "Envio da Proposta"),
            (EtapaMacroCandidatura.Contratado,  "Aprovado"),
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
            else if (g.Etapa is EtapaMacroCandidatura.ReprovadoRh
                     or EtapaMacroCandidatura.ReprovadoGestor
                     or EtapaMacroCandidatura.Recusado
                     or EtapaMacroCandidatura.Desistiu)
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
                var result = await AvancarEtapaAsync(id, request.NovaEtapa, request.Observacao, null, ct);
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
        EtapaMacroCandidatura.EntrevistaTecnica => 10,
        EtapaMacroCandidatura.Teste       => 7,
        EtapaMacroCandidatura.Proposta    => 5,
        EtapaMacroCandidatura.Contratado       => 365, // terminal
        EtapaMacroCandidatura.ReprovadoRh      => 365, // terminal
        EtapaMacroCandidatura.ReprovadoGestor => 365, // terminal
        EtapaMacroCandidatura.Recusado         => 365, // terminal
        EtapaMacroCandidatura.Desistiu         => 365, // terminal
        _                                 => 7,
    };

    private static bool IsEtapaComAgendaEntrevista(EtapaMacroCandidatura etapa)
        => etapa is EtapaMacroCandidatura.Entrevista or EtapaMacroCandidatura.EntrevistaTecnica;

    private sealed record KanbanColunaDef(
        EtapaMacroCandidatura EtapaChave,
        string Titulo,
        Func<EtapaMacroCandidatura, bool> IncluirEtapa);

    /// <summary>Colunas do Kanban de Candidaturas (funil Key User — 10 colunas).</summary>
    private static IReadOnlyList<KanbanColunaDef> KanbanColunasDefinicao() =>
    [
        new(EtapaMacroCandidatura.Aplicada, "Candidatura", e => e == EtapaMacroCandidatura.Aplicada),
        new(EtapaMacroCandidatura.EmTriagem, "Triagem", e => e == EtapaMacroCandidatura.EmTriagem),
        new(EtapaMacroCandidatura.Entrevista, "Entrevista RH", e => e == EtapaMacroCandidatura.Entrevista),
        new(EtapaMacroCandidatura.EntrevistaTecnica, "Entrevista Técnica/Gestão", e => e == EtapaMacroCandidatura.EntrevistaTecnica),
        new(EtapaMacroCandidatura.Teste, "Testes", e => e == EtapaMacroCandidatura.Teste),
        new(EtapaMacroCandidatura.Proposta, "Envio da Proposta", e => e == EtapaMacroCandidatura.Proposta),
        new(EtapaMacroCandidatura.Contratado, "Aprovado", e => e == EtapaMacroCandidatura.Contratado),
        new(EtapaMacroCandidatura.ReprovadoRh, "Reprovado RH", e => e == EtapaMacroCandidatura.ReprovadoRh),
        new(EtapaMacroCandidatura.ReprovadoGestor, "Reprovado Gestão", e => e == EtapaMacroCandidatura.ReprovadoGestor),
        new(EtapaMacroCandidatura.Desistiu, "Declinado", e => e is EtapaMacroCandidatura.Recusado or EtapaMacroCandidatura.Desistiu),
    ];
}
