using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Contracts.Inbox;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RHPortal.Api.Domain.Enums;
using RhPortal.Api.Application.Matching;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Localization;
using RhPortal.Api.Infrastructure.Tenancy;
using RHPortal.Api.Domain.Entities;

namespace RhPortal.Api.Infrastructure.Inbox;

public sealed class InboxFileProcessor
{
    private static readonly Regex EmailRegex = new(
        @"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly IHostEnvironment _env;
    private readonly IHubContext<InboxHub> _hub;
    private readonly IStringLocalizer<InfrastructureMessages> _localizer;
    private readonly IMatchingService _matchingService;

    public InboxFileProcessor(
        AppDbContext db,
        ITenantContext tenantContext,
        IHostEnvironment env,
        IHubContext<InboxHub> hub,
        IStringLocalizer<InfrastructureMessages> localizer,
        IMatchingService matchingService)
    {
        _db = db;
        _tenantContext = tenantContext;
        _env = env;
        _hub = hub;
        _localizer = localizer;
        _matchingService = matchingService;
    }

    public async Task ProcessAsync(
        string tenantId,
        string filePath,
        InboxFolderOptions options,
        InboxOrigem origem,
        CancellationToken ct)
    {
        _tenantContext.SetTenantId(tenantId);

        var log = new List<string>();
        var inbox = new InboxItem
        {
            Id = Guid.NewGuid(),
            Origem = origem,
            Status = InboxStatus.Processando,
            RecebidoEm = DateTimeOffset.UtcNow,
            Assunto = Path.GetFileName(filePath),
            ProcessamentoEtapa = _localizer["InfrastructureInbox.StageStarted"],
            ProcessamentoTentativas = 1
        };

        try
        {
            if (!File.Exists(filePath))
                throw new InvalidOperationException(_localizer["InfrastructureInbox.FileNotFound"]);

            var ext = Path.GetExtension(filePath).ToLowerInvariant();
            if (!IsSupported(ext))
                throw new InvalidOperationException(_localizer["InfrastructureInbox.FileTypeNotSupported"]);

            var bytes = await File.ReadAllBytesAsync(filePath, ct);
            var hash = ComputeHash(bytes);
            var sizeKb = (int)Math.Ceiling(bytes.Length / 1024.0);

            var already = await _db.InboxAttachments.AsNoTracking()
                .AnyAsync(x => x.Hash == hash, ct);
            if (already)
            {
                inbox.Status = InboxStatus.Descartado;
                inbox.ProcessamentoEtapa = _localizer["InfrastructureInbox.StageDuplicate"];
                inbox.ProcessamentoUltimoErro = _localizer["InfrastructureInbox.FileAlreadyProcessed"];
                inbox.ProcessamentoLogRaw = JsonSerializer.Serialize(new[] { _localizer["InfrastructureInbox.FileDuplicateLog"].Value });
                inbox.Anexos.Add(new InboxAnexo
                {
                    Id = Guid.NewGuid(),
                    Nome = Path.GetFileName(filePath),
                    Tipo = ext.Trim('.'),
                    TamanhoKB = sizeKb,
                    Hash = hash
                });
                _db.InboxItems.Add(inbox);
                await _db.SaveChangesAsync(ct);
                MoveToFolder(filePath, tenantId, options.ErrorFolderName, options);
                return;
            }

            var text = await ResumeTextExtractor.ExtractAsync(filePath, ct);
            inbox.PreviewText = TakePreview(text);
            log.Add(_localizer["InfrastructureInbox.LogTextExtracted"]);

            var email = ExtractEmail(text);
            if (string.IsNullOrWhiteSpace(email))
                throw new InvalidOperationException(_localizer["InfrastructureInbox.EmailNotFound"]);

            var nome = ExtractName(text);
            if (string.IsNullOrWhiteSpace(nome))
                nome = GuessNameFromFile(filePath, email);

            log.Add(_localizer["InfrastructureInbox.LogEmail", email]);
            log.Add(_localizer["InfrastructureInbox.LogNome", nome]);
            inbox.Remetente = email;

            var vagaId = await GetOrCreateInboxVagaAsync(ct);
            if (vagaId == Guid.Empty)
                throw new InvalidOperationException(_localizer["InfrastructureInbox.VagaLinkFailed"]);

            var suggestions = await SuggestVagasAsync(text, ct);
            inbox.SuggestedVagasJson = JsonSerializer.Serialize(suggestions);

            var candidato = new Candidato
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Nome = nome,
                Email = email,
                Fonte = CandidateOrigin.Pasta,
                Status = CandidateStatus.Triagem,
                VagaId = vagaId,
                Obs = _localizer["InfrastructureInbox.OrigemPastaObs", Path.GetFileName(filePath)],
                CvText = text
            };

            var documentId = Guid.NewGuid();
            var storageFileName = BuildStorageFileName(documentId, Path.GetFileName(filePath));
            var folder = GetCandidateFolder(candidato.Id);
            Directory.CreateDirectory(folder);
            var storagePath = Path.Combine(folder, storageFileName);
            await File.WriteAllBytesAsync(storagePath, bytes, ct);

            candidato.Documentos.Add(new CandidatoDocumento
            {
                Id = documentId,
                TenantId = tenantId,
                CandidatoId = candidato.Id,
                Tipo = MapDocumentoTipo(ext),
                NomeArquivo = Path.GetFileName(filePath),
                ContentType = GetContentType(ext),
                Descricao = _localizer["InfrastructureInbox.CurriculoImportadoDescricao"],
                TamanhoBytes = bytes.Length,
                StorageFileName = storageFileName,
                Url = null
            });

            inbox.Status = InboxStatus.Processado;
            inbox.ProcessamentoEtapa = _localizer["InfrastructureInbox.StageCompleted"];
            inbox.ProcessamentoPct = 100;
            inbox.ProcessamentoLogRaw = JsonSerializer.Serialize(log);
            inbox.CandidatoId = candidato.Id;
            inbox.Anexos.Add(new InboxAnexo
            {
                Id = Guid.NewGuid(),
                Nome = Path.GetFileName(filePath),
                Tipo = ext.Trim('.'),
                TamanhoKB = sizeKb,
                Hash = hash
            });

            _db.Candidatos.Add(candidato);
            _db.InboxItems.Add(inbox);
            await _db.SaveChangesAsync(ct);

            await _matchingService.CalculateAndStoreAsync(candidato.Id, vagaId, ct);

            await PublishRealtimeAsync("processed", inbox, ct);
            MoveToFolder(filePath, tenantId, options.ProcessedFolderName, options);
        }
        catch (Exception ex)
        {
            inbox.Status = InboxStatus.Falha;
            inbox.ProcessamentoEtapa = _localizer["InfrastructureInbox.StageError"];
            inbox.ProcessamentoUltimoErro = ex.Message;
            inbox.ProcessamentoLogRaw = JsonSerializer.Serialize(log.Concat(new[] { ex.Message }));
            _db.InboxItems.Add(inbox);
            await _db.SaveChangesAsync(ct);
            await PublishRealtimeAsync("failed", inbox, ct);
            MoveToFolder(filePath, tenantId, options.ErrorFolderName, options);
        }
    }

