using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Contracts.Notifications;

namespace RhPortal.Api.Controllers;

[ApiController]
[Route("api/notifications")]
public sealed class NotificationsController : ControllerBase
{
    private static readonly NotificationItem[] SampleItems =
    [
        new NotificationItem(
            Guid.Parse("2c4f7a5e-4a1f-4a1d-8c3b-7c0e6f8f4b31"),
            "Novo candidato recebido",
            "Vaga: Analista de Dados (BI) - Origem: Email",
            "info",
            DateTimeOffset.UtcNow.AddMinutes(-8),
            "/Notificacoes",
            false),
        new NotificationItem(
            Guid.Parse("0c7c8a7e-2b2a-4b41-9d36-8e2a0b4cc1b2"),
            "Entrevista agendada",
            "Mariana Souza - 15/01/2026 14:00",
            "warning",
            DateTimeOffset.UtcNow.AddHours(-3),
            "/Notificacoes",
            false),
        new NotificationItem(
            Guid.Parse("4b8c2e63-2a2a-4e0f-9ad9-efb3a1b2e4a7"),
            "SLA de triagem proximo do limite",
            "Supervisor de Qualidade - 6 candidatos aguardando",
            "danger",
            DateTimeOffset.UtcNow.AddHours(-6),
            "/Notificacoes",
            false)
    ];

    [HttpGet]
    public ActionResult<NotificationsListResponse> List([FromQuery] int take = 20)
    {
        var items = SampleItems
            .Take(Math.Clamp(take, 1, 100))
            .ToArray();

        var unreadCount = items.Count(i => !i.IsRead);
        return Ok(new NotificationsListResponse(unreadCount, items));
    }
}
