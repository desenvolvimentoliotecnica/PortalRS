namespace Liotecnica.Integration.RM;

/// <summary>
/// Pasta onde salvar os dados extraídos do RM (Liotecnica.Integration.RM.Schema.Tables).
/// </summary>
public sealed class OutputOptions
{
    public const string SectionName = "Output";

    /// <summary>Caminho da pasta para gravar os JSONs extraídos (ex.: pasta Liotecnica.Integration.RM.Schema.Tables). Se vazio, usa pasta relativa ao ContentRoot.</summary>
    public string SchemaTablesPath { get; set; } = string.Empty;

    /// <summary>Pasta para logs do worker (o que está rodando e o que foi extraído). Se vazio, usa Liotecnica.Integration.RM.Logs.</summary>
    public string LogsPath { get; set; } = string.Empty;
}
