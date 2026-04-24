using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Contracts.Avaliacao;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Messaging.Email;

namespace RhPortal.Api.Application.Avaliacao;

public interface IAvaliacaoConviteService
{
    Task<AvaliacaoGerarConvitesResultado> GerarConvitesAsync(Guid cicloId, AvaliacaoGerarConvitesRequest request, CancellationToken ct);
    Task<IReadOnlyList<AvaliacaoConviteResponse>> ListarPorCicloAsync(Guid cicloId, CancellationToken ct);
    Task<IReadOnlyList<AvaliacaoConviteResponse>> ListarPendentesDoAvaliadorAsync(Guid avaliadorId, CancellationToken ct);
    Task MarcarRespondidoAsync(Guid cicloId, Guid avaliadorId, Guid avaliandoId, CancellationToken ct);
    Task CancelarConvitesPendentesDoCicloAsync(Guid cicloId, CancellationToken ct);
}

public sealed class AvaliacaoConviteService : IAvaliacaoConviteService
{
    private readonly AppDbContext _db;
    private readonly IEmailQueueService _emailQueue;
    private readonly ILogger<AvaliacaoConviteService> _logger;

    public AvaliacaoConviteService(
        AppDbContext db,
        IEmailQueueService emailQueue,
        ILogger<AvaliacaoConviteService> logger)
    {
        _db = db;
        _emailQueue = emailQueue;
        _logger = logger;
    }

    public async Task<AvaliacaoGerarConvitesResultado> GerarConvitesAsync(Guid cicloId, AvaliacaoGerarConvitesRequest request, CancellationToken ct)
    {
        var ciclo = await _db.AvaliacaoCiclos.FirstOrDefaultAsync(c => c.Id == cicloId, ct)
            ?? throw new InvalidOperationException("Ciclo não encontrado.");

        if (ciclo.Status == AvaliacaoCicloStatus.Fechado)
            throw new InvalidOperationException("Não é possível gerar convites de ciclo fechado.");

        var funcionarios = await _db.Funcionarios
            .Where(f => f.Status == FuncionarioStatus.Active)
            .Select(f => new { f.Id, f.GestorDiretoId, f.Name, f.Email })
            .ToListAsync(ct);

        if (funcionarios.Count == 0)
            return new AvaliacaoGerarConvitesResultado(0, 0, 0);

        var existing = await _db.AvaliacaoConvites
            .Where(c => c.CicloId == cicloId)
            .Select(c => new { c.AvaliadorId, c.AvaliandoId })
            .ToListAsync(ct);
        var existingPairs = existing.Select(x => (x.AvaliadorId, x.AvaliandoId)).ToHashSet();

        var pairs = new List<(Guid Avaliador, Guid Avaliando, AvaliacaoConviteTipo Tipo)>();

        var funcionarioById = funcionarios.ToDictionary(f => f.Id);

        if (request.IncluirAutoavaliacao)
        {
            foreach (var f in funcionarios)
                pairs.Add((f.Id, f.Id, AvaliacaoConviteTipo.Autoavaliacao));
        }

        if (request.IncluirGestorParaDireto)
        {
            foreach (var f in funcionarios)
            {
                if (f.GestorDiretoId is { } gid && funcionarioById.ContainsKey(gid))
                    pairs.Add((gid, f.Id, AvaliacaoConviteTipo.GestorParaDireto));
            }
        }

        if (request.IncluirDiretoParaGestor)
        {
            foreach (var f in funcionarios)
            {
                if (f.GestorDiretoId is { } gid && funcionarioById.ContainsKey(gid))
                    pairs.Add((f.Id, gid, AvaliacaoConviteTipo.DiretoParaGestor));
            }
        }

        if (request.IncluirPares)
        {
            var gruposPorGestor = funcionarios
                .Where(f => f.GestorDiretoId.HasValue)
                .GroupBy(f => f.GestorDiretoId!.Value);

            foreach (var grupo in gruposPorGestor)
            {
                var membros = grupo.ToList();
                foreach (var a in membros)
                    foreach (var b in membros)
                        if (a.Id != b.Id)
                            pairs.Add((a.Id, b.Id, AvaliacaoConviteTipo.Par));
            }
        }

        var novos = new List<AvaliacaoConvite>();
        var jaExistiam = 0;

        foreach (var (avaliador, avaliando, tipo) in pairs)
        {
            if (!existingPairs.Add((avaliador, avaliando)))
            {
                jaExistiam++;
                continue;
            }

            novos.Add(new AvaliacaoConvite
            {
                Id = Guid.NewGuid(),
                CicloId = cicloId,
                AvaliadorId = avaliador,
                AvaliandoId = avaliando,
                Tipo = tipo,
                Status = AvaliacaoConviteStatus.Pendente,
                CriadoEmUtc = DateTimeOffset.UtcNow,
            });
        }

        if (novos.Count == 0)
            return new AvaliacaoGerarConvitesResultado(0, 0, jaExistiam);

        _db.AvaliacaoConvites.AddRange(novos);
        await _db.SaveChangesAsync(ct);

        var emailsEnfileirados = 0;

        if (request.EnviarEmail)
        {
            var avaliadorIds = novos.Select(c => c.AvaliadorId).Distinct().ToList();
            var resumoPorAvaliador = novos
                .GroupBy(c => c.AvaliadorId)
                .ToDictionary(g => g.Key, g => g.Count());

            foreach (var avaliadorId in avaliadorIds)
            {
                if (!funcionarioById.TryGetValue(avaliadorId, out var avaliador))
                    continue;

                if (string.IsNullOrWhiteSpace(avaliador.Email))
                    continue;

                var totalAvaliandos = resumoPorAvaliador[avaliadorId];
                var subject = $"Você foi convocado para o ciclo de avaliação: {ciclo.Nome}";
                var bodyHtml = $"""
                    <p>Olá, <strong>{System.Net.WebUtility.HtmlEncode(avaliador.Name)}</strong>!</p>
                    <p>Você foi convocado para participar do ciclo de avaliação de desempenho <strong>{System.Net.WebUtility.HtmlEncode(ciclo.Nome)}</strong> ({System.Net.WebUtility.HtmlEncode(ciclo.Periodo)}).</p>
                    <p>Você deve avaliar <strong>{totalAvaliandos}</strong> colega(s). Acesse o portal para responder.</p>
                    """;
                var bodyText = $"Olá, {avaliador.Name}! Você foi convocado para o ciclo {ciclo.Nome} ({ciclo.Periodo}). Você deve avaliar {totalAvaliandos} colega(s). Acesse o portal para responder.";

                try
                {
                    await _emailQueue.EnqueueRawAsync(avaliador.Email!, subject, bodyHtml, bodyText, isSystem: true, source: "Desempenho.Convocacao", ct);
                    emailsEnfileirados++;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Falha ao enfileirar e-mail de convocação para avaliador {AvaliadorId}", avaliadorId);
                }
            }

            if (emailsEnfileirados > 0)
            {
                var agora = DateTimeOffset.UtcNow;
                foreach (var c in novos)
                    c.NotificadoEmUtc = agora;
                await _db.SaveChangesAsync(ct);
            }
        }

        return new AvaliacaoGerarConvitesResultado(novos.Count, emailsEnfileirados, jaExistiam);
    }

