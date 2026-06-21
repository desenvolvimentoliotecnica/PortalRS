using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Infrastructure.Data.Seeders;

/// <summary>
/// Garante template padrão de entrevista de saída por tenant (idempotente).
/// </summary>
public static class EntrevistaSaidaTemplateSeeder
{
    public const string NomePadrao = "Entrevista de saída padrão";

    private sealed record PerguntaSeed(
        int Ordem,
        string Texto,
        TipoRespostaEntrevista Tipo,
        string? Opcoes,
        bool Obrigatoria);

    private static readonly PerguntaSeed[] PerguntasPadrao =
    [
        new(1, "Qual foi o principal motivo da sua saída?", TipoRespostaEntrevista.MultiplaEscolha,
            "Oportunidade externa;Remuneração/benefícios;Relacionamento com gestor;Cultura organizacional;Crescimento profissional;Motivos pessoais;Outro", true),
        new(2, "De 1 a 10, qual seu nível de satisfação geral com a empresa?", TipoRespostaEntrevista.Escala, null, true),
        new(3, "Você recomendaria a empresa como um bom lugar para trabalhar?", TipoRespostaEntrevista.MultiplaEscolha,
            "Sim, com certeza;Provavelmente sim;Talvez;Provavelmente não;Não", true),
        new(4, "O que a empresa poderia ter feito para reter você?", TipoRespostaEntrevista.Texto, null, false),
        new(5, "Como você avalia o relacionamento com sua liderança direta?", TipoRespostaEntrevista.Escala, null, true),
        new(6, "Como você avalia oportunidades de desenvolvimento e carreira?", TipoRespostaEntrevista.Escala, null, true),
        new(7, "Deixe sugestões ou feedback aberto para melhorarmos.", TipoRespostaEntrevista.Texto, null, false),
    ];

    public static async Task EnsureAsync(AppDbContext db, string tenantId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            throw new InvalidOperationException("EntrevistaSaidaTemplateSeeder requer um tenantId.");

        var hasActive = await db.TemplatesEntrevistaSaida
            .IgnoreQueryFilters()
            .AsNoTracking()
            .AnyAsync(t => t.TenantId == tenantId && t.Ativo, ct);

        if (hasActive)
            return;

        var now = DateTimeOffset.UtcNow;
        var template = new TemplateEntrevistaSaida
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Nome = NomePadrao,
            Ativo = true,
            CreatedAtUtc = now,
            Perguntas = PerguntasPadrao.Select(p => new PerguntaEntrevistaSaida
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Ordem = p.Ordem,
                Texto = p.Texto,
                TipoResposta = p.Tipo,
                Opcoes = p.Opcoes,
                Obrigatoria = p.Obrigatoria,
            }).ToList(),
        };

        foreach (var pergunta in template.Perguntas)
            pergunta.TemplateId = template.Id;

        db.TemplatesEntrevistaSaida.Add(template);
        await db.SaveChangesAsync(ct);
    }
}
