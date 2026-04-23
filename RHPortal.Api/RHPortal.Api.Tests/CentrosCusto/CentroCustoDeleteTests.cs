using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using Moq;
using RhPortal.Api.Controllers;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Domain.Enums;
using RHPortal.Api.Domain.Entities;
using RHPortal.Api.Domain.Enums;
using Xunit;

namespace RhPortal.Api.Tests.CentrosCusto;

/// <summary>
/// Testes do DELETE em <c>CentroCustoController</c> — garante que a mensagem de erro
/// quando o CC tem vínculos é clara e humanamente legível (regressão do bug de UX
/// reportado: "erro mas não deixa claro por que não pode deletar"). O controller faz
/// pre-check em 7 FKs (filhos, vagas, cargos, funcionários, solicitações de vaga,
/// solicitações de promoção, pré-admissões) e retorna 409 com lista de blocos + contagens.
/// </summary>
public sealed class CentroCustoDeleteTests
{
    private const string TenantTeste = "tenant-teste";

    private static (CentroCustoController Controller, AppDbContext Db) CriarControllerComDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var tenantMock = new Mock<ITenantContext>();
        tenantMock.Setup(x => x.TenantId).Returns(TenantTeste);

        var db = new AppDbContext(options, tenantMock.Object);

        var localizer = new Mock<IStringLocalizer<ControllerMessages>>();
        localizer.Setup(x => x[It.IsAny<string>()])
            .Returns<string>(k => new LocalizedString(k, k));

