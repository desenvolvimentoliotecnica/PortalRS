using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Application.OcupacaoHistorico;

public record OcupacaoHistoricoDto(
    Guid Id,
    Guid FuncionarioId,
    string FuncionarioNome,
    DateTime DataEntrada,
    DateTime? DataSaida,
    string? MotivoSaida,
    /// <summary>ID da solicitação de desligamento ativa (Aprovada ou EmIntegracao) para este ocupante. Null se não houver.</summary>
    Guid? DesligamentoSolicitacaoId
);

public interface IOcupacaoHistoricoService
{
    /// <summary>Fecha a ocupação ativa do funcionário em qualquer vaga. Silencioso se não encontrar.</summary>
    Task FecharOcupacaoAsync(Guid funcionarioId, MotivoSaidaOcupacao motivo, Guid? solicitacaoOrigemId, CancellationToken ct);

    /// <summary>Abre uma nova ocupação do funcionário em uma vaga específica.</summary>
    Task AbrirOcupacaoAsync(Guid funcionarioId, Guid vagaId, DateTime dataEntrada, Guid? solicitacaoOrigemId, CancellationToken ct);

    /// <summary>Retorna todas as ocupações de uma vaga (históricas + ativas).</summary>
    Task<List<OcupacaoHistoricoDto>> GetByVagaAsync(Guid vagaId, CancellationToken ct);
}

public sealed class OcupacaoHistoricoService : IOcupacaoHistoricoService
{
    private readonly AppDbContext _db;
    private readonly ILogger<OcupacaoHistoricoService> _logger;

    public OcupacaoHistoricoService(AppDbContext db, ILogger<OcupacaoHistoricoService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task FecharOcupacaoAsync(Guid funcionarioId, MotivoSaidaOcupacao motivo, Guid? solicitacaoOrigemId, CancellationToken ct)
    {
        var ocupacao = await _db.OcupacoesHistorico
            .FirstOrDefaultAsync(o => o.FuncionarioId == funcionarioId && o.DataSaida == null, ct);

        if (ocupacao is null)
        {
            _logger.LogWarning("OcupacaoHistorico: nenhuma ocupação ativa encontrada para funcionário {FuncionarioId}. Ignorando.", funcionarioId);
            return;
        }

        ocupacao.DataSaida = DateTime.UtcNow;
        ocupacao.MotivoSaida = motivo;
        if (solicitacaoOrigemId.HasValue)
            ocupacao.SolicitacaoOrigemId = solicitacaoOrigemId;

        await _db.SaveChangesAsync(ct);
    }

    public async Task AbrirOcupacaoAsync(Guid funcionarioId, Guid vagaId, DateTime dataEntrada, Guid? solicitacaoOrigemId, CancellationToken ct)
    {
        var nova = new RhPortal.Api.Domain.Entities.OcupacaoHistorico
        {
            Id = Guid.NewGuid(),
            VagaId = vagaId,
            FuncionarioId = funcionarioId,
            DataEntrada = dataEntrada,
            SolicitacaoOrigemId = solicitacaoOrigemId,
        };

        _db.OcupacoesHistorico.Add(nova);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<List<OcupacaoHistoricoDto>> GetByVagaAsync(Guid vagaId, CancellationToken ct)
    {
        var ocupacoes = await _db.OcupacoesHistorico
            .Where(o => o.VagaId == vagaId)
            .OrderByDescending(o => o.DataEntrada)
            .Select(o => new
            {
                o.Id,
                o.FuncionarioId,
                FuncionarioNome = o.Funcionario != null ? o.Funcionario.Name : "—",
                o.DataEntrada,
                o.DataSaida,
                o.MotivoSaida,
            })
            .ToListAsync(ct);

        // Para ocupantes ativos, verificar se há solicitação de desligamento pendente
        var activeFuncIds = ocupacoes
            .Where(o => o.DataSaida == null)
            .Select(o => o.FuncionarioId)
            .Distinct()
            .ToList();

        Dictionary<Guid, Guid> desligamentoMap = [];
        if (activeFuncIds.Count > 0)
        {
            var desligamentos = await _db.SolicitacoesDesligamento
                .Where(d => activeFuncIds.Contains(d.FuncionarioId)
                    && (d.Status == SolicitacaoStatus.Aprovada || d.Status == SolicitacaoStatus.EmIntegracao))
                .Select(d => new { d.FuncionarioId, d.Id })
                .ToListAsync(ct);

            // Se houver mais de uma (improvável), pega a mais recente (última inserida)
            foreach (var d in desligamentos)
                desligamentoMap[d.FuncionarioId] = d.Id;
        }

        return ocupacoes.Select(o => new OcupacaoHistoricoDto(
            o.Id,
            o.FuncionarioId,
            o.FuncionarioNome,
            o.DataEntrada,
            o.DataSaida,
            o.MotivoSaida != null ? o.MotivoSaida.ToString() : null,
            o.DataSaida == null && desligamentoMap.TryGetValue(o.FuncionarioId, out var dId) ? dId : null
        )).ToList();
    }
}
