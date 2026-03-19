namespace RhPortal.Api.Domain.Enums;

public enum StatusProjeto : short
{
    Ativo = 0,
    Finalizado = 1,
    Cancelado = 2
}

public enum StatusCandidatoProjeto : short
{
    Ativo = 0,
    Aprovado = 1,
    Reprovado = 2,
    /// <summary>Copiado de rodada anterior — aguarda triagem na nova rodada.</summary>
    Disponivel = 3
}

public enum ResponsavelFaseTipo : short
{
    RH = 0,
    Gestor = 1,
    Externo = 2
}
