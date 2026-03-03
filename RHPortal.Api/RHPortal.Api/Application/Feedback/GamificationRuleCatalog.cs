namespace RhPortal.Api.Application.Feedback;

public static class GamificationEventTypes
{
    public const string DailyLogin = "daily_login";
    public const string FeedbackSent = "feedback_sent";
    public const string FeedbackReceived = "feedback_received";
    public const string CelebrationPost = "celebration_post";
    public const string CelebrationMentioned = "celebration_mentioned";
    public const string CelebrationComment = "celebration_comment";
    public const string SurveyAnswered = "survey_answered";
    public const string OneOnOneCompleted = "one_on_one_completed";
    public const string DevelopmentPlanCreated = "development_plan_created";
}

public sealed record GamificationRule(
    string EventType,
    string Label,
    decimal Points,
    int? DailyCap = null,
    bool IdempotentBySource = true);

public static class GamificationRuleCatalog
{
    private static readonly IReadOnlyDictionary<string, GamificationRule> Rules =
        new Dictionary<string, GamificationRule>(StringComparer.OrdinalIgnoreCase)
        {
            [GamificationEventTypes.DailyLogin] = new(GamificationEventTypes.DailyLogin, "Login diário", 25m, DailyCap: 1),
            [GamificationEventTypes.FeedbackSent] = new(GamificationEventTypes.FeedbackSent, "Enviar feedback", 10m, DailyCap: 20),
            [GamificationEventTypes.FeedbackReceived] = new(GamificationEventTypes.FeedbackReceived, "Receber feedback", 5m, DailyCap: 20),
            [GamificationEventTypes.CelebrationPost] = new(GamificationEventTypes.CelebrationPost, "Publicar celebração", 8m, DailyCap: 10),
            [GamificationEventTypes.CelebrationMentioned] = new(GamificationEventTypes.CelebrationMentioned, "Ser mencionado em celebração", 3m, DailyCap: 20),
            [GamificationEventTypes.CelebrationComment] = new(GamificationEventTypes.CelebrationComment, "Comentar em celebração", 2m, DailyCap: 25),
            [GamificationEventTypes.SurveyAnswered] = new(GamificationEventTypes.SurveyAnswered, "Responder pesquisa", 500m, DailyCap: 3),
            [GamificationEventTypes.OneOnOneCompleted] = new(GamificationEventTypes.OneOnOneCompleted, "Realizar reunião 1:1", 10m, DailyCap: 8),
            [GamificationEventTypes.DevelopmentPlanCreated] = new(GamificationEventTypes.DevelopmentPlanCreated, "Criar plano de desenvolvimento", 15m, DailyCap: 4),
        };

    public static IReadOnlyCollection<GamificationRule> GetAll() => Rules.Values.OrderBy(x => x.Label).ToArray();

    public static bool TryGet(string eventType, out GamificationRule rule) => Rules.TryGetValue(eventType, out rule!);
}
