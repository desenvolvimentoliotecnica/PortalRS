namespace RHPortal.Api.Domain.Enums;

/// <summary>
/// Escopo de dados para vagas no perfil: todas, só da área, ou só abertas pelo recrutador.
/// </summary>
public enum VagasDataScope : short
{
    /// <summary>Todas as vagas (sem filtro por área/recrutador).</summary>
    All = 0,

    /// <summary>Apenas vagas da área do usuário.</summary>
    ByArea = 1,

    /// <summary>Apenas vagas abertas pelo usuário (RecrutadorResponsavelUserId).</summary>
    ByRecrutador = 2
}
