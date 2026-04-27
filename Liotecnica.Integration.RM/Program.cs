using Liotecnica.Integration.RM;
using Liotecnica.Integration.RM.Schema;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var runClean = args.Length > 0 && string.Equals(args[0], "clean", StringComparison.OrdinalIgnoreCase);
var runCleanCandidatos = args.Length > 0 && string.Equals(args[0], "clean-candidatos", StringComparison.OrdinalIgnoreCase);
var runCleanCandidatosAndSync = args.Length > 0 && string.Equals(args[0], "clean-candidatos-and-sync", StringComparison.OrdinalIgnoreCase);
var runCleanCandidatosTalentos = args.Length > 0 && string.Equals(args[0], "clean-candidatos-talentos", StringComparison.OrdinalIgnoreCase);
var runCleanCandidatosTalentosAndSync = args.Length > 0 && string.Equals(args[0], "clean-candidatos-talentos-and-sync", StringComparison.OrdinalIgnoreCase);
var runExtractOnly = args.Length > 0 && string.Equals(args[0], "extract", StringComparison.OrdinalIgnoreCase);
var runExtractCv = args.Length > 0 && string.Equals(args[0], "extract-cv", StringComparison.OrdinalIgnoreCase);
var runImportCv10 = args.Length > 0 && string.Equals(args[0], "import-cv-10", StringComparison.OrdinalIgnoreCase);
var runImportCvByTalento = args.Length > 0 && string.Equals(args[0], "import-cv-by-talento", StringComparison.OrdinalIgnoreCase);
var runSyncOnce = args.Length > 0 && string.Equals(args[0], "sync", StringComparison.OrdinalIgnoreCase);
var runSyncFull = runSyncOnce && args.Any(a => string.Equals(a, "--full", StringComparison.OrdinalIgnoreCase));
var runSyncOne = args.Length > 0 && string.Equals(args[0], "sync-one", StringComparison.OrdinalIgnoreCase);
var runSyncClayton = args.Length > 0 && string.Equals(args[0], "sync-clayton", StringComparison.OrdinalIgnoreCase);
var runSyncHistSal = args.Length > 0 && string.Equals(args[0], "sync-historico-salarial", StringComparison.OrdinalIgnoreCase);
var runSyncFuncionariosOnly = args.Length > 0 && string.Equals(args[0], "sync-funcionarios", StringComparison.OrdinalIgnoreCase);
var runSyncPessoasBulk = args.Length > 0 && string.Equals(args[0], "sync-pessoas-bulk", StringComparison.OrdinalIgnoreCase);
var runSyncVagasOnly = args.Length > 0 && string.Equals(args[0], "sync-vagas", StringComparison.OrdinalIgnoreCase);
var runSyncDesligamentosOnly = args.Length > 0 && string.Equals(args[0], "sync-desligamentos", StringComparison.OrdinalIgnoreCase);

var builder = Host.CreateApplicationBuilder(args);

if (runSyncOne)
{
    builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
    {
        ["RmSync:MaxTalentosToSync"] = "1",
        ["RmSync:MaxCandidatosToSync"] = "1",
        // sync-one é smoke test — sem este cap, a API recebe 7938 POSTs em pessoa (~4h).
        ["RmSync:MaxPessoasToSync"] = "1"
    });
}
if (runSyncClayton)
{
    builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
    {
        ["RmSync:MaxTalentosToSync"] = "1",
        ["RmSync:MaxCandidatosToSync"] = "1",
        ["RmSync:SyncOnlyEmail"] = "claytonhamada@gmail.com",
        ["RmSync:SyncCandidatosPerfilCv"] = "true"
    });
}

builder.Services.Configure<RmSchemaOptions>(builder.Configuration.GetSection(RmSchemaOptions.SectionName));
builder.Services.Configure<RmConnectionOptions>(builder.Configuration.GetSection(RmConnectionOptions.SectionName));
builder.Services.Configure<PortalApiOptions>(builder.Configuration.GetSection(PortalApiOptions.SectionName));
builder.Services.Configure<OutputOptions>(builder.Configuration.GetSection(OutputOptions.SectionName));
builder.Services.Configure<RmSyncOptions>(builder.Configuration.GetSection(RmSyncOptions.SectionName));

