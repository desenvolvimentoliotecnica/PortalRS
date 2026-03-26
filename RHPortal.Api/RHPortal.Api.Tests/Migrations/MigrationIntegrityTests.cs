using Xunit;

namespace RhPortal.Api.Tests.Migrations;

/// <summary>
/// Testes de integridade das migrations — garante que não há operações
/// duplicadas que quebrariam a chain de apply no PostgreSQL.
///
/// Contexto: a migration 20260325192801_AddNineBoxAssessment foi gerada
/// incluindo por engano os mesmos AddColumn que a migration anterior
/// 20260324000000_AddCamposIntegracaoPreAdmissao já tinha adicionado.
/// Isso causava erro "column already exists" ao aplicar as migrations,
/// que por sua vez impedia o startup da API e resultava em 500 em todos
/// os endpoints que escrevem no banco (criar vaga, criar pré-admissão, etc).
/// </summary>
public sealed class MigrationIntegrityTests
{
    // Navega da pasta de saída do build (bin/Debug/net8.0) até a raiz da solução
    // procurando a pasta de migrations pelo caminho relativo esperado.
    private static string? EncontrarArquivoMigration(string nomeArquivo)
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            var candidato = Path.Combine(dir.FullName, "RHPortal.Api", "RHPortal.Api", "Migrations", nomeArquivo);
            if (File.Exists(candidato)) return candidato;
            dir = dir.Parent;
        }
        return null;
    }

    // ── NineBoxAssessment ────────────────────────────────────────────────────

    [Fact]
    public void Migration_AddNineBoxAssessment_NaoContemAddColumn_IntegracaoMensagem()
    {
        var path = EncontrarArquivoMigration("20260325192801_AddNineBoxAssessment.cs");
        Assert.True(path is not null, "Arquivo de migration 20260325192801_AddNineBoxAssessment.cs não encontrado.");

        var conteudo = File.ReadAllText(path!);

        // Essa coluna já existe na migration 20260324000000_AddCamposIntegracaoPreAdmissao.
        // Se aparecer aqui também, o PostgreSQL lança "column already exists" → startup falha → 500 em tudo.
        Assert.DoesNotContain(
            "name: \"IntegracaoMensagem\"",
            conteudo,
            StringComparison.Ordinal);
    }

    [Fact]
    public void Migration_AddNineBoxAssessment_NaoContemAddColumn_IntegracaoResultado()
    {
        var path = EncontrarArquivoMigration("20260325192801_AddNineBoxAssessment.cs");
        Assert.True(path is not null, "Arquivo de migration 20260325192801_AddNineBoxAssessment.cs não encontrado.");

        var conteudo = File.ReadAllText(path!);

        Assert.DoesNotContain(
            "name: \"IntegracaoResultado\"",
            conteudo,
            StringComparison.Ordinal);
    }

    [Fact]
    public void Migration_AddNineBoxAssessment_NaoContemAddColumn_IntegradaEmUtc()
    {
        var path = EncontrarArquivoMigration("20260325192801_AddNineBoxAssessment.cs");
        Assert.True(path is not null, "Arquivo de migration 20260325192801_AddNineBoxAssessment.cs não encontrado.");

        var conteudo = File.ReadAllText(path!);

        Assert.DoesNotContain(
            "name: \"IntegradaEmUtc\"",
            conteudo,
            StringComparison.Ordinal);
    }

    [Fact]
    public void Migration_AddNineBoxAssessment_ContemCreateTable_NineBoxAssessments()
    {
        // Garante que a parte válida da migration ainda está presente.
        var path = EncontrarArquivoMigration("20260325192801_AddNineBoxAssessment.cs");
        Assert.True(path is not null, "Arquivo de migration 20260325192801_AddNineBoxAssessment.cs não encontrado.");

        var conteudo = File.ReadAllText(path!);

        Assert.Contains("NineBoxAssessments", conteudo, StringComparison.Ordinal);
        Assert.Contains("CreateTable", conteudo, StringComparison.Ordinal);
    }

    // ── AddCamposIntegracaoPreAdmissao (migration original) ──────────────────

    [Fact]
    public void Migration_AddCamposIntegracaoPreAdmissao_UsaSqlIdempotente()
    {
        // A migration original deve usar IF NOT EXISTS para ser segura em qualquer ambiente.
        var path = EncontrarArquivoMigration("20260324000000_AddCamposIntegracaoPreAdmissao.cs");
        Assert.True(path is not null, "Arquivo de migration 20260324000000_AddCamposIntegracaoPreAdmissao.cs não encontrado.");

        var conteudo = File.ReadAllText(path!);

        Assert.Contains("IF NOT EXISTS", conteudo, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("IntegracaoResultado", conteudo, StringComparison.Ordinal);
        Assert.Contains("IntegracaoMensagem", conteudo, StringComparison.Ordinal);
        Assert.Contains("IntegradaEmUtc", conteudo, StringComparison.Ordinal);
    }

    // ── AddVagaNomeEngessado ─────────────────────────────────────────────────

    [Fact]
    public void Migration_AddVagaNomeEngessado_ContemAddColumn_NomeEngessado()
    {
        // Garante que a migration que adiciona NomeEngessado à tabela Vagas existe
        // e contém a operação esperada — sem ela a criação de vagas falha com 500.
        var path = EncontrarArquivoMigration("20260318000000_AddVagaNomeEngessado.cs");
        Assert.True(path is not null, "Arquivo de migration 20260318000000_AddVagaNomeEngessado.cs não encontrado.");

        var conteudo = File.ReadAllText(path!);

        Assert.Contains("NomeEngessado", conteudo, StringComparison.Ordinal);
        Assert.Contains("Vagas", conteudo, StringComparison.Ordinal);
    }
}
