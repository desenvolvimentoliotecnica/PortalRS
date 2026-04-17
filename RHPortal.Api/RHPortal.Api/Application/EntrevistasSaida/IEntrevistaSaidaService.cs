namespace RhPortal.Api.Application.EntrevistasSaida;

public interface IEntrevistaSaidaService
{
    /// <summary>Cria uma entrevista de saída para o desligamento e envia o link ao funcionário.</summary>
    Task CriarEEnviarAsync(Guid desligamentoId, Guid funcionarioId, string? httpScheme, string? httpHost, CancellationToken ct);

    /// <summary>Retorna o formulário para o token público (perguntas + dados do desligamento).</summary>
    Task<EntrevistaSaidaFormulario?> GetFormularioAsync(string token, CancellationToken ct);

    /// <summary>Salva as respostas do formulário.</summary>
    Task<EntrevistaSaidaResultado> SubmitAsync(string token, IReadOnlyList<RespostaDto> respostas, CancellationToken ct);

    /// <summary>Relatório agregado para o admin (respostas por período/área).</summary>
    Task<EntrevistaSaidaRelatorio> GetRelatorioAsync(DateOnly? de, DateOnly? ate, CancellationToken ct);
}

public sealed record PerguntaDto(
    Guid Id,
    int Ordem,
    string Texto,
    string TipoResposta,
    string[]? Opcoes,
    bool Obrigatoria);

public sealed record EntrevistaSaidaFormulario(
    Guid EntrevistaId,
    string FuncionarioNome,
    bool Expirado,
    bool JaPreenchido,
    IReadOnlyList<PerguntaDto> Perguntas);

public sealed record RespostaDto(
    Guid PerguntaId,
    string? ValorTexto,
    int? ValorEscala,
    string? ValorOpcao);

public enum EntrevistaSaidaResultado
{
    Sucesso,
    TokenInvalido,
    Expirado,
    JaPreenchido
}

public sealed record EntrevistaSaidaRelatorioItem(
    Guid EntrevistaId,
    Guid DesligamentoId,
    string FuncionarioNome,
    DateTimeOffset SubmittedAt,
    IReadOnlyList<EntrevistaSaidaRespostaItem> Respostas);

public sealed record EntrevistaSaidaRespostaItem(
    string Pergunta,
    string? ValorTexto,
    int? ValorEscala,
    string? ValorOpcao);

public sealed record EntrevistaSaidaRelatorio(
    int TotalEnviadas,
    int TotalRespondidas,
    IReadOnlyList<EntrevistaSaidaRelatorioItem> Itens);