builder.Services.AddSingleton<ExtractionLogWriter>();
builder.Services.AddSingleton<RmDataExtractor>();
builder.Services.AddSingleton<PortalHierarquiaSyncService>();
builder.Services.AddSingleton<PortalDesligamentoSyncService>();
builder.Services.AddSingleton<PortalFuncionarioMovimentacaoSyncService>();
builder.Services.AddSingleton<PortalEmpresaSyncService>();
builder.Services.AddSingleton<PortalAreaSyncService>();
builder.Services.AddSingleton<PortalCategoriaSyncService>();
builder.Services.AddSingleton<PortalCargoSyncService>();
builder.Services.AddSingleton<PortalUnitSyncService>();
builder.Services.AddSingleton<PortalPessoaSyncService>();
builder.Services.AddSingleton<PortalFuncionarioSyncService>();
builder.Services.AddSingleton<PortalVagaSyncService>();
builder.Services.AddSingleton<PortalTalentoSyncService>();
builder.Services.AddSingleton<PortalCandidatoVagaSyncService>();
builder.Services.AddSingleton<PortalIntegrationCleanupService>();
builder.Services.AddSingleton<PortalHistoricoSalarialSyncService>();
builder.Services.AddSingleton<PortalPessoaBulkSyncService>();
builder.Services.AddSingleton<ImportCvToPortalService>();
builder.Services.AddHttpClient<PortalApiClient>()
    .ConfigurePrimaryHttpMessageHandler(() =>
    {
        var handler = new HttpClientHandler();
        if (builder.Environment.IsDevelopment())
            handler.ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator;
        return handler;
    });

if (runSyncOnce || runSyncOne || runSyncClayton || runCleanCandidatosAndSync || runCleanCandidatosTalentosAndSync)
    builder.Services.AddSingleton<RmSyncWorker>();
else if (!runClean && !runCleanCandidatos && !runCleanCandidatosTalentos && !runCleanCandidatosAndSync && !runCleanCandidatosTalentosAndSync && !runExtractOnly && !runExtractCv && !runImportCv10 && !runImportCvByTalento && !runSyncOne && !runSyncClayton && !runSyncHistSal && !runSyncFuncionariosOnly && !runSyncPessoasBulk && !runSyncVagasOnly && !runSyncDesligamentosOnly)
    builder.Services.AddHostedService<RmSyncWorker>();

var host = builder.Build();

if (runClean)
{
    var cleanup = host.Services.GetRequiredService<PortalIntegrationCleanupService>();
    await cleanup.RunCleanupAsync();
    return;
}

if (runCleanCandidatos)
{
    var cleanup = host.Services.GetRequiredService<PortalIntegrationCleanupService>();
    await cleanup.DeleteAllCandidatosAsync();
    return;
}

if (runCleanCandidatosAndSync)
{
    var cleanup = host.Services.GetRequiredService<PortalIntegrationCleanupService>();
    await cleanup.DeleteAllCandidatosAsync();
    var worker = host.Services.GetRequiredService<RmSyncWorker>();
    await worker.RunOneCycleAsync(CancellationToken.None);
    return;
}

if (runCleanCandidatosTalentos)
{
    var cleanup = host.Services.GetRequiredService<PortalIntegrationCleanupService>();
    await cleanup.DeleteAllCandidatosAndTalentosViaApiAsync();
    return;
}

if (runCleanCandidatosTalentosAndSync)
{
    var cleanup = host.Services.GetRequiredService<PortalIntegrationCleanupService>();
    await cleanup.DeleteAllCandidatosAndTalentosViaApiAsync();
    var worker = host.Services.GetRequiredService<RmSyncWorker>();
    await worker.RunOneCycleAsync(CancellationToken.None);
    return;
}

if (runExtractOnly)
{
    var extractor = host.Services.GetRequiredService<RmDataExtractor>();
    var ct = CancellationToken.None;
    await extractor.ExtractSchemaAsync(ct);
    await extractor.ExtractAndSaveAsync(watermarks: null, ct: ct);
    return;
}

