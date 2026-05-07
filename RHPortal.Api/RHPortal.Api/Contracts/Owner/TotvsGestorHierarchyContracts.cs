namespace RhPortal.Api.Contracts.Owner;

public sealed class TotvsGestorHierarchySettingsView
{
    public string TenantId { get; set; } = default!;
    public string ConsultaUrlTemplate { get; set; } = string.Empty;
    public string HttpUser { get; set; } = string.Empty;
    public bool PasswordConfigured { get; set; }
    public int DefaultCodColigada { get; set; } = 1;
    public int DelayMsBetweenRequests { get; set; } = 250;
}

public sealed class TotvsGestorHierarchySettingsSaveRequest
{
    public string TenantId { get; set; } = default!;
    public string ConsultaUrlTemplate { get; set; } = string.Empty;
    public string HttpUser { get; set; } = string.Empty;
    /// <summary>Quando null ou vazio, mantém a senha já salva.</summary>
    public string? HttpPassword { get; set; }
    public int DefaultCodColigada { get; set; } = 1;
    public int DelayMsBetweenRequests { get; set; } = 250;
}

public sealed class TotvsGestorHierarchyRunStartResponse
{
    public Guid RunId { get; set; }
}

public enum TotvsGestorHierarchyRunUiStatus
{
    Running = 1,
    Completed = 2,
    Failed = 3,
    Cancelled = 4
}

public sealed class TotvsGestorHierarchyRunDto
{
    public Guid RunId { get; set; }
    public string TenantId { get; set; } = default!;
    public TotvsGestorHierarchyRunUiStatus Status { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTimeOffset StartedAtUtc { get; set; }
    public DateTimeOffset? EndedAtUtc { get; set; }
    public int ProgressCurrent { get; set; }
    public int ProgressTotal { get; set; }
    /// <summary>Tail das últimas linhas (ordem cronológica).</summary>
    public IReadOnlyList<string> LogLines { get; set; } = Array.Empty<string>();
}
