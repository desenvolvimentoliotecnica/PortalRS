namespace RhPortal.Api.Domain.Entities;

/// <summary>
/// Template de Survey/Pesquisa pronto para uso (Entrega 1.5 — Fase 1 Paridade Feedz).
/// Cobertura inicial: eNPS, Clima, Liderança e Diversidade — 4 modelos BR validados
/// que chegam por seeder em todo tenant.
///
/// <para>Quando RH cria uma pesquisa a partir do template, as perguntas
/// (<see cref="SurveyTemplateQuestion"/>) são copiadas para <c>SurveyQuestion</c>
/// e o Survey real fica desacoplado do template (edições no template não afetam
/// pesquisas já criadas).</para>
/// </summary>
public sealed class SurveyTemplate : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public string Codigo { get; set; } = default!;
    public string Nome { get; set; } = default!;
    public string? Descricao { get; set; }

    /// <summary>Tipo principal — usado para popular Survey.Type (eNPS, Clima, etc.).</summary>
    public string TipoSurvey { get; set; } = default!;

    /// <summary>
    /// Sugestão de cadência para futura recorrência automática (ex: "0 9 * * 1" = toda segunda 9h).
    /// Por ora apenas informativo — disparo automático será via hosted service em Onda 2.
    /// </summary>
    public string? CadenciaSugerida { get; set; }

    public bool IsSystem { get; set; }
    public bool IsActive { get; set; } = true;
    public int Ordem { get; set; }

    public DateTimeOffset CriadoEmUtc { get; set; }
    public DateTimeOffset AtualizadoEmUtc { get; set; }

    public List<SurveyTemplateQuestion> Questions { get; set; } = new();
}

/// <summary>Pergunta de um <see cref="SurveyTemplate"/>.</summary>
public sealed class SurveyTemplateQuestion
{
    public Guid Id { get; set; }
    public Guid TemplateId { get; set; }
    public SurveyTemplate? Template { get; set; }

    public string Texto { get; set; } = default!;

    /// <summary>Tipo da pergunta — segue contrato de SurveyQuestion (Text, SingleChoice, MultiChoice, Score0-10).</summary>
    public string Tipo { get; set; } = default!;

    public int Ordem { get; set; }

    /// <summary>JSON com as opções (quando aplicável). Formato: ["Opção 1","Opção 2",...].</summary>
    public string? OpcoesJson { get; set; }
}
