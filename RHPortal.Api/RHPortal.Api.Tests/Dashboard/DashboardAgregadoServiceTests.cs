using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Moq;
using RhPortal.Api.Application.Dashboard;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Configuration;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using RHPortal.Api.Domain.Entities;
using RHPortal.Api.Domain.Enums;
using Xunit;

namespace RhPortal.Api.Tests.Dashboard;

/// <summary>
/// Testes do DashboardAgregadoService (Sessão 31).
///
/// Cobertura: perfil inválido, gestor sem funcionário (seção null), queries por perfil
/// respeitando hierarquia, filtros de SLA, contagem por status, isolamento por tenant
/// (confia no query filter do AppDbContext, que é amarrado ao ITenantContext).
/// </summary>
public sealed class DashboardAgregadoServiceTests
{
    private const string TenantTeste = "tenant-teste";
    private const string OutroTenant = "tenant-outro";

    // ── factory ──────────────────────────────────────────────────────────────

    /// <summary>
    /// Cria AppDbContext isolado para tenant "tenant-teste" e o DashboardAgregadoService.
    /// </summary>
    private static (AppDbContext Db, DashboardAgregadoService Service) CriarServico()
    {
        var (db, svc, _) = CriarServicoComOutroTenant();
        return (db, svc);
    }

    /// <summary>
    /// Cria dois AppDbContexts compartilhando o mesmo InMemoryDatabase: um contextualizado
    /// ao TenantTeste (usado pelo service em teste) e outro contextualizado ao OutroTenant
    /// (só para semear dados que simulam vazamento cross-tenant). Só o segundo serve para seed
    /// — o SaveChangesAsync do AppDbContext sobrescreve TenantId com o tenantContext atual.
    /// </summary>
    private static (AppDbContext Db, DashboardAgregadoService Service, AppDbContext DbOutroTenant) CriarServicoComOutroTenant()
    {
        var dbName = Guid.NewGuid().ToString();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(dbName)
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantTeste);

        var outroTenantMock = new Mock<ITenantContext>();
        outroTenantMock.Setup(x => x.TenantId).Returns(OutroTenant);

