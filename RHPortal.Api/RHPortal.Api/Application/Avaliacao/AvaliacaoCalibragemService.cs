using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Avaliacao;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Application.Avaliacao;

public interface IAvaliacaoCalibragemService
{
    Task<int> IniciarCalibragemAsync(Guid cicloId, CancellationToken ct);
    Task<IReadOnlyList<AvaliacaoCalibragemResponse>> ListarAsync(Guid cicloId, CancellationToken ct);
    Task<AvaliacaoCalibragemResponse> AjustarAsync(Guid cicloId, AvaliacaoCalibragemAjusteRequest request, CancellationToken ct);
    Task<AvaliacaoCalibragemResponse> DecidirAsync(Guid cicloId, Guid decididoPorUserId, AvaliacaoCalibragemDecisaoRequest request, CancellationToken ct);
}

public sealed class AvaliacaoCalibragemService : IAvaliacaoCalibragemService
{
    private readonly AppDbContext _db;

    public AvaliacaoCalibragemService(AppDbContext db) => _db = db;

    public async Task<int> IniciarCalibragemAsync(Guid cicloId, CancellationToken ct)
    {
        var ciclo = await _db.AvaliacaoCiclos.FirstOrDefaultAsync(c => c.Id == cicloId, ct)
            ?? throw new InvalidOperationException("Ciclo não encontrado.");

        if (ciclo.Status == AvaliacaoCicloStatus.Rascunho)
            throw new InvalidOperationException("Não é possível calibrar ciclo em rascunho.");

        var respostas = await _db.AvaliacaoRespostas
            .AsNoTracking()
            .Where(r => r.CicloId == cicloId)
            .ToListAsync(ct);

        var scoresPorAvaliando = respostas
            .GroupBy(r => r.AvaliandoId)
            .ToDictionary(g => g.Key, g => Math.Round(g.Average(r => r.Score), 2));

        if (scoresPorAvaliando.Count == 0)
            return 0;

        var existentes = await _db.AvaliacaoCalibragens
            .Where(c => c.CicloId == cicloId)
            .Select(c => c.FuncionarioId)
            .ToListAsync(ct);
        var existentesSet = existentes.ToHashSet();

        var agora = DateTimeOffset.UtcNow;
        var criadas = 0;

        foreach (var (funcionarioId, score) in scoresPorAvaliando)
        {
            if (existentesSet.Contains(funcionarioId)) continue;

            _db.AvaliacaoCalibragens.Add(new AvaliacaoCalibragem
            {
                Id = Guid.NewGuid(),
                CicloId = cicloId,
                FuncionarioId = funcionarioId,
                ScoreGestor = score,
                DesempenhoGestor = MapScoreParaCategoria(score),
                PotencialGestor = null,
                Status = AvaliacaoCalibragemStatus.Pendente,
                Decisao = AvaliacaoCalibragemVersao.Indefinida,
                CriadoEmUtc = agora,
                AtualizadoEmUtc = agora,
            });
            criadas++;
        }

        if (ciclo.Status != AvaliacaoCicloStatus.EmCalibragem && ciclo.Status != AvaliacaoCicloStatus.Fechado)
        {
            ciclo.Status = AvaliacaoCicloStatus.EmCalibragem;
            ciclo.AtualizadoEmUtc = agora;
        }

        if (criadas > 0 || ciclo.Status == AvaliacaoCicloStatus.EmCalibragem)
            await _db.SaveChangesAsync(ct);

        return criadas;
    }

    public async Task<IReadOnlyList<AvaliacaoCalibragemResponse>> ListarAsync(Guid cicloId, CancellationToken ct)
    {
        var linhas = await _db.AvaliacaoCalibragens
            .Include(c => c.Funcionario)
                .ThenInclude(f => f!.JobPosition)
            .AsNoTracking()
            .Where(c => c.CicloId == cicloId)
            .OrderBy(c => c.Funcionario!.Name)
            .ToListAsync(ct);

        return linhas.Select(ToResponse).ToList();
    }

