using RhPortal.Api.Application.Navegacao;
using RhPortal.Api.Infrastructure.Modules;
using RhPortal.Api.Infrastructure.Navegacao;
using Xunit;

namespace RhPortal.Api.Tests.Navegacao;

/// <summary>
/// Garante que <see cref="ModuleScreensResolver"/> é a única fonte de verdade para
/// "quais telas cada módulo entrega", derivando do <see cref="NavegacaoManifest"/>
/// pelo mesmo mecanismo que a sidebar usa. Qualquer drift aqui implica que a tela
/// do Owner fica desalinhada da navegação real do admin.
/// </summary>
public sealed class ModuleScreensResolverTests
{
    // ── Cobertura total ────────────────────────────────────────────────────

    [Fact]
    public void TodosOsItensDoManifesto_SaoAssociadosAumModulo()
    {
        var totalItensManifesto = NavegacaoManifest.Items.Count;
        var totalTelasMapeadas = ModuleScreensResolver.GetAll().Values.Sum(list => list.Count);

        // Todo item do manifesto tem permission → ResolveModuleKey/override sempre acha módulo.
        // Se algum item ficar órfão, a contagem diverge e o Owner perde visibilidade.
        Assert.Equal(totalItensManifesto, totalTelasMapeadas);
    }

    [Fact]
    public void ModulosComTelasNoManifesto_AparecemNoMapa()
    {
        // Todos os módulos declarados no ModuleCatalog DEVEM ter telas no manifesto.
        // (Antes da Sessão 30 'desempenho' estava declarado mas sem UI — essa lacuna
        // foi fechada com a adição de "Minhas Avaliações", "Ciclos de Avaliação" e
        // "Nine Box" ao bucket Gestão de Pessoas.) Se algum sair do manifesto, é
        // regressão séria.
        var map = ModuleScreensResolver.GetAll();

        var modulosObrigatorios = new[]
        {
            "dashboard", "administracao", "cadastros", "configuracoes",
            "recrutamento", "candidatos", "matching", "portal-vagas", "admissao", "agenda",
            "feedback", "gestao", "desempenho", "folha-pagamento", "relatorios",
        };
        foreach (var key in modulosObrigatorios)
        {
            Assert.True(map.ContainsKey(key),
                $"Módulo '{key}' perdeu suas telas no manifesto — regressão detectada.");
            Assert.NotEmpty(map[key]);
        }
    }

    // ── Mapeamento específico do pacote R&S (caso real do produto) ────────

    [Fact]
    public void RecrutamentoModule_InclueVagasEProcessoSeletivo()
    {
        var telas = ModuleScreensResolver.GetScreensForModule("recrutamento");
        var hrefs = telas.Select(t => t.Href).ToList();
        Assert.Contains("/vagas", hrefs);
        Assert.Contains("/gestao/processo-seletivo", hrefs);
    }

    [Fact]
    public void CandidatosModule_IncluiKanbanPipelineEBancoDeTalentos()
    {
        var telas = ModuleScreensResolver.GetScreensForModule("candidatos");
        var hrefs = telas.Select(t => t.Href).ToList();
        Assert.Contains("/candidatos", hrefs);
        Assert.Contains("/recrutamento/candidaturas", hrefs);
        Assert.Contains("/triagem", hrefs);
        Assert.Contains("/talentos", hrefs); // via ModuloKeyOverride="candidatos"
    }

    [Fact]
    public void PortalVagasModule_IncluiPainelRH_PorqueUsaEntradaView()
    {
        // /painel-rh tem permission entrada.view → portal-vagas (via PermissionKeyPrefixes)
        var telas = ModuleScreensResolver.GetScreensForModule("portal-vagas");
        var hrefs = telas.Select(t => t.Href).ToList();
        Assert.Contains("/painel-rh", hrefs);
        Assert.Contains("/portalvagas", hrefs);
    }

    [Fact]
    public void MatchingModule_IncluiApenasMatching()
    {
        var telas = ModuleScreensResolver.GetScreensForModule("matching");
        Assert.Single(telas);
        Assert.Equal("/assistente-ia", telas[0].Href);
    }

