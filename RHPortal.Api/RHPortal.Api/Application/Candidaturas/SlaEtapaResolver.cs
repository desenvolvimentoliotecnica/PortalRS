using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Application.Candidaturas;

/// <summary>Defaults hardcoded do funil — usados quando o tenant não configurou a etapa.</summary>
public static class SlaEtapaDefaults
{
    public static int GetDias(EtapaMacroCandidatura etapa) => etapa switch
    {
        EtapaMacroCandidatura.Aplicada => 2,
        EtapaMacroCandidatura.EmTriagem => 5,
        EtapaMacroCandidatura.Entrevista => 10,
        EtapaMacroCandidatura.EntrevistaTecnica => 10,
        EtapaMacroCandidatura.Teste => 7,
        EtapaMacroCandidatura.Proposta => 5,
        EtapaMacroCandidatura.Contratado => 365,
        EtapaMacroCandidatura.ReprovadoRh => 365,
        EtapaMacroCandidatura.ReprovadoGestor => 365,
        EtapaMacroCandidatura.Recusado => 365,
        EtapaMacroCandidatura.Desistiu => 365,
        _ => 7,
    };

    /// <summary>Etapas configuráveis pelo RH (funil ativo).</summary>
    public static readonly IReadOnlyList<EtapaMacroCandidatura> Configuraveis =
    [
        EtapaMacroCandidatura.Aplicada,
        EtapaMacroCandidatura.EmTriagem,
        EtapaMacroCandidatura.Entrevista,
        EtapaMacroCandidatura.EntrevistaTecnica,
        EtapaMacroCandidatura.Teste,
        EtapaMacroCandidatura.Proposta,
    ];
}

public interface ISlaEtapaResolver
{
    Task<int> GetDiasMetaAsync(EtapaMacroCandidatura etapa, CancellationToken ct);
    Task<IReadOnlyDictionary<EtapaMacroCandidatura, int>> GetMapAsync(CancellationToken ct);
}

public sealed class SlaEtapaResolver : ISlaEtapaResolver
{
    private readonly AppDbContext _db;

    public SlaEtapaResolver(AppDbContext db) => _db = db;

    public async Task<int> GetDiasMetaAsync(EtapaMacroCandidatura etapa, CancellationToken ct)
    {
        var map = await GetMapAsync(ct);
        return map.TryGetValue(etapa, out var dias) ? dias : SlaEtapaDefaults.GetDias(etapa);
    }

    public async Task<IReadOnlyDictionary<EtapaMacroCandidatura, int>> GetMapAsync(CancellationToken ct)
    {
        var configs = await _db.SlaEtapaCandidaturaConfigs
            .AsNoTracking()
            .Where(x => x.Ativo)
            .ToListAsync(ct);

        var result = new Dictionary<EtapaMacroCandidatura, int>();
        foreach (var etapa in Enum.GetValues<EtapaMacroCandidatura>())
        {
            var cfg = configs.FirstOrDefault(c => c.Etapa == etapa);
            result[etapa] = cfg is { SlaDias: > 0 } ? cfg.SlaDias : SlaEtapaDefaults.GetDias(etapa);
        }

        return result;
    }
}
