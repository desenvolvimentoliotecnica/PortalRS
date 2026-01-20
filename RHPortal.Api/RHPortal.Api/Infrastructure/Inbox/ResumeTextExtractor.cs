using DocumentFormat.OpenXml.Packaging;
using System.Text;
using UglyToad.PdfPig;

namespace RhPortal.Api.Infrastructure.Inbox;

public static class ResumeTextExtractor
{
    public static async Task<string> ExtractAsync(string filePath, CancellationToken ct)
    {
        var ext = Path.GetExtension(filePath)?.ToLowerInvariant() ?? string.Empty;
        return ext switch
        {
            ".pdf" => ExtractPdf(filePath),
            ".docx" => ExtractDocx(filePath),
            ".txt" => await File.ReadAllTextAsync(filePath, ct),
            _ => string.Empty
        };
    }

    private static string ExtractPdf(string filePath)
    {
        var sb = new StringBuilder();
        using var doc = PdfDocument.Open(filePath);
        foreach (var page in doc.GetPages())
        {
            sb.AppendLine(page.Text);
        }
        return sb.ToString();
    }

    private static string ExtractDocx(string filePath)
    {
        using var doc = WordprocessingDocument.Open(filePath, false);
        var body = doc.MainDocumentPart?.Document?.Body;
        return body?.InnerText ?? string.Empty;
    }
}
