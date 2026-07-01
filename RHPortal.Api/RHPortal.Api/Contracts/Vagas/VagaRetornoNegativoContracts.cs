using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Contracts.Vagas;

public sealed record VagaRetornoNegativoPreviewItem(
    Guid CandidaturaId,
    Guid CandidatoId,
    string CandidatoNome,
    string? CandidatoEmail,
    string? CandidatoFone,
    string? CandidatoCelular,
    EtapaMacroCandidatura EtapaAtual);

public sealed record VagaRetornoNegativoPreviewResponse(
    Guid VagaId,
    string VagaTitulo,
    IReadOnlyList<VagaRetornoNegativoPreviewItem> Destinatarios,
    string TemplateAssunto,
    string TemplateCorpo);

public sealed record VagaRetornoNegativoEnviarRequest(
    IReadOnlyList<Guid> CandidaturaIds);

public sealed record VagaRetornoNegativoEnviarItemResult(
    Guid CandidaturaId,
    bool Sucesso,
    string? MensagemErro);

public sealed record VagaRetornoNegativoEnviarResponse(
    int Enviados,
    int Falhas,
    IReadOnlyList<VagaRetornoNegativoEnviarItemResult> Resultados);
