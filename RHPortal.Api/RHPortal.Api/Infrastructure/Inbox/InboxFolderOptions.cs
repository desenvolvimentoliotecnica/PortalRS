namespace RhPortal.Api.Infrastructure.Inbox;

public sealed class InboxFolderOptions
{
    public string RootPath { get; set; } = @"C:\Projetos\RHPortal\Inbox";
    public string IncomingFolderName { get; set; } = "incoming";
    public string ProcessedFolderName { get; set; } = "processado";
    public string ErrorFolderName { get; set; } = "erro";
    public int RetryDelayMs { get; set; } = 800;
    public int RetryCount { get; set; } = 6;
}
