using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Moq;
using RhPortal.Api.Application.Common;
using RhPortal.Api.Application.Pessoas;
using RhPortal.Api.Application.SolicitacoesVaga;
using RhPortal.Api.Application.Vagas;
using RhPortal.Api.Contracts.SolicitacoesVaga;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Notifications;
using RhPortal.Api.Infrastructure.Tenancy;
using RHPortal.Api.Domain.Enums;
using Xunit;

namespace RhPortal.Api.Tests.SolicitacoesVaga;

/// <summary>
/// Testes do SolicitacaoVagaService — cobertura de fluxo completo de aprovação
/// de vagas: criação, submissão, aprovação, reprovação, solicitação de ajustes e exclusão.
/// Garante que guards de negócio (ReadOnly, transições de status) funcionam corretamente.
/// </summary>
public sealed class SolicitacaoVagaServiceTests
{
    private const string TenantTeste = "tenant-teste";

    // ── factory ──────────────────────────────────────────────────────────────

    private static (AppDbContext Db, SolicitacaoVagaService Service, Mock<IVagaService> VagaMock)
        CriarServico(bool isReadOnly = false, bool isAdmin = true)
    {
        var appOptions = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantTeste);

        var db = new AppDbContext(appOptions, tenantMock.Object);

        // MasterDbContext — necessário para NotificationPublisher (apenas usado em
        // PublishToAllTenantsAsync, que não é chamado neste serviço)
        var masterOptions = new DbContextOptionsBuilder<MasterDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var masterDb = new MasterDbContext(masterOptions);

        // Hub SignalR mockado — as notificações só são enviadas se o Funcionario
        // do aprovador existir no DB, o que não acontece nos testes unitários
        var hubCtx = new Mock<IHubContext<NotificationsHub>>();
        var hubClients = new Mock<IHubClients>();
        var clientProxy = new Mock<IClientProxy>();
        hubCtx.Setup(x => x.Clients).Returns(hubClients.Object);
        hubClients.Setup(x => x.Group(It.IsAny<string>())).Returns(clientProxy.Object);
        clientProxy
            .Setup(x => x.SendCoreAsync(
                It.IsAny<string>(), It.IsAny<object[]>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var notifications = new NotificationPublisher(db, masterDb, hubCtx.Object);

        var vagaMock = new Mock<IVagaService>();
        var currentUserMock = new Mock<ICurrentUserContext>();
        currentUserMock.Setup(x => x.IsReadOnly).Returns(isReadOnly);
        currentUserMock.Setup(x => x.IsAdmin).Returns(isAdmin);
        currentUserMock.Setup(x => x.VagasDataScope).Returns(VagasDataScope.All);
        currentUserMock.Setup(x => x.UserId).Returns((Guid?)null);

        var pessoaMock = new Mock<IPessoaService>();
        var workflow = new ApprovalWorkflowHelper(db, tenantMock.Object, notifications);
        var workflowRHMock = new Mock<RhPortal.Api.Application.WorkflowRH.IWorkflowRHService>();

        var service = new SolicitacaoVagaService(
            db, tenantMock.Object, vagaMock.Object, currentUserMock.Object,
            pessoaMock.Object, notifications, workflow, workflowRHMock.Object);

        return (db, service, vagaMock);
    }

    /// <summary>Seed de um Funcionario mínimo válido no DB.</summary>
    private static Guid SeedFuncionario(AppDbContext db, Guid? userId = null)
    {
        var f = new Funcionario
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            Name = "Solicitante Teste",
            Email = "solicitante@teste.com",
            Status = FuncionarioStatus.Active,
            UserId = userId,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        db.Funcionarios.Add(f);
        db.SaveChanges();
        return f.Id;
    }

    /// <summary>
    /// Seed direto de SolicitacaoVaga (bypassa validações do serviço para preparar estado).
    /// </summary>
    private static Guid SeedSolicitacao(
        AppDbContext db,
        Guid solicitanteId,
        SolicitacaoStatus status,
        Guid? aprovadorId = null,
        Guid? areaId = null)
    {
        var entity = new SolicitacaoVaga
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            SolicitanteId = solicitanteId,
            AprovadorId = aprovadorId,
            Titulo = "Vaga Teste",
            Justificativa = "Justificativa",
            QtdPosicoes = 1,
            Urgencia = SolicitacaoVagaUrgencia.Media,
            Status = status,
            TipoSolicitacao = TipoSolicitacaoVaga.VagaNova,
            IsConfidencial = false,
            CentroCustoId = areaId,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        db.SolicitacoesVaga.Add(entity);
        db.SaveChanges();
        return entity.Id;
    }

    private static void SeedEtapaPendente(AppDbContext db, Guid solicitacaoId, Guid? aprovadorId = null)
    {
        db.SolicitacoesAprovacaoEtapa.Add(new SolicitacaoAprovacaoEtapa
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            SolicitacaoId = solicitacaoId,
            TipoFluxo = TipoFluxoAprovacao.RequisicaoPessoal,
            Ordem = 1,
            Label = "Aprovacao",
            AprovadorId = aprovadorId,
            Status = StatusAprovacao.Pendente,
            AcaoEtapa = AcaoEtapa.Nenhuma,
            MomentoAcao = MomentoAcao.AoChegar,
        });
        db.SaveChanges();
    }

