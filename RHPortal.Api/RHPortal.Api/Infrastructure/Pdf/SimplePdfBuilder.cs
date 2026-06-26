using System.Text;

namespace RhPortal.Api.Infrastructure.Pdf;

/// <summary>Gera PDF minimalista (texto puro, Helvetica) sem dependências externas.</summary>
public static class SimplePdfBuilder
{
    public static byte[] BuildFromLines(IEnumerable<string> lines)
    {
        static string Escape(string value) => value.Replace("\\", "\\\\").Replace("(", "\\(").Replace(")", "\\)");

        var normalized = lines
            .SelectMany(line => WrapLine(line.Trim(), 92))
            .Where(x => x.Length > 0)
            .Take(80)
            .ToList();

        var content = new StringBuilder();
        content.AppendLine("BT");
        content.AppendLine("/F1 11 Tf");
        content.AppendLine("50 790 Td");
        foreach (var line in normalized)
        {
            content.AppendLine($"({Escape(line)}) Tj");
            content.AppendLine("0 -15 Td");
        }
        content.AppendLine("ET");

        var stream = Encoding.ASCII.GetBytes(content.ToString());
        var objects = new List<string>
        {
            "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
            "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
            "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
            "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
            $"5 0 obj\n<< /Length {stream.Length} >>\nstream\n{content}endstream\nendobj\n"
        };

        using var ms = new MemoryStream();
        using var writer = new StreamWriter(ms, Encoding.ASCII, leaveOpen: true);
        writer.Write("%PDF-1.4\n");
        var offsets = new List<long> { 0 };
        foreach (var obj in objects)
        {
            writer.Flush();
            offsets.Add(ms.Position);
            writer.Write(obj);
        }
        writer.Flush();
        var xref = ms.Position;
        writer.WriteLine("xref");
        writer.WriteLine($"0 {objects.Count + 1}");
        writer.WriteLine("0000000000 65535 f ");
        foreach (var offset in offsets.Skip(1))
            writer.WriteLine($"{offset:0000000000} 00000 n ");
        writer.WriteLine("trailer");
        writer.WriteLine($"<< /Size {objects.Count + 1} /Root 1 0 R >>");
        writer.WriteLine("startxref");
        writer.WriteLine(xref);
        writer.WriteLine("%%EOF");
        writer.Flush();
        return ms.ToArray();
    }

    private static IEnumerable<string> WrapLine(string line, int maxChars)
    {
        if (string.IsNullOrEmpty(line))
        {
            yield return string.Empty;
            yield break;
        }

        for (var i = 0; i < line.Length; i += maxChars)
            yield return line.Substring(i, Math.Min(maxChars, line.Length - i));
    }
}