    private async Task<Guid> GetOrCreateInboxVagaAsync(CancellationToken ct)
    {
        const string code = "BANCO-TALENTOS";
        var existing = await _db.Vagas.FirstOrDefaultAsync(x => x.Codigo == code, ct);
        if (existing is not null)
            return existing.Id;

        var area = await _db.Areas.FirstOrDefaultAsync(ct);
        var dep = await _db.Departments.FirstOrDefaultAsync(ct);
        if (area is null || dep is null)
            return Guid.Empty;

        var baseTitle = _localizer["InfrastructureInbox.VagaBaseTitulo"].Value;
        var baseDescription = _localizer["InfrastructureInbox.VagaBaseDescricao"].Value;

        var vaga = new Vaga
        {
            Id = Guid.NewGuid(),
            Codigo = code,
            Titulo = baseTitle,
            AreaId = area.Id,
            DepartmentId = dep.Id,
            Status = VagaStatus.Rascunho,
            QuantidadeVagas = 1,
            MatchMinimoPercentual = 70,
            DescricaoInterna = baseDescription,
            Visibilidade = VagaPublicacaoVisibilidade.Interna
        };

        _db.Vagas.Add(vaga);
        await _db.SaveChangesAsync(ct);
        return vaga.Id;
    }

    private async Task<IReadOnlyList<InboxSuggestedVagaDto>> SuggestVagasAsync(string text, CancellationToken ct)
    {
        var normalized = NormalizeText(text);
        if (string.IsNullOrWhiteSpace(normalized))
            return Array.Empty<InboxSuggestedVagaDto>();

        var vagas = await _db.Vagas.AsNoTracking()
            .Select(v => new { v.Id, v.Titulo, v.Codigo })
            .ToListAsync(ct);

        var scored = vagas.Select(v =>
        {
            var score = ScoreByKeywords(normalized, v.Titulo, v.Codigo);
            return new InboxSuggestedVagaDto(v.Id, v.Titulo, score);
        })
        .Where(x => x.Score > 0)
        .OrderByDescending(x => x.Score)
        .Take(3)
        .ToList();

        return scored;
    }

