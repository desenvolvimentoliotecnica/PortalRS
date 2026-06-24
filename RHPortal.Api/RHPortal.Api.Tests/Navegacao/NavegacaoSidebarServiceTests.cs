using RhPortal.Api.Application.Navegacao;
using RhPortal.Api.Contracts.Navegacao;
using RhPortal.Api.Infrastructure.Modules;
using RhPortal.Api.Infrastructure.Navegacao;
using Xunit;

namespace RhPortal.Api.Tests.Navegacao;

/// <summary>
/// Testa o <see cref="NavegacaoSidebarService.Build"/> puro — sem I/O.
/// Foca no contrato do endpoint: gating por permissão/módulo/pacote,
/// agrupamento por bucket de UI e ordenação.
/// </summary>
public sealed class NavegacaoSidebarServiceTests
{
    private static HashSet<string> TodosModulosHabilitados()
    {
        return ModuleCatalog.All
            .Select(m => m.Key)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    // ── Gate por permissão ─────────────────────────────────────────────────

    [Fact]
    public void Build_SemPermissoes_RetornaSemItens()
    {
        var resp = NavegacaoSidebarService.Build(
            permissions: Array.Empty<string>(),
            enabledModuleKeys: TodosModulosHabilitados(),
            contextoEspecial: null);

        Assert.Empty(resp.Grupos);
    }

    [Fact]
    public void Build_Wildcard_EmiteTodosItensExcetoDePacoteInativo()
    {
        var resp = NavegacaoSidebarService.Build(
            permissions: new[] { "*" },
            enabledModuleKeys: TodosModulosHabilitados(),
            contextoEspecial: null);

        // Regra: itens cujo módulo pertence a um pacote com IsActive=false no catálogo
        // (ex.: folha-pagamento enquanto não é produto) são COMPLETAMENTE omitidos.
        var itensDePacoteInativo = NavegacaoManifest.Items.Count(item =>
        {
            var moduloKey = item.ModuloKeyOverride ?? ModuleCatalog.ResolveModuleKey(item.PermissionKey);
            var modulo = moduloKey is not null ? ModuleCatalog.GetByKey(moduloKey) : null;
            if (modulo is null || modulo.IsCore || string.IsNullOrWhiteSpace(modulo.PackageKey))
                return false;
            var package = PackageCatalog.GetByKey(modulo.PackageKey!);
            return package is null || !package.IsActive;
        });
        var esperado = NavegacaoManifest.Items.Count - itensDePacoteInativo;

        var totalItens = resp.Grupos.Sum(g => g.Itens.Count);
        Assert.Equal(esperado, totalItens);

        // Invariante adicional: pacote 'folha-pagamento' hoje está inativo → itens folha omitidos (exceto Desligamentos, em Principais).
        Assert.True(itensDePacoteInativo >= 2);
    }

    [Fact]
    public void Build_UsuarioComPermissaoUnica_VeSomenteItensCompativeis()
    {
        var resp = NavegacaoSidebarService.Build(
            permissions: new[] { "vagas.view" },
            enabledModuleKeys: TodosModulosHabilitados(),
            contextoEspecial: null);

        var itens = resp.Grupos.SelectMany(g => g.Itens).ToList();
        Assert.Contains(itens, i => i.Href == "/vagas");
        // /sla-vagas (ex-/eixo-vaga) também usa vagas.view
        Assert.Contains(itens, i => i.Href == "/sla-vagas");
        Assert.DoesNotContain(itens, i => i.Href == "/candidatos");
        Assert.DoesNotContain(itens, i => i.Href == "/admin/users");
    }

    // ── Gate por módulo/pacote ─────────────────────────────────────────────

    [Fact]
    public void Build_PacoteInativo_NaoEmiteItens()
    {
        // folha-pagamento é PackageCatalog com IsActive=false:
        // enquanto o produto não existir, os itens NÃO devem aparecer (nem com cadeado).
        // A UX antiga (cadeado + "pacote-inativo") foi descontinuada — regra de negócio:
        // pacote não disponível = módulo não existe para o usuário.
        var resp = NavegacaoSidebarService.Build(
            permissions: new[] { "*" },
            enabledModuleKeys: TodosModulosHabilitados(),
            contextoEspecial: null);

        // O bucket de UI existe no catálogo mas não deve conter itens visíveis.
        var grupoFolha = resp.Grupos.FirstOrDefault(g => g.Key == "folha-pagamento");
        Assert.Null(grupoFolha);

        // E também não pode vazar batida/comissoes/entrevista (folha inativo). Desligamentos fica em Principais.
        var folhaEmQualquerGrupo = resp.Grupos
            .SelectMany(g => g.Itens)
            .Any(i => i.Href.StartsWith("/gestao/batida-ponto")
                   || i.Href.StartsWith("/gestao/comissoes")
                   || i.Href.StartsWith("/gestao/desligamentos/entrevista"));
        Assert.False(folhaEmQualquerGrupo);
    }

    [Fact]
    public void Build_AnalistaRh_VeDesligamentosAposSolicitacoes()
    {
        var resp = NavegacaoSidebarService.Build(
            permissions: new[] { "solicitacoes-vaga.view", "folha.desligamentos.view" },
            enabledModuleKeys: TodosModulosHabilitados(),
            contextoEspecial: null);

        var principais = resp.Grupos.Single(g => g.Key == "principais");
        var hrefs = principais.Itens.Select(i => i.Href).ToList();
        var idxSolicitacoes = hrefs.IndexOf("/gestao/solicitacoes");
        var idxDesligamentos = hrefs.IndexOf("/gestao/desligamentos");
        Assert.True(idxSolicitacoes >= 0);
        Assert.True(idxDesligamentos >= 0);
        Assert.True(idxDesligamentos > idxSolicitacoes);
        Assert.True(principais.Itens.First(i => i.Href == "/gestao/desligamentos").Acessivel);
    }

    [Fact]
    public void Build_ModuloDesativadoNoTenant_MarcaComoPacoteNaoContratado()
    {
        // Desabilita "matching" (pertence a recrutamento-selecao, que está ativo)
        var enabled = TodosModulosHabilitados();
        enabled.Remove("matching");

        var resp = NavegacaoSidebarService.Build(
            permissions: new[] { "*" },
            enabledModuleKeys: enabled,
            contextoEspecial: null);

        var matching = resp.Grupos
            .SelectMany(g => g.Itens)
            .FirstOrDefault(i => i.Href == "/assistente-ia");

        Assert.NotNull(matching);
        Assert.False(matching!.Acessivel);
        Assert.Equal(MotivoBloqueioNav.PacoteNaoContratado, matching.MotivoBloqueio);
    }

    [Fact]
    public void Build_ModuloStandaloneDesativado_IgnoraItensPorCompleto()
    {
        // Relatórios é standalone (sem pacote). Gate atual: quando o módulo está OFF para o tenant,
        // o sidebar omite os itens (não aparecem bloqueados) — igual módulos fora do contrato pacoteados.
        var enabled = TodosModulosHabilitados();
        enabled.Remove("relatorios");

        var resp = NavegacaoSidebarService.Build(
            permissions: new[] { "*" },
            enabledModuleKeys: enabled,
            contextoEspecial: null);

        var rel = resp.Grupos
            .SelectMany(g => g.Itens)
            .FirstOrDefault(i => i.Href == "/relatorios");

        Assert.Null(rel);
    }

    [Fact]
    public void Build_ItemCore_NuncaBloqueadoPorModulo()
    {
        // Cadastros é core — mesmo "sem o módulo habilitado" no set, deve permanecer acessível.
        // 31.2: /areas foi absorvido por /centros-custo, que herdou a posição no bucket.
        var enabled = new HashSet<string>(StringComparer.OrdinalIgnoreCase); // vazio propositalmente

        var resp = NavegacaoSidebarService.Build(
            permissions: new[] { "*" },
            enabledModuleKeys: enabled,
            contextoEspecial: null);

        var centrosCusto = resp.Grupos.SelectMany(g => g.Itens).FirstOrDefault(i => i.Href == "/centros-custo");
        Assert.NotNull(centrosCusto);
        Assert.True(centrosCusto!.Acessivel);
        Assert.Null(centrosCusto.MotivoBloqueio);
    }

    // ── Agrupamento (bucket de UI) ─────────────────────────────────────────

    [Fact]
    public void Build_DashboardVaiParaPrincipais()
    {
        var resp = NavegacaoSidebarService.Build(
            permissions: new[] { "dashboard.view" },
            enabledModuleKeys: TodosModulosHabilitados(),
            contextoEspecial: null);

        var principais = resp.Grupos.FirstOrDefault(g => g.Key == "principais");
        Assert.NotNull(principais);
        Assert.Contains(principais!.Itens, i => i.Href == "/dashboard");
    }

    [Fact]
    public void Build_PendenciasESolicitacoes_AprovacoesSomenteOwner()
    {
        var respTenant = NavegacaoSidebarService.Build(
            permissions: new[] { "aprovacoes-vaga.view", "solicitacoes-vaga.view" },
            enabledModuleKeys: TodosModulosHabilitados(),
            contextoEspecial: null);

        var principaisTenant = respTenant.Grupos.Single(g => g.Key == "principais");
        Assert.DoesNotContain(principaisTenant.Itens, i => i.Href == "/gestao/aprovacoes");
        Assert.Contains(principaisTenant.Itens, i => i.Href == "/gestao/solicitacoes");

        var respOwner = NavegacaoSidebarService.Build(
            permissions: new[] { "*" },
            enabledModuleKeys: TodosModulosHabilitados(),
            contextoEspecial: "owner-em-tenant");

        var principaisOwner = respOwner.Grupos.Single(g => g.Key == "principais");
        Assert.Contains(principaisOwner.Itens, i => i.Href == "/gestao/aprovacoes");
        Assert.Contains(principaisOwner.Itens, i => i.Href == "/gestao/solicitacoes");
    }

    [Fact]
    public void Build_ItensDeRecrutamento_VaoParaBucketDoPacote()
    {
        var resp = NavegacaoSidebarService.Build(
            permissions: new[] { "vagas.view", "candidatos.view", "admissao.view" },
            enabledModuleKeys: TodosModulosHabilitados(),
            contextoEspecial: null);

        var pacote = resp.Grupos.FirstOrDefault(g => g.Key == "recrutamento-selecao");
        Assert.NotNull(pacote);
        Assert.Contains(pacote!.Itens, i => i.Href == "/vagas");
        Assert.Contains(pacote.Itens, i => i.Href == "/candidatos");
        Assert.Contains(pacote.Itens, i => i.Href == "/admissao");
    }

    [Fact]
    public void Build_ItensDeGestao_VaoParaBucketGestaoPessoas()
    {
        var resp = NavegacaoSidebarService.Build(
            permissions: new[] { "gestao.dashboard", "feedback.send" },
            enabledModuleKeys: TodosModulosHabilitados(),
            contextoEspecial: null);

        var pacote = resp.Grupos.FirstOrDefault(g => g.Key == "gestao-pessoas");
        Assert.NotNull(pacote);
        Assert.Contains(pacote!.Itens, i => i.Href == "/gestao/dashboard");
        Assert.Contains(pacote.Itens, i => i.Href == "/feedback/enviar");
    }

    [Fact]
    public void Build_ItensDeCadastro_VaoParaBucketCadastros()
    {
        // 31.2: Area + Department foram colapsados em CentroCusto; o bucket
        // cadastros agora concentra o item unificado /centros-custo no lugar
        // dos antigos /areas e /departamentos.
        var resp = NavegacaoSidebarService.Build(
            permissions: new[] { "areas.view", "jobpositions.view" },
            enabledModuleKeys: TodosModulosHabilitados(),
            contextoEspecial: null);

        var cadastros = resp.Grupos.FirstOrDefault(g => g.Key == "cadastros");
        Assert.NotNull(cadastros);
        Assert.Contains(cadastros!.Itens, i => i.Href == "/centros-custo");
        Assert.Contains(cadastros.Itens, i => i.Href == "/cargos");
        Assert.DoesNotContain(cadastros.Itens, i => i.Href == "/areas");
        Assert.DoesNotContain(cadastros.Itens, i => i.Href == "/departamentos");
    }

    [Fact]
    public void Build_ItensDeAdministracao_VaoParaBucketAdministracao()
    {
        var resp = NavegacaoSidebarService.Build(
            permissions: new[] { "users.read", "roles.manage", "logs.view" },
            enabledModuleKeys: TodosModulosHabilitados(),
            contextoEspecial: null);

        var admin = resp.Grupos.FirstOrDefault(g => g.Key == "administracao");
        Assert.NotNull(admin);
        Assert.Contains(admin!.Itens, i => i.Href == "/admin/users");
        Assert.Contains(admin.Itens, i => i.Href == "/admin/roles");
        Assert.Contains(admin.Itens, i => i.Href == "/admin/logs");
    }

    [Fact]
    public void Build_ItensDeConfiguracao_VaoParaBucketConfiguracoes()
    {
        var resp = NavegacaoSidebarService.Build(
            permissions: new[] { "email-config.manage", "entra-config.manage", "localization-config.manage" },
            enabledModuleKeys: TodosModulosHabilitados(),
            contextoEspecial: null);

        var cfg = resp.Grupos.FirstOrDefault(g => g.Key == "configuracoes");
        Assert.NotNull(cfg);
        Assert.Contains(cfg!.Itens, i => i.Href == "/admin/email-config");
        Assert.Contains(cfg.Itens, i => i.Href == "/admin/entra-id");
        Assert.Contains(cfg.Itens, i => i.Href == "/admin/localization");
    }

    [Fact]
    public void Build_Relatorios_VaoParaBucketRelatorios()
    {
        var resp = NavegacaoSidebarService.Build(
            permissions: new[] { "relatorios.view" },
            enabledModuleKeys: TodosModulosHabilitados(),
            contextoEspecial: null);

        var rel = resp.Grupos.FirstOrDefault(g => g.Key == "relatorios");
        Assert.NotNull(rel);
        Assert.Contains(rel!.Itens, i => i.Href == "/relatorios");
    }

    // ── Ordenação ──────────────────────────────────────────────────────────

    [Fact]
    public void Build_GruposVemOrdenadosPorOrdem()
    {
        var resp = NavegacaoSidebarService.Build(
            permissions: new[] { "*" },
            enabledModuleKeys: TodosModulosHabilitados(),
            contextoEspecial: null);

        var ordens = resp.Grupos.Select(g => g.Ordem).ToList();
        var ordenadas = ordens.OrderBy(x => x).ToList();
        Assert.Equal(ordenadas, ordens);
    }

    [Fact]
    public void Build_PrincipaisAparecePrimeiro()
    {
        var resp = NavegacaoSidebarService.Build(
            permissions: new[] { "*" },
            enabledModuleKeys: TodosModulosHabilitados(),
            contextoEspecial: null);

        Assert.Equal("principais", resp.Grupos.First().Key);
    }

    [Fact]
    public void Build_PrincipaisTemOcultarHeaderTrue()
    {
        var resp = NavegacaoSidebarService.Build(
            permissions: new[] { "*" },
            enabledModuleKeys: TodosModulosHabilitados(),
            contextoEspecial: null);

        var principais = resp.Grupos.First(g => g.Key == "principais");
        Assert.True(principais.OcultarHeader);
    }

    [Fact]
    public void Build_ItensDoGrupoSaoOrdenadosPorOrdemAscendente()
    {
        var resp = NavegacaoSidebarService.Build(
            permissions: new[] { "*" },
            enabledModuleKeys: TodosModulosHabilitados(),
            contextoEspecial: null);

        foreach (var grupo in resp.Grupos)
        {
            var ordens = grupo.Itens.Select(i => i.Ordem).ToList();
            var ordenadas = ordens.OrderBy(x => x).ToList();
            Assert.Equal(ordenadas, ordens);
        }
    }

    [Fact]
    public void Build_GruposVaziosNaoSaoEmitidos()
    {
        var resp = NavegacaoSidebarService.Build(
            permissions: new[] { "dashboard.view" },
            enabledModuleKeys: TodosModulosHabilitados(),
            contextoEspecial: null);

        Assert.All(resp.Grupos, g => Assert.NotEmpty(g.Itens));
    }

    // ── Consistência do manifesto ──────────────────────────────────────────

    [Fact]
    public void Manifest_TodosItensTemIdUnico()
    {
        var duplicatas = NavegacaoManifest.Items
            .GroupBy(i => i.Id)
            .Where(g => g.Count() > 1)
            .Select(g => g.Key)
            .ToList();

        Assert.Empty(duplicatas);
    }

    [Fact]
    public void Manifest_TodosItensTemHrefPreenchido()
    {
        Assert.All(NavegacaoManifest.Items, item =>
        {
            Assert.False(string.IsNullOrWhiteSpace(item.Href));
            Assert.StartsWith("/", item.Href);
        });
    }

    [Fact]
    public void Manifest_ResolveModuleKey_EncontraModuloParaTodosItens()
    {
        foreach (var item in NavegacaoManifest.Items)
        {
            var moduloKey = item.ModuloKeyOverride
                ?? ModuleCatalog.ResolveModuleKey(item.PermissionKey);
            Assert.NotNull(moduloKey);
            Assert.NotNull(ModuleCatalog.GetByKey(moduloKey!));
        }
    }

    [Fact]
    public void Manifest_TodosOverridesDeGrupoReferemGrupoExistente()
    {
        foreach (var item in NavegacaoManifest.Items.Where(i => !string.IsNullOrEmpty(i.GrupoUiOverride)))
        {
            Assert.NotNull(NavegacaoManifest.GetGrupo(item.GrupoUiOverride!));
        }
    }

    // ── Contexto especial ──────────────────────────────────────────────────

    [Fact]
    public void Build_PropagaContextoEspecial()
    {
        var resp = NavegacaoSidebarService.Build(
            permissions: new[] { "*" },
            enabledModuleKeys: TodosModulosHabilitados(),
            contextoEspecial: "owner-em-tenant");

        Assert.Equal("owner-em-tenant", resp.ContextoEspecial);
    }

    [Fact]
    public void Build_OwnerEmTenant_PortalAdmissaoComTenantIdNaUrl()
    {
        var resp = NavegacaoSidebarService.Build(
            permissions: new[] { "*" },
            enabledModuleKeys: TodosModulosHabilitados(),
            contextoEspecial: "owner-em-tenant",
            tenantId: "demo");

        var recrutamento = resp.Grupos.FirstOrDefault(g => g.Key == "recrutamento-selecao");
        Assert.NotNull(recrutamento);
        var item = recrutamento!.Itens.FirstOrDefault(i => i.Id == "nav-portal-admissao");
        Assert.NotNull(item);
        Assert.Equal("/DocumentoAdmissao?tenantId=demo", item!.Href);
        Assert.True(item.OpenInNewTab);
    }

    // ── Alinhamento de buckets (Fase C) ────────────────────────────────────

    [Fact]
    public void Manifest_DeclaraOsOitoBucketsEsperados()
    {
        var esperados = new[]
        {
            "principais",
            "recrutamento-selecao",
            "gestao-pessoas",
            "folha-pagamento",
            "cadastros",
            "configuracoes",
            "administracao",
            "relatorios",
        };

        var declarados = NavegacaoManifest.Grupos.Select(g => g.Key).ToArray();
        Assert.Equal(esperados, declarados);
    }

    [Fact]
    public void Build_FolhaPagamento_ItensSumuemQuandoPacoteInativo()
    {
        // Com o pacote folha-pagamento inativo no catálogo, nenhum dos itens
        // de folha deve ser emitido pela sidebar (sem cadeado, sem vestígio).
        // Quando o produto Folha existir, basta mudar IsActive=true no PackageCatalog
        // e os itens voltam pelo fluxo padrão (com gate por pacote contratado).
        var resp = NavegacaoSidebarService.Build(
            permissions: new[] { "*" },
            enabledModuleKeys: TodosModulosHabilitados(),
            contextoEspecial: null);

        var folha = resp.Grupos.FirstOrDefault(g => g.Key == "folha-pagamento");
        Assert.Null(folha);

        var hrefs = resp.Grupos.SelectMany(g => g.Itens).Select(i => i.Href).ToList();
        Assert.DoesNotContain("/gestao/batida-ponto", hrefs);
        Assert.DoesNotContain("/gestao/comissoes", hrefs);
        Assert.DoesNotContain("/gestao/desligamentos/entrevista-template", hrefs);
        // Desligamentos operacional fica em Principais (fora do pacote folha inativo).
        Assert.Contains("/gestao/desligamentos", hrefs);
    }

    [Fact]
    public void Build_SlaVagas_VaiParaCadastrosPorOverride()
    {
        // SLA de Vagas (rota /sla-vagas, antes /eixo-vaga) tem permissão vagas.view
        // (módulo recrutamento) mas pertence visualmente aos cadastros — via
        // GrupoUiOverride="cadastros".
        var resp = NavegacaoSidebarService.Build(
            permissions: new[] { "vagas.view" },
            enabledModuleKeys: TodosModulosHabilitados(),
            contextoEspecial: null);

        var cadastros = resp.Grupos.FirstOrDefault(g => g.Key == "cadastros");
        Assert.NotNull(cadastros);
        Assert.Contains(cadastros!.Itens, i => i.Href == "/sla-vagas");
    }

    [Fact]
    public void Build_ApiKeysETenantConfig_VaoParaConfiguracoesPorOverride()
    {
        var resp = NavegacaoSidebarService.Build(
            permissions: new[] { "*" },
            enabledModuleKeys: TodosModulosHabilitados(),
            contextoEspecial: null);

        var cfg = resp.Grupos.FirstOrDefault(g => g.Key == "configuracoes");
        Assert.NotNull(cfg);
        Assert.Contains(cfg!.Itens, i => i.Href == "/admin/api-keys");
        Assert.Contains(cfg.Itens, i => i.Href == "/admin/tenant-configuracao");
    }
}