        var db = new AppDbContext(options, tenantMock.Object);
        var dbOutro = new AppDbContext(options, outroTenantMock.Object);
        var sla = Options.Create(new SlaVagaOptions { DiasMetaFechamento = 30 });
        var service = new DashboardAgregadoService(db, sla);
        return (db, service, dbOutro);
    }

    /// <summary>
    /// AppDbContext.SaveChangesAsync sobrescreve CreatedAtUtc/UpdatedAtUtc de várias entidades
    /// para DateTimeOffset.UtcNow no estado Added. Esse helper permite backdate: salva primeiro
    /// (estado Added), depois muda CreatedAtUtc e salva de novo (estado Modified — só
    /// UpdatedAtUtc é tocado).
    /// </summary>
    private static async Task AjustarCreatedAtAsync<T>(AppDbContext db, T entity, DateTimeOffset valor)
        where T : class
    {
        var prop = typeof(T).GetProperty("CreatedAtUtc");
        prop!.SetValue(entity, valor);
        db.Entry(entity).Property("CreatedAtUtc").IsModified = true;
        await db.SaveChangesAsync();
    }

    // 31.2: Area foi absorvido por CentroCusto. Helper cria CentroCusto, mas mantém o
    // nome "NovaArea" para expressar a intenção semântica dos cenários de teste
    // (muitos dos quais verificam VagasForaSlaTop.Area e HeadcountPorArea, que são
    // contratos que preservam o nome "Area" por compatibilidade de DTO).
    private static CentroCusto NovaArea(string tenant, Guid id, string nome, string? code = null) =>
        new()
        {
            Id = id,
            TenantId = tenant,
            Code = code ?? nome.ToUpperInvariant(),
            Description = nome,
            IsActive = true,
        };

    private static Funcionario NovoFunc(string tenant, Guid id, Guid? gestor = null, Guid? centroCustoId = null, bool incomplete = false, FuncionarioStatus status = FuncionarioStatus.Active) =>
        new()
        {
            Id = id,
            TenantId = tenant,
            Name = $"Func {id.ToString()[..4]}",
            GestorDiretoId = gestor,
            CentroCustoId = centroCustoId,
            Status = status,
            HasIncompleteData = incomplete,
            CreatedAtUtc = DateTimeOffset.UtcNow.AddDays(-60),
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };

    private static Vaga NovaVaga(string tenant, Guid id, Guid centroCustoId, VagaStatus status, DateTimeOffset? dataAbertura = null, int? slaDias = null, bool isEstrutural = false) =>
        new()
        {
            Id = id,
            TenantId = tenant,
            Titulo = $"Vaga {id.ToString()[..4]}",
            Status = status,
            CentroCustoId = centroCustoId,
            DataAbertura = dataAbertura,
            SlaDiasMetaFechamento = slaDias,
            IsEstrutural = isEstrutural,
            CreatedAtUtc = DateTimeOffset.UtcNow.AddDays(-30),
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };

    // ─────────────────────────────────────────────────────────────────────────
    // Fachada
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task ObterAsync_PerfilInvalido_LancaArgumentException()
    {
        var (_, svc) = CriarServico();
        await Assert.ThrowsAsync<ArgumentException>(
            () => svc.ObterAsync("supervisor", null, CancellationToken.None));
    }

    [Fact]
    public async Task ObterAsync_PerfilVazio_LancaArgumentException()
    {
        var (_, svc) = CriarServico();
        await Assert.ThrowsAsync<ArgumentException>(
            () => svc.ObterAsync("", null, CancellationToken.None));
    }

    [Fact]
    public async Task ObterAsync_GestorSemFuncionarioId_RetornaSecaoNull()
    {
        var (_, svc) = CriarServico();

        var resp = await svc.ObterAsync("gestor", funcionarioId: null, CancellationToken.None);

        // Contrato: sem FuncionarioId, frontend recebe seção null e mostra "perfil indisponível"
        // em vez de receber 403 ou erro.
        Assert.Equal("gestor", resp.Perfil);
        Assert.Null(resp.Gestor);
        Assert.Null(resp.Rh);
        Assert.Null(resp.Diretor);
        Assert.Null(resp.FuncionarioId);
    }

    [Fact]
    public async Task ObterAsync_Rh_PreencheApenasSecaoRh()
    {
        var (_, svc) = CriarServico();
        var resp = await svc.ObterAsync("rh", null, CancellationToken.None);

        Assert.NotNull(resp.Rh);
        Assert.Null(resp.Gestor);
        Assert.Null(resp.Diretor);
    }

    [Fact]
    public async Task ObterAsync_Diretor_PreencheApenasSecaoDiretor()
    {
        var (_, svc) = CriarServico();
        var resp = await svc.ObterAsync("diretor", null, CancellationToken.None);

        Assert.NotNull(resp.Diretor);
        Assert.Null(resp.Gestor);
        Assert.Null(resp.Rh);
    }

    [Fact]
    public async Task ObterAsync_NormalizaPerfilParaMinusculas()
    {
        var (_, svc) = CriarServico();
        var resp = await svc.ObterAsync("  RH  ", null, CancellationToken.None);
        Assert.Equal("rh", resp.Perfil);
        Assert.NotNull(resp.Rh);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Gestor
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Gestor_ContaDiretosAtivosEIgnoraInativos()
    {
        var (db, svc) = CriarServico();
        var gestorId = Guid.NewGuid();
        var areaId = Guid.NewGuid();

        db.Funcionarios.Add(NovoFunc(TenantTeste, gestorId, centroCustoId: areaId));
        db.Funcionarios.Add(NovoFunc(TenantTeste, Guid.NewGuid(), gestor: gestorId, centroCustoId: areaId));
        db.Funcionarios.Add(NovoFunc(TenantTeste, Guid.NewGuid(), gestor: gestorId, centroCustoId: areaId, incomplete: true));
        db.Funcionarios.Add(NovoFunc(TenantTeste, Guid.NewGuid(), gestor: gestorId, status: FuncionarioStatus.Inactive));
        await db.SaveChangesAsync();

        var sec = await svc.ParaGestorAsync(gestorId, CancellationToken.None);

        Assert.NotNull(sec);
        Assert.Equal(2, sec!.DiretosAtivos);
        Assert.Equal(1, sec.DiretosComDadosIncompletos);
    }

    [Fact]
    public async Task Gestor_CarteiraInclueApenasVagasDasAreasDoGestorEDiretos()
    {
        var (db, svc) = CriarServico();
        var gestorId = Guid.NewGuid();
        var areaMinha = Guid.NewGuid();
        var areaDireto = Guid.NewGuid();
        var areaOutro = Guid.NewGuid();

        db.Funcionarios.Add(NovoFunc(TenantTeste, gestorId, centroCustoId: areaMinha));
        db.Funcionarios.Add(NovoFunc(TenantTeste, Guid.NewGuid(), gestor: gestorId, centroCustoId: areaDireto));

        db.Vagas.Add(NovaVaga(TenantTeste, Guid.NewGuid(), areaMinha, VagaStatus.Aberta));
        db.Vagas.Add(NovaVaga(TenantTeste, Guid.NewGuid(), areaDireto, VagaStatus.Aberta));
        db.Vagas.Add(NovaVaga(TenantTeste, Guid.NewGuid(), areaOutro, VagaStatus.Aberta)); // fora da carteira
        db.Vagas.Add(NovaVaga(TenantTeste, Guid.NewGuid(), areaMinha, VagaStatus.Rascunho)); // não-aberta
        db.Vagas.Add(NovaVaga(TenantTeste, Guid.NewGuid(), areaMinha, VagaStatus.Aberta, isEstrutural: true)); // estrutural ignora
        await db.SaveChangesAsync();

        var sec = await svc.ParaGestorAsync(gestorId, CancellationToken.None);

        Assert.NotNull(sec);
        Assert.Equal(2, sec!.CarteiraVagasAbertas);
    }

    [Fact]
    public async Task Gestor_VagasParadasContaAcimaDoSla()
    {
        var (db, svc) = CriarServico();
        var gestorId = Guid.NewGuid();
        var areaId = Guid.NewGuid();

        db.Funcionarios.Add(NovoFunc(TenantTeste, gestorId, centroCustoId: areaId));

        // Com SLA global = 30d, abaixo do prazo: 10 dias atrás.
        db.Vagas.Add(NovaVaga(TenantTeste, Guid.NewGuid(), areaId, VagaStatus.Aberta,
            dataAbertura: DateTimeOffset.UtcNow.AddDays(-10)));
        // Acima do prazo: 45 dias atrás.
        db.Vagas.Add(NovaVaga(TenantTeste, Guid.NewGuid(), areaId, VagaStatus.Aberta,
            dataAbertura: DateTimeOffset.UtcNow.AddDays(-45)));
        await db.SaveChangesAsync();

        var sec = await svc.ParaGestorAsync(gestorId, CancellationToken.None);

        Assert.NotNull(sec);
        Assert.Equal(2, sec!.CarteiraVagasAbertas);
        Assert.Equal(1, sec.CarteiraVagasParadas);
    }

    [Fact]
    public async Task Gestor_CandidaturasEtapaAvancada_ContaApenasEntrevistaTesteProposta()
    {
        var (db, svc) = CriarServico();
        var gestorId = Guid.NewGuid();
        var areaId = Guid.NewGuid();
        var vagaId = Guid.NewGuid();

        db.Funcionarios.Add(NovoFunc(TenantTeste, gestorId, centroCustoId: areaId));
        db.Vagas.Add(NovaVaga(TenantTeste, vagaId, areaId, VagaStatus.Aberta));

        var candidatoId = Guid.NewGuid();
        db.Candidatos.Add(new Candidato
        {
            Id = candidatoId,
            TenantId = TenantTeste,
            Nome = "Ana",
            Fonte = CandidateOrigin.Site,
            Status = CandidateStatus.Triagem,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        });

        foreach (var etapa in new[] { EtapaMacroCandidatura.Aplicada, EtapaMacroCandidatura.EmTriagem,
                                       EtapaMacroCandidatura.Entrevista, EtapaMacroCandidatura.Teste,
                                       EtapaMacroCandidatura.Proposta })
        {
            db.Candidaturas.Add(new Candidatura
            {
                Id = Guid.NewGuid(),
                TenantId = TenantTeste,
                CandidatoId = candidatoId,
                VagaId = vagaId,
                Status = CandidaturaStatus.Ativa,
                EtapaMacro = etapa,
                AplicadaEmUtc = DateTimeOffset.UtcNow.AddDays(-5),
                EtapaAtualDesdeUtc = DateTimeOffset.UtcNow.AddDays(-2),
                CreatedAtUtc = DateTimeOffset.UtcNow.AddDays(-5),
                UpdatedAtUtc = DateTimeOffset.UtcNow,
            });
        }
        await db.SaveChangesAsync();

        var sec = await svc.ParaGestorAsync(gestorId, CancellationToken.None);

        Assert.NotNull(sec);
        Assert.Equal(5, sec!.CarteiraCandidaturasAtivas);
        Assert.Equal(3, sec.CandidaturasEtapaAvancada); // entrevista + teste + proposta
    }

    [Fact]
    public async Task Gestor_AprovacoesPendentesMinhas_ContaApenasComigoComoAprovador()
    {
        var (db, svc) = CriarServico();
        var gestorId = Guid.NewGuid();
        var outroApr = Guid.NewGuid();
        db.Funcionarios.Add(NovoFunc(TenantTeste, gestorId));

        db.SolicitacoesAprovacaoEtapa.Add(new SolicitacaoAprovacaoEtapa
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            SolicitacaoId = Guid.NewGuid(),
            TipoFluxo = TipoFluxoAprovacao.RequisicaoPessoal,
            AprovadorId = gestorId,
            Status = StatusAprovacao.Pendente,
            Ordem = 1,
        });
        db.SolicitacoesAprovacaoEtapa.Add(new SolicitacaoAprovacaoEtapa
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            SolicitacaoId = Guid.NewGuid(),
            TipoFluxo = TipoFluxoAprovacao.RequisicaoPessoal,
            AprovadorId = gestorId,
            Status = StatusAprovacao.Aprovado, // não conta
            Ordem = 2,
        });
        db.SolicitacoesAprovacaoEtapa.Add(new SolicitacaoAprovacaoEtapa
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            SolicitacaoId = Guid.NewGuid(),
            TipoFluxo = TipoFluxoAprovacao.RequisicaoPessoal,
            AprovadorId = outroApr, // outro aprovador
            Status = StatusAprovacao.Pendente,
            Ordem = 3,
        });
        await db.SaveChangesAsync();

        var sec = await svc.ParaGestorAsync(gestorId, CancellationToken.None);

        Assert.NotNull(sec);
        Assert.Equal(1, sec!.AprovacoesPendentesMinhas);
    }

    [Fact]
    public async Task Gestor_AvaliacoesDiretosPendentes_ContaApenasMeusDiretos()
    {
        var (db, svc) = CriarServico();
        var gestorId = Guid.NewGuid();
        var diretoId = Guid.NewGuid();
        var estranhoId = Guid.NewGuid();
        var cicloId = Guid.NewGuid();

        db.Funcionarios.Add(NovoFunc(TenantTeste, gestorId));
        db.Funcionarios.Add(NovoFunc(TenantTeste, diretoId, gestor: gestorId));
        db.Funcionarios.Add(NovoFunc(TenantTeste, estranhoId));

        db.AvaliacaoCiclos.Add(new AvaliacaoCiclo
        {
            Id = cicloId,
            TenantId = TenantTeste,
            Nome = "Q1",
            Periodo = "2026-Q1",
            Status = AvaliacaoCicloStatus.Aberto,
            CriadoPorId = gestorId,
            CriadoEmUtc = DateTimeOffset.UtcNow,
            AtualizadoEmUtc = DateTimeOffset.UtcNow,
        });

        // Convite para direto: conta
        db.AvaliacaoConvites.Add(new AvaliacaoConvite
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            CicloId = cicloId,
            AvaliadorId = gestorId,
            AvaliandoId = diretoId,
            Tipo = AvaliacaoConviteTipo.GestorParaDireto,
            Status = AvaliacaoConviteStatus.Pendente,
            CriadoEmUtc = DateTimeOffset.UtcNow,
        });
        // Convite para estranho: não conta (não é meu direto)
        db.AvaliacaoConvites.Add(new AvaliacaoConvite
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            CicloId = cicloId,
            AvaliadorId = gestorId,
            AvaliandoId = estranhoId,
            Tipo = AvaliacaoConviteTipo.GestorParaDireto,
            Status = AvaliacaoConviteStatus.Pendente,
            CriadoEmUtc = DateTimeOffset.UtcNow,
        });
        // Convite respondido: não conta
        db.AvaliacaoConvites.Add(new AvaliacaoConvite
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            CicloId = cicloId,
            AvaliadorId = gestorId,
            AvaliandoId = diretoId,
            Tipo = AvaliacaoConviteTipo.GestorParaDireto,
            Status = AvaliacaoConviteStatus.Respondido,
            CriadoEmUtc = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var sec = await svc.ParaGestorAsync(gestorId, CancellationToken.None);

        Assert.NotNull(sec);
        Assert.Equal(1, sec!.AvaliacoesDiretosPendentes);
    }

    [Fact]
    public async Task Gestor_SemDiretosEAreas_RetornaZerosSemExplodir()
    {
        var (db, svc) = CriarServico();
        var gestorId = Guid.NewGuid();
        db.Funcionarios.Add(NovoFunc(TenantTeste, gestorId));
        await db.SaveChangesAsync();

        var sec = await svc.ParaGestorAsync(gestorId, CancellationToken.None);

        Assert.NotNull(sec);
        Assert.Equal(0, sec!.DiretosAtivos);
        Assert.Equal(0, sec.CarteiraVagasAbertas);
        Assert.Equal(0, sec.CandidaturasEtapaAvancada);
        Assert.Equal(0, sec.AvaliacoesDiretosPendentes);
        Assert.Equal(0, sec.SolicitacoesEquipePendentes);
        Assert.Empty(sec.VagasMaisAntigas);
        Assert.Empty(sec.CandidaturasEmDestaque);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RH
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Rh_VagasAbertas_IgnoraEstruturalEFechadas()
    {
        var (db, svc) = CriarServico();
        var areaId = Guid.NewGuid();

        db.Vagas.Add(NovaVaga(TenantTeste, Guid.NewGuid(), areaId, VagaStatus.Aberta));
        db.Vagas.Add(NovaVaga(TenantTeste, Guid.NewGuid(), areaId, VagaStatus.Aberta));
        db.Vagas.Add(NovaVaga(TenantTeste, Guid.NewGuid(), areaId, VagaStatus.Aberta, isEstrutural: true));
        db.Vagas.Add(NovaVaga(TenantTeste, Guid.NewGuid(), areaId, VagaStatus.Encerrada));
        db.Vagas.Add(NovaVaga(TenantTeste, Guid.NewGuid(), areaId, VagaStatus.Rascunho));
        await db.SaveChangesAsync();

        var sec = await svc.ParaRhAsync(CancellationToken.None);

        Assert.Equal(2, sec.VagasAbertas);
        Assert.Equal(1, sec.VagasRascunho);
    }

    [Fact]
    public async Task Rh_VagasForaSla_ListaOrdenadaDecrescente()
    {
        var (db, svc) = CriarServico();
        var areaId = Guid.NewGuid();
        db.CentrosCusto.Add(NovaArea(TenantTeste, areaId, "Comercial"));

        db.Vagas.Add(NovaVaga(TenantTeste, Guid.NewGuid(), areaId, VagaStatus.Aberta,
            dataAbertura: DateTimeOffset.UtcNow.AddDays(-40)));
        db.Vagas.Add(NovaVaga(TenantTeste, Guid.NewGuid(), areaId, VagaStatus.Aberta,
            dataAbertura: DateTimeOffset.UtcNow.AddDays(-90)));
        db.Vagas.Add(NovaVaga(TenantTeste, Guid.NewGuid(), areaId, VagaStatus.Aberta,
            dataAbertura: DateTimeOffset.UtcNow.AddDays(-15))); // dentro do SLA
        await db.SaveChangesAsync();

        var sec = await svc.ParaRhAsync(CancellationToken.None);

        Assert.Equal(2, sec.VagasForaSla);
        Assert.Equal(2, sec.VagasForaSlaTop.Count);
        Assert.True(sec.VagasForaSlaTop[0].DiasAberta >= sec.VagasForaSlaTop[1].DiasAberta);
        Assert.Equal("Comercial", sec.VagasForaSlaTop[0].Area);
    }

    [Fact]
    public async Task Rh_PreAdmissoesEmAndamento_SomaOs4StatusIntermediarios()
    {
        var (db, svc) = CriarServico();

        void AddPre(PreAdmissaoStatus s)
        {
            db.PreAdmissoes.Add(new RhPortal.Api.Domain.Entities.PreAdmissao
            {
                Id = Guid.NewGuid(),
                TenantId = TenantTeste,
                Nome = $"Pre {s}",
                Status = s,
                CreatedAtUtc = DateTimeOffset.UtcNow,
                UpdatedAtUtc = DateTimeOffset.UtcNow,
            });
        }
        AddPre(PreAdmissaoStatus.Enviado);
        AddPre(PreAdmissaoStatus.Acessado);
        AddPre(PreAdmissaoStatus.Preenchido);
        AddPre(PreAdmissaoStatus.PreenchidoParcial);
        AddPre(PreAdmissaoStatus.Aprovada); // fora
        AddPre(PreAdmissaoStatus.Rascunho); // fora
        await db.SaveChangesAsync();

        var sec = await svc.ParaRhAsync(CancellationToken.None);

        Assert.Equal(4, sec.PreAdmissoesEmAndamento);
        Assert.Equal(1, sec.PreAdmissoesAguardandoAprovacao); // só "Preenchido"
    }

    [Fact]
    public async Task Rh_AdmissoesSemanaEMes_UsaCreatedAtDeFuncionariosAtivos()
    {
        var (db, svc) = CriarServico();
        var agora = DateTimeOffset.UtcNow;
        var inicioMes = new DateTimeOffset(agora.Year, agora.Month, 1, 0, 0, 0, TimeSpan.Zero);

        // Helper: cria Funcionario, salva (o AppDbContext força CreatedAtUtc = now no Added)
        // e depois backdata via segundo save no estado Modified.
        async Task<Funcionario> CriarComCreatedAt(DateTimeOffset created, FuncionarioStatus status = FuncionarioStatus.Active)
        {
            var f = new Funcionario
            {
                Id = Guid.NewGuid(),
                TenantId = TenantTeste,
                Name = "F",
                Status = status,
                CreatedAtUtc = agora,
                UpdatedAtUtc = agora,
            };
            db.Funcionarios.Add(f);
            await db.SaveChangesAsync();
            await AjustarCreatedAtAsync(db, f, created);
            return f;
        }

        await CriarComCreatedAt(agora.AddDays(-2));                          // semana + mês (se mesmo mês)
        await CriarComCreatedAt(agora.AddDays(-10));                         // fora semana, dentro do mês se aplicável
        await CriarComCreatedAt(agora.AddDays(-40));                         // fora do mês
        await CriarComCreatedAt(agora.AddDays(-1), FuncionarioStatus.Inactive); // inativo → ignorado

        var sec = await svc.ParaRhAsync(CancellationToken.None);

        Assert.Equal(1, sec.AdmissoesSemana);

        var esperadoMes =
            (agora.AddDays(-2) >= inicioMes ? 1 : 0) +
            (agora.AddDays(-10) >= inicioMes ? 1 : 0) +
            (agora.AddDays(-40) >= inicioMes ? 1 : 0);
        Assert.Equal(esperadoMes, sec.AdmissoesMes);
    }

    [Fact]
    public async Task Rh_MatchingScoresUltimas48h_UsaCalculatedAtUtc()
    {
        var (db, svc) = CriarServico();
        var candId = Guid.NewGuid();
        var vaga1 = Guid.NewGuid();
        var vaga2 = Guid.NewGuid();

        db.Candidatos.Add(new Candidato
        {
            Id = candId,
            TenantId = TenantTeste,
            Nome = "Test",
            Fonte = CandidateOrigin.Site,
            Status = CandidateStatus.Novo,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        });
        db.Vagas.Add(NovaVaga(TenantTeste, vaga1, Guid.NewGuid(), VagaStatus.Aberta));
        db.Vagas.Add(NovaVaga(TenantTeste, vaga2, Guid.NewGuid(), VagaStatus.Aberta));

        // Chave composta (CandidatoId, VagaId) exige VagaIds distintos para dois scores.
        db.CandidatoVagaMatchingScores.Add(new CandidatoVagaMatchingScore
        {
            TenantId = TenantTeste, CandidatoId = candId, VagaId = vaga1, Score = 80,
            CalculatedAtUtc = DateTimeOffset.UtcNow.AddHours(-10)
        });
        db.CandidatoVagaMatchingScores.Add(new CandidatoVagaMatchingScore
        {
            TenantId = TenantTeste, CandidatoId = candId, VagaId = vaga2, Score = 75,
            CalculatedAtUtc = DateTimeOffset.UtcNow.AddHours(-72) // fora de 48h
        });
        await db.SaveChangesAsync();

        var sec = await svc.ParaRhAsync(CancellationToken.None);

        Assert.Equal(1, sec.MatchingScoresUltimas48h);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Diretor
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Diretor_HeadcountTotal_ContaApenasAtivos()
    {
        var (db, svc) = CriarServico();

        for (int i = 0; i < 3; i++)
            db.Funcionarios.Add(NovoFunc(TenantTeste, Guid.NewGuid()));
        db.Funcionarios.Add(NovoFunc(TenantTeste, Guid.NewGuid(), status: FuncionarioStatus.Inactive));
        await db.SaveChangesAsync();

        var sec = await svc.ParaDiretorAsync(CancellationToken.None);

        Assert.Equal(3, sec.HeadcountTotal);
    }

    [Fact]
    public async Task Diretor_HeadcountPorArea_OrdenaDecrescentePorContagem()
    {
        var (db, svc) = CriarServico();
        var areaGrande = Guid.NewGuid();
        var areaPequena = Guid.NewGuid();
        db.CentrosCusto.Add(NovaArea(TenantTeste, areaGrande, "Ops"));
        db.CentrosCusto.Add(NovaArea(TenantTeste, areaPequena, "Lab"));

        for (int i = 0; i < 5; i++)
            db.Funcionarios.Add(NovoFunc(TenantTeste, Guid.NewGuid(), centroCustoId: areaGrande));
        for (int i = 0; i < 2; i++)
            db.Funcionarios.Add(NovoFunc(TenantTeste, Guid.NewGuid(), centroCustoId: areaPequena));

        db.Vagas.Add(NovaVaga(TenantTeste, Guid.NewGuid(), areaGrande, VagaStatus.Aberta));
        db.Vagas.Add(NovaVaga(TenantTeste, Guid.NewGuid(), areaGrande, VagaStatus.Aberta));
        db.Vagas.Add(NovaVaga(TenantTeste, Guid.NewGuid(), areaPequena, VagaStatus.Aberta));
        await db.SaveChangesAsync();

        var sec = await svc.ParaDiretorAsync(CancellationToken.None);

        Assert.Equal(2, sec.HeadcountPorArea.Count);
        Assert.Equal("Ops", sec.HeadcountPorArea[0].AreaNome);
        Assert.Equal(5, sec.HeadcountPorArea[0].Headcount);
        Assert.Equal(2, sec.HeadcountPorArea[0].VagasAbertas);
        Assert.Equal("Lab", sec.HeadcountPorArea[1].AreaNome);
    }

    [Fact]
    public async Task Diretor_DesligamentosConcluidosMes_FiltraPorStatusEData()
    {
        var (db, svc) = CriarServico();
        var agora = DateTimeOffset.UtcNow;
        var solicitanteId = Guid.NewGuid();
        db.Funcionarios.Add(NovoFunc(TenantTeste, solicitanteId));

        void AddDesligamento(SolicitacaoStatus s, DateTimeOffset updated)
        {
            db.SolicitacoesDesligamento.Add(new SolicitacaoDesligamento
            {
                Id = Guid.NewGuid(),
                TenantId = TenantTeste,
                FuncionarioId = Guid.NewGuid(),
                SolicitanteId = solicitanteId,
                Status = s,
                TipoDesligamento = TipoDesligamento.PedidoDemissao,
                MotivoDesligamento = "Pedido de demissão",
                TipoAvisoPrevio = TipoAvisoPrevio.Trabalhado,
                CreatedAtUtc = updated,
                UpdatedAtUtc = updated,
                DataDesligamento = DateOnly.FromDateTime(agora.DateTime),
            });
        }

        AddDesligamento(SolicitacaoStatus.Concluida, agora);                // conta
        AddDesligamento(SolicitacaoStatus.Concluida, agora.AddMonths(-2));  // fora do mês
        AddDesligamento(SolicitacaoStatus.EmIntegracao, agora);             // em integração
        AddDesligamento(SolicitacaoStatus.PendenteAprovacao, agora);        // não conta
        await db.SaveChangesAsync();

        var sec = await svc.ParaDiretorAsync(CancellationToken.None);

        Assert.Equal(1, sec.DesligamentosConcluidosMes);
        Assert.Equal(1, sec.DesligamentosAguardandoIntegracaoMes);
    }

    [Fact]
    public async Task Diretor_CiclosResumo_ContaConvitesPorStatusDoCiclo()
    {
        var (db, svc) = CriarServico();
        var gestorId = Guid.NewGuid();
        db.Funcionarios.Add(NovoFunc(TenantTeste, gestorId));

        var cicloId = Guid.NewGuid();
        db.AvaliacaoCiclos.Add(new AvaliacaoCiclo
        {
            Id = cicloId,
            TenantId = TenantTeste,
            Nome = "Semestral 2026",
            Periodo = "S1",
            Status = AvaliacaoCicloStatus.Aberto,
            CriadoPorId = gestorId,
            CriadoEmUtc = DateTimeOffset.UtcNow,
            AtualizadoEmUtc = DateTimeOffset.UtcNow,
        });

        for (int i = 0; i < 3; i++)
            db.AvaliacaoConvites.Add(new AvaliacaoConvite
            {
                Id = Guid.NewGuid(), TenantId = TenantTeste, CicloId = cicloId,
                AvaliadorId = gestorId, AvaliandoId = Guid.NewGuid(),
                Tipo = AvaliacaoConviteTipo.GestorParaDireto,
                Status = AvaliacaoConviteStatus.Respondido, CriadoEmUtc = DateTimeOffset.UtcNow,
            });
        for (int i = 0; i < 2; i++)
            db.AvaliacaoConvites.Add(new AvaliacaoConvite
            {
                Id = Guid.NewGuid(), TenantId = TenantTeste, CicloId = cicloId,
                AvaliadorId = gestorId, AvaliandoId = Guid.NewGuid(),
                Tipo = AvaliacaoConviteTipo.GestorParaDireto,
                Status = AvaliacaoConviteStatus.Pendente, CriadoEmUtc = DateTimeOffset.UtcNow,
            });
        await db.SaveChangesAsync();

        var sec = await svc.ParaDiretorAsync(CancellationToken.None);

        Assert.Single(sec.CiclosResumo);
        var ciclo = sec.CiclosResumo[0];
        Assert.Equal("Semestral 2026", ciclo.Nome);
        Assert.Equal(5, ciclo.ConvitesTotal);
        Assert.Equal(3, ciclo.ConvitesRespondidos);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Isolamento por tenant (confia no query filter do AppDbContext).
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Rh_NaoVazaDadosDeOutroTenant()
    {
        // O AppDbContext.SaveChangesAsync sobrescreve TenantId com o tenant atual no Added.
        // Para testar isolamento real, usamos 2 contexts compartilhando o mesmo InMemoryDatabase.
        var (db, svc, dbOutro) = CriarServicoComOutroTenant();

        // Dado deste tenant.
        db.Vagas.Add(NovaVaga(TenantTeste, Guid.NewGuid(), Guid.NewGuid(), VagaStatus.Aberta));
        await db.SaveChangesAsync();

        // Dado de outro tenant — se o query filter falhar, este aparecerá no count.
        dbOutro.Vagas.Add(NovaVaga(OutroTenant, Guid.NewGuid(), Guid.NewGuid(), VagaStatus.Aberta));
        dbOutro.Vagas.Add(NovaVaga(OutroTenant, Guid.NewGuid(), Guid.NewGuid(), VagaStatus.Aberta));
        await dbOutro.SaveChangesAsync();

        var sec = await svc.ParaRhAsync(CancellationToken.None);

        Assert.Equal(1, sec.VagasAbertas);
    }

    [Fact]
    public async Task Diretor_HeadcountRespeitaIsolamentoDeTenant()
    {
        var (db, svc, dbOutro) = CriarServicoComOutroTenant();

        db.Funcionarios.Add(NovoFunc(TenantTeste, Guid.NewGuid()));
        await db.SaveChangesAsync();

        dbOutro.Funcionarios.Add(NovoFunc(OutroTenant, Guid.NewGuid()));
        dbOutro.Funcionarios.Add(NovoFunc(OutroTenant, Guid.NewGuid()));
        await dbOutro.SaveChangesAsync();

        var sec = await svc.ParaDiretorAsync(CancellationToken.None);

        Assert.Equal(1, sec.HeadcountTotal);
    }
}
