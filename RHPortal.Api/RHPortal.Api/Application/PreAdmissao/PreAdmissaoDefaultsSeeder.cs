using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Application.PreAdmissao;

/// <summary>
/// Responsável APENAS por:
/// 1. Resolver <c>CodEmpresa</c> automaticamente a partir da tabela <see cref="Empresa"/> do tenant
///    — RH não precisa saber o código técnico da empresa pra cada nova admissão.
/// 2. Normalizar códigos de país (ex: "Brasil" → "BRA") pra prevenir erro no Datasul caso a UI
///    ou uma integração externa envie o nome por extenso.
///
/// Nenhum outro campo é preenchido automaticamente. Todos os dados obrigatórios TOTVS/eSocial
/// precisam ser preenchidos pelo RH via wizard — cada funcionário tem seu próprio contexto.
/// </summary>
public static class PreAdmissaoDefaultsSeeder
{
    public static async Task ApplyAsync(
        Domain.Entities.PreAdmissao e,
        AppDbContext db,
        string tenantId,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(e.CodEmpresa))
        {
            var empresaCode = await db.Set<Empresa>()
                .AsNoTracking()
                .Where(x => x.TenantId == tenantId && x.IsActive)
                .OrderBy(x => x.Code)
                .Select(x => x.Code)
                .FirstOrDefaultAsync(ct);
            if (!string.IsNullOrWhiteSpace(empresaCode))
                e.CodEmpresa = empresaCode;
        }

        // Normalização defensiva — se o RH digitar "Brasil" no input de país, converte pra "BRA".
        // NÃO preenche quando o campo vem null/vazio; validator cobrará do RH.
        if (!string.IsNullOrWhiteSpace(e.PaisNacionalidade))
            e.PaisNacionalidade = NormalizePais(e.PaisNacionalidade);
        if (!string.IsNullOrWhiteSpace(e.PaisNascimento))
            e.PaisNascimento = NormalizePais(e.PaisNascimento);
        if (!string.IsNullOrWhiteSpace(e.PaisLocalidade))
            e.PaisLocalidade = NormalizePais(e.PaisLocalidade);
    }

    /// <summary>
    /// Converte nome de país para código ISO 3166-1 alpha-3. "Brasil" → "BRA",
    /// "Argentina" → "ARG". Aceita input case-insensitive.
    /// Se já estiver em formato ISO-3 válido, retorna como recebido (uppercase).
    /// </summary>
    private static string? NormalizePais(string? valor)
    {
        if (string.IsNullOrWhiteSpace(valor)) return valor;
        var t = valor.Trim().ToUpperInvariant();
        if (t.Length == 3) return t;
        return t switch
        {
            "BRASIL" or "BRAZIL" or "BR"                          => "BRA",
            "ARGENTINA" or "AR"                                    => "ARG",
            "URUGUAI" or "URUGUAY" or "UY"                         => "URY",
            "PARAGUAI" or "PARAGUAY" or "PY"                       => "PRY",
            "CHILE" or "CL"                                        => "CHL",
            "ESTADOS UNIDOS" or "UNITED STATES" or "USA" or "US"   => "USA",
            "PORTUGAL" or "PT"                                     => "PRT",
            _ => t.Length >= 3 ? t[..3] : t
        };
    }
}
