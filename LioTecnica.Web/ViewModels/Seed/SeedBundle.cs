namespace LioTecnica.Web.ViewModels.Seed;

public sealed record SeedBundle
{
    public IReadOnlyList<VagaSeed> Vagas { get; init; } = Array.Empty<VagaSeed>();
    public string? SelectedVagaId { get; init; }

    public IReadOnlyList<CandidatoSeed> Candidatos { get; init; } = Array.Empty<CandidatoSeed>();
    public string? SelectedCandidatoId { get; init; }

    public IReadOnlyList<InboxSeed> Inbox { get; init; } = Array.Empty<InboxSeed>();
    public string? SelectedInboxId { get; init; }

    public IReadOnlyList<RoleSeed> Roles { get; init; } = Array.Empty<RoleSeed>();
    public IReadOnlyList<UserSeed> Users { get; init; } = Array.Empty<UserSeed>();

    public IReadOnlyList<DashboardRowSeed> DashboardRows { get; init; } = Array.Empty<DashboardRowSeed>();
    public IReadOnlyList<int> DashboardSeries { get; init; } = Array.Empty<int>();

    public IReadOnlyList<ReportSeed> Reports { get; init; } = Array.Empty<ReportSeed>();

    public IReadOnlyList<DepartamentoSeed> Departamentos { get; init; } = Array.Empty<DepartamentoSeed>();

    public IReadOnlyList<GestorSeed> Gestores { get; init; } = Array.Empty<GestorSeed>();

    public IReadOnlyList<AreaSeed> Areas { get; init; } = Array.Empty<AreaSeed>();

    public IReadOnlyList<RequisitoCategoriaSeed> RequisitoCategorias { get; init; } = Array.Empty<RequisitoCategoriaSeed>();

    public IReadOnlyList<UnidadeSeed> Unidades { get; init; } = Array.Empty<UnidadeSeed>();

    public IReadOnlyList<CargoSeed> Cargos { get; init; } = Array.Empty<CargoSeed>();
}
