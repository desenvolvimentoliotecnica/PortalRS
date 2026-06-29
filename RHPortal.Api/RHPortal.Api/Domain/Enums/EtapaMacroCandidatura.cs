namespace RhPortal.Api.Domain.Enums;

/// <summary>
/// Etapa macro no funil de recrutamento vista pelo candidato no portal externo.
/// Granularidade deliberadamente baixa — o pipeline interno do RH pode ter mais
/// estados, mas o candidato só enxerga estas fases macro.
/// </summary>
public enum EtapaMacroCandidatura
{
    Aplicada = 0,
    EmTriagem = 1,
    Entrevista = 2,
    Teste = 3,
    Proposta = 4,
    Contratado = 5,
    Recusado = 6,
    Desistiu = 7,
    EntrevistaTecnica = 8,
    ReprovadoRh = 9,
    ReprovadoGestor = 10,
}

/// <summary>
/// Status de alto nível (ciclo de vida da candidatura).
/// </summary>
public enum CandidaturaStatus
{
    Ativa = 0,
    Contratado = 1,
    Reprovado = 2,
    Desistiu = 3,
    Arquivada = 4,
}
