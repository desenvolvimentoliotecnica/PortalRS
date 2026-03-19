using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Domain.Entities;

public sealed class DocumentoColaborador : ITenantEntity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = default!;

    public Guid FuncionarioId { get; set; }
    public Funcionario? Funcionario { get; set; }

    public TipoDocumento Tipo { get; set; }
    public string NomeArquivo { get; set; } = default!;
    public string ContentType { get; set; } = default!;
    public long TamanhoBytes { get; set; }

    /// <summary>Relative path/key in storage (blob or local disk).</summary>
    public string StoragePath { get; set; } = default!;

    public StatusDocumento Status { get; set; } = StatusDocumento.PendenteValidacao;
    public string? ObservacaoRh { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
