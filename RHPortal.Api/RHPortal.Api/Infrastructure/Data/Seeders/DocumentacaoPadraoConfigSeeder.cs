using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

/// <summary>
/// Garante a configuração global padrão de documentos de admissão por tenant.
/// Idempotente: não sobrescreve documentos já configurados pelo usuário.
/// </summary>
public static class DocumentacaoPadraoConfigSeeder
{
    private const short Obrigatorio = 0;
    private const short NaoSeraPedido = 2;

    private static readonly (TipoDocumento TipoDocumento, short Configuracao)[] Defaults =
    [
        (TipoDocumento.RG, Obrigatorio),
        (TipoDocumento.CPF, Obrigatorio),
        (TipoDocumento.CNH, NaoSeraPedido),
        (TipoDocumento.TituloEleitor, Obrigatorio),
        (TipoDocumento.Reservista, NaoSeraPedido),
        (TipoDocumento.ComprovanteResidencia, Obrigatorio),
        (TipoDocumento.CertidaoNascimentoCasamento, NaoSeraPedido),
        (TipoDocumento.PisPasep, Obrigatorio),
        (TipoDocumento.CarteiraTrabalhoCTPS, Obrigatorio),
        (TipoDocumento.DeclaracaoUniaoEstavel, NaoSeraPedido),
        (TipoDocumento.RGFilho, NaoSeraPedido),
        (TipoDocumento.CertidaoNascimentoFilho, NaoSeraPedido),
        (TipoDocumento.CarteiraVacinacaoFilho, NaoSeraPedido),
        (TipoDocumento.ComprovanteBancario, NaoSeraPedido),
        (TipoDocumento.Foto3x4, Obrigatorio),
        (TipoDocumento.Escolaridade, Obrigatorio),
        (TipoDocumento.CNPJ, NaoSeraPedido),
        (TipoDocumento.ContratoSocialMEI, NaoSeraPedido),
        (TipoDocumento.ContaBancariaPJ, Obrigatorio),
        (TipoDocumento.CertidoesNegativas, NaoSeraPedido),
    ];

    public static async Task EnsureAsync(AppDbContext db, string tenantId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            throw new InvalidOperationException("DocumentacaoPadraoConfigSeeder requer um tenantId.");

        var existingTipos = await db.DocumentacaoPadraoConfigs
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .Select(x => x.TipoDocumento)
            .ToListAsync(ct);

        var existingSet = existingTipos.ToHashSet();
        var now = DateTimeOffset.UtcNow;

        foreach (var seed in Defaults)
        {
            var tipo = (short)seed.TipoDocumento;
            if (existingSet.Contains(tipo))
                continue;

            db.DocumentacaoPadraoConfigs.Add(new DocumentacaoPadraoConfig
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                TipoDocumento = tipo,
                Configuracao = seed.Configuracao,
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
            });
        }

        await db.SaveChangesAsync(ct);
    }
}