    // ── Criação ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Create_UsuarioReadOnly_LancaInvalidOperationException()
    {
        var (db, svc, _) = CriarServico(isReadOnly: true);
        var funcId = SeedFuncionario(db);

        var request = new SolicitacaoVagaCreateRequest
        {
            Titulo = "Vaga Bloqueada",
            QtdPosicoes = 1,
            Urgencia = SolicitacaoVagaUrgencia.Baixa,
            TipoSolicitacao = TipoSolicitacaoVaga.VagaNova,
        };

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.CreateAsync(request, funcId, CancellationToken.None));
    }

    [Fact]
    public async Task Create_ComSolicitanteIdExistente_CriaEmRascunho()
    {
        var (db, svc, _) = CriarServico();
        var funcId = SeedFuncionario(db);

        var request = new SolicitacaoVagaCreateRequest
        {
            Titulo = "Dev Backend",
            QtdPosicoes = 2,
            Urgencia = SolicitacaoVagaUrgencia.Alta,
            TipoSolicitacao = TipoSolicitacaoVaga.VagaNova,
            IsConfidencial = true,
        };

        var result = await svc.CreateAsync(request, funcId, CancellationToken.None);

        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal("Dev Backend", result.Titulo);
        Assert.Equal(SolicitacaoStatus.Rascunho, result.Status);
        Assert.Equal(2, result.QtdPosicoes);
        Assert.Equal(funcId, result.SolicitanteId);
        Assert.True(result.IsConfidencial);
    }

    [Fact]
    public async Task Create_QtdPosicoesMenorQueUm_NormalizaParaUm()
    {
        var (db, svc, _) = CriarServico();
        var funcId = SeedFuncionario(db);

        var request = new SolicitacaoVagaCreateRequest
        {
            Titulo = "Vaga Qtd Zero",
            QtdPosicoes = 0,
            Urgencia = SolicitacaoVagaUrgencia.Baixa,
            TipoSolicitacao = TipoSolicitacaoVaga.VagaNova,
        };

        var result = await svc.CreateAsync(request, funcId, CancellationToken.None);

        Assert.Equal(1, result.QtdPosicoes);
    }

    // ── Atualização ───────────────────────────────────────────────────────────

    [Fact]
    public async Task Update_EmRascunho_AtualizaDados()
    {
        var (db, svc, _) = CriarServico();
        var funcId = SeedFuncionario(db);
        var id = SeedSolicitacao(db, funcId, SolicitacaoStatus.Rascunho);

        var updateRequest = new SolicitacaoVagaUpdateRequest
        {
            Titulo = "Título Atualizado",
            QtdPosicoes = 3,
            Urgencia = SolicitacaoVagaUrgencia.Critica,
            TipoSolicitacao = TipoSolicitacaoVaga.Substituicao,
            IsConfidencial = true,
        };

        var result = await svc.UpdateAsync(id, updateRequest, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal("Título Atualizado", result.Titulo);
        Assert.Equal(3, result.QtdPosicoes);
        Assert.Equal(SolicitacaoVagaUrgencia.Critica, result.Urgencia);
        Assert.True(result.IsConfidencial);
    }

    [Fact]
    public async Task Update_EmStatusAprovada_LancaInvalidOperationException()
    {
        var (db, svc, _) = CriarServico();
        var funcId = SeedFuncionario(db);
        var id = SeedSolicitacao(db, funcId, SolicitacaoStatus.Aprovada);

        var updateRequest = new SolicitacaoVagaUpdateRequest
        {
            Titulo = "Tentativa inválida",
            QtdPosicoes = 1,
            Urgencia = SolicitacaoVagaUrgencia.Baixa,
            TipoSolicitacao = TipoSolicitacaoVaga.VagaNova,
        };

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.UpdateAsync(id, updateRequest, CancellationToken.None));
    }

    // ── Submissão ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task Submit_RascunhoComAprovadorIdFallback_TransicionaParaPendenteAprovacao()
    {
        // Configuração explícita de etapa fixa para garantir aprovador resolvido
        var (db, svc, _) = CriarServico();
        var funcId = SeedFuncionario(db);
        var aprovadorFakeId = SeedFuncionario(db, Guid.NewGuid());
        db.Set<EtapaConfigAprovacao>().Add(new EtapaConfigAprovacao
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            TipoFluxo = TipoFluxoAprovacao.RequisicaoPessoal,
            Ordem = 1,
            Label = "Aprovacao",
            TipoAprovador = TipoAprovador.FuncionarioFixo,
            FuncionarioFixoId = aprovadorFakeId,
            Ativo = true,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        });
        db.SaveChanges();
        var id = SeedSolicitacao(db, funcId, SolicitacaoStatus.Rascunho,
            aprovadorId: aprovadorFakeId);

        var result = await svc.SubmitAsync(id, CancellationToken.None);

        Assert.True(result);
        var entity = await db.SolicitacoesVaga
            .IgnoreQueryFilters()
            .FirstAsync(x => x.Id == id);
        Assert.Equal(SolicitacaoStatus.PendenteAprovacao, entity.Status);
        var etapa = await db.SolicitacoesAprovacaoEtapa.IgnoreQueryFilters()
            .FirstOrDefaultAsync(e => e.SolicitacaoId == id);
        Assert.NotNull(etapa);
        Assert.Equal(aprovadorFakeId, etapa.AprovadorId);
        Assert.Equal(StatusAprovacao.Pendente, etapa.Status);
    }

    [Fact]
    public async Task Submit_SemNenhumAprovadorConfigurado_CriaEtapaPendenteSemAprovador()
    {
        var (db, svc, _) = CriarServico();
        var funcId = SeedFuncionario(db);
        // Sem AprovadorId, sem GestorDireto, sem RegraAprovacao
        var id = SeedSolicitacao(db, funcId, SolicitacaoStatus.Rascunho, aprovadorId: null);

        var result = await svc.SubmitAsync(id, CancellationToken.None);

        Assert.True(result);
        var etapa = await db.SolicitacoesAprovacaoEtapa.IgnoreQueryFilters()
            .FirstOrDefaultAsync(e => e.SolicitacaoId == id);
        Assert.NotNull(etapa);
        Assert.Null(etapa!.AprovadorId);
        Assert.Null(etapa.RoleFilaId);
        Assert.Equal(StatusAprovacao.Pendente, etapa.Status);
    }

    [Fact]
    public async Task Submit_StatusPendenteAprovacao_LancaInvalidOperationException()
    {
        var (db, svc, _) = CriarServico();
        var funcId = SeedFuncionario(db);
        var id = SeedSolicitacao(db, funcId, SolicitacaoStatus.PendenteAprovacao);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.SubmitAsync(id, CancellationToken.None));
    }

    // ── Aprovação ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task Approve_StatusPendenteAprovacao_TransicionaParaAprovada()
    {
        var (db, svc, _) = CriarServico();
        var funcId = SeedFuncionario(db);
        // Sem AreaId → não tenta criar Vaga automaticamente
        var id = SeedSolicitacao(db, funcId, SolicitacaoStatus.PendenteAprovacao);
        SeedEtapaPendente(db, id, aprovadorId: funcId);

        var result = await svc.ApproveAsync(id, "Aprovado com excelência", CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(SolicitacaoStatus.Aprovada, result.Status);
        Assert.Equal("Aprovado com excelência", result.ObservacaoAprovador);
        Assert.NotNull(result.ApprovedAtUtc);
    }

    [Fact]
    public async Task Approve_IdInexistente_RetornaNull()
    {
        var (_, svc, _) = CriarServico();

        var result = await svc.ApproveAsync(Guid.NewGuid(), null, CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task Approve_StatusRascunho_LancaInvalidOperationException()
    {
        var (db, svc, _) = CriarServico();
        var funcId = SeedFuncionario(db);
        var id = SeedSolicitacao(db, funcId, SolicitacaoStatus.Rascunho);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.ApproveAsync(id, null, CancellationToken.None));
    }

    // ── Reprovação ────────────────────────────────────────────────────────────

    [Fact]
    public async Task Reject_StatusPendenteAprovacao_TransicionaParaReprovada()
    {
        var (db, svc, _) = CriarServico();
        var funcId = SeedFuncionario(db);
        var id = SeedSolicitacao(db, funcId, SolicitacaoStatus.PendenteAprovacao);

        var result = await svc.RejectAsync(id, "Não atende ao perfil", CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(SolicitacaoStatus.Reprovada, result.Status);
        Assert.Equal("Não atende ao perfil", result.ObservacaoAprovador);
    }

    [Fact]
    public async Task Reject_StatusRascunho_LancaInvalidOperationException()
    {
        var (db, svc, _) = CriarServico();
        var funcId = SeedFuncionario(db);
        var id = SeedSolicitacao(db, funcId, SolicitacaoStatus.Rascunho);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.RejectAsync(id, "Motivo", CancellationToken.None));
    }

    // ── Solicitação de ajustes ─────────────────────────────────────────────────

    [Fact]
    public async Task RequestChanges_StatusPendenteAprovacao_TransicionaParaAjustesNecessarios()
    {
        var (db, svc, _) = CriarServico();
        var funcId = SeedFuncionario(db);
        var id = SeedSolicitacao(db, funcId, SolicitacaoStatus.PendenteAprovacao);

        var result = await svc.RequestChangesAsync(id, "Falta justificativa", CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(SolicitacaoStatus.AjustesNecessarios, result.Status);
        Assert.Equal("Falta justificativa", result.ObservacaoAprovador);
    }

    [Fact]
    public async Task RequestChanges_StatusAprovada_LancaInvalidOperationException()
    {
        var (db, svc, _) = CriarServico();
        var funcId = SeedFuncionario(db);
        var id = SeedSolicitacao(db, funcId, SolicitacaoStatus.Aprovada);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.RequestChangesAsync(id, "Observação", CancellationToken.None));
    }

    // ── Exclusão ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task Delete_EmRascunho_RemoveERetornaTrue()
    {
        var (db, svc, _) = CriarServico();
        var funcId = SeedFuncionario(db);
        var id = SeedSolicitacao(db, funcId, SolicitacaoStatus.Rascunho);

        var result = await svc.DeleteAsync(id, CancellationToken.None);

        Assert.True(result);
        var retrieved = await svc.GetByIdAsync(id, CancellationToken.None);
        Assert.Null(retrieved);
    }

    [Fact]
    public async Task Delete_NaoEmRascunho_LancaInvalidOperationException()
    {
        var (db, svc, _) = CriarServico();
        var funcId = SeedFuncionario(db);
        var id = SeedSolicitacao(db, funcId, SolicitacaoStatus.Aprovada);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.DeleteAsync(id, CancellationToken.None));
    }

    [Fact]
    public async Task Delete_IdInexistente_RetornaFalse()
    {
        var (_, svc, _) = CriarServico();

        var result = await svc.DeleteAsync(Guid.NewGuid(), CancellationToken.None);

        Assert.False(result);
    }

    // ── Submit com AjustesNecessarios (deve funcionar) ───────────────────────

    [Fact]
    public async Task Submit_StatusAjustesNecessarios_TransicionaParaPendenteAprovacao()
    {
        // Após solicitação de ajustes, o solicitante resubmete e deve funcionar
        var (db, svc, _) = CriarServico();
        var funcId = SeedFuncionario(db);
        var aprovadorId = Guid.NewGuid();
        var id = SeedSolicitacao(db, funcId, SolicitacaoStatus.AjustesNecessarios,
            aprovadorId: aprovadorId);

        var result = await svc.SubmitAsync(id, CancellationToken.None);

        Assert.True(result);
        var entity = await db.SolicitacoesVaga
            .IgnoreQueryFilters()
            .FirstAsync(x => x.Id == id);
        Assert.Equal(SolicitacaoStatus.PendenteAprovacao, entity.Status);
    }
}
