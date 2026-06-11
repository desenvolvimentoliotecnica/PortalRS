using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.Common;
using RhPortal.Api.Application.RmConfiguracao;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Rm;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.SolicitacoesVaga;

public sealed class SolicitacaoVagaRmIntegracaoService : ISolicitacaoVagaRmIntegracaoService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly IRmRequisicaoCreateClient _rmCreate;
    private readonly ITenantRmConfiguracaoService _rmConfiguracaoService;
    private readonly StatusHistoricoService _statusHistorico;
    private readonly ICurrentUserContext _currentUser;

    public SolicitacaoVagaRmIntegracaoService(
        AppDbContext db,
        ITenantContext tenantContext,
        IRmRequisicaoCreateClient rmCreate,
        ITenantRmConfiguracaoService rmConfiguracaoService,
        StatusHistoricoService statusHistorico,
        ICurrentUserContext currentUser)
    {
        _db = db;
        _tenantContext = tenantContext;
        _rmCreate = rmCreate;
        _rmConfiguracaoService = rmConfiguracaoService;
        _statusHistorico = statusHistorico;
        _currentUser = currentUser;
    }

    public async Task ExecutarCriacaoRequisicaoRmAsync(Guid solicitacaoVagaId, CancellationToken ct)
    {
        var entity = await _db.SolicitacoesVaga
            .Include(x => x.Solicitante)
            .Include(x => x.CentroCusto)
            .Include(x => x.Empresa)
            .Include(x => x.Unit)
            .FirstOrDefaultAsync(x => x.Id == solicitacaoVagaId, ct);

        if (entity is null)
            throw new KeyNotFoundException($"SolicitacaoVaga {solicitacaoVagaId} não encontrada.");

        var ctxTenant = _tenantContext.TenantId;
        if (!string.IsNullOrEmpty(ctxTenant) && entity.TenantId != ctxTenant)
            throw new InvalidOperationException("Tenant da solicitação não confere com o contexto atual.");

        if (entity.TipoSolicitacao is not (TipoSolicitacaoVaga.VagaNova or TipoSolicitacaoVaga.AumentoQuadro))
            throw new InvalidOperationException("A criação assíncrona de requisição RM está habilitada apenas para VagaNova e AumentoQuadro.");

        if (entity.Status is SolicitacaoStatus.Reprovada or SolicitacaoStatus.Cancelada)
            throw new InvalidOperationException($"Solicitação em estado terminal não pode ser enviada ao RM (atual: {entity.Status}).");

        if (entity.IntegracaoResultado == IntegracaoResultado.Sucesso
            && !string.IsNullOrWhiteSpace(entity.RmRequisicaoCodigo))
            return;

        RmRequisicaoPayloadBuilder.EnsureCanBuild(entity);

        var resumo = RmRequisicaoPayloadBuilder.TruncateResumo(RmRequisicaoPayloadBuilder.BuildResumoJson(entity));
        var idempotencyKey = $"{entity.TenantId}:{entity.Id:N}";
        var now = DateTimeOffset.UtcNow;

        entity.RmCriacaoSolicitadaEmUtc ??= now;
        entity.TentativasIntegracao += 1;
        entity.UltimaTentativaUtc = now;
        entity.UpdatedAtUtc = now;

        var max = Math.Max(1, (await _rmConfiguracaoService.GetCreateOptionsAsync(ct)).MaxTentativas);
        RmCreateRequisicaoOutcome outcome;

        try
        {
            outcome = await _rmCreate.EnviarOuObterJaCriadoAsync(entity, idempotencyKey, resumo, ct);
        }
        catch (Exception ex)
        {
            outcome = new RmCreateRequisicaoOutcome(false, false, null, null, ex.Message, null);
        }

        var codigoRmRetornado = !string.IsNullOrWhiteSpace(outcome.CodigoRm)
            ? outcome.CodigoRm
            : outcome is { CodColRequisicao: not null, IdReq: not null }
                ? RmPortalRequisicaoVinculo.Build(
                    RmPortalRequisicaoVinculo.TipoAumentoQuadro,
                    outcome.CodColRequisicao.Value,
                    outcome.IdReq.Value)
                : null;

        var tentativa = new SolicitacaoVagaIntegracaoTentativa
        {
            Id = Guid.NewGuid(),
            TenantId = entity.TenantId,
            SolicitacaoVagaId = entity.Id,
            TentativaEmUtc = now,
            Sucesso = outcome.Sucesso,
            PayloadResumo = resumo,
            MensagemErro = outcome.MensagemErro,
            CodigoTecnico = outcome.CodigoTecnico,
            CodigoRmRetornado = codigoRmRetornado
        };
        _db.SolicitacoesVagaIntegracaoTentativas.Add(tentativa);

        if (outcome.Sucesso)
        {
            if (!string.IsNullOrWhiteSpace(codigoRmRetornado))
                entity.RmRequisicaoCodigo = codigoRmRetornado[..Math.Min(codigoRmRetornado.Length, 120)];
            entity.RmCodColRequisicao = outcome.CodColRequisicao ?? entity.RmCodColRequisicao;
            entity.RmIdReq = outcome.IdReq ?? entity.RmIdReq;
            entity.RmCodStatus = outcome.CodStatusRm;
            entity.RmUltimaSincronizacaoUtc = now;
            entity.IntegracaoResultado = IntegracaoResultado.Sucesso;
            entity.IntegracaoMensagem = outcome.JaExistiaNoRm
                ? "Requisição já existente no RM (confirmação idempotente)."
                : "Requisição criada no RM.";
            entity.IntegradaEmUtc = now;
        }
        else
        {
            var definitiva = entity.TentativasIntegracao >= max;
            entity.IntegracaoResultado = definitiva
                ? IntegracaoResultado.FalhaDefinitiva
                : IntegracaoResultado.Falha;

            entity.IntegracaoMensagem = outcome.MensagemErro is { Length: > 2000 }
                ? outcome.MensagemErro[..2000]
                : outcome.MensagemErro;
            entity.IntegradaEmUtc = null;
        }

        await _db.SaveChangesAsync(ct);
    }
}
