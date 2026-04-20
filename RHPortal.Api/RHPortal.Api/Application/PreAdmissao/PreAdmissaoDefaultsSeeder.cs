using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Application.PreAdmissao;

/// <summary>
/// Preenche defaults obrigatórios do TOTVS/Datasul na pré-admissão recém-criada.
///
/// Motivação: muitos campos exigidos pelo Datasul são constantes de negócio para
/// uma admissão CLT brasileira padrão (país=BRA, optanteFGTS=S, recolheINSS=S, etc.).
/// Deixar o RH ou o candidato preencher gera erro recorrente de integração. Esse
/// seeder aplica os valores só quando ainda estão nulos — RH pode editar depois
/// pelo wizard se for um caso especial (ex: funcionário cedido no exterior).
///
/// Chamado em <see cref="PreAdmissaoService.CreateAsync"/> logo após o Add.
/// </summary>
public static class PreAdmissaoDefaultsSeeder
{
    /// <summary>
    /// Aplica os defaults. Mutável — altera a entidade recebida.
    /// </summary>
    public static async Task ApplyAsync(
        Domain.Entities.PreAdmissao e,
        AppDbContext db,
        string tenantId,
        CancellationToken ct)
    {
        // --- Empresa / País / Localidade ---
        // Usa a primeira Empresa ativa do tenant como default (mesma entidade do
        // cadastro operacional de Empresas). RH pode editar depois se precisar
        // selecionar outra empresa do grupo.
        if (string.IsNullOrWhiteSpace(e.CodEmpresa))
        {
            var empresaCode = await db.Set<Empresa>()
                .AsNoTracking()
                .Where(x => x.TenantId == tenantId && x.IsActive)
                .OrderBy(x => x.Code)
                .Select(x => x.Code)
                .FirstOrDefaultAsync(ct);
            e.CodEmpresa = empresaCode ?? "1";
        }

        e.PaisNacionalidade = NormalizePais(e.PaisNacionalidade);
        e.PaisNascimento    = NormalizePais(e.PaisNascimento);
        e.PaisLocalidade    = NormalizePais(e.PaisLocalidade);
        e.TipoLogradouroESocial ??= "R"; // RUA

        // --- Flags S/N que o Datasul exige preenchidas ---
        e.OptanteFgts   ??= "S";
        e.RecolheFgts   ??= "S";
        e.RecolheInss   ??= "S";
        e.Sindicalizado ??= "N";
        e.ResideExterior ??= "N";

        // Flags de cálculo — default positivo para admissão CLT padrão
        e.CargaAutomTurno   ??= "S";
        e.ConsidEmissRAIS   ??= "S";
        e.Calcula13         ??= "S";
        e.RecebeFerias      ??= "S";

        // Adicionais — default negativo (RH marca se aplicar)
        e.RecebePericul        ??= "N";
        e.RecebeInsalub        ??= "N";
        e.RecebeAdiantamento   ??= "N";
        e.DescContribSindical  ??= "N";

        // --- Ponto eletrônico ---
        // Datasul aceita "1" (emite) ou "2" (não emite). Default "2" (não emite).
        if (string.IsNullOrWhiteSpace(e.EmitCartPonto))
            e.EmitCartPonto = "2";

        // --- Estatística / eSocial ---
        e.TipoEstatistica         ??= 1;  // Normal
        e.CategoriaTrabalhoESocial ??= 101; // Empregado - Geral
        e.IndAdmissao             ??= 1;  // Admissão normal
        e.TipoAdmissaoESocial     ??= 1;
        e.RegimeTrabalhista       ??= 1;  // CLT
        e.RegimePrevidenciario    ??= 1;  // RGPS
        e.RegimeJornada           ??= 1;  // Submetido a horário de trabalho

        // --- Origem funcionário (default brasileiro) ---
        e.OrigemFuncionario ??= 1;
    }

    /// <summary>
    /// Normaliza nome de país para código ISO 3166-1 alpha-3 (ex: "Brasil" → "BRA").
    /// TOTVS Datasul aceita o código de 3 letras, não o nome. Se vier null ou vazio,
    /// aplica "BRA" como default brasileiro. Nomes desconhecidos são retornados em
    /// uppercase (3 primeiras letras) — o Datasul rejeita, mas o erro fica claro.
    /// </summary>
    private static string? NormalizePais(string? valor)
    {
        if (string.IsNullOrWhiteSpace(valor)) return "BRA";
        var t = valor.Trim().ToUpperInvariant();
        // Se já for código ISO (3 chars), retorna como está.
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
