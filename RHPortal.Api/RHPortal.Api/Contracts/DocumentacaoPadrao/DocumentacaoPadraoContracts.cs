namespace RhPortal.Api.Contracts.DocumentacaoPadrao;

/// <summary>Configuração de um documento individual.</summary>
public sealed record DocumentacaoPadraoItemResponse(
    short TipoDocumento,
    string Label,
    /// <summary>0 = Obrigatório | 1 = Opcional | 2 = Não será pedido</summary>
    short Configuracao
);

/// <summary>Item dentro do payload de salvamento.</summary>
public sealed class DocumentacaoPadraoItemRequest
{
    public short TipoDocumento { get; set; }
    /// <summary>0 = Obrigatório | 1 = Opcional | 2 = Não será pedido</summary>
    public short Configuracao { get; set; }
}

/// <summary>Payload completo enviado pelo admin ao salvar a configuração.</summary>
public sealed class SalvarDocumentacaoPadraoRequest
{
    public List<DocumentacaoPadraoItemRequest> Documentos { get; set; } = [];
}
