using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

/// <summary>
/// Garante que cada tenant tenha o conjunto padrão de motivos de requisição de vaga.
/// O seed corresponde aos valores do antigo enum MotivoRequisicaoVaga (0..8); eles são marcados
/// como IsSystem = true, o que impede exclusão (mas permite edição/desativação via tela).
/// </summary>
public static class MotivoRequisicaoVagaSeeder
{
    /// <summary>Códigos canônicos — bate 1-para-1 com os antigos valores do enum MotivoRequisicaoVaga.</summary>
    public const string CodAtenderDemanda             = "AtenderDemanda";
    public const string CodPedidoDemissao             = "PedidoDemissao";
    public const string CodDesligamentoSemJustaCausa  = "DesligamentoSemJustaCausa";
    public const string CodCotaAprendiz               = "CotaAprendiz";
    public const string CodTerminoContrato            = "TerminoContrato";
    public const string CodExpansaoBase               = "ExpansaoBase";
    public const string CodNovaUnidade                = "NovaUnidade";
    public const string CodMovimentacao               = "Movimentacao";
    public const string CodAfastamento                = "Afastamento";

    /// <summary>
    /// Motivos seed que TODO tenant recebe no provisionamento. A ordem define o Ordem inicial e o
    /// mapeamento de efeito no headcount (Aumenta / Diminui / Ambos).
    /// </summary>
    private static readonly (string Codigo, string Nome, string Descricao, EfeitoHeadcount Efeito)[] Seeds =
    [
        (CodAtenderDemanda,            "Atender demanda",                    "Nova vaga para atender demanda da operação.",                             EfeitoHeadcount.Aumenta),
        (CodExpansaoBase,              "Expansão de base",                   "Crescimento planejado do quadro em uma área existente.",                  EfeitoHeadcount.Aumenta),
        (CodNovaUnidade,               "Nova unidade",                       "Abertura de filial / nova estrutura.",                                     EfeitoHeadcount.Aumenta),
        (CodCotaAprendiz,              "Cota de aprendiz",                   "Preenchimento da cota legal de aprendizes.",                               EfeitoHeadcount.Aumenta),
        (CodPedidoDemissao,            "Pedido de demissão",                 "Reposição por pedido de demissão do ocupante.",                            EfeitoHeadcount.Ambos),
        (CodDesligamentoSemJustaCausa, "Desligamento sem justa causa",       "Reposição por desligamento iniciado pela empresa.",                        EfeitoHeadcount.Ambos),
        (CodTerminoContrato,           "Término de contrato",                "Substituição ao fim de contrato temporário / experiência.",                EfeitoHeadcount.Ambos),
        (CodMovimentacao,              "Movimentação interna",               "Vaga aberta por promoção ou transferência interna do ocupante.",           EfeitoHeadcount.Ambos),
        (CodAfastamento,               "Afastamento",                        "Cobertura temporária por afastamento prolongado do ocupante.",             EfeitoHeadcount.Ambos),
    ];

    public static async Task EnsureAsync(AppDbContext db, string tenantId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            throw new InvalidOperationException("MotivoRequisicaoVagaSeeder requer um tenantId.");

        // Ignora query filter — o seeder pode rodar antes do TenantContext estar resolvido.
        var existingCodigos = await db.MotivosRequisicaoVagaConfig
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .Select(x => x.Codigo)
            .ToListAsync(ct);

        var existingSet = existingCodigos.ToHashSet(StringComparer.OrdinalIgnoreCase);

        var now = DateTimeOffset.UtcNow;
        var ordem = 0;
        foreach (var seed in Seeds)
        {
            ordem += 10;

            if (existingSet.Contains(seed.Codigo))
                continue;

            db.MotivosRequisicaoVagaConfig.Add(new MotivoRequisicaoVagaConfig
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Codigo = seed.Codigo,
                Nome = seed.Nome,
                Descricao = seed.Descricao,
                EfeitoHeadcount = seed.Efeito,
                IsActive = true,
                Ordem = ordem,
                IsSystem = true,
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
            });
        }

        await db.SaveChangesAsync(ct);

        // Backfill: popula MotivoRequisicaoId nas solicitações legadas a partir do enum MotivoRequisicao.
        // Idempotente — só toca linhas onde MotivoRequisicaoId ainda é null.
        await BackfillSolicitacoesAsync(db, tenantId, ct);
    }

    /// <summary>
    /// Preenche <c>SolicitacoesVaga.MotivoRequisicaoId</c> em linhas antigas que só têm o enum legado.
    /// Mapeia pelo <c>MotivoRequisicao</c> (smallint) → <c>Codigo</c> do seed, usando o número exato do antigo enum.
    /// </summary>
    private static async Task BackfillSolicitacoesAsync(AppDbContext db, string tenantId, CancellationToken ct)
    {
        // Mapa enum-numérico → Codigo (bate 1:1 com MotivoRequisicaoVaga.cs)
        var mapa = new (short EnumValue, string Codigo)[]
        {
            (0, CodAtenderDemanda),
            (1, CodPedidoDemissao),
            (2, CodDesligamentoSemJustaCausa),
            (3, CodCotaAprendiz),
            (4, CodTerminoContrato),
            (5, CodExpansaoBase),
            (6, CodNovaUnidade),
            (7, CodMovimentacao),
            (8, CodAfastamento),
        };

        // Resolve Codigo → Id (dentro do tenant) numa única consulta
        var codigos = mapa.Select(m => m.Codigo).ToArray();
        var codigoParaId = await db.MotivosRequisicaoVagaConfig
            .IgnoreQueryFilters()
            .Where(x => x.TenantId == tenantId && codigos.Contains(x.Codigo))
            .ToDictionaryAsync(x => x.Codigo, x => x.Id, ct);

        foreach (var (enumValue, codigo) in mapa)
        {
            if (!codigoParaId.TryGetValue(codigo, out var motivoId)) continue;

            // UPDATE direto via SQL (linhas potencialmente grandes — evita trackear).
            await db.Database.ExecuteSqlRawAsync(
                """
                UPDATE "SolicitacoesVaga"
                   SET "MotivoRequisicaoId" = {0}
                 WHERE "TenantId" = {1}
                   AND "MotivoRequisicaoId" IS NULL
                   AND "MotivoRequisicao"   = {2};
                """,
                new object[] { motivoId, tenantId, enumValue });
        }
    }
}
