using RhPortal.Api.Application.PreAdmissao;
using RhPortal.Api.Infrastructure.Pdf;

namespace RhPortal.Api.Application.AdmissaoPortal;

internal static class AdmissaoPortalComprovanteBuilder
{
    public static byte[] BuildPdf(Domain.Entities.PreAdmissao pa, string? vagaTitulo, string? nomeEmpresa)
    {
        var enviadoEm = pa.SubmittedAtUtc ?? pa.UpdatedAtUtc;
        var enviadoLocal = enviadoEm.ToOffset(TimeSpan.FromHours(-3)).ToString("dd/MM/yyyy HH:mm");
        var protocolo = pa.Id.ToString("N").ToUpperInvariant();

        return SimplePdfBuilder.BuildForm(canvas =>
        {
            canvas.DrawHeader(
                "Comprovante de Envio",
                "Portal de Admissão — formulário digital");

            // --- Identificação ---
            canvas.BeginSection("Identificação");
            var y = canvas.CursorY + 8f;
            y = canvas.AddField("Empresa", nomeEmpresa ?? pa.TenantId, y);
            y = canvas.AddDivider(y);
            y = canvas.AddField("Candidato(a)", pa.Nome, y);
            y = canvas.AddField("CPF", FormatCpf(pa.Cpf), y);
            y = canvas.AddDivider(y);
            y = canvas.AddField("Vaga", vagaTitulo ?? "—", y);
            y = canvas.AddField("Data do envio", $"{enviadoLocal} (Brasília)", y);
            y = canvas.AddField("Protocolo", protocolo, y);
            canvas.EndSection();

            // --- Resumo ---
            canvas.BeginSection("Resumo do envio");
            y = canvas.CursorY + 8f;
            y = canvas.AddField("Progresso do formulário", $"{pa.WizardCompletionPercent ?? 0}%", y);
            y = canvas.AddField("Documentos enviados", pa.Documentos.Count.ToString(), y);
            y = canvas.AddField("Dependentes cadastrados", pa.Dependentes.Count.ToString(), y);
            if (!string.IsNullOrWhiteSpace(pa.Email))
                y = canvas.AddField("E-mail informado", pa.Email, y);
            canvas.EndSection();

            // --- Documentos ---
            canvas.BeginSection("Documentos");
            y = canvas.CursorY + 8f;
            if (pa.DocumentosSolicitados.Count == 0)
            {
                y = canvas.AddField("Situação", "Nenhum documento solicitado configurado.", y);
            }
            else
            {
                foreach (var ds in pa.DocumentosSolicitados.OrderBy(d => d.TipoDocumento))
                {
                    var label = PreAdmissaoService.TipoDocumentoLabel(ds.TipoDocumento);
                    if (ds.Obrigatorio)
                        label += " (obrigatório)";
                    var enviado = pa.Documentos.Any(d => d.Tipo == ds.TipoDocumento);
                    y = canvas.AddDocumentRow(y, enviado, label);
                }
            }

            canvas.EndSection();

            canvas.AddFooter(
                "Este comprovante confirma o recebimento das informações enviadas pelo candidato via Portal de Admissão.",
                "Guarde este documento. O time de RH entrará em contato em breve.");
        });
    }

    private static string FormatCpf(string? cpf)
    {
        if (string.IsNullOrWhiteSpace(cpf)) return "—";
        var digits = new string(cpf.Where(char.IsDigit).ToArray());
        if (digits.Length != 11) return cpf;
        return $"{digits[..3]}.{digits[3..6]}.{digits[6..9]}-{digits[9..]}";
    }
}
