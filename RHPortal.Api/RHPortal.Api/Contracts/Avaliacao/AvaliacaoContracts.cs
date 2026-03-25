using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.Avaliacao;

// ── Pergunta ──

public sealed record AvaliacaoPerguntaResponse(Guid Id, string Texto, int Ordem);

// ── Ciclo ──

public sealed record AvaliacaoCicloResponse(
    Guid Id,
    string Nome,
    string Periodo,
    AvaliacaoCicloStatus Status,
    string CriadoPorNome,
    int TotalPerguntas,
    int TotalRespostas,
    DateTimeOffset CriadoEmUtc,
    List<AvaliacaoPerguntaResponse> Perguntas
);

public sealed record AvaliacaoCicloCreateRequest(
    string Nome,
    string Periodo,
    List<string> Perguntas  // textos das perguntas
);

// ── Respostas ──

public sealed record RespostaItemRequest(Guid PerguntaId, int Nota);

public sealed record AvaliacaoResponderRequest(
    Guid AvaliandoId,
    List<RespostaItemRequest> Respostas
);

// ── Resultados ──

public sealed record AvaliacaoResultadoRow(
    Guid AvaliandoId,
    string AvaliandoNome,
    string? Cargo,
    decimal Score,
    int TotalRespostas,
    DateTimeOffset UltimaRespostaEmUtc
);
