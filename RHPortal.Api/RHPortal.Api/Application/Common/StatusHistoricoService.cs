using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Common;

/// <summary>
/// Registra transições de status em qualquer entidade do sistema.
/// Calcula automaticamente o tempo no status anterior e valida contra o SLA configurado.
/// Não faz SaveChanges — o chamador controla a transação.
/// </summary>
public sealed class StatusHistoricoService(AppDbContext db, ITenantContext tenantContext)
{
    /// <summary>
    /// Registra transição a partir do ICurrentUserContext (resolve o nome automaticamente).
    /// Use este overload em serviços que já têm acesso ao contexto do usuário.
    /// </summary>
    public async Task RegistrarAsync(
        TipoEntidadeStatus tipoEntidade,
        Guid entidadeId,
        string statusAnterior,
        string statusNovo,
        ICurrentUserContext currentUser,
        string? observacao = null,
        CancellationToken ct = default)
    {
        string nome = currentUser.Email ?? "Sistema";

        if (currentUser.FuncionarioId.HasValue)
        {
            var funcNome = await db.Funcionarios.AsNoTracking()
                .Where(f => f.Id == currentUser.FuncionarioId.Value)
                .Select(f => f.Name)
                .FirstOrDefaultAsync(ct);

            if (funcNome is not null)
                nome = funcNome;
        }

        await RegistrarAsync(
            tipoEntidade, entidadeId, statusAnterior, statusNovo,
            currentUser.FuncionarioId, currentUser.UserId, nome, observacao, ct);
    }

    /// <summary>
    /// Verifica se um status está ativo no fluxo do tenant.
    /// Retorna true se não houver config (ativo por padrão).
    /// </summary>
    public async Task<bool> IsStatusAtivoAsync(
        TipoEntidadeStatus tipoEntidade,
        string status,
        CancellationToken ct = default)
    {
        var config = await db.SlaStatusConfigs
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.TipoEntidade == tipoEntidade && x.Status == status, ct);

        return config is null || config.Ativo;
    }

    /// <summary>
    /// Retorna o status efetivo a ser usado para uma transição.
    /// Se <paramref name="targetStatus"/> estiver inativo, avança pelo <paramref name="fluxo"/>
    /// até encontrar o próximo status ativo. Retorna o original se não encontrar substituto.
    /// </summary>
    public async Task<string> GetStatusEfetivoAsync(
        TipoEntidadeStatus tipoEntidade,
        string targetStatus,
        IReadOnlyList<string> fluxo,
        CancellationToken ct = default)
    {
        if (await IsStatusAtivoAsync(tipoEntidade, targetStatus, ct))
            return targetStatus;

        bool found = false;
        foreach (var s in fluxo)
        {
            if (!found)
            {
                if (s == targetStatus) found = true;
                continue;
            }
            if (await IsStatusAtivoAsync(tipoEntidade, s, ct))
                return s;
        }

        return targetStatus;
    }

    /// <summary>
    /// Registra transição com informações explícitas do autor.
    /// Use quando o chamador já tem o nome e IDs resolvidos.
    /// </summary>
    public async Task RegistrarAsync(
        TipoEntidadeStatus tipoEntidade,
        Guid entidadeId,
        string statusAnterior,
        string statusNovo,
        Guid? funcionarioId,
        Guid? userId,
        string alteradoPorNome,
        string? observacao = null,
        CancellationToken ct = default)
    {
        var config = await db.SlaStatusConfigs
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.TipoEntidade == tipoEntidade && x.Status == statusAnterior && x.Ativo,
                ct);

        var ultimaEntrada = await db.HistoricosStatus
            .AsNoTracking()
            .Where(x => x.TipoEntidade == tipoEntidade
                        && x.EntidadeId == entidadeId
                        && x.StatusNovo == statusAnterior)
            .OrderByDescending(x => x.AlteradoEmUtc)
            .FirstOrDefaultAsync(ct);

        var agora = DateTimeOffset.UtcNow;

        double? tempoHoras = ultimaEntrada is not null
            ? (agora - ultimaEntrada.AlteradoEmUtc).TotalHours
            : null;

        bool? dentroDoSla = config is not null && tempoHoras is not null
            ? tempoHoras <= config.SlaHoras
            : null;

        db.HistoricosStatus.Add(new HistoricoStatus
        {
            Id = Guid.NewGuid(),
            TenantId = tenantContext.TenantId,
            TipoEntidade = tipoEntidade,
            EntidadeId = entidadeId,
            StatusAnterior = statusAnterior,
            StatusNovo = statusNovo,
            AlteradoPorFuncionarioId = funcionarioId,
            AlteradoPorUserId = userId,
            AlteradoPorNome = alteradoPorNome,
            AlteradoEmUtc = agora,
            SlaEsperadoHoras = config?.SlaHoras,
            TempoNoStatusAnteriorHoras = tempoHoras,
            DentroDoSla = dentroDoSla,
            Observacao = observacao,
        });
    }
}
