namespace RhPortal.Api.Contracts.EntrevistasSaida;

public enum EntrevistaSaidaStatusCode
{
    NaoEnviada,
    Enviada,
    Respondida,
    Expirada,
    SemTemplate,
    SemEmail
}

public enum EntrevistaSaidaEnvioResult
{
    Sucesso,
    SolicitacaoNaoEncontrada,
    SemTemplate,
    SemEmail,
    JaRespondida,
    Expirada
}

public sealed record EntrevistaSaidaGridStatus(
    EntrevistaSaidaStatusCode Status,
    DateTimeOffset? EnviadaEmUtc,
    DateTimeOffset? RespondidaEmUtc);

public sealed record EntrevistaSaidaDetalheDto(
    EntrevistaSaidaStatusCode Status,
    DateTimeOffset? EnviadaEmUtc,
    DateTimeOffset? RespondidaEmUtc,
    DateTimeOffset? ExpiraEmUtc,
    IReadOnlyList<EntrevistaSaidaRespostaDetalhe>? Respostas);

public sealed record EntrevistaSaidaRespostaDetalhe(
    string Pergunta,
    string? ValorTexto,
    int? ValorEscala,
    string? ValorOpcao);

public sealed record TemplateEntrevistaSaidaResponse(
    Guid Id,
    string Nome,
    bool Ativo,
    IReadOnlyList<TemplatePerguntaResponse> Perguntas);

public sealed record TemplatePerguntaResponse(
    Guid Id,
    int Ordem,
    string Texto,
    string TipoResposta,
    string[]? Opcoes,
    bool Obrigatoria);

public sealed class TemplateEntrevistaSaidaUpsertRequest
{
    public string Nome { get; set; } = string.Empty;
    public IList<TemplatePerguntaUpsertRequest> Perguntas { get; set; } = [];
}

public sealed class TemplatePerguntaUpsertRequest
{
    public Guid? Id { get; set; }
    public int Ordem { get; set; }
    public string Texto { get; set; } = string.Empty;
    public string TipoResposta { get; set; } = "Texto";
    public string[]? Opcoes { get; set; }
    public bool Obrigatoria { get; set; }
}
