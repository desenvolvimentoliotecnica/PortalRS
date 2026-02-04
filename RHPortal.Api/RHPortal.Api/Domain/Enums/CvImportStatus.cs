namespace RhPortal.Api.Domain.Enums;

/// <summary>Status do processamento de importação de CV do talento.</summary>
public enum CvImportStatus
{
    Pendente = 0,
    EmProcessamento = 1,
    PendenteValidacao = 2,
    Concluido = 3
}
