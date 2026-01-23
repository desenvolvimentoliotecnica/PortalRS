using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using System.Text;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

public static class CandidatoSeeder
{
    public static async Task EnsureAsync(AppDbContext db, string tenantId, string emailDomain, CancellationToken ct)
    {
        if (await db.Candidatos.AnyAsync(ct))
            return;

        var vagas = await db.Vagas
            .AsNoTracking()
            .Select(v => new { v.Id, v.Titulo, v.Codigo, v.MatchMinimoPercentual })
            .ToListAsync(ct);

        if (vagas.Count == 0)
            return;

        var now = DateTimeOffset.UtcNow;
        var rng = new Random(51);

        var nomes = new[]
        {
            "Mariana", "Ana", "Carlos", "Bruno", "Daniela", "Rafael", "Patricia", "Camila", "Tiago", "Sofia",
            "Lucas", "Juliana", "Renata", "Marcelo", "Paulo", "Guilherme", "Fernanda", "Beatriz", "Luciana", "Andre",
            "Aline", "Priscila", "Fabio", "Eduardo", "Vanessa", "Carla", "Pedro", "Gabriela", "Henrique", "Isabela"
        };

        var sobrenomes = new[]
        {
            "Souza", "Silva", "Oliveira", "Pereira", "Lima", "Almeida", "Costa", "Rodrigues", "Mendes", "Santos",
            "Ferreira", "Martins", "Araujo", "Gomes", "Barbosa", "Cardoso", "Ribeiro", "Teixeira", "Carvalho", "Araujo"
        };

        var cidades = new[]
        {
            "Embu das Artes", "Sao Paulo", "Osasco", "Taboao da Serra", "Cotia", "Itapecerica da Serra", "Barueri"
        };

        var fontes = Enum.GetValues<CandidatoFonte>();
        var statuses = Enum.GetValues<CandidatoStatus>();

        var cvSnippets = new[]
        {
            "Experiencia com processos industriais, indicadores e qualidade.",
            "Atuacao em rotinas administrativas, controles e atendimento interno.",
            "Vivencia com auditorias internas, BPF e suporte a laboratorio.",
            "Forte em analise de dados, dashboards e SQL.",
            "Conhecimento em manutencao preventiva e corretiva.",
            "Atendimento a clientes, negociacoes e suporte comercial."
        };

        var obsSnippets = new[]
        {
            "Boa comunicacao e postura consultiva.",
            "Perfil analitico e organizado.",
            "Disponivel para inicio imediato.",
            "Experiencia em industria alimenticia.",
            "Boa aderencia ao perfil da vaga."
        };

        var candidatos = new List<Candidato>();

        for (var i = 0; i < 50; i++)
        {
            var nome = $"{nomes[i % nomes.Length]} {sobrenomes[(i * 3 + 1) % sobrenomes.Length]}";
            var email = $"{ToEmailUser(nome)}@{emailDomain}";
            var vaga = vagas[rng.Next(vagas.Count)];
            var createdAt = now.AddDays(-rng.Next(2, 60));
            var updatedAt = createdAt.AddDays(rng.Next(0, 15));
            if (updatedAt > now) updatedAt = now.AddDays(-1);

            var status = statuses[rng.Next(statuses.Length)];
            var fonte = fontes[rng.Next(fontes.Length)];
            var cidade = cidades[rng.Next(cidades.Length)];

            var candidato = new Candidato
            {
                Id = Guid.NewGuid(),
                Nome = nome,
                Email = email,
                Fone = PhoneFromIndex(100 + i),
                Cidade = cidade,
                Uf = "SP",
                Fonte = fonte,
                Status = status,
                VagaId = vaga.Id,
                Obs = obsSnippets[rng.Next(obsSnippets.Length)],
                CvText = cvSnippets[rng.Next(cvSnippets.Length)],
                CreatedAtUtc = createdAt,
                UpdatedAtUtc = updatedAt
            };

            if (rng.NextDouble() > 0.35)
            {
                var score = rng.Next(40, 96);
                candidato.LastMatchScore = score;
                candidato.LastMatchPass = score >= vaga.MatchMinimoPercentual;
                candidato.LastMatchAtUtc = updatedAt.AddHours(-rng.Next(1, 72));
                candidato.LastMatchVagaId = vaga.Id;
            }

            candidato.Documentos.Add(new CandidatoDocumento
            {
                Id = Guid.NewGuid(),
                CandidatoId = candidato.Id,
                Tipo = CandidatoDocumentoTipo.Curriculo,
                NomeArquivo = $"{ToEmailUser(nome)}_CV.pdf",
                ContentType = "application/pdf",
                TamanhoBytes = 120_000 + rng.Next(80_000, 320_000),
                Url = null
            });

            if (rng.NextDouble() > 0.6)
            {
                candidato.Documentos.Add(new CandidatoDocumento
                {
                    Id = Guid.NewGuid(),
                    CandidatoId = candidato.Id,
                    Tipo = CandidatoDocumentoTipo.Certificado,
                    NomeArquivo = $"certificado_{ToEmailUser(nome)}.pdf",
                    ContentType = "application/pdf",
                    TamanhoBytes = 80_000 + rng.Next(20_000, 120_000),
                    Url = null
                });
            }

            candidatos.Add(candidato);
        }

        db.Candidatos.AddRange(candidatos);
        await db.SaveChangesAsync(ct);
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

    private static string PhoneFromIndex(int i)
        => $"(11) 94010-{i:0000}";
}
