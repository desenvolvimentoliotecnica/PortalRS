using Microsoft.EntityFrameworkCore;
using Moq;
using RhPortal.Api.Application.Vagas;
using RhPortal.Api.Contracts.Vagas;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using RHPortal.Api.Domain.Enums;
using Xunit;

namespace RhPortal.Api.Tests.Vagas;

public sealed class VagaPipelineServiceTests
{
    private const string TenantTeste = "tenant-pipeline";

    private static (AppDbContext Db, VagaPipelineService Service) CriarServico()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantTeste);

        var db = new AppDbContext(options, tenantMock.Object);
        var service = new VagaPipelineService(db);
        return (db, service);
    }

    private static RHPortal.Api.Domain.Entities.Vaga SeedVaga(
        AppDbContext db,
        VagaStatus status = VagaStatus.Aberta,
        VagaOrigemTipo origem = VagaOrigemTipo.AumentoQuadro,
        int ciclosAusente = 0,
        VagaPublicacaoVisibilidade? visibilidade = null,
        bool canalSite = false,
        bool isEstrutural = false,
        string? codigo = null,
        DateTimeOffset? dataAbertura = null)
    {
        var v = new RHPortal.Api.Domain.Entities.Vaga
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            Titulo = "Vaga teste " + Guid.NewGuid().ToString("N").Substring(0, 6),
            Codigo = codigo,
            Status = status,
            OrigemTipo = origem,
            CiclosAusenteRm = ciclosAusente,
            Visibilidade = visibilidade,
            CanalSiteCarreiras = canalSite,
            IsEstrutural = isEstrutural,
            DataAbertura = dataAbertura,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        db.Vagas.Add(v);
        db.SaveChanges();
        return v;
    }

    private static void SeedCandidatura(AppDbContext db, Guid vagaId, EtapaMacroCandidatura etapa, CandidaturaStatus status = CandidaturaStatus.Ativa)
    {
        var candidatoId = Guid.NewGuid();
        db.Candidatos.Add(new Candidato
        {
            Id = candidatoId,
            TenantId = TenantTeste,
            Nome = "Cand " + candidatoId.ToString("N").Substring(0, 6),
            Email = $"c{candidatoId.ToString("N").Substring(0, 6)}@ex.com",
        });
        db.Candidaturas.Add(new Candidatura
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            CandidatoId = candidatoId,
            VagaId = vagaId,
            Status = status,
            EtapaMacro = etapa,
            AplicadaEmUtc = DateTimeOffset.UtcNow,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        });
        db.SaveChanges();
    }

    [Fact]
    public async Task Vaga_RM_RecemSync_SemCandidatos_Cai_Em_ColunaUm()
    {
        var (db, svc) = CriarServico();
        SeedVaga(db, status: VagaStatus.Aberta, origem: VagaOrigemTipo.AumentoQuadro, codigo: "VAGA-001");

        var result = await svc.ListarAsync(new VagaPipelineFiltros(null, null, null), default);

        Assert.Equal(1, result.Total);
        var col1 = result.Colunas.Single(c => c.Estagio == VagaPipelineService.EstagioRecemSync);
        Assert.Equal(1, col1.Total);
    }

    [Fact]
    public async Task Vaga_Com_Visibilidade_Externa_E_Canal_Sem_Candidato_Cai_Em_ColunaDois()
    {
        var (db, svc) = CriarServico();
        SeedVaga(db,
            status: VagaStatus.Aberta,
            visibilidade: VagaPublicacaoVisibilidade.Externa,
            canalSite: true);

        var result = await svc.ListarAsync(new VagaPipelineFiltros(null, null, null), default);

        var col2 = result.Colunas.Single(c => c.Estagio == VagaPipelineService.EstagioEmDivulgacao);
        Assert.Equal(1, col2.Total);
    }

    [Fact]
    public async Task Vaga_Com_Candidato_Aplicado_Cai_Em_ColunaTres()
    {
        var (db, svc) = CriarServico();
        var v = SeedVaga(db);
        SeedCandidatura(db, v.Id, EtapaMacroCandidatura.Aplicada);

        var result = await svc.ListarAsync(new VagaPipelineFiltros(null, null, null), default);

        var col3 = result.Colunas.Single(c => c.Estagio == VagaPipelineService.EstagioRecrutamentoAtivo);
        Assert.Equal(1, col3.Total);
    }

    [Fact]
    public async Task Vaga_Com_Candidato_Em_Triagem_Cai_Em_ColunaQuatro()
    {
        var (db, svc) = CriarServico();
        var v = SeedVaga(db);
        SeedCandidatura(db, v.Id, EtapaMacroCandidatura.EmTriagem);

        var result = await svc.ListarAsync(new VagaPipelineFiltros(null, null, null), default);

        var col4 = result.Colunas.Single(c => c.Estagio == VagaPipelineService.EstagioEmSelecao);
        Assert.Equal(1, col4.Total);
    }

    [Fact]
    public async Task Vaga_Com_Candidato_Em_Proposta_E_Outro_Em_Aplicada_Vai_Para_ColunaCinco()
    {
        var (db, svc) = CriarServico();
        var v = SeedVaga(db);
        SeedCandidatura(db, v.Id, EtapaMacroCandidatura.Proposta);
        SeedCandidatura(db, v.Id, EtapaMacroCandidatura.Aplicada);

        var result = await svc.ListarAsync(new VagaPipelineFiltros(null, null, null), default);

        var col5 = result.Colunas.Single(c => c.Estagio == VagaPipelineService.EstagioEmProposta);
        Assert.Equal(1, col5.Total);
        Assert.Equal(2, col5.Vagas[0].TotalCandidatos);
    }

    [Fact]
    public async Task Vaga_Encerrada_Cai_Em_ColunaSeis()
    {
        var (db, svc) = CriarServico();
        SeedVaga(db, status: VagaStatus.Encerrada);

        var result = await svc.ListarAsync(new VagaPipelineFiltros(null, null, null), default);

        var col6 = result.Colunas.Single(c => c.Estagio == VagaPipelineService.EstagioEncerradaOuZumbi);
        Assert.Equal(1, col6.Total);
    }

    [Fact]
    public async Task Vaga_Zumbi_Tres_Ciclos_Ausente_Cai_Em_ColunaSeis_E_Marca_IsZumbi()
    {
        var (db, svc) = CriarServico();
        SeedVaga(db, status: VagaStatus.Aberta, ciclosAusente: 3);

        var result = await svc.ListarAsync(new VagaPipelineFiltros(null, null, null), default);

        var col6 = result.Colunas.Single(c => c.Estagio == VagaPipelineService.EstagioEncerradaOuZumbi);
        Assert.Equal(1, col6.Total);
        Assert.True(col6.Vagas[0].IsZumbi);
    }

    [Fact]
    public async Task Filtro_IncluirZumbis_False_Omite_Zumbis()
    {
        var (db, svc) = CriarServico();
        SeedVaga(db, status: VagaStatus.Aberta, ciclosAusente: 5);

        var result = await svc.ListarAsync(new VagaPipelineFiltros(null, null, null, IncluirZumbis: false), default);

        Assert.Equal(0, result.Total);
    }

    [Fact]
    public async Task Filtro_Origem_Manual_Retorna_Apenas_Manuais()
    {
        var (db, svc) = CriarServico();
        SeedVaga(db, origem: VagaOrigemTipo.Manual);
        SeedVaga(db, origem: VagaOrigemTipo.AumentoQuadro);
        SeedVaga(db, origem: VagaOrigemTipo.SubstituicaoDesligamento);

        var result = await svc.ListarAsync(new VagaPipelineFiltros(VagaOrigemTipo.Manual, null, null), default);

        Assert.Equal(1, result.Total);
        Assert.Equal(VagaOrigemTipo.Manual, result.Colunas.SelectMany(c => c.Vagas).Single().Origem);
    }

    [Fact]
    public async Task Vaga_Estrutural_Nao_Aparece()
    {
        var (db, svc) = CriarServico();
        SeedVaga(db, isEstrutural: true);

        var result = await svc.ListarAsync(new VagaPipelineFiltros(null, null, null), default);

        Assert.Equal(0, result.Total);
    }

    [Fact]
    public async Task Vagas_Excluidas_Por_Status_Nao_Aparecem()
    {
        var (db, svc) = CriarServico();
        SeedVaga(db, status: VagaStatus.Rascunho);
        SeedVaga(db, status: VagaStatus.Cancelada);
        SeedVaga(db, status: VagaStatus.Preenchida);

        var result = await svc.ListarAsync(new VagaPipelineFiltros(null, null, null), default);

        Assert.Equal(0, result.Total);
    }

    [Fact]
    public async Task Resposta_Sempre_Retorna_Seis_Colunas_Mesmo_Vazias()
    {
        var (db, svc) = CriarServico();

        var result = await svc.ListarAsync(new VagaPipelineFiltros(null, null, null), default);

        Assert.Equal(6, result.Colunas.Count);
        Assert.Equal(0, result.Total);
        Assert.All(result.Colunas, c => Assert.Empty(c.Vagas));
    }
}