    public async Task<AvaliacaoCalibragemResponse> AjustarAsync(Guid cicloId, AvaliacaoCalibragemAjusteRequest request, CancellationToken ct)
    {
        var linha = await _db.AvaliacaoCalibragens
            .Include(c => c.Funcionario)
                .ThenInclude(f => f!.JobPosition)
            .FirstOrDefaultAsync(c => c.CicloId == cicloId && c.FuncionarioId == request.FuncionarioId, ct)
            ?? throw new InvalidOperationException("Linha de calibragem não encontrada.");

        if (linha.Status == AvaliacaoCalibragemStatus.Decidido)
            throw new InvalidOperationException("Linha já decidida; não pode ser recalibrada.");

        if (request.ScoreComite is { } score && (score < 0 || score > 5))
            throw new InvalidOperationException("ScoreComite deve estar entre 0 e 5.");

        if (request.DesempenhoComite is { } des && (des < 1 || des > 3))
            throw new InvalidOperationException("DesempenhoComite deve ser 1, 2 ou 3.");

        if (request.PotencialComite is { } pot && (pot < 1 || pot > 3))
            throw new InvalidOperationException("PotencialComite deve ser 1, 2 ou 3.");

        linha.ScoreComite = request.ScoreComite;
        linha.DesempenhoComite = request.DesempenhoComite;
        linha.PotencialComite = request.PotencialComite;
        linha.JustificativaComite = string.IsNullOrWhiteSpace(request.Justificativa) ? null : request.Justificativa.Trim();
        linha.Status = AvaliacaoCalibragemStatus.Calibrado;
        linha.AtualizadoEmUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return ToResponse(linha);
    }

    public async Task<AvaliacaoCalibragemResponse> DecidirAsync(Guid cicloId, Guid decididoPorUserId, AvaliacaoCalibragemDecisaoRequest request, CancellationToken ct)
    {
        if (request.Versao == AvaliacaoCalibragemVersao.Indefinida)
            throw new InvalidOperationException("Versão da decisão não pode ser Indefinida.");

        var linha = await _db.AvaliacaoCalibragens
            .Include(c => c.Funcionario)
                .ThenInclude(f => f!.JobPosition)
            .FirstOrDefaultAsync(c => c.CicloId == cicloId && c.FuncionarioId == request.FuncionarioId, ct)
            ?? throw new InvalidOperationException("Linha de calibragem não encontrada.");

        linha.Decisao = request.Versao;
        linha.Status = AvaliacaoCalibragemStatus.Decidido;
        linha.DecididoPorUserId = decididoPorUserId;
        linha.DecididoEmUtc = DateTimeOffset.UtcNow;
        linha.ObservacaoDecisao = string.IsNullOrWhiteSpace(request.Observacao) ? null : request.Observacao.Trim();
        linha.AtualizadoEmUtc = DateTimeOffset.UtcNow;

        if (request.GerarNineBox)
        {
            var (desempenho, potencial) = ResolverCategoriasFinais(linha);
            if (desempenho is { } d && potencial is { } p)
            {
                var nb = new NineBoxAssessment
                {
                    Id = Guid.NewGuid(),
                    FuncionarioId = linha.FuncionarioId,
                    AvaliadorId = linha.FuncionarioId,
                    Desempenho = d,
                    Potencial = p,
                    Observacoes = linha.ObservacaoDecisao ?? linha.JustificativaComite,
                    CicloAvaliacaoId = cicloId,
                    CriadoEmUtc = DateTimeOffset.UtcNow,
                    AtualizadoEmUtc = DateTimeOffset.UtcNow,
                };
                _db.NineBoxAssessments.Add(nb);
                linha.NineBoxAssessmentId = nb.Id;
                linha.NineBoxAssessment = nb;
            }
        }

        await _db.SaveChangesAsync(ct);
        return ToResponse(linha);
    }

    private static (int? Desempenho, int? Potencial) ResolverCategoriasFinais(AvaliacaoCalibragem linha)
    {
        if (linha.Decisao == AvaliacaoCalibragemVersao.Comite)
            return (linha.DesempenhoComite ?? linha.DesempenhoGestor, linha.PotencialComite ?? linha.PotencialGestor);
        return (linha.DesempenhoGestor ?? linha.DesempenhoComite, linha.PotencialGestor ?? linha.PotencialComite);
    }

    private static int MapScoreParaCategoria(decimal score) => score switch
    {
        < 2.5m => 1,
        < 4.0m => 2,
        _ => 3,
    };

    private static AvaliacaoCalibragemResponse ToResponse(AvaliacaoCalibragem c) => new(
        c.Id,
        c.CicloId,
        c.FuncionarioId,
        c.Funcionario?.Name ?? "",
        c.Funcionario?.JobPosition?.Name,
        c.ScoreGestor,
        c.DesempenhoGestor,
        c.PotencialGestor,
        c.ScoreComite,
        c.DesempenhoComite,
        c.PotencialComite,
        c.JustificativaComite,
        c.Status,
        c.Decisao,
        c.DecididoPorUserId,
        c.DecididoEmUtc,
        c.ObservacaoDecisao,
        c.NineBoxAssessmentId,
        c.AtualizadoEmUtc
    );
}
