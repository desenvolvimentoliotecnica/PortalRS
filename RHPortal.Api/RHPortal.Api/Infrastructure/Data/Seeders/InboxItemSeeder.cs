using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

public static class InboxItemSeeder
{
    public static async Task EnsureAsync(AppDbContext db, string tenantId, int targetCount, CancellationToken ct)
    {
        targetCount = Math.Max(0, targetCount);
        if (targetCount == 0)
            return;

        if (await db.InboxItems.AnyAsync(ct))
            return;

        var vaga = await db.Vagas.AsNoTracking().FirstOrDefaultAsync(ct);
        if (vaga is null)
            return;

        var now = DateTimeOffset.UtcNow;
        var log = new[] { "Arquivo detectado", "Upload ok", "Extraindo texto..." };
        var logRaw = System.Text.Json.JsonSerializer.Serialize(log);

        var items = new List<InboxItem>(targetCount);
        for (var i = 0; i < targetCount; i++)
            items.Add(BuildItem(i, tenantId, vaga.Id, now, logRaw));

        var autoDetectChanges = db.ChangeTracker.AutoDetectChangesEnabled;
        try
        {
            db.ChangeTracker.AutoDetectChangesEnabled = false;
            db.InboxItems.AddRange(items);
            db.ChangeTracker.DetectChanges();
            await db.SaveChangesAsync(ct);
        }
        finally
        {
            db.ChangeTracker.AutoDetectChangesEnabled = autoDetectChanges;
        }
    }

    private static InboxItem BuildItem(int seedIndex, string tenantId, Guid vagaId, DateTimeOffset now, string logRaw)
    {
        var offsetMinutes = 12 + (seedIndex * 7);
        var suffix = seedIndex + 1;
        var kind = seedIndex % 3;

        if (kind == 0)
        {
            return new InboxItem
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Origem = InboxOrigem.Email,
                Status = InboxStatus.Novo,
                RecebidoEm = now.AddMinutes(-offsetMinutes),
                Remetente = $"mariana.souza{suffix}@{tenantId}.com",
                Assunto = $"Curriculo - Analista de Dados ({suffix})",
                Destinatario = "rh@liotecnica.com.br",
                VagaId = vagaId,
                PreviewText = "Experiencia com excel avancado, dashboards e power bi.",
                ProcessamentoPct = 0,
                ProcessamentoEtapa = "Aguardando",
                ProcessamentoTentativas = 0,
                Anexos =
                {
                    new InboxAnexo
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        Nome = $"Mariana_Souza_{suffix}_CV.pdf",
                        Tipo = "pdf",
                        TamanhoKB = 284,
                        Hash = $"demo-1-{suffix}"
                    }
                }
            };
        }

        if (kind == 1)
        {
            return new InboxItem
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Origem = InboxOrigem.Pasta,
                Status = InboxStatus.Processando,
                RecebidoEm = now.AddMinutes(-(offsetMinutes + 10)),
                Remetente = "watcher@server",
                Assunto = $"Novo arquivo em pasta monitorada ({suffix})",
                Destinatario = "FS: \\\\RH\\Curriculos\\Entrada",
                VagaId = vagaId,
                PreviewText = "PowerBI, SQL, modelagem dimensional e analytics.",
                ProcessamentoPct = 55,
                ProcessamentoEtapa = "Extraindo texto",
                ProcessamentoTentativas = 1,
                ProcessamentoLogRaw = logRaw,
                Anexos =
                {
                    new InboxAnexo
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        Nome = $"Ana_Ribeiro_{suffix}.docx",
                        Tipo = "docx",
                        TamanhoKB = 512,
                        Hash = $"demo-2-{suffix}"
                    }
                }
            };
        }

        return new InboxItem
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Origem = InboxOrigem.Email,
                Status = InboxStatus.Falha,
                RecebidoEm = now.AddMinutes(-(offsetMinutes + 40)),
                Remetente = $"carlos.h{suffix}@{tenantId}.com",
                Assunto = $"CV atualizado (PDF protegido) ({suffix})",
                Destinatario = "rh@liotecnica.com.br",
                VagaId = vagaId,
                ProcessamentoPct = 100,
                ProcessamentoEtapa = "Falha",
                ProcessamentoTentativas = 2,
                ProcessamentoUltimoErro = "PDF protegido por senha",
                ProcessamentoLogRaw = System.Text.Json.JsonSerializer.Serialize(new[] { "Anexo encontrado", "Tentativa de leitura", "PDF com senha" }),
                Anexos =
                {
                    new InboxAnexo
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        Nome = $"CarlosH_{suffix}_CV.pdf",
                        Tipo = "pdf",
                        TamanhoKB = 190,
                        Hash = $"demo-3-{suffix}"
                    }
                }
            };
    }
}
