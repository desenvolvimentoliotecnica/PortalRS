using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using Microsoft.Extensions.Logging;
using Moq;
using RhPortal.Api.Application.Vagas;
using RhPortal.Api.Contracts.Vagas;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Tenancy;
using RHPortal.Api.Domain.Enums;
using Xunit;

namespace RhPortal.Api.Tests.Vagas;

/// <summary>
/// Testes de Fase 3C — trava de faixa salarial via FaixaSalarial + alçada.
/// </summary>
public sealed class VagaFaixaSalarialTests
{
    private const string TenantTeste = "tenant-faixa";

    private static (AppDbContext Db, VagaService Service, Guid UserId) CriarServico()
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

        var userId = Guid.NewGuid();
        var userContext = new Mock<ICurrentUserContext>();
        userContext.Setup(x => x.IsReadOnly).Returns(false);
        userContext.Setup(x => x.IsAdmin).Returns(true);
        userContext.Setup(x => x.VagasDataScope).Returns(VagasDataScope.All);
        userContext.Setup(x => x.UserId).Returns(userId);

        var logger = new Mock<ILogger<VagaService>>();

        var service = new VagaService(db, tenantMock.Object, logger.Object, localizer.Object, userContext.Object);
        return (db, service, userId);
    }

    // 31.2: Area foi absorvido por CentroCusto. Nome preservado para clareza semântica.
    private static Guid SeedArea(AppDbContext db)
    {
        var cc = new CentroCusto
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            Code = "TI",
            Description = "Tecnologia",
            IsActive = true
        };
        db.CentrosCusto.Add(cc);
        db.SaveChanges();
        return cc.Id;
    }

    private static Guid SeedJobPosition(AppDbContext db)
    {
        var jp = new JobPosition
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            Code = "DEV",
            Name = "Desenvolvedor",
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        db.Set<JobPosition>().Add(jp);
        db.SaveChanges();
        return jp.Id;
    }

    private static void SeedFaixa(AppDbContext db, Guid jobPositionId, decimal min, decimal max)
    {
        db.Set<FaixaSalarial>().Add(new FaixaSalarial
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            JobPositionId = jobPositionId,
            SalarioMinimo = min,
            SalarioMaximo = max,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        });
        db.SaveChanges();
    }

    private static VagaCreateRequest RequestComSalario(
        Guid centroCustoId,
        Guid? jobPositionId,
        decimal? salarioMin,
        decimal? salarioMax,
        bool travar) =>
        new(
            Titulo: "Vaga Teste",
            Status: VagaStatus.Rascunho,
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
            SalarioMinimo: salarioMin,
            SalarioMaximo: salarioMax,
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
            JobPositionId: jobPositionId,
            CategoriaSalarialId: null,
            CentroCustoId: centroCustoId,
            TurnoId: null,
            UnidadeLotacaoId: null,
            EixoVagaId: null,
            TravarFaixaSalarial: travar,
            Beneficios: null,
            Requisitos: null,
            Etapas: null,
            PerguntasTriagem: null);

    // ── testes ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task TravarFalso_SalarioForaDaFaixa_NaoLancaExcecao()
    {
        var (db, svc, _) = CriarServico();
        var areaId = SeedArea(db);
        var jpId = SeedJobPosition(db);
        SeedFaixa(db, jpId, 5000m, 8000m);

        var req = RequestComSalario(areaId, jpId, salarioMin: 100m, salarioMax: 200m, travar: false);

        var result = await svc.CreateAsync(req, CancellationToken.None);
        Assert.NotEqual(Guid.Empty, result.Id);
    }

    [Fact]
    public async Task TravarTrue_SemJobPosition_NaoValida()
    {
        var (db, svc, _) = CriarServico();
        var areaId = SeedArea(db);

        var req = RequestComSalario(areaId, jobPositionId: null, salarioMin: 100m, salarioMax: 200m, travar: true);

        var result = await svc.CreateAsync(req, CancellationToken.None);
        Assert.NotEqual(Guid.Empty, result.Id);
    }

    [Fact]
    public async Task TravarTrue_SemFaixaCadastrada_NaoValida()
    {
        var (db, svc, _) = CriarServico();
        var areaId = SeedArea(db);
        var jpId = SeedJobPosition(db);

        var req = RequestComSalario(areaId, jpId, salarioMin: 100m, salarioMax: 200m, travar: true);

        var result = await svc.CreateAsync(req, CancellationToken.None);
        Assert.NotEqual(Guid.Empty, result.Id);
    }

    [Fact]
    public async Task TravarTrue_SalarioDentroDaFaixa_Aceita()
    {
        var (db, svc, _) = CriarServico();
        var areaId = SeedArea(db);
        var jpId = SeedJobPosition(db);
        SeedFaixa(db, jpId, 5000m, 8000m);

        var req = RequestComSalario(areaId, jpId, salarioMin: 6000m, salarioMax: 7000m, travar: true);

        var result = await svc.CreateAsync(req, CancellationToken.None);
        Assert.NotEqual(Guid.Empty, result.Id);
    }

    [Fact]
    public async Task TravarTrue_SalarioMinimoAbaixoDaFaixa_Lanca()
    {
        var (db, svc, _) = CriarServico();
        var areaId = SeedArea(db);
        var jpId = SeedJobPosition(db);
        SeedFaixa(db, jpId, 5000m, 8000m);

        var req = RequestComSalario(areaId, jpId, salarioMin: 4000m, salarioMax: 7000m, travar: true);

        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.CreateAsync(req, CancellationToken.None));
    }

    [Fact]
    public async Task TravarTrue_SalarioMaximoAcimaDaFaixa_Lanca()
    {
        var (db, svc, _) = CriarServico();
        var areaId = SeedArea(db);
        var jpId = SeedJobPosition(db);
        SeedFaixa(db, jpId, 5000m, 8000m);

        var req = RequestComSalario(areaId, jpId, salarioMin: 6000m, salarioMax: 9000m, travar: true);

        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.CreateAsync(req, CancellationToken.None));
    }

    [Fact]
    public async Task AprovarAlcada_AposViolacao_PermiteAtualizacaoComSalarioFora()
    {
        var (db, svc, userId) = CriarServico();
        var areaId = SeedArea(db);
        var jpId = SeedJobPosition(db);
        SeedFaixa(db, jpId, 5000m, 8000m);

        // Cria dentro da faixa
        var criada = await svc.CreateAsync(
            RequestComSalario(areaId, jpId, 6000m, 7000m, travar: true),
            CancellationToken.None);

        // Aprova alçada
        var aprovada = await svc.AprovarAlcadaSalarialAsync(
            criada.Id,
            justificativa: "Candidato senior fora da curva",
            observacaoAprovador: "OK para prosseguir",
            CancellationToken.None);

        Assert.NotNull(aprovada);
        Assert.Equal(userId, aprovada!.AlcadaSalarialAprovadaPorUserId);
        Assert.NotNull(aprovada.AlcadaSalarialAprovadaEmUtc);
        Assert.Equal("Candidato senior fora da curva", aprovada.AlcadaSalarialJustificativa);
    }

    [Fact]
    public async Task LimparAlcada_ZeraCamposDeAprovacao()
    {
        var (db, svc, userId) = CriarServico();
        var areaId = SeedArea(db);
        var jpId = SeedJobPosition(db);
        SeedFaixa(db, jpId, 5000m, 8000m);

        var criada = await svc.CreateAsync(
            RequestComSalario(areaId, jpId, 6000m, 7000m, travar: true),
            CancellationToken.None);

        await svc.AprovarAlcadaSalarialAsync(criada.Id, "x", "y", CancellationToken.None);
        var limpa = await svc.LimparAlcadaSalarialAsync(criada.Id, CancellationToken.None);

        Assert.NotNull(limpa);
        Assert.Null(limpa!.AlcadaSalarialAprovadaPorUserId);
        Assert.Null(limpa.AlcadaSalarialAprovadaEmUtc);
        Assert.Null(limpa.AlcadaSalarialJustificativa);
        Assert.Null(limpa.AlcadaSalarialObservacaoAprovador);
    }
}
