using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

public static class InboxItemSeeder
{
    public static async Task EnsureAsync(AppDbContext db, string tenantId, CancellationToken ct)
    {
        if (await db.InboxItems.AnyAsync(ct))
            return;

        var vaga = await db.Vagas.AsNoTracking().FirstOrDefaultAsync(ct);
        if (vaga is null)
            return;

        var now = DateTimeOffset.UtcNow;
        var log = new[] { "Arquivo detectado", "Upload ok", "Extraindo texto..." };
        var logRaw = System.Text.Json.JsonSerializer.Serialize(log);

        var items = new List<InboxItem>
        {
            new()
            {
                Id = Guid.NewGuid(),
                Origem = InboxOrigem.Email,
                Status = InboxStatus.Novo,
                RecebidoEm = now.AddMinutes(-30),
                Remetente = $"mariana.souza@{tenantId}.com",
                Assunto = "Curriculo - Analista de Dados",
                Destinatario = "rh@liotecnica.com.br",
                VagaId = vaga.Id,
                PreviewText = "Experiencia com excel avancado, dashboards e power bi.",
                ProcessamentoPct = 0,
                ProcessamentoEtapa = "Aguardando",
                ProcessamentoTentativas = 0,
                Anexos =
                {
                    new InboxAnexo
                    {
                        Id = Guid.NewGuid(),
                        Nome = "Mariana_Souza_CV.pdf",
                        Tipo = "pdf",
                        TamanhoKB = 284,
                        Hash = "demo-1"
                    }
                }
            },
            new()
            {
                Id = Guid.NewGuid(),
                Origem = InboxOrigem.Pasta,
                Status = InboxStatus.Processando,
                RecebidoEm = now.AddMinutes(-12),
                Remetente = "watcher@server",
                Assunto = "Novo arquivo em pasta monitorada",
                Destinatario = "FS: \\\\RH\\Curriculos\\Entrada",
                VagaId = vaga.Id,
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
                        Nome = "Ana_Ribeiro.docx",
                        Tipo = "docx",
                        TamanhoKB = 512,
                        Hash = "demo-2"
                    }
                }
            },
            new()
            {
                Id = Guid.NewGuid(),
                Origem = InboxOrigem.Email,
                Status = InboxStatus.Falha,
                RecebidoEm = now.AddMinutes(-90),
                Remetente = $"carlos.h@{tenantId}.com",
                Assunto = "CV atualizado (PDF protegido)",
                Destinatario = "rh@liotecnica.com.br",
                VagaId = vaga.Id,
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
                        Nome = "CarlosH_CV.pdf",
                        Tipo = "pdf",
                        TamanhoKB = 190,
                        Hash = "demo-3"
                    }
                }
            }
        };

        db.InboxItems.AddRange(items);
        await db.SaveChangesAsync(ct);
    }
}
