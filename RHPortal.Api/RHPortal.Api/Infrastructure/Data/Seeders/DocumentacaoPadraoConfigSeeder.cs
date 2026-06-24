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
    private const short Opcional = 1;
    private const short NaoSeraPedido = 2;

    /// <summary>Relação CLT padrão — alinhada ao e-mail manual enviado pelo RH.</summary>
    private static readonly (TipoDocumento TipoDocumento, short Configuracao)[] Defaults =
    [
        (TipoDocumento.CarteiraTrabalhoCTPS, Obrigatorio),
        (TipoDocumento.TituloEleitor, Obrigatorio),
        (TipoDocumento.RG, Obrigatorio),
        (TipoDocumento.CPF, Obrigatorio),
        (TipoDocumento.PisPasep, Obrigatorio),
        (TipoDocumento.Foto3x4, Obrigatorio),
        (TipoDocumento.Reservista, Obrigatorio),
        (TipoDocumento.CertidaoNascimentoCasamento, Obrigatorio),
        (TipoDocumento.ComprovanteResidencia, Obrigatorio),
        (TipoDocumento.Escolaridade, Obrigatorio),
        (TipoDocumento.CNH, Obrigatorio),
        (TipoDocumento.ComprovanteBancario, Obrigatorio),
        (TipoDocumento.ExameMedico, Obrigatorio),
        (TipoDocumento.ComprovanteVacinaCovid, Obrigatorio),
        (TipoDocumento.CartaBoasVindas, Obrigatorio),
        (TipoDocumento.PrintValidacaoCep, NaoSeraPedido),
        (TipoDocumento.PrintConsultaCpfReceita, NaoSeraPedido),
        (TipoDocumento.CertidaoNascimentoFilho, Opcional),
        (TipoDocumento.RGFilho, Opcional),
        (TipoDocumento.CpfFilho, Opcional),
        (TipoDocumento.CarteiraVacinacaoFilho, Opcional),
        (TipoDocumento.FrequenciaEscolarFilho, Opcional),
        (TipoDocumento.RgCpfConjuge, Opcional),
        (TipoDocumento.DeclaracaoUniaoEstavel, NaoSeraPedido),
        (TipoDocumento.CNPJ, NaoSeraPedido),
        (TipoDocumento.ContratoSocialMEI, NaoSeraPedido),
        (TipoDocumento.ContaBancariaPJ, NaoSeraPedido),
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