    public async Task<IReadOnlyList<AvaliacaoConviteResponse>> ListarPorCicloAsync(Guid cicloId, CancellationToken ct)
    {
        var convites = await _db.AvaliacaoConvites
            .Include(c => c.Avaliador)
            .Include(c => c.Avaliando)
            .AsNoTracking()
            .Where(c => c.CicloId == cicloId)
            .OrderBy(c => c.Tipo).ThenBy(c => c.Status)
            .ToListAsync(ct);

        return convites.Select(ToResponse).ToList();
    }

    public async Task<IReadOnlyList<AvaliacaoConviteResponse>> ListarPendentesDoAvaliadorAsync(Guid avaliadorId, CancellationToken ct)
    {
        var convites = await _db.AvaliacaoConvites
            .Include(c => c.Ciclo)
            .Include(c => c.Avaliador)
            .Include(c => c.Avaliando)
            .AsNoTracking()
            .Where(c => c.AvaliadorId == avaliadorId
                && c.Status == AvaliacaoConviteStatus.Pendente
                && c.Ciclo!.Status == AvaliacaoCicloStatus.Aberto)
            .OrderBy(c => c.CriadoEmUtc)
            .ToListAsync(ct);

        return convites.Select(ToResponse).ToList();
    }

    public async Task MarcarRespondidoAsync(Guid cicloId, Guid avaliadorId, Guid avaliandoId, CancellationToken ct)
    {
        var convite = await _db.AvaliacaoConvites
            .FirstOrDefaultAsync(c => c.CicloId == cicloId && c.AvaliadorId == avaliadorId && c.AvaliandoId == avaliandoId, ct);

        if (convite is null) return;

        if (convite.Status == AvaliacaoConviteStatus.Respondido) return;

        convite.Status = AvaliacaoConviteStatus.Respondido;
        convite.RespondidoEmUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    public async Task CancelarConvitesPendentesDoCicloAsync(Guid cicloId, CancellationToken ct)
    {
        var pendentes = await _db.AvaliacaoConvites
            .Where(c => c.CicloId == cicloId && c.Status == AvaliacaoConviteStatus.Pendente)
            .ToListAsync(ct);

        foreach (var c in pendentes)
            c.Status = AvaliacaoConviteStatus.Cancelado;

        if (pendentes.Count > 0)
            await _db.SaveChangesAsync(ct);
    }

    private static AvaliacaoConviteResponse ToResponse(AvaliacaoConvite c) => new(
        c.Id,
        c.CicloId,
        c.AvaliadorId,
        c.Avaliador?.Name ?? "",
        c.AvaliandoId,
        c.Avaliando?.Name ?? "",
        c.Tipo,
        c.Status,
        c.CriadoEmUtc,
        c.NotificadoEmUtc,
        c.RespondidoEmUtc
    );
}
