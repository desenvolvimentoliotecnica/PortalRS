using System.Globalization;
using System.Text;

namespace RhPortal.Api.Infrastructure.Pdf;

/// <summary>Gera PDF A4 multipágina com layout de formulário (Helvetica + WinAnsi/CP1252).</summary>
public static class SimplePdfBuilder
{
    private const float PageWidth = 612f;
    private const float PageHeight = 842f;
    private const float MarginLeft = 48f;
    private const float MarginRight = 48f;
    private const float MarginTop = 48f;
    private const float MarginBottom = 52f;
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
        private readonly List<List<string>> _pages = new() { new() };
        private int _pageIndex;
        private float _cursorY = MarginTop;

        public float CursorY => _cursorY;

        public void DrawBrandHeader(string empresa, string title, string subtitle, string protocolo, string dataEnvio)
        {
            EnsureSpace(78f);
            const float h = 72f;
            FillRect(MarginLeft, _cursorY, ContentWidth, h, 0.15f, 0.39f, 0.92f);
            FillRect(MarginLeft + 4f, _cursorY, ContentWidth - 4f, h, 0.96f, 0.97f, 0.99f);
            Text(MarginLeft + 16f, _cursorY + 14f, empresa, 10, bold: true, color: (0.15f, 0.39f, 0.92f));
            Text(MarginLeft + 16f, _cursorY + 30f, title, 18, bold: true, color: (0.10f, 0.14f, 0.22f));
            Text(MarginLeft + 16f, _cursorY + 50f, subtitle, 9, color: (0.42f, 0.46f, 0.52f));
            Text(MarginLeft + ContentWidth - 200f, _cursorY + 16f, $"Protocolo: {protocolo}", 8, bold: true, color: (0.25f, 0.30f, 0.38f));
            Text(MarginLeft + ContentWidth - 200f, _cursorY + 30f, $"Enviado em: {dataEnvio}", 8, color: (0.42f, 0.46f, 0.52f));
            _cursorY += h + 16f;
        }

        public void BeginSection(string title)
        {
            EnsureSpace(28f);
            _sectionStartY = _cursorY;
            FillRect(MarginLeft, _cursorY, 4f, 24f, 0.15f, 0.39f, 0.92f);
            FillRect(MarginLeft + 4f, _cursorY, ContentWidth - 4f, 24f, 0.91f, 0.94f, 0.98f);
            Text(MarginLeft + 14f, _cursorY + 7f, title, 11, bold: true, color: (0.12f, 0.20f, 0.38f));
            _cursorY += 24f;
            _bodyStartY = _cursorY;
        }

        public void EndSection()
        {
            var bodyHeight = Math.Max(6f, _cursorY - _bodyStartY + 6f);
            StrokeRect(MarginLeft, _sectionStartY, ContentWidth, 24f + bodyHeight, 0.82f, 0.86f, 0.91f, 0.5f);
            _cursorY = _sectionStartY + 24f + bodyHeight + 10f;
        }

        public void AddFields(params (string Label, string? Value)[] fields)
        {
            var y = _cursorY + 6f;
            foreach (var (label, value) in fields)
                y = AddFieldRow(label, value, y);
            _cursorY = y + 4f;
        }

        public void AddDocumentRows(IEnumerable<(bool Enviado, string Label)> rows)
        {
            var y = _cursorY + 6f;
            foreach (var (enviado, label) in rows)
            {
                EnsureSpaceFromY(y, 20f);
                y = AddDocumentRow(y, enviado, label);
            }

            _cursorY = y + 4f;
        }

        public void AddFooterNote(params string[] lines)
        {
            EnsureSpace(12f + lines.Length * 12f);
            FillRect(MarginLeft, _cursorY, ContentWidth, 8f + lines.Length * 12f, 0.97f, 0.98f, 0.99f);
            StrokeRect(MarginLeft, _cursorY, ContentWidth, 8f + lines.Length * 12f, 0.85f, 0.88f, 0.92f, 0.5f);
            var y = _cursorY + 8f;
            foreach (var line in lines)
            {
                Text(MarginLeft + 12f, y, line, 8, color: (0.40f, 0.44f, 0.48f));
                y += 12f;
            }

            _cursorY = y + 8f;
        }

