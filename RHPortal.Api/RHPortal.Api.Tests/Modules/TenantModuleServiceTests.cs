using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.Owner;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Modules;
using Xunit;

namespace RhPortal.Api.Tests.Modules;

/// <summary>
/// Testes do TenantModuleService — List/Set/EnsureDefaults/GetEnabledKeys.
/// Cobre defaults (tudo ligado), bloqueio de core, upsert, auditoria de ownerId
/// e idempotência do EnsureDefaultsAsync.
/// </summary>
public sealed class TenantModuleServiceTests
{
    private const string TenantA = "empresa-a";
    private const string TenantB = "empresa-b";

    private static (MasterDbContext Db, TenantModuleService Service) CriarServico()
    {
        var options = new DbContextOptionsBuilder<MasterDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var db = new MasterDbContext(options);
        var packageService = new TenantPackageService(db);
        var service = new TenantModuleService(db, packageService);
        return (db, service);
    }

    // ── ListAsync ──

    [Fact]
    public async Task List_SemRegistros_RetornaTodosDoCatalogoHabilitados()
    {
        var (_, svc) = CriarServico();

        var list = await svc.ListAsync(TenantA, CancellationToken.None);

        Assert.Equal(ModuleCatalog.All.Count, list.Count);
        Assert.All(list, m => Assert.True(m.IsEnabled));
        Assert.All(list, m => Assert.Null(m.UpdatedAtUtc));
        Assert.All(list, m => Assert.Null(m.UpdatedByOwnerId));
    }

