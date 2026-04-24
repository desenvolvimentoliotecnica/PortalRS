using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.Avaliacao;

// ── Pergunta ──

public sealed record AvaliacaoPerguntaResponse(Guid Id, string Texto, int Ordem);

// ── Ciclo ──

public sealed record AvaliacaoCicloResponse(
    Guid Id,
    string Nome,
    string Periodo,
    string? Descricao,
    AvaliacaoCicloStatus Status,
    DateOnly? DataInicio,
    DateOnly? DataFim,
    string CriadoPorNome,
    int TotalPerguntas,
    int TotalRespostas,
    DateTimeOffset CriadoEmUtc,
    List<AvaliacaoPerguntaResponse> Perguntas
);

public sealed record AvaliacaoCicloCreateRequest(
    string Nome,
    string Periodo,
    List<string> Perguntas,           // textos das perguntas
    string? Descricao = null,
    DateOnly? DataInicio = null,
    DateOnly? DataFim = null,
    bool IniciarEmRascunho = false    // quando true, cria em Rascunho; precisa ser ativado para aceitar respostas
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

// ── Convites ──

public sealed record AvaliacaoConviteResponse(
    Guid Id,
    Guid CicloId,
    Guid AvaliadorId,
    string AvaliadorNome,
    Guid AvaliandoId,
    string AvaliandoNome,
    AvaliacaoConviteTipo Tipo,
    AvaliacaoConviteStatus Status,
    DateTimeOffset CriadoEmUtc,
    DateTimeOffset? NotificadoEmUtc,
    DateTimeOffset? RespondidoEmUtc
);

public sealed record AvaliacaoGerarConvitesRequest(
    bool IncluirAutoavaliacao = true,
    bool IncluirGestorParaDireto = true,
    bool IncluirDiretoParaGestor = true,
    bool IncluirPares = false,
    bool EnviarEmail = true
);

public sealed record AvaliacaoGerarConvitesResultado(
    int ConvitesCriados,
    int EmailsEnfileirados,
    int ConvitesExistentesIgnorados
);

// ── Calibragem ──

public sealed record AvaliacaoCalibragemResponse(
    Guid Id,
    Guid CicloId,
    Guid FuncionarioId,
    string FuncionarioNome,
    string? Cargo,
    decimal ScoreGestor,
    int? DesempenhoGestor,
    int? PotencialGestor,
    decimal? ScoreComite,
    int? DesempenhoComite,
    int? PotencialComite,
    string? JustificativaComite,
    AvaliacaoCalibragemStatus Status,
    AvaliacaoCalibragemVersao Decisao,
    Guid? DecididoPorUserId,
    DateTimeOffset? DecididoEmUtc,
    string? ObservacaoDecisao,
    Guid? NineBoxAssessmentId,
    DateTimeOffset AtualizadoEmUtc
);

public sealed record AvaliacaoCalibragemAjusteRequest(
    Guid FuncionarioId,
    decimal? ScoreComite,
    int? DesempenhoComite,
    int? PotencialComite,
    string? Justificativa
);

public sealed record AvaliacaoCalibragemDecisaoRequest(
    Guid FuncionarioId,
    AvaliacaoCalibragemVersao Versao,
    string? Observacao,
    bool GerarNineBox = true
);
