namespace RhPortal.Api.Domain.Enums;

public enum TipoWorkflowRH : short
{
    TriagemVaga = 1,
    RevisaoPosEfetivacao = 2,
    OffboardingDesligamento = 3
}

public enum WorkflowRHStatus : short
{
    NaoIniciado = 0,
    EmAndamento = 1,
    Concluido = 2,
    Cancelado = 3
}

public enum EtapaWorkflowRHStatus : short
{
    NaoIniciada = 0,
    EmAndamento = 1,
    Concluida = 2,
    Pulada = 3,
    Bloqueada = 4
}

public enum OrigemPreenchimento : short
{
    Gestor = 0,
    RH = 1,
    Sistema = 2
}
