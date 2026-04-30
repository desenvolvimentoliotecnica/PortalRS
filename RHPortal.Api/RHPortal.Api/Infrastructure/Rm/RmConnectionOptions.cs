namespace RhPortal.Api.Infrastructure.Rm;

/// <summary>
/// Conexão read-only ao SQL Server do RM (CORPORERM). Configure via seção <c>Rm</c>.
/// </summary>
public sealed class RmConnectionOptions
{
    public const string SectionName = "Rm";

    public string ConnectionString { get; set; } = string.Empty;

    public string? Server { get; set; }
    public string? Database { get; set; }
    public string? UserId { get; set; }
    public string? Password { get; set; }
    public bool Encrypt { get; set; } = true;
    public bool TrustServerCertificate { get; set; } = true;

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(ConnectionString)
        || (!string.IsNullOrWhiteSpace(Server) && !string.IsNullOrWhiteSpace(Database));

    public string GetConnectionString()
    {
        if (!string.IsNullOrWhiteSpace(ConnectionString))
            return ConnectionString;

        if (string.IsNullOrWhiteSpace(Server) || string.IsNullOrWhiteSpace(Database))
            throw new InvalidOperationException("Configure Rm:ConnectionString ou Rm:Server e Rm:Database.");

        var builder = new Microsoft.Data.SqlClient.SqlConnectionStringBuilder
        {
            DataSource = Server,
            InitialCatalog = Database,
            Encrypt = Encrypt,
            TrustServerCertificate = TrustServerCertificate
        };
        if (!string.IsNullOrWhiteSpace(UserId))
        {
            builder.UserID = UserId;
            builder.Password = Password ?? string.Empty;
        }
        return builder.ConnectionString;
    }
}
