using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Storage;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Cartas;

public interface ICartaService
{
    Task<CartaResult> GerarCartaDesligamentoAsync(Guid solicitacaoId, CancellationToken ct);
    Task<CartaResult> GerarCartaPromocaoAsync(Guid solicitacaoId, CancellationToken ct);
    Task<CartaResult> GerarCartaFeriasAsync(Guid solicitacaoId, CancellationToken ct);
}

public sealed class CartaService : ICartaService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly IS3StorageService _storage;

    public CartaService(AppDbContext db, ITenantContext tenantContext, IS3StorageService storage)
    {
        _db = db;
        _tenantContext = tenantContext;
        _storage = storage;
    }

    public async Task<CartaResult> GerarCartaDesligamentoAsync(Guid solicitacaoId, CancellationToken ct)
    {
        var sol = await _db.SolicitacoesDesligamento.AsNoTracking()
            .Include(s => s.Funcionario).ThenInclude(f => f != null ? f.JobPosition : null)
            .Include(s => s.Funcionario).ThenInclude(f => f != null ? f.CentroCusto : null)
            .Include(s => s.Solicitante)
            .FirstOrDefaultAsync(s => s.Id == solicitacaoId, ct)
            ?? throw new InvalidOperationException("Solicitação de desligamento não encontrada.");

        var funcionarioNome = sol.Funcionario?.Name ?? "–";
        var cargoNome = sol.Funcionario?.JobPosition?.Name ?? "–";
        var areaNome = sol.Funcionario?.CentroCusto?.Description ?? "–";
        var dataDesligamento = sol.DataDesligamento.ToString("dd/MM/yyyy");
        var tipoDesligamento = sol.TipoDesligamento.ToString();
        var motivo = sol.MotivoDesligamento;
        var solicitanteNome = sol.Solicitante?.Name ?? "–";

        var linhas = new[]
        {
            ("Carta de Desligamento", true, true),
            ("", false, false),
            ($"Funcionário: {funcionarioNome}", false, false),
            ($"Cargo: {cargoNome}", false, false),
            ($"Área: {areaNome}", false, false),
            ($"Data de Desligamento: {dataDesligamento}", false, false),
            ($"Tipo: {tipoDesligamento}", false, false),
            ("", false, false),
            ("Prezado(a),", false, false),
            ("", false, false),
            ($"Comunicamos o desligamento do(a) colaborador(a) {funcionarioNome} do quadro funcional da empresa.", false, false),
            ($"Motivo: {motivo}", false, false),
            ("", false, false),
            ("Esta carta serve como documento formal de encerramento do vínculo empregatício.", false, false),
            ("", false, false),
            ($"Atenciosamente,", false, false),
            ($"{solicitanteNome}", false, false),
            ($"Data: {DateTime.UtcNow:dd/MM/yyyy}", false, false),
        };

        var key = $"{_tenantContext.TenantId}/cartas/desligamento/{solicitacaoId:N}.docx";
        return await GerarEEntregarAsync(linhas, key, ct);
    }

    public async Task<CartaResult> GerarCartaPromocaoAsync(Guid solicitacaoId, CancellationToken ct)
    {
        var sol = await _db.SolicitacoesPromocao.AsNoTracking()
            .Include(s => s.Funcionario)
            .Include(s => s.CargoAtual)
            .Include(s => s.NovoCargo)
            .Include(s => s.CentroCustoAtual)
            .Include(s => s.NovoCentroCusto)
            .Include(s => s.Solicitante)
            .FirstOrDefaultAsync(s => s.Id == solicitacaoId, ct)
            ?? throw new InvalidOperationException("Solicitação de movimentação não encontrada.");

        var funcionarioNome = sol.Funcionario?.Name ?? "–";
        var cargoAtual = sol.CargoAtual?.Name ?? "–";
        var novoCargo = sol.NovoCargo?.Name ?? "–";
        var areaAtual = sol.CentroCustoAtual?.Description ?? "–";
        var novaArea = sol.NovoCentroCusto?.Description ?? "–";
        var dataEfetiva = sol.DataEfetiva.ToString("dd/MM/yyyy");
        var justificativa = sol.Justificativa;
        var solicitanteNome = sol.Solicitante?.Name ?? "–";

        var linhas = new[]
        {
            ("Carta de Movimentação de Pessoal", true, true),
            ("", false, false),
            ($"Funcionário: {funcionarioNome}", false, false),
            ($"Cargo Atual: {cargoAtual}", false, false),
            ($"Novo Cargo: {novoCargo}", false, false),
            ($"Área Atual: {areaAtual}", false, false),
            ($"Nova Área: {novaArea}", false, false),
            ($"Data Efetiva: {dataEfetiva}", false, false),
            ("", false, false),
            ("Prezado(a),", false, false),
            ("", false, false),
            ($"Comunicamos a movimentação do(a) colaborador(a) {funcionarioNome} conforme detalhes acima.", false, false),
            ($"Justificativa: {justificativa}", false, false),
            ("", false, false),
            ("Esta carta serve como documento formal de aprovação da movimentação.", false, false),
            ("", false, false),
            ("Atenciosamente,", false, false),
            ($"{solicitanteNome}", false, false),
            ($"Data: {DateTime.UtcNow:dd/MM/yyyy}", false, false),
        };

        var key = $"{_tenantContext.TenantId}/cartas/movimentacao/{solicitacaoId:N}.docx";
        return await GerarEEntregarAsync(linhas, key, ct);
    }

    public async Task<CartaResult> GerarCartaFeriasAsync(Guid solicitacaoId, CancellationToken ct)
    {
        var sol = await _db.SolicitacoesFerias.AsNoTracking()
            .Include(s => s.Solicitante).ThenInclude(f => f != null ? f.JobPosition : null)
            .Include(s => s.Solicitante).ThenInclude(f => f != null ? f.CentroCusto : null)
            .FirstOrDefaultAsync(s => s.Id == solicitacaoId, ct)
            ?? throw new InvalidOperationException("Solicitação de férias não encontrada.");

        var funcionarioNome = sol.Solicitante?.Name ?? "–";
        var cargoNome = sol.Solicitante?.JobPosition?.Name ?? "–";
        var areaNome = sol.Solicitante?.CentroCusto?.Description ?? "–";
        var dataInicio = sol.DataInicio.ToString("dd/MM/yyyy");
        var dataFim = sol.DataFim.ToString("dd/MM/yyyy");
        var qtdDias = sol.QtdDias.ToString();
        var abono = sol.AbonoPecuniario ? $"Sim ({sol.DiasAbono} dias)" : "Não";

        var linhas = new[]
        {
            ("Autorização de Férias", true, true),
            ("", false, false),
            ($"Funcionário: {funcionarioNome}", false, false),
            ($"Cargo: {cargoNome}", false, false),
            ($"Área: {areaNome}", false, false),
            ($"Período de Férias: {dataInicio} a {dataFim}", false, false),
            ($"Quantidade de Dias: {qtdDias}", false, false),
            ($"Abono Pecuniário: {abono}", false, false),
            ("", false, false),
            ("Prezado(a),", false, false),
            ("", false, false),
            ($"Confirmamos a aprovação das férias do(a) colaborador(a) {funcionarioNome} conforme período indicado acima.", false, false),
            ("", false, false),
            ("Esta carta serve como documento formal de autorização de férias.", false, false),
            ("", false, false),
            ("Atenciosamente,", false, false),
            ($"Departamento de Recursos Humanos", false, false),
            ($"Data: {DateTime.UtcNow:dd/MM/yyyy}", false, false),
        };

        var key = $"{_tenantContext.TenantId}/cartas/ferias/{solicitacaoId:N}.docx";
        return await GerarEEntregarAsync(linhas, key, ct);
    }

    // ── helpers ──

    /// <summary>
    /// Gera o DOCX e entrega via S3 (URL presigned) ou download direto quando S3 não está configurado.
    /// </summary>
    private async Task<CartaResult> GerarEEntregarAsync(
        IEnumerable<(string Texto, bool Negrito, bool Grande)> linhas,
        string key,
        CancellationToken ct)
    {
        const string contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        var bytes = GerarDocxBytes(linhas);
        var fileName = Path.GetFileName(key);

        try
        {
            using var ms = new MemoryStream(bytes);
            await _storage.UploadAsync(ms, key, contentType, ct);
            return CartaResult.FromUrl(_storage.GetPresignedUrl(key, TimeSpan.FromHours(24)));
        }
        catch (InvalidOperationException ex) when (IsS3NotConfigured(ex))
        {
            return CartaResult.FromContent(bytes, fileName);
        }
    }

    private static bool IsS3NotConfigured(InvalidOperationException ex)
        => ex.Message.Contains("AWS S3 não configurado", StringComparison.OrdinalIgnoreCase);

    private static byte[] GerarDocxBytes(IEnumerable<(string Texto, bool Negrito, bool Grande)> linhas)
    {
        using var ms = new MemoryStream();
        using (var doc = WordprocessingDocument.Create(ms, WordprocessingDocumentType.Document, true))
        {
            var mainPart = doc.AddMainDocumentPart();
            mainPart.Document = new Document(new Body());
            var body = mainPart.Document.Body!;

            foreach (var (texto, negrito, grande) in linhas)
            {
                var para = new Paragraph();
                var props = new ParagraphProperties();

                if (grande)
                {
                    props.Append(new Justification { Val = JustificationValues.Center });
                    props.Append(new SpacingBetweenLines { After = "200" });
                }
                para.Append(props);

                if (!string.IsNullOrEmpty(texto))
                {
                    var run = new Run();
                    var runProps = new RunProperties();
                    if (negrito) runProps.Append(new Bold());
                    if (grande) runProps.Append(new FontSize { Val = "32" }); // 16pt
                    run.Append(runProps);
                    run.Append(new Text(texto) { Space = SpaceProcessingModeValues.Preserve });
                    para.Append(run);
                }

                body.Append(para);
            }

            mainPart.Document.Save();
        }

        return ms.ToArray();
    }
}
