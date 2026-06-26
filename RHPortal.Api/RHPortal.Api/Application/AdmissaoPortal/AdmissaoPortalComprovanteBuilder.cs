using RhPortal.Api.Application.PreAdmissao;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Application.AdmissaoPortal;

internal static class AdmissaoPortalComprovanteBuilder
{
    public static IReadOnlyList<string> BuildLines(Domain.Entities.PreAdmissao pa, string? vagaTitulo, string? nomeEmpresa)
    {
        var enviadoEm = pa.SubmittedAtUtc ?? pa.UpdatedAtUtc;
        var enviadoLocal = enviadoEm.ToOffset(TimeSpan.FromHours(-3)).ToString("dd/MM/yyyy HH:mm");

        var lines = new List<string>
        {
            "COMPROVANTE DE ENVIO — PORTAL DE ADMISSAO",
            "==========================================",
            "",
            $"Empresa: {nomeEmpresa ?? pa.TenantId}",
            $"Candidato: {pa.Nome}",
            $"CPF: {FormatCpf(pa.Cpf)}",
            $"Vaga: {vagaTitulo ?? "—"}",
            $"Data do envio: {enviadoLocal} (Brasilia)",
            $"Protocolo: {pa.Id:N}".ToUpperInvariant(),
            "",
            "RESUMO DO ENVIO",
            "---------------",
            $"Progresso: {pa.WizardCompletionPercent ?? 0}%",
            $"Documentos enviados: {pa.Documentos.Count}",
            $"Dependentes cadastrados: {pa.Dependentes.Count}",
            "",
            "DOCUMENTOS",
            "----------",
        };

        if (pa.DocumentosSolicitados.Count == 0)
        {
            lines.Add("Nenhum documento solicitado configurado.");
        }
        else
        {
            foreach (var ds in pa.DocumentosSolicitados.OrderBy(d => d.TipoDocumento))
            {
                var label = PreAdmissaoService.TipoDocumentoLabel(ds.TipoDocumento);
                var enviado = pa.Documentos.Any(d => d.Tipo == ds.TipoDocumento);
                lines.Add($"- {(enviado ? "[OK]" : "[  ]")} {label}");
            }
        }

        lines.Add("");
        lines.Add("Este comprovante confirma o recebimento das informacoes");
        lines.Add("enviadas pelo candidato via Portal de Admissao.");
        lines.Add("O time de RH entrara em contato em breve.");

        return lines;
    }

    private static string FormatCpf(string? cpf)
    {
        if (string.IsNullOrWhiteSpace(cpf)) return "—";
        var digits = new string(cpf.Where(char.IsDigit).ToArray());
        if (digits.Length != 11) return cpf;
        return $"{digits[..3]}.{digits[3..6]}.{digits[6..9]}-{digits[9..]}";
    }
}
