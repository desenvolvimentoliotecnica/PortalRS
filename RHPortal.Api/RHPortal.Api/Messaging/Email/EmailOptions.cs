namespace RhPortal.Api.Messaging.Email;

public sealed class EmailOptions
{
    public string Provider { get; set; } = "smtp"; // smtp | ses
    public SmtpSettings Smtp { get; set; } = new();
    public SmtpSettings Ses { get; set; } = new();
}

public sealed class SmtpSettings
{
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 587;
    public bool EnableSsl { get; set; } = true;
    public string UserName { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FromAddress { get; set; } = string.Empty;
    public string FromName { get; set; } = string.Empty;
}
