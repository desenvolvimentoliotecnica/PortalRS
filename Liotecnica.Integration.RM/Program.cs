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
var runSyncOne = args.Length > 0 && string.Equals(args[0], "sync-one", StringComparison.OrdinalIgnoreCase);
var runSyncClayton = args.Length > 0 && string.Equals(args[0], "sync-clayton", StringComparison.OrdinalIgnoreCase);

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
else if (!runClean && !runCleanCandidatos && !runCleanCandidatosTalentos && !runCleanCandidatosAndSync && !runCleanCandidatosTalentosAndSync && !runExtractOnly && !runExtractCv && !runImportCv10 && !runImportCvByTalento && !runSyncOne && !runSyncClayton)
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
    await extractor.ExtractAndSaveAsync(ct);
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
    var worker = host.Services.GetRequiredService<RmSyncWorker>();
    await worker.RunOneCycleAsync(CancellationToken.None);
    return;
}

if (runSyncOne || runSyncClayton)
{
    var worker = host.Services.GetRequiredService<RmSyncWorker>();
    await worker.RunOneCycleAsync(CancellationToken.None);
    return;
}

await host.RunAsync();
