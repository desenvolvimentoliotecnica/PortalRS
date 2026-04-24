using RhPortal.Api.Domain.Entities;

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

/// <summary>Configuração efetiva para um NivelCargo, indicando se veio de override ou do padrão global.</summary>
public sealed record DocumentacaoPadraoPorNivelItemResponse(
    short TipoDocumento,
    string Label,
    /// <summary>0 = Obrigatório | 1 = Opcional | 2 = Não será pedido</summary>
    short Configuracao,
    /// <summary>True = valor vem do override por NivelCargo; False = vem do padrão global do tenant.</summary>
    bool OverrideAtivo
);

/// <summary>Lista de itens efetivos para um NivelCargo específico.</summary>
public sealed record DocumentacaoPadraoPorNivelResponse(
    Guid NivelCargoId,
    string NivelCargoNome,
    IReadOnlyList<DocumentacaoPadraoPorNivelItemResponse> Documentos
);

/// <summary>Payload para salvar override por NivelCargo. Itens ausentes são removidos do override (fallback volta ao global).</summary>
public sealed class SalvarDocumentacaoPadraoPorNivelRequest
{
    public List<DocumentacaoPadraoItemRequest> Documentos { get; set; } = [];
}

// ── Override por Cargo específico (JobPosition) ─────────────────────────────

/// <summary>
/// Item efetivo para um Cargo específico, com rastreio da origem do valor (cargo/nivel/global).
/// </summary>
public sealed record DocumentacaoPadraoPorCargoItemResponse(
    short TipoDocumento,
    string Label,
    /// <summary>0 = Obrigatório | 1 = Opcional | 2 = Não será pedido</summary>
    short Configuracao,
    /// <summary>True = valor vem do override por Cargo específico.</summary>
    bool OverrideCargoAtivo,
    /// <summary>True = valor vem do override por NivelCargo (quando não há override por Cargo).</summary>
    bool OverrideNivelCargoAtivo,
    /// <summary>Origem efetiva do valor: "cargo" | "nivel" | "global".</summary>
    string Origem
);

public sealed record DocumentacaoPadraoPorCargoResponse(
    Guid CargoId,
    string CargoCode,
    string CargoNome,
    Guid? NivelCargoId,
    string? NivelCargoNome,
    IReadOnlyList<DocumentacaoPadraoPorCargoItemResponse> Documentos
);

public sealed class SalvarDocumentacaoPadraoPorCargoRequest
{
    public List<DocumentacaoPadraoItemRequest> Documentos { get; set; } = [];
}

// ── Histórico de alterações ─────────────────────────────────────────────────

/// <summary>Linha do histórico de alterações de documentação padrão (global, por NivelCargo ou por Cargo).</summary>
public sealed record DocumentacaoPadraoHistoricoItem(
    Guid Id,
    DocumentacaoPadraoEscopo Escopo,
    Guid? NivelCargoId,
    string? NivelCargoNome,
    Guid? CargoId,
    string? CargoNome,
    short TipoDocumento,
    string TipoDocumentoLabel,
    /// <summary>0=Obrigatório, 1=Opcional, 2=Não será pedido. Null = antes não existia ou era herdado.</summary>
    short? ConfiguracaoAnterior,
    /// <summary>0=Obrigatório, 1=Opcional, 2=Não será pedido. Null = override removido (voltou a herdar).</summary>
    short? ConfiguracaoNova,
    DocumentacaoPadraoAcao Acao,
    Guid? UserId,
    string? UserNome,
    DateTimeOffset CriadoEmUtc
);

public sealed record DocumentacaoPadraoHistoricoResponse(
    IReadOnlyList<DocumentacaoPadraoHistoricoItem> Items,
    int Total,
    int Page,
    int PageSize,
    int TotalPages
);
