using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Contracts.Feedback;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Feedback;

/// <summary>
/// Catálogo de Render Coin Rewards (Entrega 1.8 — Fase 1 Paridade Feedz):
/// listagem, resgate, gestão do workflow Solicitado → Aprovado → Entregue / Cancelado.
/// </summary>
public interface IRenderCoinRewardService
{
    Task<IReadOnlyList<RenderCoinRewardResponse>> ListAsync(bool incluirInativos, CancellationToken ct);
    Task<RenderCoinRewardResponse?> GetAsync(Guid id, CancellationToken ct);
    Task<RenderCoinRewardResponse> CreateAsync(RenderCoinRewardCreateRequest request, CancellationToken ct);
    Task<RenderCoinRedemptionResponse> RedeemAsync(Guid userId, RenderCoinRedeemRequest request, CancellationToken ct);
    Task<IReadOnlyList<RenderCoinRedemptionResponse>> ListRedemptionsAsync(Guid? userIdFilter, int? statusFilter, CancellationToken ct);
    Task<RenderCoinRedemptionResponse> UpdateRedemptionStatusAsync(Guid redemptionId, RenderCoinRedemptionStatusUpdateRequest request, Guid processadoPorUserId, CancellationToken ct);
}

public sealed class RenderCoinRewardService : IRenderCoinRewardService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenant;
    private readonly ILogger<RenderCoinRewardService> _logger;

    public RenderCoinRewardService(AppDbContext db, ITenantContext tenant, ILogger<RenderCoinRewardService> logger)
    {
        _db = db;
        _tenant = tenant;
        _logger = logger;
    }

    private static string StatusName(int s) => s switch
    {
        0 => "Solicitado",
        1 => "Aprovado",
        2 => "Entregue",
        3 => "Cancelado",
        _ => "Desconhecido",
    };

    private static RenderCoinRewardResponse ToResponse(RenderCoinReward r) => new(
        r.Id, r.Codigo, r.Nome, r.Descricao, r.Categoria, r.CustoCoins,
        r.EstoqueDisponivel, r.ImagemUrl, r.IsSystem, r.IsActive, r.Ordem, r.CriadoEmUtc);

    public async Task<IReadOnlyList<RenderCoinRewardResponse>> ListAsync(bool incluirInativos, CancellationToken ct)
    {
        var query = _db.RenderCoinRewards.AsNoTracking();
        if (!incluirInativos) query = query.Where(r => r.IsActive);
        var ts = await query.OrderBy(r => r.Ordem).ThenBy(r => r.Nome).ToListAsync(ct);
        return ts.Select(ToResponse).ToList();
    }

    public async Task<RenderCoinRewardResponse?> GetAsync(Guid id, CancellationToken ct)
    {
        var r = await _db.RenderCoinRewards.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return r is null ? null : ToResponse(r);
    }

    public async Task<RenderCoinRewardResponse> CreateAsync(RenderCoinRewardCreateRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Codigo)) throw new InvalidOperationException("Código é obrigatório.");
        if (string.IsNullOrWhiteSpace(request.Nome)) throw new InvalidOperationException("Nome é obrigatório.");
        if (request.CustoCoins <= 0) throw new InvalidOperationException("Custo em coins deve ser positivo.");

        var codigo = request.Codigo.Trim();
        if (await _db.RenderCoinRewards.AnyAsync(r => r.Codigo == codigo, ct))
            throw new InvalidOperationException($"Já existe recompensa com código '{codigo}'.");

        var maiorOrdem = await _db.RenderCoinRewards.Select(r => (int?)r.Ordem).MaxAsync(ct) ?? 0;

        var reward = new RenderCoinReward
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant.TenantId,
            Codigo = codigo,
            Nome = request.Nome.Trim(),
            Descricao = string.IsNullOrWhiteSpace(request.Descricao) ? null : request.Descricao.Trim(),
            Categoria = string.IsNullOrWhiteSpace(request.Categoria) ? null : request.Categoria.Trim(),
            CustoCoins = request.CustoCoins,
            EstoqueDisponivel = request.EstoqueDisponivel,
            ImagemUrl = request.ImagemUrl,
            IsSystem = false,
            IsActive = true,
            Ordem = maiorOrdem + 10,
            CriadoEmUtc = DateTimeOffset.UtcNow,
            AtualizadoEmUtc = DateTimeOffset.UtcNow,
        };
        _db.RenderCoinRewards.Add(reward);
        await _db.SaveChangesAsync(ct);
        return ToResponse(reward);
    }

    public async Task<RenderCoinRedemptionResponse> RedeemAsync(Guid userId, RenderCoinRedeemRequest request, CancellationToken ct)
    {
        var reward = await _db.RenderCoinRewards.FirstOrDefaultAsync(r => r.Id == request.RewardId, ct)
            ?? throw new InvalidOperationException("Recompensa não encontrada.");

        if (!reward.IsActive)
            throw new InvalidOperationException("Recompensa inativa.");
        if (reward.EstoqueDisponivel is { } estoque && estoque <= 0)
            throw new InvalidOperationException("Recompensa esgotada.");

        var balance = await _db.RenderCoinBalances.FirstOrDefaultAsync(b => b.UserId == userId, ct);
        var saldo = balance?.Balance ?? 0m;
        if (saldo < reward.CustoCoins)
            throw new InvalidOperationException($"Saldo insuficiente. Você tem {saldo:F0} coins; resgate custa {reward.CustoCoins:F0}.");

        // Debita saldo
        if (balance is null)
            throw new InvalidOperationException("Você não tem saldo de Render Coins ainda.");
        balance.Balance -= reward.CustoCoins;
        balance.UpdatedAtUtc = DateTimeOffset.UtcNow;

        // Decrementa estoque (se aplicável)
        if (reward.EstoqueDisponivel.HasValue)
            reward.EstoqueDisponivel = reward.EstoqueDisponivel.Value - 1;

        // Cria transação de débito (rastro)
        _db.RenderCoinTransactions.Add(new RenderCoinTransaction
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant.TenantId,
            UserId = userId,
            Amount = -reward.CustoCoins,
            Reason = $"Resgate: {reward.Nome}",
            SourceType ="redemption",
            SourceId = reward.Id.ToString(),
            CreatedAtUtc = DateTimeOffset.UtcNow,
        });

        var redemption = new RenderCoinRedemption
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant.TenantId,
            RewardId = reward.Id,
            UserId = userId,
            CoinsGastos = reward.CustoCoins,
            Status = 0, // Solicitado
            Observacao = string.IsNullOrWhiteSpace(request.Observacao) ? null : request.Observacao.Trim(),
            CriadoEmUtc = DateTimeOffset.UtcNow,
        };
        _db.RenderCoinRedemptions.Add(redemption);

        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Redemption {RedId}: user {UserId} resgatou {Reward} ({Coins} coins)",
            redemption.Id, userId, reward.Codigo, reward.CustoCoins);

        return await GetRedemptionResponseAsync(redemption.Id, ct);
    }

    private async Task<RenderCoinRedemptionResponse> GetRedemptionResponseAsync(Guid id, CancellationToken ct)
    {
        var r = await _db.RenderCoinRedemptions
            .Include(x => x.Reward)
            .Include(x => x.User)
            .AsNoTracking()
            .FirstAsync(x => x.Id == id, ct);

        string? procPorNome = null;
        if (r.ProcessadoPorUserId is { } procId)
        {
            var u = await _db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == procId, ct);
            procPorNome = u?.FullName ?? u?.UserName;
        }

        return new RenderCoinRedemptionResponse(
            r.Id, r.RewardId, r.Reward?.Nome ?? "", r.UserId, r.User?.FullName ?? r.User?.UserName ?? "",
            r.CoinsGastos, r.Status, StatusName(r.Status), r.Observacao,
            r.ProcessadoPorUserId, procPorNome, r.ProcessadoEmUtc, r.CriadoEmUtc);
    }

    public async Task<IReadOnlyList<RenderCoinRedemptionResponse>> ListRedemptionsAsync(
        Guid? userIdFilter, int? statusFilter, CancellationToken ct)
    {
        var q = _db.RenderCoinRedemptions
            .Include(r => r.Reward)
            .Include(r => r.User)
            .AsNoTracking();
        if (userIdFilter.HasValue)
            q = q.Where(r => r.UserId == userIdFilter.Value);
        if (statusFilter.HasValue)
            q = q.Where(r => r.Status == statusFilter.Value);

        var list = await q.OrderByDescending(r => r.CriadoEmUtc).ToListAsync(ct);

        return list.Select(r => new RenderCoinRedemptionResponse(
            r.Id, r.RewardId, r.Reward?.Nome ?? "", r.UserId, r.User?.FullName ?? r.User?.UserName ?? "",
            r.CoinsGastos, r.Status, StatusName(r.Status), r.Observacao,
            r.ProcessadoPorUserId, null, r.ProcessadoEmUtc, r.CriadoEmUtc)).ToList();
    }

    public async Task<RenderCoinRedemptionResponse> UpdateRedemptionStatusAsync(
        Guid redemptionId,
        RenderCoinRedemptionStatusUpdateRequest request,
        Guid processadoPorUserId,
        CancellationToken ct)
    {
        if (request.NovoStatus is < 1 or > 3)
            throw new InvalidOperationException("Status inválido. Use 1 (Aprovado), 2 (Entregue) ou 3 (Cancelado).");

        var red = await _db.RenderCoinRedemptions.FirstOrDefaultAsync(r => r.Id == redemptionId, ct)
            ?? throw new InvalidOperationException("Resgate não encontrado.");

        // Cancelar reverte coins
        if (request.NovoStatus == 3 && red.Status != 3)
        {
            var bal = await _db.RenderCoinBalances.FirstOrDefaultAsync(b => b.UserId == red.UserId, ct);
            if (bal is not null)
            {
                bal.Balance += red.CoinsGastos;
                bal.UpdatedAtUtc = DateTimeOffset.UtcNow;
                _db.RenderCoinTransactions.Add(new RenderCoinTransaction
                {
                    Id = Guid.NewGuid(),
                    TenantId = _tenant.TenantId,
                    UserId = red.UserId,
                    Amount = red.CoinsGastos,
                    Reason = "Estorno de resgate cancelado",
                    SourceType ="redemption_refund",
                    SourceId = red.Id.ToString(),
                    CreatedAtUtc = DateTimeOffset.UtcNow,
                });
            }
            // Devolve estoque
            var reward = await _db.RenderCoinRewards.FirstOrDefaultAsync(r => r.Id == red.RewardId, ct);
            if (reward?.EstoqueDisponivel.HasValue == true)
                reward.EstoqueDisponivel = reward.EstoqueDisponivel.Value + 1;
        }

        red.Status = request.NovoStatus;
        red.ProcessadoPorUserId = processadoPorUserId;
        red.ProcessadoEmUtc = DateTimeOffset.UtcNow;
        if (!string.IsNullOrWhiteSpace(request.Observacao))
            red.Observacao = request.Observacao.Trim();

        await _db.SaveChangesAsync(ct);
        return await GetRedemptionResponseAsync(red.Id, ct);
    }
}
