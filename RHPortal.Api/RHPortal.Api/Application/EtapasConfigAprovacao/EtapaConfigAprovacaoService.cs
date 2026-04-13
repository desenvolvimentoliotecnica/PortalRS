using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Common;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.EtapasConfigAprovacao;

public interface IEtapaConfigAprovacaoService
{
    Task<IReadOnlyList<EtapaConfigAprovacaoDto>> ListAsync(TipoFluxoAprovacao tipoFluxo, CancellationToken ct);
    Task<IReadOnlyList<EtapaConfigAprovacaoDto>> UpsertAsync(TipoFluxoAprovacao tipoFluxo, IReadOnlyList<EtapaConfigAprovacaoSaveRequest> etapas, CancellationToken ct);
    Task<FluxoAprovacaoConfigDto> GetConfigGlobalAsync(TipoFluxoAprovacao tipoFluxo, CancellationToken ct);
    Task<FluxoAprovacaoConfigDto> SaveConfigGlobalAsync(TipoFluxoAprovacao tipoFluxo, FluxoAprovacaoConfigSaveRequest req, CancellationToken ct);
}

public sealed class EtapaConfigAprovacaoService : IEtapaConfigAprovacaoService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;

    public EtapaConfigAprovacaoService(AppDbContext db, ITenantContext tenantContext)
    {
        _db = db;
        _tenantContext = tenantContext;
    }

    public async Task<IReadOnlyList<EtapaConfigAprovacaoDto>> ListAsync(TipoFluxoAprovacao tipoFluxo, CancellationToken ct)
    {
        var etapas = await _db.EtapasConfigAprovacao
            .AsNoTracking()
            .Include(e => e.FuncionarioFixo)
            .Include(e => e.RoleFila)
            .Where(e => e.TipoFluxo == tipoFluxo)
            .OrderBy(e => e.Ordem)
            .ToListAsync(ct);

        return etapas.Select(MapToDto).ToList();
    }

    public async Task<IReadOnlyList<EtapaConfigAprovacaoDto>> UpsertAsync(
        TipoFluxoAprovacao tipoFluxo,
        IReadOnlyList<EtapaConfigAprovacaoSaveRequest> etapas,
        CancellationToken ct)
    {
        // Remove existing steps for this flow type
        var existing = await _db.EtapasConfigAprovacao
            .Where(e => e.TipoFluxo == tipoFluxo)
            .ToListAsync(ct);
        _db.EtapasConfigAprovacao.RemoveRange(existing);

        // Insert new steps
        var novas = etapas.Select((req, idx) => new EtapaConfigAprovacao
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId ?? "",
            TipoFluxo = tipoFluxo,
            Ordem = req.Ordem > 0 ? req.Ordem : (idx + 1),
            Label = req.Label,
            TipoAprovador = (TipoAprovador)req.TipoAprovador,
            FuncionarioFixoId = req.FuncionarioFixoId,
            RoleFilaId = req.RoleFilaId,
            AcaoEtapa = (AcaoEtapa)req.AcaoEtapa,
            MomentoAcao = (MomentoAcao)req.MomentoAcao,
            Ativo = true,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        }).ToList();

        _db.EtapasConfigAprovacao.AddRange(novas);
        await _db.SaveChangesAsync(ct);

        return await ListAsync(tipoFluxo, ct);
    }

    public async Task<FluxoAprovacaoConfigDto> GetConfigGlobalAsync(TipoFluxoAprovacao tipoFluxo, CancellationToken ct)
    {
        var config = await _db.FluxosAprovacaoConfig
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.TipoFluxo == tipoFluxo, ct);

        return new FluxoAprovacaoConfigDto((short)(config?.ReferenciaUnidade ?? ReferenciaUnidade.Solicitante));
    }

    public async Task<FluxoAprovacaoConfigDto> SaveConfigGlobalAsync(
        TipoFluxoAprovacao tipoFluxo,
        FluxoAprovacaoConfigSaveRequest req,
        CancellationToken ct)
    {
        var config = await _db.FluxosAprovacaoConfig
            .FirstOrDefaultAsync(c => c.TipoFluxo == tipoFluxo, ct);

        if (config is null)
        {
            config = new FluxoAprovacaoConfig
            {
                Id = Guid.NewGuid(),
                TenantId = _tenantContext.TenantId ?? "",
                TipoFluxo = tipoFluxo,
            };
            _db.FluxosAprovacaoConfig.Add(config);
        }

        config.ReferenciaUnidade = (ReferenciaUnidade)req.ReferenciaUnidade;
        config.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        return new FluxoAprovacaoConfigDto((short)config.ReferenciaUnidade);
    }

    private static EtapaConfigAprovacaoDto MapToDto(EtapaConfigAprovacao e) => new(
        e.Id,
        e.Ordem,
        e.Label,
        ((short)e.TipoAprovador).ToString(),
        e.FuncionarioFixoId,
        e.FuncionarioFixo?.Name,
        e.RoleFilaId,
        e.RoleFila?.Name,
        e.Ativo,
        (short)e.AcaoEtapa,
        (short)e.MomentoAcao
    );
}
