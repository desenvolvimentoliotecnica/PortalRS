namespace RhPortal.Api.Domain.Enums;

/// <summary>
/// Efeito de um motivo de requisição de vaga sobre o headcount do quadro.
/// Aumenta  = entra alguém, ninguém sai  → +1 (ex.: demanda, expansão, nova unidade).
/// Diminui  = sai alguém, ninguém entra  → -1 (ex.: desligamento puro, sem reposição).
/// Ambos    = sai um e entra outro       →  0 líquido (reposição — ex.: pedido de demissão com vaga).
/// </summary>
public enum EfeitoHeadcount : short
{
    Aumenta = 0,
    Diminui = 1,
    Ambos = 2,
}
