using System.Text.Json;
using System.Net.Http;

namespace RhPortal.Api.Application.PreAdmissao;

/// <summary>Validações de CPF, CEP (ViaCEP), Bancos FEBRABAN, estrangeiro.</summary>
public static class ValidacaoHelper
{
    // ── CPF ──

    public static bool ValidarCpf(string? cpf)
    {
        if (string.IsNullOrWhiteSpace(cpf)) return false;
        var digits = cpf.Replace(".", "").Replace("-", "").Trim();
        if (digits.Length != 11 || digits.All(c => c == digits[0])) return false;
        int sum = 0;
        for (int i = 0; i < 9; i++) sum += (digits[i] - '0') * (10 - i);
        int rem = sum % 11;
        int d1 = rem < 2 ? 0 : 11 - rem;
        if (digits[9] - '0' != d1) return false;
        sum = 0;
        for (int i = 0; i < 10; i++) sum += (digits[i] - '0') * (11 - i);
        rem = sum % 11;
        int d2 = rem < 2 ? 0 : 11 - rem;
        return digits[10] - '0' == d2;
    }

    // ── CEP → ViaCEP ──

    public sealed record ViaCepResult(string? Logradouro, string? Bairro, string? Localidade, string? Uf, bool Erro);

    public static async Task<ViaCepResult?> ConsultarCepAsync(string? cep, HttpClient? httpClient = null)
    {
        if (string.IsNullOrWhiteSpace(cep)) return null;
        var clean = cep.Replace("-", "").Trim();
        if (clean.Length != 8) return null;

        var client = httpClient ?? new HttpClient();
        try
        {
            var resp = await client.GetStringAsync($"https://viacep.com.br/ws/{clean}/json/");
            if (resp.Contains("\"erro\"")) return new ViaCepResult(null, null, null, null, true);
            var doc = JsonDocument.Parse(resp);
            return new ViaCepResult(
                doc.RootElement.TryGetProperty("logradouro", out var l) ? l.GetString() : null,
                doc.RootElement.TryGetProperty("bairro", out var b) ? b.GetString() : null,
                doc.RootElement.TryGetProperty("localidade", out var c) ? c.GetString() : null,
                doc.RootElement.TryGetProperty("uf", out var u) ? u.GetString() : null,
                false
            );
        }
        catch { return null; }
    }

    // ── Bancos FEBRABAN (top 20) ──

    public static readonly IReadOnlyList<(string Codigo, string Nome)> BancosFebraban = new List<(string, string)>
    {
        ("001", "Banco do Brasil"),
        ("033", "Santander"),
        ("104", "Caixa Econômica Federal"),
        ("237", "Bradesco"),
        ("341", "Itaú Unibanco"),
        ("260", "Nubank"),
        ("077", "Inter"),
        ("756", "Sicoob"),
        ("748", "Sicredi"),
        ("422", "Safra"),
        ("212", "Original"),
        ("655", "Votorantim"),
        ("745", "Citibank"),
        ("399", "HSBC"),
        ("389", "Mercantil do Brasil"),
        ("041", "Banrisul"),
        ("070", "BRB"),
        ("085", "Cecred"),
        ("246", "ABC Brasil"),
        ("336", "C6 Bank"),
    };

    public static bool ValidarCodigoBanco(string? codigo)
    {
        if (string.IsNullOrWhiteSpace(codigo)) return false;
        return BancosFebraban.Any(b => b.Codigo == codigo.Trim());
    }

    // ── Estrangeiro — campos obrigatórios ──

    public sealed record ValidacaoEstrangeiroResult(bool Ok, List<string> CamposFaltantes);

    public static ValidacaoEstrangeiroResult ValidarEstrangeiro(string? nacionalidade, string? passaporte, string? rnmRne, DateOnly? validadeVisto)
    {
        if (string.IsNullOrWhiteSpace(nacionalidade) || nacionalidade.Trim().Equals("Brasileira", StringComparison.OrdinalIgnoreCase))
            return new ValidacaoEstrangeiroResult(true, new());

        var faltantes = new List<string>();
        if (string.IsNullOrWhiteSpace(passaporte) && string.IsNullOrWhiteSpace(rnmRne))
            faltantes.Add("Passaporte ou RNM/RNE");
        if (!validadeVisto.HasValue)
            faltantes.Add("Validade do Visto");
        else if (validadeVisto.Value < DateOnly.FromDateTime(DateTime.Today))
            faltantes.Add("Visto Expirado");

        return new ValidacaoEstrangeiroResult(faltantes.Count == 0, faltantes);
    }
}