if (runExtractCv)
{
    var extractor = host.Services.GetRequiredService<RmDataExtractor>();
    await extractor.ExtractCurriculosCvAsync(CancellationToken.None);
    return;
}

if (runImportCv10)
{
    var importCv = host.Services.GetRequiredService<ImportCvToPortalService>();
    var count = await importCv.ImportCvCandidatesAsync(10, CancellationToken.None);
    return;
}

if (runImportCvByTalento)
{
    if (args.Length < 3)
    {
        Console.WriteLine("Uso: dotnet run -- import-cv-by-talento <TalentoId> <caminho-do-PDF>");
        Console.WriteLine("Exemplo: dotnet run -- import-cv-by-talento A1B2C3D4-... ./CV/12345678901/curriculo.pdf");
        return;
    }
    var talentoIdStr = args[1].Trim();
    var pdfPath = args[2].Trim();
    if (!Guid.TryParse(talentoIdStr, out var talentoId))
    {
        Console.WriteLine("TalentoId inválido (deve ser um GUID).");
        return;
    }
    var importCv = host.Services.GetRequiredService<ImportCvToPortalService>();
    var enviarParaGpt = args.Length > 3 && string.Equals(args[3], "gpt", StringComparison.OrdinalIgnoreCase);
    var ok = await importCv.ImportCvByTalentoAsync(talentoId, pdfPath, enviarParaGpt, CancellationToken.None);
    Console.WriteLine(ok ? "PDF importado para o talento." : "Falha ao importar PDF.");
    return;
}

if (runSyncOnce)
{
    if (runSyncFull)
    {
        // CLI `sync --full` — zera todos os checkpoints antes do ciclo, forçando varredura completa
        // de todas as tabelas incrementais. Safety net pra corrigir registros perdidos por bug de watermark.
        var portal = host.Services.GetRequiredService<PortalApiClient>();
        await portal.ResetAllCheckpointsAsync(CancellationToken.None);
        Console.WriteLine("[sync --full] checkpoints resetados; iniciando ciclo full.");
    }
    var worker = host.Services.GetRequiredService<RmSyncWorker>();
    await worker.RunOneCycleAsync(CancellationToken.None);
    return;
}

if (runSyncHistSal)
{
    var svc = host.Services.GetRequiredService<PortalHistoricoSalarialSyncService>();
    await svc.SyncAsync(CancellationToken.None);
    return;
}

if (runSyncFuncionariosOnly)
{
    // Roda só PortalFuncionarioSync — usa funcionario.json + pessoa.json já extraídos.
    // Pula Pessoa/Talento/CandidatoVaga (lentos) e re-aplica DataAdmissao + Nacionalidade.
    var svc = host.Services.GetRequiredService<PortalFuncionarioSyncService>();
    await svc.SyncFuncionariosFromFuncionarioJsonAsync(CancellationToken.None);
    return;
}

if (runSyncPessoasBulk)
{
    // Sync rápido de pessoas (~2700 candidatos puros) via /api/pessoas/bulk em chunks de 500.
    // Pula CODPESSOAs já populados pelo sync de funcionários.
    var svc = host.Services.GetRequiredService<PortalPessoaBulkSyncService>();
    await svc.SyncAsync(CancellationToken.None);
    return;
}

if (runSyncVagasOnly)
{
    // Sync só de vagas a partir de vaga.json + aumento_quadro.json + substituicao.json + funcao.json.
    var svc = host.Services.GetRequiredService<PortalVagaSyncService>();
    await svc.SyncVagasFromVagaJsonAsync(CancellationToken.None);
    return;
}

if (runSyncDesligamentosOnly)
{
    // Re-sync desligamentos com lookup oficial PTPDEMISSAO + PMOTDEMISSAO.
    var svc = host.Services.GetRequiredService<PortalDesligamentoSyncService>();
    await svc.SyncDesligamentosFromJsonAsync(CancellationToken.None);
    return;
}

if (runSyncOne || runSyncClayton)
{
    var worker = host.Services.GetRequiredService<RmSyncWorker>();
    await worker.RunOneCycleAsync(CancellationToken.None);
    return;
}

await host.RunAsync();