        var controller = new CentroCustoController(localizer.Object)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
        return (controller, db);
    }

    private static RhPortal.Api.Domain.Entities.CentroCusto SeedCc(AppDbContext db, string code = "TI", string desc = "Tecnologia")
    {
        var cc = new RhPortal.Api.Domain.Entities.CentroCusto
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            Code = code,
            Description = desc,
            IsActive = true,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        db.CentrosCusto.Add(cc);
        db.SaveChanges();
        return cc;
    }

    // ── Casos básicos ────────────────────────────────────────────────────────

    [Fact]
    public async Task Delete_CcNaoExiste_Retorna404()
    {
        var (ctl, db) = CriarControllerComDb();
        var idInexistente = Guid.NewGuid();

        var result = await ctl.Delete(idInexistente, db, CancellationToken.None);

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task Delete_CcSemVinculos_Remove_Retorna204()
    {
        var (ctl, db) = CriarControllerComDb();
        var cc = SeedCc(db);

        var result = await ctl.Delete(cc.Id, db, CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
        Assert.Empty(db.CentrosCusto);
    }

    // ── Blocos individuais (um por tipo de FK) ───────────────────────────────

    [Fact]
    public async Task Delete_CcComFilhosNaHierarquia_Retorna409_ComContagem()
    {
        var (ctl, db) = CriarControllerComDb();
        var pai = SeedCc(db, code: "TI", desc: "TI");
        var filho = SeedCc(db, code: "TI.DEV", desc: "Dev");
        filho.ParentId = pai.Id;
        db.SaveChanges();

        var result = await ctl.Delete(pai.Id, db, CancellationToken.None);

        var conflict = Assert.IsType<ConflictObjectResult>(result);
        Assert.NotNull(conflict.Value);
        var msg = GetMessage(conflict.Value);
        Assert.Contains("1 centro(s) de custo filho(s)", msg);
        Assert.Contains("TI - TI", msg); // mensagem identifica o CC alvo
    }

    [Fact]
    public async Task Delete_CcComVaga_Retorna409_CitaVaga()
    {
        var (ctl, db) = CriarControllerComDb();
        var cc = SeedCc(db);

        db.Vagas.Add(new Vaga
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            Titulo = "Dev Backend",
            Status = VagaStatus.Rascunho,
            QuantidadeVagas = 1,
            HeadcountAutorizado = 1,
            CentroCustoId = cc.Id,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        });
        db.SaveChanges();

        var result = await ctl.Delete(cc.Id, db, CancellationToken.None);

        var conflict = Assert.IsType<ConflictObjectResult>(result);
        Assert.Contains("1 vaga(s)", GetMessage(conflict.Value!));
    }

    [Fact]
    public async Task Delete_CcComFuncionario_Retorna409_CitaFuncionario()
    {
        var (ctl, db) = CriarControllerComDb();
        var cc = SeedCc(db);

        db.Funcionarios.Add(new Funcionario
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            Name = "João",
            Email = "joao@empresa.com",
            Status = FuncionarioStatus.Active,
            CentroCustoId = cc.Id,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        });
        db.SaveChanges();

        var result = await ctl.Delete(cc.Id, db, CancellationToken.None);

        var conflict = Assert.IsType<ConflictObjectResult>(result);
        Assert.Contains("1 funcionário(s)", GetMessage(conflict.Value!));
    }

    [Fact]
    public async Task Delete_CcComCargo_Retorna409_CitaCargo()
    {
        var (ctl, db) = CriarControllerComDb();
        var cc = SeedCc(db);

        db.Set<JobPosition>().Add(new JobPosition
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            Code = "DEV",
            Name = "Desenvolvedor",
            CentroCustoId = cc.Id,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        });
        db.SaveChanges();

        var result = await ctl.Delete(cc.Id, db, CancellationToken.None);

        var conflict = Assert.IsType<ConflictObjectResult>(result);
        Assert.Contains("1 cargo(s)", GetMessage(conflict.Value!));
    }

    // ── Múltiplos blocos agregados ───────────────────────────────────────────

    [Fact]
    public async Task Delete_CcComMultiplosVinculos_Retorna409_ListaTodos()
    {
        var (ctl, db) = CriarControllerComDb();
        var cc = SeedCc(db);

        // 2 vagas + 3 funcionários + 1 cargo
        for (int i = 0; i < 2; i++)
        {
            db.Vagas.Add(new Vaga
            {
                Id = Guid.NewGuid(),
                TenantId = TenantTeste,
                Titulo = $"Vaga {i}",
                Status = VagaStatus.Rascunho,
                QuantidadeVagas = 1,
                HeadcountAutorizado = 1,
                CentroCustoId = cc.Id,
                CreatedAtUtc = DateTimeOffset.UtcNow,
                UpdatedAtUtc = DateTimeOffset.UtcNow,
            });
        }
        for (int i = 0; i < 3; i++)
        {
            db.Funcionarios.Add(new Funcionario
            {
                Id = Guid.NewGuid(),
                TenantId = TenantTeste,
                Name = $"Func {i}",
                Email = $"func{i}@empresa.com",
                Status = FuncionarioStatus.Active,
                CentroCustoId = cc.Id,
                CreatedAtUtc = DateTimeOffset.UtcNow,
                UpdatedAtUtc = DateTimeOffset.UtcNow,
            });
        }
        db.Set<JobPosition>().Add(new JobPosition
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            Code = "X",
            Name = "Desenvolvedor",
            CentroCustoId = cc.Id,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        });
        db.SaveChanges();

        var result = await ctl.Delete(cc.Id, db, CancellationToken.None);

        var conflict = Assert.IsType<ConflictObjectResult>(result);
        var msg = GetMessage(conflict.Value!);
        Assert.Contains("2 vaga(s)", msg);
        Assert.Contains("3 funcionário(s)", msg);
        Assert.Contains("1 cargo(s)", msg);
    }

    [Fact]
    public async Task Delete_CcComVinculos_Retorna409_ExpoeDependenciasNoBody()
    {
        var (ctl, db) = CriarControllerComDb();
        var cc = SeedCc(db);
        db.Vagas.Add(new Vaga
        {
            Id = Guid.NewGuid(),
            TenantId = TenantTeste,
            Titulo = "V",
            Status = VagaStatus.Rascunho,
            QuantidadeVagas = 1,
            HeadcountAutorizado = 1,
            CentroCustoId = cc.Id,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        });
        db.SaveChanges();

        var result = await ctl.Delete(cc.Id, db, CancellationToken.None);

        // Body do 409 deve conter dependencies.vagas para o frontend opcionalmente
        // oferecer "ver os X vínculos" no modal.
        var conflict = Assert.IsType<ConflictObjectResult>(result);
        var dependencies = conflict.Value!.GetType().GetProperty("dependencies")?.GetValue(conflict.Value);
        Assert.NotNull(dependencies);
        var vagasCount = dependencies!.GetType().GetProperty("vagas")?.GetValue(dependencies);
        Assert.Equal(1, vagasCount);
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private static string GetMessage(object value) =>
        value.GetType().GetProperty("message")?.GetValue(value) as string ?? string.Empty;
}
