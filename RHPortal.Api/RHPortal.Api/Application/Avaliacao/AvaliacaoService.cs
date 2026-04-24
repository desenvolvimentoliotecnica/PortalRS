using System.Globalization;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
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
    Task AtivarCicloAsync(Guid cicloId, CancellationToken ct);
    Task FecharCicloAsync(Guid cicloId, CancellationToken ct);
    Task<IReadOnlyList<AvaliacaoResultadoRow>> ListResultadosAsync(Guid cicloId, CancellationToken ct);
    Task<byte[]> ExportarResultadosCsvAsync(Guid cicloId, CancellationToken ct);
}

public sealed class AvaliacaoService : IAvaliacaoService
{
    private readonly AppDbContext _db;
    private readonly IAvaliacaoConviteService _conviteService;
    private readonly IAvaliacaoCalibragemService _calibragemService;
    private readonly ILogger<AvaliacaoService> _logger;

    public AvaliacaoService(
        AppDbContext db,
        IAvaliacaoConviteService conviteService,
        IAvaliacaoCalibragemService calibragemService,
        ILogger<AvaliacaoService> logger)
    {
        _db = db;
        _conviteService = conviteService;
        _calibragemService = calibragemService;
        _logger = logger;
    }

    private static AvaliacaoCicloResponse ToCicloResponse(AvaliacaoCiclo c, int totalRespostas) => new(
        c.Id,
        c.Nome,
        c.Periodo,
        c.Descricao,
        c.Status,
        c.DataInicio,
        c.DataFim,
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
        if (request.DataInicio is { } ini && request.DataFim is { } fim && fim < ini)
            throw new InvalidOperationException("DataFim não pode ser anterior a DataInicio.");

        var ciclo = new AvaliacaoCiclo
        {
            Id = Guid.NewGuid(),
            Nome = request.Nome.Trim(),
            Periodo = request.Periodo.Trim(),
            Descricao = string.IsNullOrWhiteSpace(request.Descricao) ? null : request.Descricao.Trim(),
            DataInicio = request.DataInicio,
            DataFim = request.DataFim,
            Status = request.IniciarEmRascunho ? AvaliacaoCicloStatus.Rascunho : AvaliacaoCicloStatus.Aberto,
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

    public async Task AtivarCicloAsync(Guid cicloId, CancellationToken ct)
    {
        var ciclo = await _db.AvaliacaoCiclos.FirstOrDefaultAsync(c => c.Id == cicloId, ct)
            ?? throw new InvalidOperationException("Ciclo não encontrado.");

        if (ciclo.Status == AvaliacaoCicloStatus.Aberto) return; // idempotente

        if (ciclo.Status == AvaliacaoCicloStatus.Fechado)
            throw new InvalidOperationException("Ciclo fechado não pode ser reaberto.");

        ciclo.Status = AvaliacaoCicloStatus.Aberto;
        ciclo.AtualizadoEmUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        try
        {
            await _conviteService.GerarConvitesAsync(cicloId, new AvaliacaoGerarConvitesRequest(), ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha best-effort ao gerar convites para ciclo {CicloId}", cicloId);
        }
    }

    public async Task ResponderAsync(Guid cicloId, Guid avaliadorId, AvaliacaoResponderRequest request, CancellationToken ct)
    {
        var ciclo = await _db.AvaliacaoCiclos
            .Include(c => c.Perguntas)
            .FirstOrDefaultAsync(c => c.Id == cicloId, ct)
            ?? throw new InvalidOperationException("Ciclo não encontrado.");

        if (ciclo.Status == AvaliacaoCicloStatus.Fechado)
            throw new InvalidOperationException("Este ciclo está fechado e não aceita mais respostas.");

        if (ciclo.Status == AvaliacaoCicloStatus.Rascunho)
            throw new InvalidOperationException("Ciclo ainda em rascunho — ative antes de receber respostas.");

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

        try
        {
            await _calibragemService.IniciarCalibragemAsync(cicloId, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha best-effort ao iniciar calibragem do ciclo {CicloId}", cicloId);
        }

        try
        {
            await _conviteService.CancelarConvitesPendentesDoCicloAsync(cicloId, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha best-effort ao cancelar convites pendentes do ciclo {CicloId}", cicloId);
        }

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

    public async Task<byte[]> ExportarResultadosCsvAsync(Guid cicloId, CancellationToken ct)
    {
        var resultados = await ListResultadosAsync(cicloId, ct);

        var calibragens = await _db.AvaliacaoCalibragens
            .AsNoTracking()
            .Where(c => c.CicloId == cicloId)
            .ToDictionaryAsync(c => c.FuncionarioId, ct);

        var sb = new StringBuilder();
        sb.AppendLine("AvaliandoId;AvaliandoNome;Cargo;Score;TotalRespostas;UltimaRespostaUtc;DesempenhoGestor;PotencialGestor;ScoreComite;DesempenhoComite;PotencialComite;StatusCalibragem;Decisao");

        foreach (var r in resultados)
        {
            calibragens.TryGetValue(r.AvaliandoId, out var cal);
            sb.Append(r.AvaliandoId).Append(';')
              .Append(Csv(r.AvaliandoNome)).Append(';')
              .Append(Csv(r.Cargo ?? "")).Append(';')
              .Append(r.Score.ToString(CultureInfo.InvariantCulture)).Append(';')
              .Append(r.TotalRespostas).Append(';')
              .Append(r.UltimaRespostaEmUtc.ToString("O", CultureInfo.InvariantCulture)).Append(';')
              .Append(cal?.DesempenhoGestor?.ToString(CultureInfo.InvariantCulture) ?? "").Append(';')
              .Append(cal?.PotencialGestor?.ToString(CultureInfo.InvariantCulture) ?? "").Append(';')
              .Append(cal?.ScoreComite?.ToString(CultureInfo.InvariantCulture) ?? "").Append(';')
              .Append(cal?.DesempenhoComite?.ToString(CultureInfo.InvariantCulture) ?? "").Append(';')
              .Append(cal?.PotencialComite?.ToString(CultureInfo.InvariantCulture) ?? "").Append(';')
              .Append(cal?.Status.ToString() ?? "").Append(';')
              .Append(cal?.Decisao.ToString() ?? "")
              .AppendLine();
        }

        var preamble = Encoding.UTF8.GetPreamble();
        var body = Encoding.UTF8.GetBytes(sb.ToString());
        var result = new byte[preamble.Length + body.Length];
        Buffer.BlockCopy(preamble, 0, result, 0, preamble.Length);
        Buffer.BlockCopy(body, 0, result, preamble.Length, body.Length);
        return result;
    }

    private static string Csv(string v)
    {
        if (v.Contains('"') || v.Contains(';') || v.Contains('\n') || v.Contains('\r'))
            return "\"" + v.Replace("\"", "\"\"") + "\"";
        return v;
    }
}
