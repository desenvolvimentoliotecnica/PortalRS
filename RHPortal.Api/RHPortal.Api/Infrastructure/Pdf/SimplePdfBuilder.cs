using System.Text;

namespace RhPortal.Api.Infrastructure.Pdf;

/// <summary>Gera PDF A4 com layout de formulário (Helvetica + WinAnsi/CP1252 para PT-BR).</summary>
public static class SimplePdfBuilder
{
    private const float PageWidth = 612f;
    private const float PageHeight = 842f;
    private const float MarginLeft = 45f;
    private const float MarginRight = 45f;
    private static readonly Encoding WinAnsi;

    static SimplePdfBuilder()
    {
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
        WinAnsi = Encoding.GetEncoding(1252);
    }

    public static byte[] BuildForm(Action<FormPdfCanvas> draw)
    {
        var canvas = new FormPdfCanvas();
        draw(canvas);
        return canvas.ToPdfBytes();
    }

    public sealed class FormPdfCanvas
    {
        private readonly List<string> _ops = new();
        private float _cursorY = 42f;
        private float _sectionStartY;
        private float _bodyStartY;

        public float CursorY => _cursorY;

        public void MoveDown(float points) => _cursorY += points;

        public void DrawHeader(string title, string subtitle)
        {
            const float boxH = 58f;
            FillRect(MarginLeft, _cursorY, ContentWidth, boxH, 0.93f, 0.95f, 0.98f);
            StrokeRect(MarginLeft, _cursorY, ContentWidth, boxH, 0.75f, 0.78f, 0.82f);
            Text(MarginLeft + 14f, _cursorY + 16f, title, 16, bold: true, color: (0.12f, 0.16f, 0.28f));
            Text(MarginLeft + 14f, _cursorY + 38f, subtitle, 11, color: (0.35f, 0.38f, 0.45f));
            _cursorY += boxH + 14f;
        }

        public void BeginSection(string title)
        {
            _sectionStartY = _cursorY;
            FillRect(MarginLeft, _sectionStartY, ContentWidth, 22f, 0.88f, 0.90f, 0.94f);
            Text(MarginLeft + 10f, _sectionStartY + 7f, title.ToUpperInvariant(), 10, bold: true, color: (0.15f, 0.18f, 0.25f));
            _cursorY = _sectionStartY + 22f;
            _bodyStartY = _cursorY;
        }

        public void EndSection()
        {
            var bodyHeight = Math.Max(8f, _cursorY - _bodyStartY + 8f);
            var totalHeight = 22f + bodyHeight;
            StrokeRect(MarginLeft, _sectionStartY, ContentWidth, totalHeight, 0.75f, 0.78f, 0.82f);
            _cursorY = _sectionStartY + totalHeight + 12f;
        }

        public float AddField(string label, string? value, float startY)
        {
            var y = startY;
            Text(MarginLeft + 12f, y, label, 9, bold: true, color: (0.30f, 0.33f, 0.38f));
            Text(MarginLeft + 150f, y, value ?? "—", 10, color: (0.10f, 0.10f, 0.12f));
            _cursorY = Math.Max(_cursorY, y + 17f);
            return y + 17f;
        }

        public float AddDivider(float y)
        {
            var pdfY = ToPdfY(y + 6f);
            _ops.Add("0.85 0.86 0.88 RG");
            _ops.Add("0.5 w");
            _ops.Add($"{MarginLeft + 10f} {pdfY} m");
            _ops.Add($"{MarginLeft + ContentWidth - 10f} {pdfY} l");
            _ops.Add("S");
            return y + 12f;
        }

