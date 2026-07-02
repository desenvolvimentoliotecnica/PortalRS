using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using Microsoft.Extensions.Logging;
using Moq;
using RhPortal.Api.Application.Vagas;
using RhPortal.Api.Contracts.Vagas;
using RhPortal.Api.Domain.Entities;
using Empresa = RhPortal.Api.Domain.Entities.Empresa;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Tenancy;
using RHPortal.Api.Domain.Enums;
using Xunit;

namespace RhPortal.Api.Tests.Vagas;

/// <summary>
/// Testes de operações secundárias do VagaService — UpdateAsync, DeleteAsync,
/// ListAsync e UpdateMatchingFiltrosAsync.
/// </summary>
public sealed class VagaServiceOperacoesTests
{
    private const string TenantTeste = "tenant-teste";

    // ── factory ──────────────────────────────────────────────────────────────

    private static (AppDbContext Db, VagaService Service) CriarServico(
        bool isReadOnly = false,
        bool isAdmin = true)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantTeste);

        var db = new AppDbContext(options, tenantMock.Object);

        var localizer = new Mock<IStringLocalizer<ServiceMessages>>();
        localizer
            .Setup(x => x[It.IsAny<string>()])
            .Returns<string>(k => new LocalizedString(k, k));

        var userContext = new Mock<ICurrentUserContext>();
        userContext.Setup(x => x.IsReadOnly).Returns(isReadOnly);
        userContext.Setup(x => x.IsAdmin).Returns(isAdmin);
        userContext.Setup(x => x.VagasDataScope).Returns(VagasDataScope.All);
        userContext.Setup(x => x.UserId).Returns((Guid?)null);

        var logger = new Mock<ILogger<VagaService>>();

        var service = new VagaService(db, tenantMock.Object, logger.Object, localizer.Object, userContext.Object);
        return (db, service);
    }

    // 31.2: Area foi absorvido por CentroCusto. Mantemos o nome semântico "SeedArea" nos testes
    // para expressar o cenário ("vaga em uma determinada área organizacional"), mas o seed
    // cria CentroCusto agora. O Guid retornado é um CentroCustoId.
    private static Guid SeedArea(AppDbContext db)
    {
        var cc = new CentroCusto
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            Code = "TI",
            Description = "Tecnologia da Informação",
            IsActive = true
        };
        db.CentrosCusto.Add(cc);
        db.SaveChanges();
        return cc.Id;
    }

    private static VagaCreateRequest CriarRequest(Guid centroCustoId, string titulo = "Vaga Teste", VagaStatus status = VagaStatus.Rascunho) =>
        new(
            Titulo: titulo,
            Status: status,
            Codigo: null,
            AreaTime: null,
            Modalidade: null,
            Senioridade: null,
            QuantidadeVagas: 1,
            TipoContratacao: null,
            MatchMinimoPercentual: 0,
            Weights: null,
            MatchingFiltrosRaw: null,
            DescricaoInterna: null,
            CodigoInterno: null,
            CodigoCbo: null,
            MotivoAbertura: null,
            OrcamentoAprovado: null,
            GestorRequisitante: null,
            RecrutadorResponsavel: null,
            Prioridade: null,
            ResumoPitch: null,
            TagsResponsabilidadesRaw: null,
            TagsKeywordsRaw: null,
            Confidencial: false,
            AceitaPcd: false,
            Urgente: false,
            GeneroPreferencia: null,
            VagaAfirmativa: false,
            LinguagemInclusiva: false,
            PublicoAfirmativo: null,
            ObservacoesPcd: null,
            ProjetoNome: null,
            ProjetoClienteAreaImpactada: null,
            ProjetoPrazoPrevisto: null,
            ProjetoDescricao: null,
            Regime: null,
            CargaSemanalHoras: null,
            Escala: null,
            EscalaTrabalhoRaw: null,
            HoraEntrada: null,
            HoraSaida: null,
            Intervalo: null,
            Cep: null,
            Logradouro: null,
            Numero: null,
            Bairro: null,
            Cidade: null,
            Uf: "SP",
            PoliticaTrabalho: null,
            ObservacoesDeslocamento: null,
            Moeda: null,
            SalarioMinimo: null,
            SalarioMaximo: null,
            Periodicidade: null,
            BonusTipo: null,
            BonusPercentual: null,
            ObservacoesRemuneracao: null,
            Escolaridade: null,
            FormacaoArea: null,
            ExperienciaMinimaAnos: null,
            TagsStackRaw: null,
            TagsIdiomasRaw: null,
            Diferenciais: null,
            ObservacoesProcesso: null,
            Visibilidade: null,
            DataInicio: null,
            DataEncerramento: null,
            CanalLinkedIn: false,
            CanalSiteCarreiras: false,
            CanalIndicacao: false,
            CanalPortaisEmprego: false,
            DescricaoPublica: null,
            LgpdSolicitarConsentimentoExplicito: false,
            LgpdCompartilharCurriculoInternamente: false,
            LgpdRetencaoAtiva: false,
            LgpdRetencaoMeses: null,
            ExigeCnh: false,
            DisponibilidadeParaViagens: false,
            ChecagemAntecedentes: false,
            SlaDiasMetaFechamento: null,
            NomeEngessado: null,
            JobPositionId: null,
            CategoriaSalarialId: null,
            CentroCustoId: centroCustoId,
            TurnoId: null,
            UnidadeLotacaoId: null,
            EmpresaId: null,
            UnitId: null,
            EixoVagaId: null,
            DescricaoCargoId: null,
            PesoCompetencia: null,
            PesoExperiencia: null,
            PesoFormacao: null,
            PesoLocalidade: null,
            PesoIdioma: null,
            PesoConhecimentoTecnico: null,
            PesoVivenciaEspecifica: null,
            LocalidadeMaxDistanciaKm: null,
            TravarFaixaSalarial: false,
            Beneficios: null,
            Requisitos: null,
            Etapas: null,
            PerguntasTriagem: null);

    private static VagaUpdateRequest ToUpdateRequest(Guid centroCustoId, string titulo = "Vaga Atualizada", VagaStatus status = VagaStatus.Rascunho) =>
        new(
            Titulo: titulo,
            Status: status,
            Codigo: null,
            AreaTime: null,
            Modalidade: null,
            Senioridade: null,
            QuantidadeVagas: 2,
            TipoContratacao: null,
            MatchMinimoPercentual: 0,
            Weights: null,
            MatchingFiltrosRaw: null,
            DescricaoInterna: null,
            CodigoInterno: null,
            CodigoCbo: null,
            MotivoAbertura: null,
            OrcamentoAprovado: null,
            GestorRequisitante: null,
            RecrutadorResponsavel: null,
            Prioridade: null,
            ResumoPitch: null,
            TagsResponsabilidadesRaw: null,
            TagsKeywordsRaw: null,
            Confidencial: false,
            AceitaPcd: false,
            Urgente: false,
            GeneroPreferencia: null,
            VagaAfirmativa: false,
            LinguagemInclusiva: false,
            PublicoAfirmativo: null,
            ObservacoesPcd: null,
            ProjetoNome: null,
            ProjetoClienteAreaImpactada: null,
            ProjetoPrazoPrevisto: null,
            ProjetoDescricao: null,
            Regime: null,
            CargaSemanalHoras: null,
            Escala: null,
            EscalaTrabalhoRaw: null,
            HoraEntrada: null,
            HoraSaida: null,
            Intervalo: null,
            Cep: null,
            Logradouro: null,
            Numero: null,
            Bairro: null,
            Cidade: null,
            Uf: "SP",
            PoliticaTrabalho: null,
            ObservacoesDeslocamento: null,
            Moeda: null,
            SalarioMinimo: null,
            SalarioMaximo: null,
            Periodicidade: null,
            BonusTipo: null,
            BonusPercentual: null,
            ObservacoesRemuneracao: null,
            Escolaridade: null,
            FormacaoArea: null,
            ExperienciaMinimaAnos: null,
            TagsStackRaw: null,
            TagsIdiomasRaw: null,
            Diferenciais: null,
            ObservacoesProcesso: null,
            Visibilidade: null,
            DataInicio: null,
            DataEncerramento: null,
            CanalLinkedIn: false,
            CanalSiteCarreiras: false,
            CanalIndicacao: false,
            CanalPortaisEmprego: false,
            DescricaoPublica: null,
            LgpdSolicitarConsentimentoExplicito: false,
            LgpdCompartilharCurriculoInternamente: false,
            LgpdRetencaoAtiva: false,
            LgpdRetencaoMeses: null,
            ExigeCnh: false,
            DisponibilidadeParaViagens: false,
            ChecagemAntecedentes: false,
            SlaDiasMetaFechamento: null,
            NomeEngessado: null,
            JobPositionId: null,
            CategoriaSalarialId: null,
            CentroCustoId: centroCustoId,
            TurnoId: null,
            UnidadeLotacaoId: null,
            EmpresaId: null,
            UnitId: null,
            EixoVagaId: null,
            DescricaoCargoId: null,
            PesoCompetencia: null,
            PesoExperiencia: null,
            PesoFormacao: null,
            PesoLocalidade: null,
            PesoIdioma: null,
            PesoConhecimentoTecnico: null,
            PesoVivenciaEspecifica: null,
            LocalidadeMaxDistanciaKm: null,
            TravarFaixaSalarial: false,
            Beneficios: null,
            Requisitos: null,
            Etapas: null,
            PerguntasTriagem: null);

    // ── UpdateAsync ───────────────────────────────────────────────────────────

    [Fact]
    public async Task Update_IdInexistente_RetornaNull()
    {
        var (db, svc) = CriarServico();
        var areaId = SeedArea(db);

        var result = await svc.UpdateAsync(Guid.NewGuid(), ToUpdateRequest(areaId), CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task Update_PerfilReadOnly_LancaInvalidOperationException()
    {
        var (db, svc) = CriarServico(isReadOnly: true);
        var areaId = SeedArea(db);
        var (db2, svcNormal) = CriarServico();
        db2.CentrosCusto.Add(new CentroCusto { Id = areaId, TenantId = TenantTeste, Code = "TI", Description = "TI", IsActive = true });
        db2.SaveChanges();
        var created = await svcNormal.CreateAsync(CriarRequest(areaId), CancellationToken.None);

        // ReadOnly service deve bloquear update
        // (usa DB diferente, mas valida apenas a guarda isReadOnly)
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.UpdateAsync(created.Id, ToUpdateRequest(areaId), CancellationToken.None));
    }

    [Fact]
    public async Task Update_ComDadosValidos_AtualizaTituloEStatus()
    {
        var (db, svc) = CriarServico();
        var areaId = SeedArea(db);

        var created = await svc.CreateAsync(CriarRequest(areaId, "Vaga Original"), CancellationToken.None);

        var request = ToUpdateRequest(areaId, "Vaga Atualizada", VagaStatus.Aberta);
        var result = await svc.UpdateAsync(created.Id, request, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal("Vaga Atualizada", result.Titulo);
        Assert.Equal(VagaStatus.Aberta, result.Status);
        Assert.Equal(2, result.QuantidadeVagas);
    }

    // ── DeleteAsync ───────────────────────────────────────────────────────────

    [Fact]
    public async Task Delete_IdInexistente_RetornaFalse()
    {
        var (_, svc) = CriarServico();

        var result = await svc.DeleteAsync(Guid.NewGuid(), CancellationToken.None);

        Assert.False(result);
    }

    [Fact]
    public async Task Delete_PerfilReadOnly_LancaInvalidOperationException()
    {
        var (_, svc) = CriarServico(isReadOnly: true);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.DeleteAsync(Guid.NewGuid(), CancellationToken.None));
    }

    [Fact]
    public async Task Delete_IdExistente_RemoveERetornaTrue()
    {
        var (db, svc) = CriarServico();
        var areaId = SeedArea(db);

        var created = await svc.CreateAsync(CriarRequest(areaId), CancellationToken.None);

        var deleted = await svc.DeleteAsync(created.Id, CancellationToken.None);

        Assert.True(deleted);
        Assert.Null(await svc.GetByIdAsync(created.Id, CancellationToken.None));
    }

    // ── ListAsync ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task List_SemFiltro_RetornaVagasCriadas()
    {
        var (db, svc) = CriarServico();
        var areaId = SeedArea(db);

        await svc.CreateAsync(CriarRequest(areaId, "Vaga 1"), CancellationToken.None);
        await svc.CreateAsync(CriarRequest(areaId, "Vaga 2"), CancellationToken.None);

        var result = await svc.ListAsync(new VagaListQuery(null, null, null, null), CancellationToken.None);

        Assert.Equal(2, result.Count);
    }

    [Fact]
    public async Task List_FiltroStatus_RetornaApenasFiltradas()
    {
        var (db, svc) = CriarServico();
        var areaId = SeedArea(db);

        await svc.CreateAsync(CriarRequest(areaId, "Rascunho", VagaStatus.Rascunho), CancellationToken.None);
        await svc.CreateAsync(CriarRequest(areaId, "Aberta", VagaStatus.Aberta), CancellationToken.None);

        var result = await svc.ListAsync(new VagaListQuery(null, VagaStatus.Rascunho, null, null), CancellationToken.None);

        Assert.Equal(1, result.Count);
        Assert.All(result, item => Assert.Equal(VagaStatus.Rascunho, item.Status));
    }

    [Fact]
    public async Task List_FiltroCentroCusto_RetornaApenasVagasDoCc()
    {
        var (db, svc) = CriarServico();
        var area1 = SeedArea(db);
        var area2 = new CentroCusto { Id = Guid.NewGuid(), TenantId = TenantTeste, Code = "RH", Description = "RH", IsActive = true };
        db.CentrosCusto.Add(area2);
        db.SaveChanges();

        await svc.CreateAsync(CriarRequest(area1, "Vaga TI"), CancellationToken.None);
        await svc.CreateAsync(CriarRequest(area2.Id, "Vaga RH"), CancellationToken.None);

        var result = await svc.ListAsync(new VagaListQuery(null, null, area1, null), CancellationToken.None);

        Assert.Equal(1, result.Count);
        Assert.Equal(area1, result[0].CentroCustoId);
    }

    // ── UpdateMatchingFiltrosAsync ─────────────────────────────────────────────

    [Fact]
    public async Task UpdateMatchingFiltros_FiltrosNulos_LancaInvalidOperationException()
    {
        var (_, svc) = CriarServico();

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.UpdateMatchingFiltrosAsync(Guid.NewGuid(), null, CancellationToken.None));
    }

    [Fact]
    public async Task UpdateMatchingFiltros_IdInexistente_RetornaNull()
    {
        var (_, svc) = CriarServico();

        var result = await svc.UpdateMatchingFiltrosAsync(
            Guid.NewGuid(), "{\"seniority\":\"senior\"}", CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task UpdateMatchingFiltros_IdExistente_AtualizaFiltros()
    {
        var (db, svc) = CriarServico();
        var areaId = SeedArea(db);

        var created = await svc.CreateAsync(CriarRequest(areaId), CancellationToken.None);
        var filtros = "{\"seniority\":\"senior\",\"skills\":[\"C#\"]}";

        var result = await svc.UpdateMatchingFiltrosAsync(created.Id, filtros, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(filtros, result.MatchingFiltrosRaw);
    }

    [Fact]
    public async Task GetByIdAsync_sem_cidade_na_vaga_herda_da_empresa_do_centro_custo()
    {
        var (db, svc) = CriarServico();
        var empresa = new Empresa
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            Code = "001",
            Description = "Matriz",
            Cidade = "Jundiaí",
            Uf = "SP",
        };
        var ccId = Guid.NewGuid();
        db.Empresas.Add(empresa);
        db.CentrosCusto.Add(new CentroCusto
        {
            Id = ccId,
            TenantId = TenantTeste,
            Code = "01.11.023.002",
            Description = "GESTAO SISTEMAS",
            EmpresaId = empresa.Id,
            IsActive = true,
        });
        var vagaId = Guid.NewGuid();
        db.Vagas.Add(new Vaga
        {
            Id = vagaId,
            TenantId = TenantTeste,
            Titulo = "Analista Infra",
            Status = VagaStatus.Aberta,
            CentroCustoId = ccId,
            Cidade = null,
            Uf = null,
            QuantidadeVagas = 1,
        });
        await db.SaveChangesAsync();

        var result = await svc.GetByIdAsync(vagaId, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal("Jundiaí", result.Cidade);
        Assert.Equal("SP", result.Uf);
    }
}
