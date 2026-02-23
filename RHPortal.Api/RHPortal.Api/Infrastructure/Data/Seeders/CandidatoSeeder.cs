using Bogus;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using System.Text;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

public static class CandidatoSeeder
{
    public static async Task EnsureAsync(
        AppDbContext db,
        string tenantId,
        string emailDomain,
        int targetCount,
        int perVaga,
        int? randomSeed,
        CancellationToken ct)
    {
        targetCount = Math.Max(0, targetCount);
        perVaga = Math.Max(0, perVaga);
        if (targetCount == 0 && perVaga == 0)
            return;

        var vagas = await db.Vagas
            .AsNoTracking()
            .Select(v => new { v.Id, v.Titulo, v.Codigo, v.MatchMinimoPercentual })
            .ToListAsync(ct);

        if (vagas.Count == 0)
            return;

        if (perVaga > 0)
            targetCount = perVaga * vagas.Count;

        var existingEmails = await db.Candidatos
            .AsNoTracking()
            .Select(c => c.Email)
            .Where(e => !string.IsNullOrWhiteSpace(e))
            .ToListAsync(ct);

        var existingCount = existingEmails.Count;
        if (existingCount >= targetCount)
            return;

        var now = DateTimeOffset.UtcNow;
        var seed = randomSeed.HasValue ? randomSeed.Value + 9 : 51;
        var faker = new Faker("pt_BR")
        {
            Random = new Randomizer(seed)
        };

        var fontes = Enum.GetValues<CandidateOrigin>();
        var statuses = Enum.GetValues<CandidateStatus>();
        var usedEmails = existingEmails.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var toCreate = targetCount - existingCount;

        var candidatos = new List<Candidato>();

        for (var i = 0; i < toCreate; i++)
        {
            var nome = faker.Name.FullName();
            var emailUser = ToEmailUser(nome);
            if (string.IsNullOrWhiteSpace(emailUser))
                emailUser = "candidato";

            var email = $"{emailUser}@{emailDomain}";
            var counter = 1;
            while (!usedEmails.Add(email))
            {
                counter++;
                email = $"{emailUser}{counter}@{emailDomain}";
            }

            var emailUserForFile = email.Split('@')[0];
            var vaga = faker.PickRandom(vagas);
            var createdAt = now.AddDays(-faker.Random.Int(2, 60));
            var updatedAt = createdAt.AddDays(faker.Random.Int(0, 15));
            if (updatedAt > now) updatedAt = now.AddDays(-1);

            var status = faker.PickRandom(statuses);
            var fonte = faker.PickRandom(fontes);
            var cidade = faker.Address.City();

            var candidato = new Candidato
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Nome = nome,
                Email = email,
                Fone = faker.Phone.PhoneNumber("(11) 9####-####"),
                Cidade = cidade,
                Uf = "SP",
                Fonte = fonte,
                Status = status,
                VagaId = vaga.Id,
                Obs = faker.Lorem.Sentence(8),
                CvText = faker.Lorem.Paragraphs(2),
                CreatedAtUtc = createdAt,
                UpdatedAtUtc = updatedAt
            };

            if (faker.Random.Double() > 0.35)
            {
                var score = faker.Random.Int(40, 95);
                candidato.LastMatchScore = score;
                candidato.LastMatchPass = score >= vaga.MatchMinimoPercentual;
                candidato.LastMatchAtUtc = updatedAt.AddHours(-faker.Random.Int(1, 72));
                candidato.LastMatchVagaId = vaga.Id;
            }

            candidato.Documentos.Add(new CandidatoDocumento
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CandidatoId = candidato.Id,
                Tipo = CandidateDocumentType.Curriculo,
                NomeArquivo = $"{emailUserForFile}_CV.pdf",
                ContentType = "application/pdf",
                TamanhoBytes = 120_000 + faker.Random.Int(80_000, 320_000),
                Url = null
            });

            if (faker.Random.Double() > 0.6)
            {
                candidato.Documentos.Add(new CandidatoDocumento
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    CandidatoId = candidato.Id,
                    Tipo = CandidateDocumentType.Certificado,
                    NomeArquivo = $"certificado_{emailUserForFile}.pdf",
                    ContentType = "application/pdf",
                    TamanhoBytes = 80_000 + faker.Random.Int(20_000, 120_000),
                    Url = null
                });
            }

            candidatos.Add(candidato);
        }

        var autoDetectChanges = db.ChangeTracker.AutoDetectChangesEnabled;
        try
        {
            db.ChangeTracker.AutoDetectChangesEnabled = false;
            db.Candidatos.AddRange(candidatos);
            db.ChangeTracker.DetectChanges();
            await db.SaveChangesAsync(ct);
        }
        finally
        {
            db.ChangeTracker.AutoDetectChangesEnabled = autoDetectChanges;
        }
    }

    private static string ToEmailUser(string fullName)
    {
        // "Joao Pedro Silva" -> "joao.pedro.silva"
        static string stripDiacritics(string s)
        {
            var normalized = s.Normalize(NormalizationForm.FormD);
            var chars = normalized.Where(c => System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c) != System.Globalization.UnicodeCategory.NonSpacingMark);
            return new string(chars.ToArray()).Normalize(NormalizationForm.FormC);
        }

        var cleaned = stripDiacritics(fullName)
            .Trim()
            .ToLowerInvariant();

        var parts = cleaned
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        if (parts.Length == 1) return parts[0];

        return string.Join('.', parts);
    }

}
