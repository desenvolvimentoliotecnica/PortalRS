namespace RHPortal.Api.Domain.Enums;

/// <summary>
/// Origem de uma vaga sincronizada do TOTVS RM. Permite ao recrutador entender
/// se a vaga é nova (aumento de quadro), substituição por desligamento (alguém saiu),
/// substituição por promoção (alguém subiu de cargo) ou avulsa.
///
/// Mapeamento com tabelas RM:
///   - <c>AumentoQuadro</c>      → veio de VREQAUMENTOQUADRO
///   - <c>SubstituicaoDesligamento</c> → veio de VREQSUBSTITUICAO cujo IDREQPAI aponta VREQDESLIGAMENTO
///   - <c>SubstituicaoPromocao</c>     → veio de VREQSUBSTITUICAO cujo IDREQPAI aponta VREQTRANSFPROMOCAO
///   - <c>Direta</c> → vaga em VRSVAGAS sem requisição-pai identificada
///   - <c>Manual</c> → vaga criada direto no Portal sem origem TOTVS
/// </summary>
public enum VagaOrigemTipo : short
{
    Manual = 0,
    AumentoQuadro = 1,
    SubstituicaoDesligamento = 2,
    SubstituicaoPromocao = 3,
    Direta = 4,
}