    [Fact]
    public void DesempenhoModule_IncluiMinhasAvaliacoesECiclosENineBox()
    {
        // Fechamento do follow-up da Sessão 27 — 'desempenho' sai da lista de
        // lacunas de produto. Backend já existia desde a Sessão 21/22 (ciclos,
        // 9-box, calibragem, convites, export CSV). Sessão 30 expôs 3 telas
        // no bucket Gestão de Pessoas, todas resolvendo para o módulo 'desempenho'
        // via PermissionKeyPrefixes=["desempenho."] no ModuleCatalog.
        var telas = ModuleScreensResolver.GetScreensForModule("desempenho");
        var hrefs = telas.Select(t => t.Href).ToList();
        Assert.Contains("/desempenho", hrefs);
        Assert.Contains("/feedback/avaliacao", hrefs);
        Assert.Contains("/feedback/nine-box", hrefs);
        Assert.Equal(3, telas.Count);

        // Todas caem no bucket Gestão de Pessoas (PackageKey="gestao-pessoas")
        Assert.All(telas, t => Assert.Equal("gestao-pessoas", t.GrupoUiKey));
        Assert.All(telas, t => Assert.Equal("Gestão de Pessoas", t.GrupoUiLabel));

        // Permissões distintas por tela — Minhas Avaliações (todos), Ciclos (RH), Nine Box (gestores)
        var minhas = telas.First(t => t.Href == "/desempenho");
        var ciclos = telas.First(t => t.Href == "/feedback/avaliacao");
        var ninebox = telas.First(t => t.Href == "/feedback/nine-box");
        Assert.Equal("desempenho.view", minhas.PermissionKey);
        Assert.Equal("desempenho.ciclos.manage", ciclos.PermissionKey);
        Assert.Equal("desempenho.calibragem.manage", ninebox.PermissionKey);
    }

    [Fact]
    public void FolhaPagamentoModule_IncluiAs3Telas_AindaQuePacoteEstejaInativo()
    {
        // Resolver é puramente estrutural — ele mapeia o que o manifesto declara.
        // O gate de pacote ativo/inativo é responsabilidade do NavegacaoSidebarService
        // (que agora esconde esses itens até o pacote virar produto).
        var telas = ModuleScreensResolver.GetScreensForModule("folha-pagamento");
        var hrefs = telas.Select(t => t.Href).ToList();
        Assert.Contains("/gestao/batida-ponto", hrefs);
        Assert.Contains("/gestao/comissoes", hrefs);
        Assert.Contains("/gestao/desligamentos", hrefs);
    }

    // ── Metadados das telas ────────────────────────────────────────────────

    [Fact]
    public void TelasTemGrupoUiResolvidoIgualAoManifesto()
    {
        var telas = ModuleScreensResolver.GetScreensForModule("recrutamento");
        Assert.All(telas, t =>
        {
            Assert.False(string.IsNullOrWhiteSpace(t.GrupoUiKey));
            Assert.False(string.IsNullOrWhiteSpace(t.GrupoUiLabel));
        });

        // /vagas pertence ao bucket recrutamento-selecao
        var vagas = telas.First(t => t.Href == "/vagas");
        Assert.Equal("recrutamento-selecao", vagas.GrupoUiKey);
        Assert.Equal("Recrutamento e Seleção", vagas.GrupoUiLabel);
    }

    [Fact]
    public void TelasSaoRetornadasOrdenadas()
    {
        foreach (var (_, telas) in ModuleScreensResolver.GetAll())
        {
            var ordens = telas.Select(t => t.Ordem).ToList();
            var ordenadas = ordens.OrderBy(o => o).ToList();
            Assert.Equal(ordenadas, ordens);
        }
    }

    [Fact]
    public void ModuloInexistente_RetornaListaVazia()
    {
        var telas = ModuleScreensResolver.GetScreensForModule("nao-existe");
        Assert.Empty(telas);
    }

    [Fact]
    public void ModuloKeyVazia_RetornaListaVazia()
    {
        Assert.Empty(ModuleScreensResolver.GetScreensForModule(""));
        Assert.Empty(ModuleScreensResolver.GetScreensForModule("   "));
    }

    // ── Consistência com NavegacaoSidebarService ──────────────────────────

    [Fact]
    public void Resolver_ResolveMesmaGrupoUi_QueONavegacaoSidebarService()
    {
        // Para cada item do manifesto, a gruoUiKey emitida pelo resolver DEVE bater
        // com a gruoUiKey que o sidebar calcula. Assim a tela do Owner ("tela X fica
        // em bucket Y") corresponde à posição real no menu do admin.
        foreach (var item in NavegacaoManifest.Items)
        {
            var moduloKey = item.ModuloKeyOverride ?? ModuleCatalog.ResolveModuleKey(item.PermissionKey);
            if (moduloKey is null) continue;

            var telasDoModulo = ModuleScreensResolver.GetScreensForModule(moduloKey);
            var telaCorrespondente = telasDoModulo.FirstOrDefault(t => t.Id == item.Id);
            Assert.NotNull(telaCorrespondente);

            var modulo = ModuleCatalog.GetByKey(moduloKey);
            var grupoEsperado = NavegacaoManifest.ResolveGrupoUi(item, modulo);
            Assert.Equal(grupoEsperado, telaCorrespondente!.GrupoUiKey);
        }
    }
}
