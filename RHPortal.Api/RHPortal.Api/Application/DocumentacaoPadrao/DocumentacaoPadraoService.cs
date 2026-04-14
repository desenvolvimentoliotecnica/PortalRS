using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.DocumentacaoPadrao;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.DocumentacaoPadrao;

public interface IDocumentacaoPadraoService
{
    Task<IReadOnlyList<DocumentacaoPadraoItemResponse>> GetAsync(CancellationToken ct);
    Task SaveAsync(SalvarDocumentacaoPadraoRequest request, CancellationToken ct);
}

public sealed class DocumentacaoPadraoService : IDocumentacaoPadraoService
{
    private static readonly IReadOnlyList<(short Tipo, string Label)> TodosOsTipos =
    [
        (0,  "RG"),
        (1,  "CPF"),
        (2,  "CNH"),
        (3,  "Título de Eleitor"),
        (4,  "Reservista"),
        (5,  "Comprovante de Residência"),
        (6,  "Certidão Nasc./Casamento"),
        (7,  "PIS/PASEP"),
        (9,  "Carteira de Trabalho (CTPS)"),
        (10, "Declaração de União Estável"),
        (11, "RG dos Filhos"),
        (12, "Certidão de Nascimento dos Filhos"),
        (13, "Carteira de Vacinação dos Filhos"),
        (14, "Comprovante Bancário"),
        (15, "Foto 3x4"),
        (16, "Escolaridade"),
        (20, "CNPJ"),
        (21, "Contrato Social/MEI"),
        (22, "Conta Bancária PJ"),
        (23, "Certidões Negativas"),
    ];

    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;

    public DocumentacaoPadraoService(AppDbContext db, ITenantContext tenantContext)
    {
        _db = db;
        _tenantContext = tenantContext;
    }

    public async Task<IReadOnlyList<DocumentacaoPadraoItemResponse>> GetAsync(CancellationToken ct)
    {
        // A query filter do DbContext já filtra por TenantId automaticamente
        var configs = await _db.DocumentacaoPadraoConfigs
            .AsNoTracking()
            .ToDictionaryAsync(x => x.TipoDocumento, x => x.Configuracao, ct);

        return TodosOsTipos
            .Select(t => new DocumentacaoPadraoItemResponse(
                TipoDocumento: t.Tipo,
                Label: t.Label,
                Configuracao: configs.TryGetValue(t.Tipo, out var cfg) ? cfg : (short)2 // padrão: Não será pedido
            ))
            .ToList();
    }

    public async Task SaveAsync(SalvarDocumentacaoPadraoRequest request, CancellationToken ct)
    {
        var existentes = await _db.DocumentacaoPadraoConfigs.ToListAsync(ct);
        var now = DateTimeOffset.UtcNow;

        foreach (var item in request.Documentos)
        {
            var existente = existentes.FirstOrDefault(x => x.TipoDocumento == item.TipoDocumento);
            if (existente is not null)
            {
                existente.Configuracao = item.Configuracao;
                existente.UpdatedAtUtc = now;
            }
            else
            {
                _db.DocumentacaoPadraoConfigs.Add(new DocumentacaoPadraoConfig
                {
                    Id = Guid.NewGuid(),
                    TipoDocumento = item.TipoDocumento,
                    Configuracao = item.Configuracao,
                    CreatedAtUtc = now,
                    UpdatedAtUtc = now,
                    // TenantId será injetado pelo SaveChangesAsync override do DbContext
                });
            }
        }

        await _db.SaveChangesAsync(ct);

        // Propaga a nova configuração para todas as pré-admissões ativas
        await SincronizarPreAdmisoesAtivasAsync(request.Documentos, now, ct);
    }

    /// <summary>
    /// Atualiza os documentos solicitados de todas as pré-admissões que ainda não foram concluídas,
    /// para refletir a configuração padrão recém-salva.
    /// </summary>
    private async Task SincronizarPreAdmisoesAtivasAsync(
        IReadOnlyList<DocumentacaoPadraoItemRequest> novaConfig,
        DateTimeOffset now,
        CancellationToken ct)
    {
        var statusesAtivos = new[]
        {
            PreAdmissaoStatus.Rascunho,
            PreAdmissaoStatus.Enviado,
            PreAdmissaoStatus.Acessado,
            PreAdmissaoStatus.PreenchidoParcial,
        };

        var preAdmissoes = await _db.Set<Domain.Entities.PreAdmissao>()
            .Where(pa => statusesAtivos.Contains(pa.Status))
            .Select(pa => pa.Id)
            .ToListAsync(ct);

        if (preAdmissoes.Count == 0) return;

        // Carrega todos os DocumentosSolicitados das pré-admissões ativas
        var solicitados = await _db.Set<PreAdmissaoDocumentoSolicitado>()
            .Where(ds => preAdmissoes.Contains(ds.PreAdmissaoId))
            .ToListAsync(ct);

        var configDict = novaConfig.ToDictionary(x => x.TipoDocumento, x => x.Configuracao);
        var tenantId = _tenantContext.TenantId;

        foreach (var preAdmissaoId in preAdmissoes)
        {
            var atuais = solicitados.Where(ds => ds.PreAdmissaoId == preAdmissaoId).ToList();
            var tiposAtuais = atuais.ToDictionary(ds => (short)ds.TipoDocumento);

            foreach (var (tipoShort, configuracao) in configDict)
            {
                var tipo = (TipoDocumento)tipoShort;

                if (configuracao == 2) // Não será pedido → remove se existir
                {
                    if (tiposAtuais.TryGetValue(tipoShort, out var existente))
                        _db.Set<PreAdmissaoDocumentoSolicitado>().Remove(existente);
                }
                else // Obrigatório ou Opcional → upsert
                {
                    var obrigatorio = configuracao == 0;
                    if (tiposAtuais.TryGetValue(tipoShort, out var existente))
                    {
                        existente.Obrigatorio = obrigatorio;
                    }
                    else
                    {
                        _db.Set<PreAdmissaoDocumentoSolicitado>().Add(new PreAdmissaoDocumentoSolicitado
                        {
                            Id = Guid.NewGuid(),
                            TenantId = tenantId ?? "",
                            PreAdmissaoId = preAdmissaoId,
                            TipoDocumento = tipo,
                            Obrigatorio = obrigatorio,
                            CreatedAtUtc = now,
                        });
                    }
                }
            }
        }

        await _db.SaveChangesAsync(ct);
    }
}
