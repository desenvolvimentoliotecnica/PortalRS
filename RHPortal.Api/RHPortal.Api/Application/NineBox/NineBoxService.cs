using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.NineBox;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.NineBox;

public interface INineBoxService
{
    Task<IReadOnlyList<NineBoxMatrizItemResponse>> ListMatrizAsync(CancellationToken ct);
    Task<NineBoxAssessmentResponse?> GetByFuncionarioAsync(Guid funcionarioId, CancellationToken ct);
    Task<NineBoxAssessmentResponse> UpsertAsync(NineBoxUpsertRequest request, Guid avaliadorId, CancellationToken ct);
}

public sealed class NineBoxService : INineBoxService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;

    public NineBoxService(AppDbContext db, ITenantContext tenantContext)
    {
        _db = db;
        _tenantContext = tenantContext;
    }

    public async Task<IReadOnlyList<NineBoxMatrizItemResponse>> ListMatrizAsync(CancellationToken ct)
    {
        // Para cada funcionário, pegar a avaliação mais recente
        var assessments = await _db.NineBoxAssessments
            .AsNoTracking()
            .Include(a => a.Funcionario).ThenInclude(f => f!.JobPosition)
            .Include(a => a.Funcionario).ThenInclude(f => f!.CentroCusto)
            .Include(a => a.Funcionario).ThenInclude(f => f!.NivelHierarquico)
            .Include(a => a.Avaliador)
            .GroupBy(a => a.FuncionarioId)
            .Select(g => g.OrderByDescending(a => a.CriadoEmUtc).First())
            .ToListAsync(ct);

        return assessments.Select(a => new NineBoxMatrizItemResponse(
            AssessmentId: a.Id,
            FuncionarioId: a.FuncionarioId,
            FuncionarioNome: a.Funcionario!.Name,
            Cargo: a.Funcionario.JobPosition?.Name,
            AreaNome: a.Funcionario.CentroCusto?.Description,
            NivelHierarquicoNome: a.Funcionario.NivelHierarquico?.Nome,
            Desempenho: a.Desempenho,
            Potencial: a.Potencial,
            Observacoes: a.Observacoes,
            AvaliadorNome: a.Avaliador!.Name,
            CriadoEmUtc: a.CriadoEmUtc
        )).ToList();
    }

    public async Task<NineBoxAssessmentResponse?> GetByFuncionarioAsync(Guid funcionarioId, CancellationToken ct)
    {
        var assessment = await _db.NineBoxAssessments
            .AsNoTracking()
            .Where(a => a.FuncionarioId == funcionarioId)
            .OrderByDescending(a => a.CriadoEmUtc)
            .FirstOrDefaultAsync(ct);

        return assessment is null ? null : MapResponse(assessment);
    }

    public async Task<NineBoxAssessmentResponse> UpsertAsync(NineBoxUpsertRequest request, Guid avaliadorId, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var now = DateTimeOffset.UtcNow;

        // Verifica se funcionário existe
        var funcionarioExiste = await _db.Funcionarios.AnyAsync(f => f.Id == request.FuncionarioId, ct);
        if (!funcionarioExiste)
            throw new InvalidOperationException("Funcionário não encontrado.");

        var desempenho = Math.Clamp(request.Desempenho, 1, 3);
        var potencial = Math.Clamp(request.Potencial, 1, 3);

        // Sempre cria um novo registro histórico
        var assessment = new NineBoxAssessment
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            FuncionarioId = request.FuncionarioId,
            AvaliadorId = avaliadorId,
            Desempenho = desempenho,
            Potencial = potencial,
            Observacoes = request.Observacoes?.Trim(),
            CriadoEmUtc = now,
            AtualizadoEmUtc = now,
        };

        _db.NineBoxAssessments.Add(assessment);
        await _db.SaveChangesAsync(ct);

        return MapResponse(assessment);
    }

    private static NineBoxAssessmentResponse MapResponse(NineBoxAssessment a) =>
        new(a.Id, a.FuncionarioId, a.AvaliadorId, a.Desempenho, a.Potencial, a.Observacoes, a.CriadoEmUtc);
}
