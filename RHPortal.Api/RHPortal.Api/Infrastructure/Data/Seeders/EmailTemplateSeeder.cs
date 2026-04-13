using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Infrastructure.Localization;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

public static class EmailTemplateSeeder
{
    public static async Task EnsureAsync(AppDbContext db, IStringLocalizer<SeedMessages> localizer, CancellationToken ct)
    {
        var exists = await db.EmailTemplates.AnyAsync(x => x.Name == "CandidaturaConfirmacao" && x.IsActive, ct);
        if (exists) return;

        var subject = localizer["Seed.EmailTemplateCandidaturaSubject"].Value;
        var bodyHtml = localizer["Seed.EmailTemplateCandidaturaBody"].Value;

        db.EmailTemplates.Add(new EmailTemplate
        {
            Id = Guid.NewGuid(),
            Name = "CandidaturaConfirmacao",
            SubjectTemplate = subject,
            BodyHtml = bodyHtml,
            Version = 1,
            IsActive = true,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow
        });

        await db.SaveChangesAsync(ct);

        // Seed: PreAdmissaoLink template
        await EnsurePreAdmissaoLinkAsync(db, ct);
    }

    private static async Task EnsurePreAdmissaoLinkAsync(AppDbContext db, CancellationToken ct)
    {
        var exists = await db.EmailTemplates.AnyAsync(x => x.Name == "PreAdmissaoLink" && x.IsActive, ct);
        if (exists) return;

        var subjectTemplate = "Preencha seus dados para admissao - {{empresa}}";
        var bodyHtml = @"
<div style=""font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px;"">
    <div style=""text-align:center;margin-bottom:24px;"">
        <div style=""display:inline-block;background:#2563eb;color:#fff;width:56px;height:56px;border-radius:50%;line-height:56px;font-size:24px;font-weight:bold;"">RH</div>
    </div>
    <h2 style=""color:#1a1a1a;text-align:center;margin-bottom:8px;"">Bem-vindo(a), {{nome}}!</h2>
    <p style=""color:#555;text-align:center;font-size:15px;margin-bottom:24px;"">
        Voce foi aprovado(a) e precisa preencher seus dados para admissao. E rapido e simples.
    </p>
    <div style=""text-align:center;margin-bottom:24px;"">
        <a href=""{{url}}"" style=""background:#2563eb;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;display:inline-block;font-size:16px;font-weight:600;"">
            Comecar agora
        </a>
    </div>
    <div style=""background:#f8f9fa;border-radius:8px;padding:16px;margin-bottom:24px;"">
        <p style=""color:#555;font-size:13px;margin:0 0 8px 0;font-weight:600;"">O que voce vai precisar:</p>
        <ul style=""color:#555;font-size:13px;margin:0;padding-left:20px;"">
            <li>RG e CPF</li>
            <li>Comprovante de Residencia</li>
            <li>Comprovante Bancario</li>
            <li>Carteira de Trabalho (CTPS)</li>
        </ul>
    </div>
    <p style=""color:#999;font-size:12px;text-align:center;"">
        Ou copie e cole este link no navegador:<br/>
        <a href=""{{url}}"" style=""color:#2563eb;font-size:11px;word-break:break-all;"">{{url}}</a>
    </p>
    <p style=""color:#999;font-size:11px;text-align:center;margin-top:24px;"">
        Atenciosamente, Equipe RH
    </p>
</div>";

        db.EmailTemplates.Add(new EmailTemplate
        {
            Id = Guid.NewGuid(),
            Name = "PreAdmissaoLink",
            SubjectTemplate = subjectTemplate,
            BodyHtml = bodyHtml.Trim(),
            Version = 1,
            IsActive = true,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow
        });

        await db.SaveChangesAsync(ct);
    }
}
