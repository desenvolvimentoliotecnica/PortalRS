namespace RhPortal.Api.Domain.Enums;

/// <summary>
/// Indica qual face/lado de um documento foi enviado.
/// Permite distinguir frente e verso (RG, CNH, CTPS) sem criar tipos separados.
/// </summary>
public enum LadoDocumento : short
{
    /// <summary>Documento de face única — sem distinção frente/verso.</summary>
    Unico = 0,
    /// <summary>Frente do documento.</summary>
    Frente = 1,
    /// <summary>Verso do documento.</summary>
    Verso = 2,
}