    private static int ScoreByKeywords(string text, string? title, string? code)
    {
        var score = 0;
        foreach (var token in Tokenize(title))
            if (text.Contains(token)) score += 2;
        foreach (var token in Tokenize(code))
            if (text.Contains(token)) score += 3;
        return score;
    }

    private static IEnumerable<string> Tokenize(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) yield break;
        var tokens = input.ToLowerInvariant().Split(new[] { ' ', '-', '/', '_', '.', ',', ';' }, StringSplitOptions.RemoveEmptyEntries);
        foreach (var t in tokens)
            if (t.Length >= 3)
                yield return t;
    }

    private static string NormalizeText(string? text)
        => (text ?? string.Empty).ToLowerInvariant();

    private static string? ExtractEmail(string text)
        => EmailRegex.Matches(text).Select(x => x.Value).FirstOrDefault();

    private static string? ExtractName(string text)
    {
        var match = Regex.Match(text, @"(?im)^\s*nome\s*[:\-]\s*(.+)$");
        if (match.Success)
            return match.Groups[1].Value.Trim();
        return null;
    }

    private string GuessNameFromFile(string filePath, string email)
    {
        var fileName = Path.GetFileNameWithoutExtension(filePath)?.Replace('_', ' ').Replace('-', ' ').Trim();
        if (!string.IsNullOrWhiteSpace(fileName) && fileName.Length >= 3)
            return fileName;

        var prefix = email.Split('@').FirstOrDefault() ?? _localizer["InfrastructureInbox.DefaultCandidateName"].Value;
        return prefix.Replace('.', ' ').Replace('-', ' ').Trim();
    }

    private static string? TakePreview(string text)
        => string.IsNullOrWhiteSpace(text) ? null : text.Trim().Substring(0, Math.Min(280, text.Length));

    private static bool IsSupported(string ext)
        => ext is ".pdf" or ".docx" or ".txt";

    private static string ComputeHash(byte[] bytes)
    {
        using var sha = SHA256.Create();
        var hash = sha.ComputeHash(bytes);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private string GetCandidateFolder(Guid candidatoId)
        => Path.Combine(_env.ContentRootPath, "App_Data", "uploads", _tenantContext.TenantId, "candidatos", candidatoId.ToString("N"));

    private static string BuildStorageFileName(Guid documentId, string originalName)
    {
        var extension = Path.GetExtension(originalName);
        if (!string.IsNullOrWhiteSpace(extension))
        {
            extension = new string(extension
                .Where(c => char.IsLetterOrDigit(c) || c == '.')
                .ToArray());

            if (extension.Length > 12)
                extension = extension[..12];
        }
        else
        {
            extension = string.Empty;
        }

        return $"{documentId:N}{extension}";
    }

    private static CandidateDocumentType MapDocumentoTipo(string ext)
        => CandidateDocumentType.Curriculo;

    private static string GetContentType(string ext)
        => ext switch
        {
            ".pdf" => "application/pdf",
            ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".txt" => "text/plain",
            _ => "application/octet-stream"
        };

    private static void MoveToFolder(string filePath, string tenantId, string folderName, InboxFolderOptions options)
    {
        try
        {
            var tenantRoot = Path.Combine(options.RootPath, tenantId);
            var targetFolder = Path.Combine(tenantRoot, folderName);
            Directory.CreateDirectory(targetFolder);
            var targetPath = Path.Combine(targetFolder, Path.GetFileName(filePath));
            if (File.Exists(targetPath))
                File.Delete(targetPath);
            File.Move(filePath, targetPath);
        }
        catch
        {
            // Best-effort
        }
    }

    private Task PublishRealtimeAsync(string action, InboxItem inbox, CancellationToken ct)
    {
        var message = new InboxRealtimeMessage(
            action,
            inbox.Id,
            inbox.Status.ToString().ToLowerInvariant(),
            inbox.RecebidoEm,
            inbox.Assunto,
            inbox.Remetente);

        // Publica para todos os clientes conectados no grupo do tenant.
        return _hub.Clients.Group(InboxHub.GetTenantGroup(_tenantContext.TenantId))
            .SendAsync($"inbox.{action}", message, ct);
    }
}
