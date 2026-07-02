using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using Microsoft.Extensions.Logging;
using Moq;
using RhPortal.Api.Application.Common;
using RhPortal.Api.Application.ProjetosVaga;
using RhPortal.Api.Application.Vagas;
using RhPortal.Api.Application.WorkflowRH;
using RhPortal.Api.Contracts.Vagas;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Tenancy;
using RHPortal.Api.Domain.Enums;
using Xunit;

namespace RhPortal.Api.Tests.Vagas;

public sealed class VagaLocalServiceTests
{
    private const string TenantTeste = "tenant-teste";

    private static (AppDbContext Db, VagaService Service) CriarServico(string tenantId = TenantTeste)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(tenantId);

        var db = new AppDbContext(options, tenantMock.Object);

        var localizer = new Mock<IStringLocalizer<ServiceMessages>>();
        localizer.Setup(x => x[It.IsAny<string>()]).Returns<string>(k => new LocalizedString(k, k));

        var userContext = new Mock<ICurrentUserContext>();
        userContext.Setup(x => x.IsReadOnly).Returns(false);
        userContext.Setup(x => x.IsAdmin).Returns(true);
        userContext.Setup(x => x.VagasDataScope).Returns(VagasDataScope.All);
        userContext.Setup(x => x.UserId).Returns((Guid?)null);

        var logger = new Mock<ILogger<VagaService>>();
        var workflowRh = new Mock<IWorkflowRHService>();
        var projetoVaga = new Mock<IProjetoVagaService>();
        var statusHistorico = new StatusHistoricoService(db, tenantMock.Object);
        var service = new VagaService(
            db,
            tenantMock.Object,
            logger.Object,
            localizer.Object,
            userContext.Object,
            workflowRh.Object,
            statusHistorico,
            projetoVaga.Object);
        return (db, service);
    }

    private static Guid SeedCentroCusto(AppDbContext db, string tenantId = TenantTeste)
    {
        var cc = new CentroCusto
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Code = "TI",
            Description = "Tecnologia",
            IsActive = true,
        };
        db.CentrosCusto.Add(cc);
        db.SaveChanges();
        return cc.Id;
    }

    private static (Guid EmpresaId, Guid UnitId) SeedEmpresaUnit(AppDbContext db, string tenantId = TenantTeste)
    {
        var empresa = new Empresa
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Code = "EMP-001",
            Description = "Render Indústria S.A.",
            IsActive = true,
        };
        var unit = new Unit
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Code = "UNI-003",
            Name = "Fábrica 1 — Guarulhos",
            Status = UnitStatus.Active,
            EmpresaId = empresa.Id,
            ZipCode = "07034-000",
            AddressLine = "Av. Industrial, 1200",
            Neighborhood = "Jardim Industrial",
            City = "Guarulhos",
            Uf = "SP",
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        db.Empresas.Add(empresa);
        db.Set<Unit>().Add(unit);
        db.SaveChanges();
        return (empresa.Id, unit.Id);
    }

    private static VagaCreateRequest RequestBase(Guid centroCustoId, VagaModalidade? modalidade = null, VagaStatus status = VagaStatus.Rascunho) =>
        new(
            Titulo: "Analista",
            Status: status,
            Codigo: null,
            AreaTime: null,
            Modalidade: modalidade,
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
            Uf: null,
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

    [Fact]
    public async Task Create_PresencialAberta_SemUnitId_LancaExcecao()
    {
        var (db, svc) = CriarServico();
        var ccId = SeedCentroCusto(db);
        var request = RequestBase(ccId, VagaModalidade.Presencial, VagaStatus.Aberta);

        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.CreateAsync(request, CancellationToken.None));
    }

    [Fact]
    public async Task Create_RemotaAberta_SemUnitId_Permitido()
    {
        var (db, svc) = CriarServico();
        var ccId = SeedCentroCusto(db);
        var request = RequestBase(ccId, VagaModalidade.Remoto, VagaStatus.Aberta);

        var result = await svc.CreateAsync(request, CancellationToken.None);

        Assert.Null(result.UnitId);
    }

    [Fact]
    public async Task Create_ComUnitId_SincronizaEndereco()
    {
        var (db, svc) = CriarServico();
        var ccId = SeedCentroCusto(db);
        var (empresaId, unitId) = SeedEmpresaUnit(db);
        var request = RequestBase(ccId, VagaModalidade.Presencial, VagaStatus.Rascunho) with
        {
            EmpresaId = empresaId,
            UnitId = unitId,
        };

        var result = await svc.CreateAsync(request, CancellationToken.None);

        Assert.Equal(unitId, result.UnitId);
        Assert.Equal(empresaId, result.EmpresaId);
        Assert.Equal("07034-000", result.Cep);
        Assert.Equal("Guarulhos", result.Cidade);
        Assert.Equal("SP", result.Uf);
    }

    [Fact]
    public async Task Create_UnitDeOutraEmpresa_LancaExcecao()
    {
        var (db, svc) = CriarServico();
        var ccId = SeedCentroCusto(db);
        var (_, unitId) = SeedEmpresaUnit(db);
        var outraEmpresa = new Empresa
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            Code = "EMP-999",
            Description = "Outra",
            IsActive = true,
        };
        db.Empresas.Add(outraEmpresa);
        db.SaveChanges();

        var request = RequestBase(ccId) with { EmpresaId = outraEmpresa.Id, UnitId = unitId };

        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.CreateAsync(request, CancellationToken.None));
    }
}
