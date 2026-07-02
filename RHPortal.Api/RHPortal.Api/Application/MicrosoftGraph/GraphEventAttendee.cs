namespace RhPortal.Api.Application.MicrosoftGraph;

public sealed class GraphEventAttendee
{
    public string Email { get; init; } = "";
    public string Name { get; init; } = "";
    public string Type { get; init; } = "required";
}
