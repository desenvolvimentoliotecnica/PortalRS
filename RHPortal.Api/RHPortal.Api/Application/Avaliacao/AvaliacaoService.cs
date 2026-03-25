using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Avaliacao;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Application.Avaliacao;

public interface IAvaliacaoService
{
    Task<IReadOnlyList<AvaliacaoCicloResponse>> ListCiclosAsync(CancellationToken ct);
    Task<AvaliacaoCicloResponse?> GetCicloAsync(Guid id, CancellationToken ct);
    Task<AvaliacaoCicloResponse> CriarCicloAsync(AvaliacaoCicloCreateRequest request, Guid criadoPorId, CancellationToken ct);
    Task ResponderAsync(Guid cicloId, Guid avaliadorId, AvaliacaoResponderRequest request, CancellationToken ct);
    Task FecharCicloAsync(Guid cicloId, CancellationToken ct);
    Task<IReadOnlyList<AvaliacaoResultadoRow>> ListResultadosAsync(Guid cicloId, CancellationToken ct);
}

public sealed class AvaliacaoService : IAvaliacaoService
{
    private readonly AppDbContext _db;

    public AvaliacaoService(AppDbContext db) => _db = db;

    private static AvaliacaoCicloResponse ToCicloResponse(AvaliacaoCiclo c, int totalRespostas) => new(
        c.Id,
        c.Nome,
        c.Periodo,
        c.Status,
        c.CriadoPor?.Name ?? "",
        c.Perguntas.Count,
        totalRespostas,
        c.CriadoEmUtc,
        c.Perguntas.OrderBy(p => p.Ordem).Select(p => new AvaliacaoPerguntaResponse(p.Id, p.Texto, p.Ordem)).ToList()
    );

    public async Task<IReadOnlyList<AvaliacaoCicloResponse>> ListCiclosAsync(CancellationToken ct)
    {
        var ciclos = await _db.AvaliacaoCiclos
            .Include(c => c.Perguntas)
            .Include(c => c.CriadoPor)
            .AsNoTracking()
            .OrderByDescending(c => c.CriadoEmUtc)
            .ToListAsync(ct);

        var ids = ciclos.Select(c => c.Id).ToList();
        var counts = await _db.AvaliacaoRespostas
            .Where(r => ids.Contains(r.CicloId))
            .GroupBy(r => r.CicloId)
            .Select(g => new { CicloId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.CicloId, x => x.Count, ct);

        return ciclos.Select(c => ToCicloResponse(c, counts.GetValueOrDefault(c.Id, 0))).ToList();
    }

    public async Task<AvaliacaoCicloResponse?> GetCicloAsync(Guid id, CancellationToken ct)
    {
        var ciclo = await _db.AvaliacaoCiclos
            .Include(c => c.Perguntas)
            .Include(c => c.CriadoPor)
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == id, ct);

        if (ciclo is null) return null;

        var total = await _db.AvaliacaoRespostas.CountAsync(r => r.CicloId == id, ct);
        return ToCicloResponse(ciclo, total);
    }

    public async Task<AvaliacaoCicloResponse> CriarCicloAsync(AvaliacaoCicloCreateRequest request, Guid criadoPorId, CancellationToken ct)
    {
        var ciclo = new AvaliacaoCiclo
        {
            Id = Guid.NewGuid(),
            Nome = request.Nome.Trim(),
            Periodo = request.Periodo.Trim(),
            Status = AvaliacaoCicloStatus.Aberto,
            CriadoPorId = criadoPorId,
            CriadoEmUtc = DateTimeOffset.UtcNow,
            AtualizadoEmUtc = DateTimeOffset.UtcNow,
            Perguntas = request.Perguntas.Select((texto, idx) => new AvaliacaoPergunta
            {
                Id = Guid.NewGuid(),
                Texto = texto.Trim(),
                Ordem = idx + 1,
            }).ToList(),
        };

        _db.AvaliacaoCiclos.Add(ciclo);
        await _db.SaveChangesAsync(ct);

        return ToCicloResponse(ciclo, 0);
    }

    public async Task ResponderAsync(Guid cicloId, Guid avaliadorId, AvaliacaoResponderRequest request, CancellationToken ct)
    {
        var ciclo = await _db.AvaliacaoCiclos
            .Include(c => c.Perguntas)
            .FirstOrDefaultAsync(c => c.Id == cicloId, ct)
            ?? throw new InvalidOperationException("Ciclo não encontrado.");

        if (ciclo.Status == AvaliacaoCicloStatus.Fechado)
            throw new InvalidOperationException("Este ciclo está fechado e não aceita mais respostas.");

        if (request.Respostas.Any(r => r.Nota < 1 || r.Nota > 5))
            throw new InvalidOperationException("Notas devem ser entre 1 e 5.");

        var notas = request.Respostas.Select(r => (double)r.Nota).ToList();
        var score = notas.Count > 0 ? (decimal)(notas.Average()) : 0m;
        score = Math.Round(score, 2);

        // upsert: remove resposta anterior do mesmo avaliador sobre o mesmo avaliando neste ciclo
        var existing = await _db.AvaliacaoRespostas
            .FirstOrDefaultAsync(r => r.CicloId == cicloId && r.AvaliadorId == avaliadorId && r.AvaliandoId == request.AvaliandoId, ct);

        if (existing is not null)
            _db.AvaliacaoRespostas.Remove(existing);

        var resposta = new AvaliacaoResposta
        {
            Id = Guid.NewGuid(),
            CicloId = cicloId,
            AvaliadorId = avaliadorId,
            AvaliandoId = request.AvaliandoId,
            Score = score,
            RespostasJson = JsonSerializer.Serialize(request.Respostas),
            CriadoEmUtc = DateTimeOffset.UtcNow,
        };

        _db.AvaliacaoRespostas.Add(resposta);
        await _db.SaveChangesAsync(ct);
    }

    public async Task FecharCicloAsync(Guid cicloId, CancellationToken ct)
    {
        var ciclo = await _db.AvaliacaoCiclos.FirstAsync(c => c.Id == cicloId, ct);
        ciclo.Status = AvaliacaoCicloStatus.Fechado;
        ciclo.AtualizadoEmUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<AvaliacaoResultadoRow>> ListResultadosAsync(Guid cicloId, CancellationToken ct)
    {
        var respostas = await _db.AvaliacaoRespostas
            .Include(r => r.Avaliando)
                .ThenInclude(f => f!.JobPosition)
            .AsNoTracking()
            .Where(r => r.CicloId == cicloId)
            .OrderByDescending(r => r.CriadoEmUtc)
            .ToListAsync(ct);

        return respostas
            .GroupBy(r => r.AvaliandoId)
            .Select(g =>
            {
                var f = g.First().Avaliando;
                return new AvaliacaoResultadoRow(
                    g.Key,
                    f?.Name ?? "",
                    f?.JobPosition?.Name,
                    Math.Round(g.Average(r => r.Score), 2),
                    g.Count(),
                    g.Max(r => r.CriadoEmUtc)
                );
            })
            .OrderByDescending(r => r.Score)
            .ToList();
    }
}
