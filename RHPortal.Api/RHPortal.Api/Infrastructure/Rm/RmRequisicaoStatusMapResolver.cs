using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Infrastructure.Rm;

public static class RmRequisicaoStatusMapResolver
{
    /// <summary>Primeira entrada por <c>CodStatusRm</c> após ordenar prioridade ascendente (null último).</summary>
    public static RmRequisicaoStatusMap? ResolveFirst(IReadOnlyList<RmRequisicaoStatusMap> maps, int codStatusRm)
        => maps
            .Where(m => m.CodStatusRm == codStatusRm)
            .OrderBy(m => m.Priority ?? int.MaxValue)
            .ThenBy(m => m.CreatedAtUtc)
            .FirstOrDefault();

    public static bool TryParsePortalStatus(RmRequisicaoStatusMap map, out SolicitacaoStatus status)
        => Enum.TryParse(map.PortalStatusKey, ignoreCase: false, out status);
}
