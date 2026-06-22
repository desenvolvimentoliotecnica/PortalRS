using RhPortal.Api.Contracts.EntrevistasSaida;

namespace RhPortal.Api.Application.EntrevistasSaida;

public interface IEntrevistaSaidaService
{
    /// <summary>Envia (ou reenvia idempotente) entrevista de saída para uma solicitação de desligamento.</summary>
    Task<EntrevistaSaidaEnvioResult> EnviarAsync(Guid solicitacaoDesligamentoId, CancellationToken ct);

    /// <summary>Reenvia e-mail do link ativo (não respondido, não expirado).</summary>
    Task<EntrevistaSaidaEnvioResult> ReenviarAsync(Guid solicitacaoDesligamentoId, CancellationToken ct);

    /// <summary>Status e respostas (se respondida) de uma solicitação.</summary>
    Task<EntrevistaSaidaDetalheDto?> GetDetalheAsync(Guid solicitacaoDesligamentoId, CancellationToken ct);

    /// <summary>Status em lote para enriquecer grid de desligamentos (1 query).</summary>
    Task<IReadOnlyDictionary<Guid, EntrevistaSaidaGridStatus>> GetStatusBatchAsync(
        IReadOnlyList<(Guid DesligamentoId, Guid FuncionarioId)> items,
        CancellationToken ct);

    /// <summary>Retorna o formulário para o token público (perguntas + dados do desligamento).</summary>
    Task<EntrevistaSaidaFormulario?> GetFormularioAsync(string token, CancellationToken ct);

    /// <summary>Salva as respostas do formulário.</summary>
    Task<EntrevistaSaidaResultado> SubmitAsync(string token, IReadOnlyList<RespostaDto> respostas, CancellationToken ct);

    /// <summary>Relatório agregado para o admin (respostas por período).</summary>
    Task<EntrevistaSaidaRelatorio> GetRelatorioAsync(DateOnly? de, DateOnly? ate, CancellationToken ct);

    /// <summary>Template ativo do tenant com perguntas ordenadas.</summary>
    Task<TemplateEntrevistaSaidaResponse?> GetTemplateAtivoAsync(CancellationToken ct);

    /// <summary>Upsert do template ativo (1 por tenant).</summary>
    Task<TemplateEntrevistaSaidaResponse> UpsertTemplateAtivoAsync(
        TemplateEntrevistaSaidaUpsertRequest request,
        CancellationToken ct);
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
