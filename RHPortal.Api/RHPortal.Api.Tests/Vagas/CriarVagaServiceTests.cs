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
/// Testes de criação de vaga — garante que VagaService.CreateAsync persiste
/// corretamente com todos os campos do modelo (incluindo NomeEngessado adicionado
/// pela migration 20260318000000_AddVagaNomeEngessado).
/// </summary>
public sealed class CriarVagaServiceTests
{
    private const string TenantTeste = "tenant-teste";

    // ── factory ──────────────────────────────────────────────────────────────

    private static (AppDbContext Db, VagaService Service) CriarServico(
        string tenantId = TenantTeste,
        bool isReadOnly = false)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(tenantId);

        var db = new AppDbContext(options, tenantMock.Object);

        var localizer = new Mock<IStringLocalizer<ServiceMessages>>();
        localizer
            .Setup(x => x[It.IsAny<string>()])
            .Returns<string>(k => new LocalizedString(k, k));

        var userContext = new Mock<ICurrentUserContext>();
        userContext.Setup(x => x.IsReadOnly).Returns(isReadOnly);
        userContext.Setup(x => x.IsAdmin).Returns(true);
        userContext.Setup(x => x.VagasDataScope).Returns(VagasDataScope.All);
        userContext.Setup(x => x.UserId).Returns((Guid?)null);

        var logger = new Mock<ILogger<VagaService>>();

        var service = new VagaService(db, tenantMock.Object, logger.Object, localizer.Object, userContext.Object);

        return (db, service);
    }

    // 31.2: Area foi absorvido por CentroCusto. Nome "SeedArea" preservado para clareza semântica.
    private static Guid SeedArea(AppDbContext db, string tenantId = TenantTeste)
    {
        var cc = new CentroCusto
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Code = "TI",
            Description = "Tecnologia da Informação",
            IsActive = true
        };
        db.CentrosCusto.Add(cc);
        db.SaveChanges();
        return cc.Id;
    }

    private static VagaCreateRequest RequestMinimo(Guid centroCustoId, string titulo = "Dev Backend", string? nomeEngessado = null) =>
        new(
            Titulo: titulo,
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
            NomeEngessado: nomeEngessado,
            JobPositionId: null,
            CategoriaSalarialId: null,
            CentroCustoId: centroCustoId,
            TurnoId: null,
            UnidadeLotacaoId: null,
            EixoVagaId: null,
            TravarFaixaSalarial: false,
            Beneficios: null,
            Requisitos: null,
            Etapas: null,
            PerguntasTriagem: null);

    // ── testes ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Create_ComTituloEArea_RetornaVagaCriadaComId()
    {
        var (db, svc) = CriarServico();
        var areaId = SeedArea(db);

        var result = await svc.CreateAsync(RequestMinimo(areaId, titulo: "Engenheiro de Software"), CancellationToken.None);

        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal("Engenheiro de Software", result.Titulo);
    }

    [Fact]
    public async Task Create_StatusRascunho_DataAberturaEhNula()
    {
        var (db, svc) = CriarServico();
        var areaId = SeedArea(db);

        var result = await svc.CreateAsync(RequestMinimo(areaId), CancellationToken.None);

        Assert.Equal(VagaStatus.Rascunho, result.Status);
        Assert.Null(result.DataAbertura);
    }

    [Fact]
    public async Task Create_StatusAberta_PreencheDataAbertura()
    {
        var (db, svc) = CriarServico();
        var areaId = SeedArea(db);
        var request = RequestMinimo(areaId) with { Status = VagaStatus.Aberta };

        var result = await svc.CreateAsync(request, CancellationToken.None);

        Assert.Equal(VagaStatus.Aberta, result.Status);
        Assert.NotNull(result.DataAbertura);
    }

    [Fact]
    public async Task Create_NomeEngessado_EhPersistitoCorretamente()
    {
        // Garante que o campo NomeEngessado (adicionado pela migration
        // 20260318000000_AddVagaNomeEngessado) persiste sem erro de coluna ausente.
        var (db, svc) = CriarServico();
        var areaId = SeedArea(db);

        var result = await svc.CreateAsync(
            RequestMinimo(areaId, nomeEngessado: "Desenvolvedor Pleno"),
            CancellationToken.None);

        Assert.Equal("Desenvolvedor Pleno", result.NomeEngessado);
    }

    [Fact]
    public async Task Create_NomeEngessadoNulo_NaoCausaErro()
    {
        var (db, svc) = CriarServico();
        var areaId = SeedArea(db);

        var result = await svc.CreateAsync(RequestMinimo(areaId, nomeEngessado: null), CancellationToken.None);

        Assert.Null(result.NomeEngessado);
    }

    [Fact]
    public async Task Create_UfPreenchida_EhPersistida()
    {
        var (db, svc) = CriarServico();
        var areaId = SeedArea(db);

        var result = await svc.CreateAsync(RequestMinimo(areaId), CancellationToken.None);

        Assert.Equal("SP", result.Uf);
    }

    [Fact]
    public async Task Create_AreaInexistente_LancaInvalidOperationException()
    {
        var (_, svc) = CriarServico();
        var areaIdFake = Guid.NewGuid();

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.CreateAsync(RequestMinimo(areaIdFake), CancellationToken.None));
    }

    [Fact]
    public async Task Create_UsuarioReadOnly_LancaInvalidOperationException()
    {
        var (db, svc) = CriarServico(isReadOnly: true);
        var areaId = SeedArea(db);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.CreateAsync(RequestMinimo(areaId), CancellationToken.None));
    }

    [Fact]
    public async Task Create_PesosDefault_SaoNormalizadosParaCem()
    {
        var (db, svc) = CriarServico();
        var areaId = SeedArea(db);

        var result = await svc.CreateAsync(RequestMinimo(areaId), CancellationToken.None);

        // Com Weights=null, NormalizeWeights deve retornar 40+30+15+15=100
        Assert.Equal(100, result.Weights.Competencia + result.Weights.Experiencia
                        + result.Weights.Formacao + result.Weights.Localidade);
    }

    [Fact]
    public async Task Create_VagaCriada_PodeSerRecuperadaPorId()
    {
        var (db, svc) = CriarServico();
        var areaId = SeedArea(db);

        var created = await svc.CreateAsync(RequestMinimo(areaId, titulo: "QA Engineer"), CancellationToken.None);
        var retrieved = await svc.GetByIdAsync(created.Id, CancellationToken.None);

        Assert.NotNull(retrieved);
        Assert.Equal(created.Id, retrieved.Id);
        Assert.Equal("QA Engineer", retrieved.Titulo);
    }
}