    [Fact]
    public async Task List_ComRegistroDesabilitadoParaOpcional_RefleteStatus()
    {
        var (db, svc) = CriarServico();
        db.TenantModules.Add(new TenantModule
        {
            Id = Guid.NewGuid(),
            TenantId = TenantA,
            ModuleKey = "matching",
            IsEnabled = false,
            UpdatedAtUtc = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var list = await svc.ListAsync(TenantA, CancellationToken.None);

        var matching = list.Single(m => m.Key == "matching");
        Assert.False(matching.IsEnabled);
    }

    [Fact]
    public async Task List_IgnoraRegistrosDeOutroTenant()
    {
        var (db, svc) = CriarServico();
        db.TenantModules.Add(new TenantModule
        {
            Id = Guid.NewGuid(),
            TenantId = TenantB,
            ModuleKey = "matching",
            IsEnabled = false,
            UpdatedAtUtc = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var list = await svc.ListAsync(TenantA, CancellationToken.None);

        Assert.True(list.Single(m => m.Key == "matching").IsEnabled);
    }

    [Fact]
    public async Task List_ForcaCoreAtivoMesmoSeRegistroEstiverFalso()
    {
        // Cenário defensivo: se alguém conseguir gravar um core como desabilitado
        // direto no banco, o List deve forçar IsEnabled=true (UI não permite, mas
        // a leitura precisa ser consistente com o contrato).
        var (db, svc) = CriarServico();
        db.TenantModules.Add(new TenantModule
        {
            Id = Guid.NewGuid(),
            TenantId = TenantA,
            ModuleKey = "dashboard",
            IsEnabled = false,
            UpdatedAtUtc = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var list = await svc.ListAsync(TenantA, CancellationToken.None);

        Assert.True(list.Single(m => m.Key == "dashboard").IsEnabled);
    }

    // ── ListDetailedAsync ──

    [Fact]
    public async Task ListDetailed_RetornaMesmosModulosDeListAsync_MasComTelas()
    {
        var (_, svc) = CriarServico();

        var simples = await svc.ListAsync(TenantA, CancellationToken.None);
        var detalhada = await svc.ListDetailedAsync(TenantA, CancellationToken.None);

        Assert.Equal(simples.Count, detalhada.Count);
        foreach (var mod in simples)
        {
            var det = detalhada.Single(d => d.Key == mod.Key);
            Assert.Equal(mod.Name, det.Name);
            Assert.Equal(mod.IsCore, det.IsCore);
            Assert.Equal(mod.IsEnabled, det.IsEnabled);
            Assert.Equal(mod.PackageKey, det.PackageKey);
            // Telas sempre presentes (podem ser 0 para módulo sem manifesto).
            Assert.NotNull(det.Telas);
        }
    }

    [Fact]
    public async Task ListDetailed_TelasDerivamDoNavegacaoManifest()
    {
        var (_, svc) = CriarServico();

        var detalhada = await svc.ListDetailedAsync(TenantA, CancellationToken.None);

        // Módulo "candidatos" deve expor 4 telas (Candidatos, Kanban, Pipeline, Talentos).
        var candidatos = detalhada.Single(m => m.Key == "candidatos");
        var hrefs = candidatos.Telas.Select(t => t.Href).ToList();
        Assert.Contains("/candidatos", hrefs);
        Assert.Contains("/recrutamento/candidaturas", hrefs);
        Assert.Contains("/triagem", hrefs);
        Assert.Contains("/talentos", hrefs);
    }

    [Fact]
    public async Task ListDetailed_RefleteStatusDesabilitado()
    {
        var (db, svc) = CriarServico();
        db.TenantModules.Add(new TenantModule
        {
            Id = Guid.NewGuid(),
            TenantId = TenantA,
            ModuleKey = "matching",
            IsEnabled = false,
            UpdatedAtUtc = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var detalhada = await svc.ListDetailedAsync(TenantA, CancellationToken.None);

        var matching = detalhada.Single(m => m.Key == "matching");
        Assert.False(matching.IsEnabled);
        // Telas continuam listadas para o Owner ver o que o cliente perde ao desligar.
        Assert.NotEmpty(matching.Telas);
    }

    // ── SetEnabledAsync ──

    [Fact]
    public async Task Set_ModuloInexistente_RetornaNull()
    {
        var (_, svc) = CriarServico();

        var result = await svc.SetEnabledAsync(TenantA, "modulo-inexistente", false, null, CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task Set_DesabilitarCore_LancaInvalidOperation()
    {
        var (_, svc) = CriarServico();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.SetEnabledAsync(TenantA, "dashboard", false, null, CancellationToken.None));

        Assert.Contains("dashboard", ex.Message);
        Assert.Contains("core", ex.Message);
    }

    [Fact]
    public async Task Set_HabilitarCore_Permitido()
    {
        // Habilitar core é no-op lógico mas não deve falhar.
        var (_, svc) = CriarServico();

        var result = await svc.SetEnabledAsync(TenantA, "dashboard", true, null, CancellationToken.None);

        Assert.NotNull(result);
        Assert.True(result!.IsEnabled);
    }

    [Fact]
    public async Task Set_PrimeiraVezParaOpcional_CriaRegistroComOwnerId()
    {
        var (db, svc) = CriarServico();
        var ownerId = Guid.NewGuid();

        var result = await svc.SetEnabledAsync(TenantA, "matching", false, ownerId, CancellationToken.None);

        Assert.NotNull(result);
        Assert.False(result!.IsEnabled);
        Assert.Equal(ownerId, result.UpdatedByOwnerId);
        Assert.NotNull(result.UpdatedAtUtc);

        var row = await db.TenantModules.SingleAsync(x => x.TenantId == TenantA && x.ModuleKey == "matching");
        Assert.False(row.IsEnabled);
        Assert.Equal(ownerId, row.UpdatedByOwnerId);
    }

    [Fact]
    public async Task Set_SegundaVez_AtualizaRegistroExistente()
    {
        var (db, svc) = CriarServico();
        var ownerA = Guid.NewGuid();
        var ownerB = Guid.NewGuid();

        await svc.SetEnabledAsync(TenantA, "matching", false, ownerA, CancellationToken.None);
        await svc.SetEnabledAsync(TenantA, "matching", true, ownerB, CancellationToken.None);

        // Ainda deve existir apenas 1 registro (upsert)
        var count = await db.TenantModules.CountAsync(x => x.TenantId == TenantA && x.ModuleKey == "matching");
        Assert.Equal(1, count);

        var row = await db.TenantModules.SingleAsync(x => x.TenantId == TenantA && x.ModuleKey == "matching");
        Assert.True(row.IsEnabled);
        Assert.Equal(ownerB, row.UpdatedByOwnerId);
    }

    [Fact]
    public async Task Set_IsolamentoPorTenant()
    {
        var (db, svc) = CriarServico();

        await svc.SetEnabledAsync(TenantA, "matching", false, null, CancellationToken.None);

        // Tenant B não deve ser afetado
        var listB = await svc.ListAsync(TenantB, CancellationToken.None);
        Assert.True(listB.Single(m => m.Key == "matching").IsEnabled);

        Assert.Equal(1, await db.TenantModules.CountAsync());
    }

    // ── EnsureDefaultsAsync ──

    [Fact]
    public async Task EnsureDefaults_TenantNovo_CriaRegistrosParaTodosOsModulos()
    {
        var (db, svc) = CriarServico();

        await svc.EnsureDefaultsAsync(TenantA, CancellationToken.None);

        var rows = await db.TenantModules.Where(x => x.TenantId == TenantA).ToListAsync();
        Assert.Equal(ModuleCatalog.All.Count, rows.Count);
        Assert.All(rows, r => Assert.True(r.IsEnabled));
    }

    [Fact]
    public async Task EnsureDefaults_ComRegistroExistente_NaoSobrescreve()
    {
        var (db, svc) = CriarServico();

        // pré-popula 'matching' como desabilitado
        await svc.SetEnabledAsync(TenantA, "matching", false, null, CancellationToken.None);

        // chama EnsureDefaults — NÃO deve virar true de volta
        await svc.EnsureDefaultsAsync(TenantA, CancellationToken.None);

        var matching = await db.TenantModules.SingleAsync(x => x.TenantId == TenantA && x.ModuleKey == "matching");
        Assert.False(matching.IsEnabled);
    }

    [Fact]
    public async Task EnsureDefaults_Idempotente()
    {
        var (db, svc) = CriarServico();

        await svc.EnsureDefaultsAsync(TenantA, CancellationToken.None);
        await svc.EnsureDefaultsAsync(TenantA, CancellationToken.None);
        await svc.EnsureDefaultsAsync(TenantA, CancellationToken.None);

        var count = await db.TenantModules.CountAsync(x => x.TenantId == TenantA);
        Assert.Equal(ModuleCatalog.All.Count, count);
    }

    // ── GetEnabledModuleKeysAsync ──

    [Fact]
    public async Task GetEnabled_SemRegistros_RetornaTodosExcetoDePacotesInativos()
    {
        var (_, svc) = CriarServico();

        var enabled = await svc.GetEnabledModuleKeysAsync(TenantA, CancellationToken.None);

        // Módulos em pacotes não-ativos (ex.: folha-pagamento) não entram mesmo sem registro.
        var esperados = ModuleCatalog.All
            .Where(m =>
            {
                if (m.IsCore) return true;
                if (string.IsNullOrWhiteSpace(m.PackageKey)) return true;
                var pack = PackageCatalog.GetByKey(m.PackageKey!);
                return pack is not null && pack.IsActive;
            })
            .Select(m => m.Key)
            .ToList();

        Assert.Equal(esperados.Count, enabled.Count);
        foreach (var key in esperados)
            Assert.Contains(key, enabled);

        // Módulos de pacotes inativos ficam fora
        var desativadosEsperados = ModuleCatalog.All
            .Where(m => !m.IsCore
                        && !string.IsNullOrWhiteSpace(m.PackageKey)
                        && PackageCatalog.GetByKey(m.PackageKey!)?.IsActive == false)
            .Select(m => m.Key);
        foreach (var key in desativadosEsperados)
            Assert.DoesNotContain(key, enabled);
    }

    [Fact]
    public async Task GetEnabled_ComModuloDesabilitado_ExcluiDoSet()
    {
        var (_, svc) = CriarServico();
        await svc.SetEnabledAsync(TenantA, "matching", false, null, CancellationToken.None);
        await svc.SetEnabledAsync(TenantA, "feedback", false, null, CancellationToken.None);

        var enabled = await svc.GetEnabledModuleKeysAsync(TenantA, CancellationToken.None);

        Assert.DoesNotContain("matching", enabled);
        Assert.DoesNotContain("feedback", enabled);
        Assert.Contains("recrutamento", enabled); // outros opcionais continuam
    }

    [Fact]
    public async Task GetEnabled_CoreSempreAtivo()
    {
        var (db, svc) = CriarServico();

        // força core desabilitado no banco (cenário defensivo)
        db.TenantModules.Add(new TenantModule
        {
            Id = Guid.NewGuid(),
            TenantId = TenantA,
            ModuleKey = "dashboard",
            IsEnabled = false,
            UpdatedAtUtc = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var enabled = await svc.GetEnabledModuleKeysAsync(TenantA, CancellationToken.None);

        Assert.Contains("dashboard", enabled);
        Assert.Contains("administracao", enabled);
        Assert.Contains("cadastros", enabled);
        Assert.Contains("configuracoes", enabled);
    }

    [Fact]
    public async Task GetEnabled_EHashSetCaseInsensitive()
    {
        var (_, svc) = CriarServico();

        var enabled = await svc.GetEnabledModuleKeysAsync(TenantA, CancellationToken.None);

        Assert.Contains("matching", enabled);
        Assert.Contains("MATCHING", enabled);
        Assert.Contains("Matching", enabled);
    }

    // ── Composição pacote ↔ módulo ──

    [Fact]
    public async Task Set_LigarModuloComPacotePaiInativo_LancaInvalidOperation()
    {
        // folha-pagamento no catálogo está IsActive=false. Nenhum módulo do
        // catálogo atual aponta para ele, mas a regra é genérica — usamos um
        // helper defensivo: pegamos um módulo com PackageKey e simulamos o
        // cenário setando o pacote como desligado no banco (o fluxo abaixo).
        // Aqui o alvo é especificamente a proteção que recusa ligar módulo
        // cujo PackageKey aponta para pacote inativo no catálogo.
        var moduloComPacote = ModuleCatalog.All.FirstOrDefault(m => m.PackageKey is not null && m.PackageKey == "folha-pagamento");
        if (moduloComPacote is null)
        {
            // Não há módulo associado a pacote inativo no catálogo — cenário
            // protegido apenas pela impossibilidade de ligar o pacote pai via
            // SetEnabledAsync (já coberto em TenantPackageServiceTests).
            // Nada a validar aqui.
            return;
        }

        var (_, svc) = CriarServico();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.SetEnabledAsync(TenantA, moduloComPacote.Key, true, null, CancellationToken.None));

        Assert.Contains(moduloComPacote.Key, ex.Message);
    }

    [Fact]
    public async Task GetEnabled_ModuloOpcional_DesligaQuandoPacotePaiDesligado()
    {
        // Desligando o pacote 'recrutamento-selecao', os módulos filhos
        // (recrutamento, candidatos, matching, portal-vagas, admissao, agenda)
        // devem sumir do set efetivo mesmo sem registro individual em TenantModules.
        var (db, svc) = CriarServico();
        var packageService = new TenantPackageService(db);
        await packageService.SetEnabledAsync(TenantA, "recrutamento-selecao", false, null, CancellationToken.None);

        var enabled = await svc.GetEnabledModuleKeysAsync(TenantA, CancellationToken.None);

        var filhos = ModuleCatalog.All
            .Where(m => m.PackageKey == "recrutamento-selecao")
            .Select(m => m.Key)
            .ToList();

        Assert.NotEmpty(filhos);
        foreach (var filho in filhos)
            Assert.DoesNotContain(filho, enabled);

        // Módulos de outro pacote continuam ativos
        Assert.Contains("feedback", enabled);
        Assert.Contains("gestao", enabled);
        // Core permanece
        Assert.Contains("dashboard", enabled);
    }

    [Fact]
    public async Task GetEnabled_ModuloOpcional_VoltaQuandoPacotePaiReligado()
    {
        var (db, svc) = CriarServico();
        var packageService = new TenantPackageService(db);

        await packageService.SetEnabledAsync(TenantA, "recrutamento-selecao", false, null, CancellationToken.None);
        var desligado = await svc.GetEnabledModuleKeysAsync(TenantA, CancellationToken.None);
        Assert.DoesNotContain("matching", desligado);

        await packageService.SetEnabledAsync(TenantA, "recrutamento-selecao", true, null, CancellationToken.None);
        var religado = await svc.GetEnabledModuleKeysAsync(TenantA, CancellationToken.None);
        Assert.Contains("matching", religado);
    }

    [Fact]
    public async Task GetEnabled_ModuloIndividualDesligado_NaoVoltaMesmoComPacoteLigado()
    {
        // Módulo indivual desligado + pacote pai ligado → módulo fica fora.
        // Isso prova que a regra é "AND" entre módulo e pacote, não "OR".
        var (_, svc) = CriarServico();

        await svc.SetEnabledAsync(TenantA, "matching", false, null, CancellationToken.None);

        var enabled = await svc.GetEnabledModuleKeysAsync(TenantA, CancellationToken.None);

        Assert.DoesNotContain("matching", enabled);
        // Outros filhos do mesmo pacote continuam ligados
        Assert.Contains("recrutamento", enabled);
    }

    [Fact]
    public async Task GetEnabled_StandaloneNaoEAfetadoPorPacote()
    {
        // 'relatorios' não tem PackageKey → só depende do próprio flag.
        var (db, svc) = CriarServico();
        var packageService = new TenantPackageService(db);

        await packageService.SetEnabledAsync(TenantA, "recrutamento-selecao", false, null, CancellationToken.None);
        await packageService.SetEnabledAsync(TenantA, "gestao-pessoas", false, null, CancellationToken.None);

        var enabled = await svc.GetEnabledModuleKeysAsync(TenantA, CancellationToken.None);

        Assert.Contains("relatorios", enabled);
    }
}
