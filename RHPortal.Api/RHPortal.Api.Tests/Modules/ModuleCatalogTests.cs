using RhPortal.Api.Infrastructure.Modules;
using Xunit;

namespace RhPortal.Api.Tests.Modules;

/// <summary>
/// Testes do catálogo estático ModuleCatalog.
/// Garante que as chaves são estáveis (não dá para renomear sem quebrar clientes) e
/// que a resolução de permission → module funciona conforme os prefixos declarados.
/// </summary>
public sealed class ModuleCatalogTests
{
    // ── All / Exists / GetByKey ──

    [Fact]
    public void All_ContemOsModulosCoreObrigatorios()
    {
        var keys = ModuleCatalog.All.Select(m => m.Key).ToHashSet(StringComparer.OrdinalIgnoreCase);

        Assert.Contains("dashboard", keys);
        Assert.Contains("administracao", keys);
        Assert.Contains("cadastros", keys);
        Assert.Contains("configuracoes", keys);
    }

    [Fact]
    public void All_ContemOsModulosOpcionaisEsperados()
    {
        var keys = ModuleCatalog.All.Select(m => m.Key).ToHashSet(StringComparer.OrdinalIgnoreCase);

        Assert.Contains("agenda", keys);
        Assert.Contains("recrutamento", keys);
        Assert.Contains("candidatos", keys);
        Assert.Contains("matching", keys);
        Assert.Contains("portal-vagas", keys);
        Assert.Contains("admissao", keys);
        Assert.Contains("feedback", keys);
        Assert.Contains("gestao", keys);
        Assert.Contains("relatorios", keys);
    }

    [Fact]
    public void All_NaoContemChavesDuplicadas()
    {
        var dup = ModuleCatalog.All
            .GroupBy(m => m.Key, StringComparer.OrdinalIgnoreCase)
            .Where(g => g.Count() > 1)
            .Select(g => g.Key)
            .ToList();

        Assert.Empty(dup);
    }

    [Fact]
    public void ModulosCore_EstaoMarcadosComoIsCore()
    {
        var coreKeys = new[] { "dashboard", "administracao", "cadastros", "configuracoes" };
        foreach (var key in coreKeys)
        {
            var m = ModuleCatalog.GetByKey(key);
            Assert.NotNull(m);
            Assert.True(m!.IsCore, $"Módulo '{key}' deveria ser core.");
        }
    }

    [Fact]
    public void ModulosOpcionais_NaoEstaoMarcadosComoIsCore()
    {
        var optionalKeys = new[] { "agenda", "recrutamento", "candidatos", "matching", "admissao", "feedback", "gestao", "relatorios", "portal-vagas" };
        foreach (var key in optionalKeys)
        {
            var m = ModuleCatalog.GetByKey(key);
            Assert.NotNull(m);
            Assert.False(m!.IsCore, $"Módulo '{key}' não deveria ser core.");
        }
    }

    [Fact]
    public void Exists_RetornaTrueParaChaveExistente()
    {
        Assert.True(ModuleCatalog.Exists("matching"));
        Assert.True(ModuleCatalog.Exists("Matching")); // case-insensitive
    }

    [Fact]
    public void Exists_RetornaFalseParaChaveInexistente()
    {
        Assert.False(ModuleCatalog.Exists("modulo-inventado"));
        Assert.False(ModuleCatalog.Exists(""));
    }

    [Fact]
    public void GetByKey_RetornaNullParaInexistente()
    {
        Assert.Null(ModuleCatalog.GetByKey("inexistente"));
    }

    [Fact]
    public void GetByKey_ECaseInsensitive()
    {
        var m1 = ModuleCatalog.GetByKey("matching");
        var m2 = ModuleCatalog.GetByKey("MATCHING");
        Assert.NotNull(m1);
        Assert.NotNull(m2);
        Assert.Equal(m1!.Key, m2!.Key);
    }

    // ── ResolveModuleKey — mapeamento por prefixo de permissionKey ──

    [Theory]
    [InlineData("vagas.view", "recrutamento")]
    [InlineData("solicitacoes-vaga.view", "recrutamento")]
    [InlineData("aprovacoes-vaga.view", "recrutamento")]
    [InlineData("projetos.view", "recrutamento")]
    [InlineData("processo-seletivo.view", "recrutamento")]
    [InlineData("candidatos.view", "candidatos")]
    [InlineData("triagem.view", "candidatos")]
    [InlineData("matching.view", "matching")]
    [InlineData("admissao.view", "admissao")]
    [InlineData("feedback.send", "feedback")]
    [InlineData("feedback.view", "feedback")]
    [InlineData("gestao.dashboard", "gestao")]
    [InlineData("agenda.view", "agenda")]
    [InlineData("relatorios.view", "relatorios")]
    [InlineData("portalvagas.view", "portal-vagas")]
    [InlineData("entrada.view", "portal-vagas")]
    [InlineData("dashboard.view", "dashboard")]
    [InlineData("users.read", "administracao")]
    [InlineData("roles.manage", "administracao")]
    [InlineData("menus.manage", "administracao")]
    [InlineData("audit.view", "administracao")]
    [InlineData("areas.view", "cadastros")]
    [InlineData("departments.view", "cadastros")]
    [InlineData("funcionarios.view", "cadastros")]
    [InlineData("email-config.manage", "configuracoes")]
    [InlineData("entra-config.manage", "configuracoes")]
    [InlineData("localization-config.manage", "configuracoes")]
    public void ResolveModuleKey_MapeiaPermissionKeysParaModulos(string permissionKey, string expectedModule)
    {
        var result = ModuleCatalog.ResolveModuleKey(permissionKey);
        Assert.Equal(expectedModule, result);
    }

    [Fact]
    public void ResolveModuleKey_RetornaNullParaPermissionKeyInexistente()
    {
        Assert.Null(ModuleCatalog.ResolveModuleKey("sem-prefixo-conhecido"));
    }

    [Fact]
    public void ResolveModuleKey_RetornaNullParaInputVazio()
    {
        Assert.Null(ModuleCatalog.ResolveModuleKey(""));
        Assert.Null(ModuleCatalog.ResolveModuleKey(null!));
    }
}
