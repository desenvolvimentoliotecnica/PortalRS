namespace RhPortal.Api.Auditing.Context;

public interface IAuditContextAccessor
{
    AuditContext? Current { get; set; }
    bool SuppressAuditing { get; set; }
    int NextOrder();
    IDisposable BeginScope(AuditContext context);
    IDisposable BeginSuppress();
}