        public float AddDocumentRow(float y, bool enviado, string label)
        {
            var tag = enviado ? "ENVIADO" : "PENDENTE";
            var tagColor = enviado ? (0.08f, 0.45f, 0.25f) : (0.55f, 0.35f, 0.05f);
            FillRect(MarginLeft + 12f, y, 58f, 14f, tagColor.Item1, tagColor.Item2, tagColor.Item3);
            Text(MarginLeft + 16f, y + 3f, tag, 7, bold: true, color: (1f, 1f, 1f));
            Text(MarginLeft + 78f, y + 2f, label, 9, color: (0.12f, 0.12f, 0.14f));
            _cursorY = Math.Max(_cursorY, y + 18f);
            return y + 18f;
        }

        public void AddFooter(params string[] lines)
        {
            _cursorY += 4f;
            StrokeRect(MarginLeft, _cursorY, ContentWidth, 8f + lines.Length * 13f, 0.80f, 0.82f, 0.85f);
            var y = _cursorY + 8f;
            foreach (var line in lines)
            {
                Text(MarginLeft + 12f, y, line, 8, color: (0.38f, 0.40f, 0.44f));
                y += 13f;
            }
            _cursorY = y + 6f;
        }

        public byte[] ToPdfBytes()
        {
            var content = string.Join("\n", _ops) + "\n";
            var streamBytes = WinAnsi.GetBytes(content);

            var objects = new List<string>
            {
                "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
                "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
                "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] " +
                "/Resources << /Font << /F1 4 0 R /F2 6 0 R >> >> /Contents 5 0 R >>\nendobj\n",
                "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n",
                $"5 0 obj\n<< /Length {streamBytes.Length} >>\nstream\n{content}endstream\nendobj\n",
                "6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n",
            };

            using var ms = new MemoryStream();
            using var writer = new StreamWriter(ms, WinAnsi, leaveOpen: true);
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

        private static float ContentWidth => PageWidth - MarginLeft - MarginRight;

        private void FillRect(float x, float yTop, float w, float h, float r, float g, float b)
        {
            _ops.Add($"{r:0.##} {g:0.##} {b:0.##} rg");
            _ops.Add($"{x:0.##} {ToPdfY(yTop + h):0.##} {w:0.##} {h:0.##} re f");
        }

        private void StrokeRect(float x, float yTop, float w, float h, float r, float g, float b)
        {
            _ops.Add($"{r:0.##} {g:0.##} {b:0.##} RG");
            _ops.Add("0.75 w");
            _ops.Add($"{x:0.##} {ToPdfY(yTop + h):0.##} {w:0.##} {h:0.##} re S");
        }

        private void Text(float x, float yTop, string text, int size, bool bold = false, (float R, float G, float B)? color = null)
        {
            var (r, g, b) = color ?? (0f, 0f, 0f);
            _ops.Add("BT");
            _ops.Add($"{r:0.##} {g:0.##} {b:0.##} rg");
            _ops.Add($"/F{(bold ? 2 : 1)} {size} Tf");
            _ops.Add($"1 0 0 1 {x:0.##} {ToPdfY(yTop + size):0.##} Tm");
            _ops.Add($"{EscapePdfString(text)} Tj");
            _ops.Add("ET");
        }

        private static float ToPdfY(float yFromTop) => PageHeight - yFromTop;

        private static string EscapePdfString(string text)
        {
            var bytes = WinAnsi.GetBytes(text);
            var sb = new StringBuilder("(");
            foreach (var b in bytes)
            {
                switch (b)
                {
                    case (byte)'\\':
                        sb.Append("\\\\");
                        break;
                    case (byte)'(':
                        sb.Append("\\(");
                        break;
                    case (byte)')':
                        sb.Append("\\)");
                        break;
                    case (byte)'\r':
                        break;
                    case (byte)'\n':
                        sb.Append("\\n");
                        break;
                    default:
                        if (b < 32 || b == 127)
                            sb.Append($"\\{Convert.ToString(b, 8).PadLeft(3, '0')}");
                        else
                            sb.Append((char)b);
                        break;
                }
            }

            sb.Append(')');
            return sb.ToString();
        }
    }
}