        public byte[] ToPdfBytes()
        {
            var pageObjects = new List<string>();
            var contentObjects = new List<string>();
            var pageRefs = new List<string>();

            for (var i = 0; i < _pages.Count; i++)
            {
                var pageNum = i + 1;
                var ops = _pages[i];
                if (_pages.Count > 1)
                {
                    ops.Add("BT");
                    ops.Add("0.55 0.58 0.62 rg");
                    ops.Add("/F1 8 Tf");
                    ops.Add($"1 0 0 1 {N(MarginLeft)} {N(PageHeight - MarginBottom + 18f)} Tm");
                    ops.Add(EscapePdfString($"Página {pageNum} de {_pages.Count}"));
                    ops.Add("ET");
                }

                var content = string.Join("\n", ops) + "\n";
                var streamBytes = WinAnsi.GetBytes(content);
                var contentId = 5 + i * 2;
                var pageId = 6 + i * 2;
                contentObjects.Add($"{contentId} 0 obj\n<< /Length {streamBytes.Length} >>\nstream\n{content}\nendstream\n");
                pageRefs.Add($"{pageId} 0 R");
                pageObjects.Add(
                    $"{pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {N(PageWidth)} {N(PageHeight)}] " +
                    $"/Resources << /Font << /F1 4 0 R /F2 {4 + _pages.Count * 2 + 1} 0 R >> >> /Contents {contentId} 0 R >>\nendobj\n");
            }

            var objects = new List<string>
            {
                "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
                $"2 0 obj\n<< /Type /Pages /Kids [{string.Join(" ", pageRefs)}] /Count {_pages.Count} >>\nendobj\n",
                "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n",
            };
            objects.AddRange(contentObjects);
            objects.AddRange(pageObjects);
            objects.Add($"{4 + _pages.Count * 2 + 1} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n");

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
            writer.WriteLine(xref.ToString(CultureInfo.InvariantCulture));
            writer.WriteLine("%%EOF");
            writer.Flush();
            return ms.ToArray();
        }

        private float _sectionStartY;
        private float _bodyStartY;
        private List<string> Ops => _pages[_pageIndex];

        private static float ContentWidth => PageWidth - MarginLeft - MarginRight;

        private void EnsureSpace(float height) => EnsureSpaceFromY(_cursorY, height);

        private void EnsureSpaceFromY(float yFromTop, float height)
        {
            if (yFromTop + height <= PageHeight - MarginBottom)
                return;

            _pages.Add(new List<string>());
            _pageIndex++;
            _cursorY = MarginTop;
        }

        private float AddFieldRow(string label, string? value, float y)
        {
            EnsureSpaceFromY(y, 16f);
            var display = string.IsNullOrWhiteSpace(value) ? "Não informado" : value.Trim();
            var valueColor = string.IsNullOrWhiteSpace(value)
                ? (0.55f, 0.58f, 0.62f)
                : (0.10f, 0.12f, 0.15f);

            Text(MarginLeft + 12f, y, label, 8, bold: true, color: (0.35f, 0.38f, 0.44f));
            Text(MarginLeft + 168f, y, Truncate(display, 62), 9, color: valueColor);
            return y + 15f;
        }

        private float AddDocumentRow(float y, bool enviado, string label)
        {
            var tag = enviado ? "OK" : "—";
            var bg = enviado ? (0.06f, 0.64f, 0.38f) : (0.90f, 0.91f, 0.93f);
            var fg = enviado ? (1f, 1f, 1f) : (0.50f, 0.52f, 0.56f);
            FillRect(MarginLeft + 12f, y, 22f, 13f, bg.Item1, bg.Item2, bg.Item3);
            Text(MarginLeft + 15f, y + 2f, tag, 7, bold: true, color: fg);
            Text(MarginLeft + 40f, y + 2f, Truncate(label, 70), 9, color: (0.12f, 0.14f, 0.17f));
            return y + 16f;
        }

        private void FillRect(float x, float yTop, float w, float h, float r, float g, float b)
        {
            Ops.Add($"{N(r)} {N(g)} {N(b)} rg");
            Ops.Add($"{N(x)} {N(ToPdfY(yTop + h))} {N(w)} {N(h)} re f");
        }

        private void StrokeRect(float x, float yTop, float w, float h, float r, float g, float b, float lineWidth)
        {
            Ops.Add($"{N(r)} {N(g)} {N(b)} RG");
            Ops.Add($"{N(lineWidth)} w");
            Ops.Add($"{N(x)} {N(ToPdfY(yTop + h))} {N(w)} {N(h)} re S");
        }

        private void Text(float x, float yTop, string text, int size, bool bold = false, (float R, float G, float B)? color = null)
        {
            var (r, g, b) = color ?? (0f, 0f, 0f);
            Ops.Add("BT");
            Ops.Add($"{N(r)} {N(g)} {N(b)} rg");
            Ops.Add($"/F{(bold ? 2 : 1)} {size} Tf");
            Ops.Add($"1 0 0 1 {N(x)} {N(ToPdfY(yTop + size * 0.85f))} Tm");
            Ops.Add($"{EscapePdfString(text)} Tj");
            Ops.Add("ET");
        }

        private static float ToPdfY(float yFromTop) => PageHeight - yFromTop;

        private static string N(float value) => value.ToString("0.###", CultureInfo.InvariantCulture);

        private static string Truncate(string text, int maxChars)
            => text.Length <= maxChars ? text : text[..(maxChars - 1)] + "…";

        private static string EscapePdfString(string text)
        {
            var bytes = WinAnsi.GetBytes(text);
            var sb = new StringBuilder("(");
            foreach (var b in bytes)
            {
                switch (b)
                {
                    case (byte)'\\': sb.Append("\\\\"); break;
                    case (byte)'(': sb.Append("\\("); break;
                    case (byte)')': sb.Append("\\)"); break;
                    case (byte)'\r': break;
                    case (byte)'\n': sb.Append("\\n"); break;
                    default:
                        if (b < 32 || b == 127)
                            sb.Append('\\').Append(Convert.ToString(b, 8).PadLeft(3, '0'));
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
