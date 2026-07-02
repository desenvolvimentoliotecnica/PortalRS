namespace RhPortal.Api.Application.Agenda;

public static class AgendaMeetingFormats
{
    public const string Online = "online";
    public const string Presencial = "presencial";
    public const string Hibrido = "hibrido";

    public static bool RequiresRoom(string? format) =>
        string.Equals(format, Presencial, StringComparison.OrdinalIgnoreCase)
        || string.Equals(format, Hibrido, StringComparison.OrdinalIgnoreCase);

    public static bool RequiresOnlineMeeting(string? format) =>
        string.Equals(format, Online, StringComparison.OrdinalIgnoreCase)
        || string.Equals(format, Hibrido, StringComparison.OrdinalIgnoreCase);

    public static string Normalize(string? format)
    {
        var normalized = (format ?? string.Empty).Trim().ToLowerInvariant();
        return normalized switch
        {
            Online => Online,
            Presencial => Presencial,
            Hibrido => Hibrido,
            _ => Online,
        };
    }

    public static string ResolveLocationDisplay(string? format, string? roomDisplayName, string? roomEmail)
    {
        var f = Normalize(format);
        if (f == Online)
            return "Online";

        var room = string.IsNullOrWhiteSpace(roomDisplayName) ? roomEmail?.Trim() : roomDisplayName.Trim();
        if (f == Hibrido)
            return string.IsNullOrWhiteSpace(room) ? "Teams + Sala" : $"{room} + Teams";

        return string.IsNullOrWhiteSpace(room) ? "Presencial" : room;
    }
}
