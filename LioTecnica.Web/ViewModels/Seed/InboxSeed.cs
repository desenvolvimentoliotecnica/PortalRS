namespace LioTecnica.Web.ViewModels.Seed;

public sealed class InboxSeed
{
    public string Id { get; init; } = "";
    public string Origem { get; init; } = "";
    public string Status { get; init; } = "";
    public string RecebidoEm { get; init; } = "";
    public string Remetente { get; init; } = "";
    public string Assunto { get; init; } = "";
    public string Destinatario { get; init; } = "";
    public string? VagaId { get; init; }
    public IReadOnlyList<InboxAnexoSeed> Anexos { get; init; } = Array.Empty<InboxAnexoSeed>();
    public InboxProcessamentoSeed Processamento { get; init; } = new();
    public string PreviewText { get; init; } = "";
}

public sealed class InboxAnexoSeed
{
    public string Nome { get; init; } = "";
    public string Tipo { get; init; } = "";
    public int TamanhoKB { get; init; }
    public string Hash { get; init; } = "";
}

public sealed class InboxProcessamentoSeed
{
    public int Pct { get; init; }
    public string Etapa { get; init; } = "";
    public IReadOnlyList<string> Log { get; init; } = Array.Empty<string>();
    public int Tentativas { get; init; }
    public string? UltimoErro { get; init; }
}
