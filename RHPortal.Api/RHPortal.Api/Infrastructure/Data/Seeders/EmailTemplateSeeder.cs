using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

public static class EmailTemplateSeeder
{
    public static async Task EnsureAsync(AppDbContext db, CancellationToken ct)
    {
        var exists = await db.EmailTemplates.AnyAsync(x => x.Name == "CandidaturaConfirmacao" && x.IsActive, ct);
        if (exists) return;

        db.EmailTemplates.Add(new EmailTemplate
        {
            Id = Guid.NewGuid(),
            Name = "CandidaturaConfirmacao",
            SubjectTemplate = "Confirmacao da sua candidatura - {{VagaTitulo}}",
            BodyHtml = @"<div style=""font-family:Arial,sans-serif;line-height:1.6"">
                <h2>Obrigado pela candidatura, {{Nome}}!</h2>
                <p>Recebemos sua candidatura para a vaga <strong>{{VagaTitulo}}</strong>.</p>
                <p>Guarde sua chave unica de acesso ao portal:</p>
                <p style=""font-size:18px;font-weight:bold"">{{PortalAccessKey}}</p>
                <p>Em breve voce recebera novidades sobre o processo seletivo.</p>
                <p>Equipe RH</p>
            </div>",
            Version = 1,
            IsActive = true,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow
        });

        await db.SaveChangesAsync(ct);
    }
}
