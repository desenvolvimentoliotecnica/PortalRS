using RhPortal.Api.Application.PreAdmissao;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Pdf;

namespace RhPortal.Api.Application.AdmissaoPortal;

internal static class AdmissaoPortalComprovanteBuilder
{
    public static byte[] BuildPdf(Domain.Entities.PreAdmissao pa, string? vagaTitulo, string? nomeEmpresa)
    {
        var enviadoEm = pa.SubmittedAtUtc ?? pa.UpdatedAtUtc;
        var enviadoLocal = enviadoEm.ToOffset(TimeSpan.FromHours(-3)).ToString("dd/MM/yyyy HH:mm");
        var protocolo = pa.Id.ToString("N").ToUpperInvariant();
        var empresa = nomeEmpresa ?? pa.TenantId;

        return SimplePdfBuilder.BuildForm(canvas =>
        {
            canvas.DrawBrandHeader(
                empresa,
                "Comprovante de Envio",
                "Portal de Admissão — resumo do formulário preenchido",
                protocolo,
                $"{enviadoLocal} (Brasília)");

            canvas.BeginSection("Identificação do processo");
            canvas.AddFields(
                ("Vaga", vagaTitulo),
                ("Progresso", pa.WizardCompletionPercent.HasValue ? $"{pa.WizardCompletionPercent}%" : null),
                ("Documentos enviados", pa.Documentos.Count.ToString()),
                ("Dependentes", pa.Dependentes.Count.ToString()));
            canvas.EndSection();

            canvas.BeginSection("Dados pessoais");
            canvas.AddFields(
                ("Nome completo", pa.Nome),
                ("Nome social", pa.NomeSocial),
                ("CPF", FormatCpf(pa.Cpf)),
                ("RG", pa.Rg),
                ("Órgão expedidor / UF", Join(pa.RgOrgaoExpedidor, pa.RgUfExpedidor, " / ")),
                ("Data expedição RG", FormatDate(pa.RgDataExpedicao)),
                ("Data de nascimento", FormatDate(pa.DataNascimento)),
                ("Sexo", EnumLabel(pa.Sexo)),
                ("Estado civil", EnumLabel(pa.EstadoCivil)),
                ("Nacionalidade", pa.Nacionalidade),
                ("Nome da mãe", pa.NomeMae),
                ("Nome do pai", pa.NomePai),
                ("Naturalidade", Join(pa.NaturalCidade, pa.NaturalUf, "/")));
            canvas.EndSection();

            canvas.BeginSection("Endereço e contato");
            canvas.AddFields(
                ("CEP", pa.Cep),
                ("Logradouro", pa.Logradouro),
                ("Número", pa.Numero),
                ("Complemento", pa.Complemento),
                ("Bairro", pa.Bairro),
                ("Cidade / UF", Join(pa.Cidade, pa.Uf, "/")),
                ("E-mail", pa.Email),
                ("Celular", FormatPhone(pa.DddTelefone, pa.Celular)),
                ("Telefone", FormatPhone(pa.DddTelContato, pa.Telefone)),
                ("Contato de emergência", Join(pa.ContatoEmergenciaNome, pa.ContatoEmergenciaFone, " — ")));
            canvas.EndSection();

            canvas.BeginSection("Informações bancárias");
            canvas.AddFields(
                ("Banco", Join(pa.BancoCodigo, pa.BancoNome, " — ")),
                ("Agência", Join(pa.Agencia, pa.AgenciaDigito, "-")),
                ("Conta", Join(pa.Conta, pa.ContaDigito, "-")),
                ("Tipo de conta", pa.TipoConta.HasValue ? EnumLabel(pa.TipoConta.Value) : null));
            canvas.EndSection();

            canvas.BeginSection("Dependentes");
            if (pa.Dependentes.Count == 0)
            {
                canvas.AddFields(("Situação", "Nenhum dependente cadastrado"));
            }
            else
            {
                var idx = 1;
                foreach (var dep in pa.Dependentes.OrderBy(d => d.NomeCompleto))
                {
                    var pcd = dep.IsPcd ? " — PCD" : "";
                    canvas.AddFields(
                        ($"Dependente {idx}", dep.NomeCompleto),
                        ("Parentesco", EnumLabel(dep.Parentesco)),
                        ("CPF", FormatCpf(dep.Cpf)),
                        ("Data nascimento", FormatDate(dep.DataNascimento)),
                        ("Observação", dep.IsPcd ? "Pessoa com deficiência" : null));
                    idx++;
                }
            }

            canvas.EndSection();

            canvas.BeginSection("Documentos enviados");
            if (pa.DocumentosSolicitados.Count == 0)
            {
                canvas.AddFields(("Situação", "Nenhum documento solicitado configurado"));
            }
            else
            {
                canvas.AddDocumentRows(pa.DocumentosSolicitados
                    .OrderBy(d => d.TipoDocumento)
                    .Select(ds =>
                    {
                        var label = PreAdmissaoService.TipoDocumentoLabel(ds.TipoDocumento);
                        if (ds.Obrigatorio) label += " (obrigatório)";
                        var enviado = pa.Documentos.Any(d => d.Tipo == ds.TipoDocumento);
                        return (enviado, label);
                    }));
            }

            canvas.EndSection();

            canvas.AddFooterNote(
                "Este comprovante confirma o recebimento das informações enviadas pelo candidato via Portal de Admissão.",
                "Guarde este documento. O time de RH analisará os dados e entrará em contato em breve.");
        });
    }

    private static string? Join(string? a, string? b, string sep)
    {
        var parts = new[] { a?.Trim(), b?.Trim() }.Where(p => !string.IsNullOrWhiteSpace(p)).ToArray();
        return parts.Length == 0 ? null : string.Join(sep, parts);
    }

    private static string FormatCpf(string? cpf)
    {
        if (string.IsNullOrWhiteSpace(cpf)) return string.Empty;
        var digits = new string(cpf.Where(char.IsDigit).ToArray());
        if (digits.Length != 11) return cpf;
        return $"{digits[..3]}.{digits[3..6]}.{digits[6..9]}-{digits[9..]}";
    }

    private static string FormatDate(DateOnly? date) => date?.ToString("dd/MM/yyyy") ?? string.Empty;

    private static string? FormatPhone(int? ddd, string? number)
    {
        if (string.IsNullOrWhiteSpace(number)) return null;
        return ddd.HasValue ? $"({ddd}) {number}" : number;
    }

    private static string EnumLabel<TEnum>(TEnum value) where TEnum : struct, Enum
    {
        if (!Enum.IsDefined(typeof(TEnum), value)) return string.Empty;
        var name = Enum.GetName(typeof(TEnum), value) ?? string.Empty;
        return name switch
        {
            "NaoInformado" => string.Empty,
            "UniaoEstavel" => "União estável",
            "ContaCorrente" => "Conta corrente",
            "ContaPoupanca" => "Conta poupança",
            "ContaSalario" => "Conta salário",
            _ => Humanize(name),
        };
    }

    private static string Humanize(string name)
    {
        if (string.IsNullOrEmpty(name)) return name;
        var sb = new System.Text.StringBuilder(name.Length + 8);
        foreach (var ch in name)
        {
            if (char.IsUpper(ch) && sb.Length > 0) sb.Append(' ');
            sb.Append(sb.Length == 0 ? char.ToUpper(ch) : char.ToLower(ch));
        }

        return sb.ToString();
    }
}
