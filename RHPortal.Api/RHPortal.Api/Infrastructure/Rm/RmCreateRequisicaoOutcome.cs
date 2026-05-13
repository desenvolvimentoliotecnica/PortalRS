namespace RhPortal.Api.Infrastructure.Rm;

public sealed record RmCreateRequisicaoOutcome(
    bool Sucesso,
    bool JaExistiaNoRm,
    string? CodigoRm,
    short? CodStatusRm,
    string? MensagemErro,
    int? CodigoTecnico,
    short? CodColRequisicao = null,
    int? IdReq = null);
