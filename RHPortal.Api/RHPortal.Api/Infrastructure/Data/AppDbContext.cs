using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Auditing.Entities;
using RhPortal.Api.Infrastructure.Tenancy;
using RHPortal.Api.Domain.Entities;

namespace RhPortal.Api.Infrastructure.Data;

public sealed class AppDbContext : IdentityDbContext<ApplicationUser, ApplicationRole, Guid, IdentityUserClaim<Guid>, ApplicationUserRole, IdentityUserLogin<Guid>, IdentityRoleClaim<Guid>, IdentityUserToken<Guid>>
{
    private readonly ITenantContext _tenantContext;

    public AppDbContext(DbContextOptions<AppDbContext> options, ITenantContext tenantContext)
        : base(options)
    {
        _tenantContext = tenantContext;
    }

    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<AuditTransaction> AuditTransactions => Set<AuditTransaction>();
    public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();
    public DbSet<AuditEntityChange> AuditEntityChanges => Set<AuditEntityChange>();
    public DbSet<AuditEntityPropertyChange> AuditEntityPropertyChanges => Set<AuditEntityPropertyChange>();
    public DbSet<Menu> Menus => Set<Menu>();
    public DbSet<RoleMenu> RoleMenus => Set<RoleMenu>();

    public DbSet<Department> Departments => Set<Department>();
    public DbSet<Area> Areas => Set<Area>();
    public DbSet<RequisitoCategoria> RequisitoCategorias => Set<RequisitoCategoria>();
    public DbSet<CostCenter> CostCenters => Set<CostCenter>();
    public DbSet<Unit> Units => Set<Unit>();
    public DbSet<JobPosition> JobPositions => Set<JobPosition>();
    public DbSet<Manager> Managers => Set<Manager>();
    public DbSet<Vaga> Vagas => Set<Vaga>();
    public DbSet<VagaBeneficio> VagaBeneficios => Set<VagaBeneficio>();
    public DbSet<VagaRequisito> VagaRequisitos => Set<VagaRequisito>();
    public DbSet<VagaEtapa> VagaEtapas => Set<VagaEtapa>();
    public DbSet<VagaPergunta> VagaPerguntas => Set<VagaPergunta>();
    public DbSet<Candidato> Candidatos => Set<Candidato>();
    public DbSet<CandidatoDocumento> CandidatoDocumentos => Set<CandidatoDocumento>();
    public DbSet<InboxItem> InboxItems => Set<InboxItem>();
    public DbSet<InboxAnexo> InboxAttachments => Set<InboxAnexo>();
    public DbSet<AgendaEventType> AgendaEventTypes => Set<AgendaEventType>();
    public DbSet<AgendaEvent> AgendaEvents => Set<AgendaEvent>();



    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Tenant>(b =>
        {
            b.ToTable("Tenants");
            b.HasKey(x => x.TenantId);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Name).HasMaxLength(120).IsRequired();
            b.Property(x => x.IsActive).IsRequired();
        });

        modelBuilder.Entity<ApplicationUser>(b =>
        {
            b.ToTable("Users");

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.FullName).HasMaxLength(200).IsRequired();
            b.Property(x => x.IsActive).IsRequired();

            b.HasIndex(x => x.NormalizedUserName)
                .HasDatabaseName("UserNameIndex")
                .IsUnique(false);

            b.HasIndex(x => x.NormalizedEmail)
                .HasDatabaseName("EmailIndex")
                .IsUnique(false);

            b.HasIndex(x => new { x.TenantId, x.NormalizedUserName }).IsUnique();
            b.HasIndex(x => new { x.TenantId, x.NormalizedEmail }).IsUnique(false);

            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<ApplicationRole>(b =>
        {
            b.ToTable("Roles");

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Description).HasMaxLength(400);
            b.Property(x => x.IsActive).IsRequired();

            b.HasIndex(x => x.NormalizedName)
                .HasDatabaseName("RoleNameIndex")
                .IsUnique(false);

            b.HasIndex(x => new { x.TenantId, x.NormalizedName }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<ApplicationUserRole>(b =>
        {
            b.ToTable("UserRoles");
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();

            b.HasIndex(x => new { x.TenantId, x.UserId });
            b.HasIndex(x => new { x.TenantId, x.RoleId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<Menu>(b =>
        {
            b.ToTable("Menus");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.DisplayName).HasMaxLength(160).IsRequired();
            b.Property(x => x.Route).HasMaxLength(240).IsRequired();
            b.Property(x => x.Icon).HasMaxLength(120);
            b.Property(x => x.PermissionKey).HasMaxLength(160).IsRequired();
            b.Property(x => x.IsActive).IsRequired();

            b.HasIndex(x => new { x.TenantId, x.PermissionKey }).IsUnique();
            b.HasIndex(x => new { x.TenantId, x.Route });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<RoleMenu>(b =>
        {
            b.ToTable("RoleMenus");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.PermissionKey).HasMaxLength(160).IsRequired();

            b.HasOne(x => x.Role)
                .WithMany()
                .HasForeignKey(x => x.RoleId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(x => x.Menu)
                .WithMany()
                .HasForeignKey(x => x.MenuId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(x => new { x.TenantId, x.RoleId, x.MenuId, x.PermissionKey }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<Area>(b =>
        {
            b.ToTable("Areas");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Code).HasMaxLength(40).IsRequired();
            b.Property(x => x.Name).HasMaxLength(120).IsRequired();
            b.Property(x => x.Description).HasMaxLength(1000);

            b.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<RequisitoCategoria>(b =>
        {
            b.ToTable("RequisitoCategorias");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Code).HasMaxLength(40).IsRequired();
            b.Property(x => x.Name).HasMaxLength(120).IsRequired();
            b.Property(x => x.Description).HasMaxLength(1000);

            b.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<CostCenter>(b =>
        {
            b.ToTable("CostCenters");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Code).HasMaxLength(40).IsRequired();
            b.Property(x => x.Name).HasMaxLength(160).IsRequired();
            b.Property(x => x.Description).HasMaxLength(1000);
            b.Property(x => x.GroupName).HasMaxLength(120);
            b.Property(x => x.UnitName).HasMaxLength(160);

            b.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<Department>(b =>
        {
            b.ToTable("Departments");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Code).HasMaxLength(40).IsRequired();
            b.Property(x => x.Name).HasMaxLength(120).IsRequired();

            b.Property(x => x.ManagerName).HasMaxLength(120);
            b.Property(x => x.ManagerEmail).HasMaxLength(180);
            b.Property(x => x.Phone).HasMaxLength(40);
            b.Property(x => x.CostCenter).HasMaxLength(60);
            b.Property(x => x.BranchOrLocation).HasMaxLength(80);
            b.Property(x => x.Description).HasMaxLength(1000);

            b.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);

            b.HasOne(x => x.Area)
             .WithMany()
             .HasForeignKey(x => x.AreaId)
             .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Unit>(b =>
        {
            b.ToTable("Units");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();

            b.Property(x => x.Code).HasMaxLength(40).IsRequired();
            b.Property(x => x.Name).HasMaxLength(140).IsRequired();

            b.Property(x => x.City).HasMaxLength(120);
            b.Property(x => x.Uf).HasMaxLength(2);

            b.Property(x => x.AddressLine).HasMaxLength(220);
            b.Property(x => x.Neighborhood).HasMaxLength(120);
            b.Property(x => x.ZipCode).HasMaxLength(12);

            b.Property(x => x.Email).HasMaxLength(180);
            b.Property(x => x.Phone).HasMaxLength(40);

            b.Property(x => x.ResponsibleName).HasMaxLength(140);
            b.Property(x => x.Type).HasMaxLength(120);

            b.Property(x => x.Notes).HasMaxLength(1000);

            b.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<JobPosition > (b =>
        {
            b.ToTable("JobPositions");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();

            b.Property(x => x.Code).HasMaxLength(40).IsRequired();
            b.Property(x => x.Name).HasMaxLength(160).IsRequired();

            b.Property(x => x.Type).HasMaxLength(180);
            b.Property(x => x.Description).HasMaxLength(1000);

            b.HasOne(x => x.Area)
                .WithMany()
                .HasForeignKey(x => x.AreaId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();

            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<Manager>(b =>
        {
            b.ToTable("Managers");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();

            b.Property(x => x.Name).HasMaxLength(160).IsRequired();
            b.Property(x => x.Email).HasMaxLength(180).IsRequired();
            b.Property(x => x.Phone).HasMaxLength(40);
            b.Property(x => x.Notes).HasMaxLength(1000);
            b.Property(x => x.Headcount);

            b.HasOne(x => x.Unit)
                .WithMany()
                .HasForeignKey(x => x.UnitId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(x => x.Area)
                .WithMany()
                .HasForeignKey(x => x.AreaId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(x => x.JobPosition)
                .WithMany()
                .HasForeignKey(x => x.JobPositionId)
                .OnDelete(DeleteBehavior.Restrict);

            // Evitar duplicar gestor por email no tenant
            b.HasIndex(x => new { x.TenantId, x.Email }).IsUnique();

            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        // VAGAS
        modelBuilder.Entity<Vaga>(b =>
        {
            b.ToTable("Vagas");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();

            b.Property(x => x.Codigo).HasMaxLength(40);
            b.Property(x => x.Titulo).HasMaxLength(160).IsRequired();

            b.Property(x => x.CodigoInterno).HasMaxLength(40);
            b.Property(x => x.CodigoCbo).HasMaxLength(20);

            b.Property(x => x.GestorRequisitante).HasMaxLength(120);
            b.Property(x => x.RecrutadorResponsavel).HasMaxLength(120);
            b.Property(x => x.PublicoAfirmativo).HasMaxLength(120);

            b.Property(x => x.ProjetoNome).HasMaxLength(160);
            b.Property(x => x.ProjetoClienteAreaImpactada).HasMaxLength(160);
            b.Property(x => x.ProjetoPrazoPrevisto).HasMaxLength(80);

            b.Property(x => x.Cep).HasMaxLength(12);
            b.Property(x => x.Logradouro).HasMaxLength(160);
            b.Property(x => x.Numero).HasMaxLength(20);
            b.Property(x => x.Bairro).HasMaxLength(120);
            b.Property(x => x.Cidade).HasMaxLength(120);
            b.Property(x => x.Uf).HasMaxLength(2);

            b.Property(x => x.PoliticaTrabalho).HasMaxLength(200);
            b.Property(x => x.ObservacoesDeslocamento).HasMaxLength(200);
            b.Property(x => x.ObservacoesRemuneracao).HasMaxLength(240);

            // Decimais
            b.Property(x => x.SalarioMinimo).HasPrecision(18, 2);
            b.Property(x => x.SalarioMaximo).HasPrecision(18, 2);

            // ✅ AREA (FK + Navegação)
            // Se você quer obrigar AreaId, deixe IsRequired()
            b.Property(x => x.AreaId).IsRequired();

            b.Property(x => x.DepartmentId).IsRequired();

            b.HasOne(x => x.Area)
                .WithMany() // ou .WithMany(a => a.Vagas) se você tiver coleção em Area
                .HasForeignKey(x => x.AreaId)
                .OnDelete(DeleteBehavior.Restrict); // ou NoAction se preferir

            b.HasOne(x => x.Department)
                 .WithMany()
                 .HasForeignKey(x => x.DepartmentId)
                 .OnDelete(DeleteBehavior.Restrict);

            // Relacionamentos (listas do modal)
            b.HasMany(x => x.Beneficios)
                .WithOne(x => x.Vaga)
                .HasForeignKey(x => x.VagaId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasMany(x => x.Requisitos)
                .WithOne(x => x.Vaga)
                .HasForeignKey(x => x.VagaId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasMany(x => x.Etapas)
                .WithOne(x => x.Vaga)
                .HasForeignKey(x => x.VagaId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasMany(x => x.PerguntasTriagem)
                .WithOne(x => x.Vaga)
                .HasForeignKey(x => x.VagaId)
                .OnDelete(DeleteBehavior.Cascade);

            // Índices úteis
            b.HasIndex(x => new { x.TenantId, x.Status });
            b.HasIndex(x => new { x.TenantId, x.DepartmentId });

            // ✅ antes era x.Area (enum) -> agora é AreaId (Guid)
            b.HasIndex(x => new { x.TenantId, x.AreaId });

            // Multi-tenant
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<VagaBeneficio>(b =>
        {
            b.ToTable("VagaBeneficios");
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.HasIndex(x => new { x.TenantId, x.VagaId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<VagaRequisito>(b =>
        {
            b.ToTable("VagaRequisitos");
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.HasIndex(x => new { x.TenantId, x.VagaId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<VagaEtapa>(b =>
        {
            b.ToTable("VagaEtapas");
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.HasIndex(x => new { x.TenantId, x.VagaId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<VagaPergunta>(b =>
        {
            b.ToTable("VagaPerguntas");
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.HasIndex(x => new { x.TenantId, x.VagaId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<Candidato>(b =>
        {
            b.ToTable("Candidatos");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Nome).HasMaxLength(160).IsRequired();
            b.Property(x => x.Email).HasMaxLength(180).IsRequired();
            b.Property(x => x.Fone).HasMaxLength(40);
            b.Property(x => x.Cidade).HasMaxLength(120);
            b.Property(x => x.Uf).HasMaxLength(2);
            b.Property(x => x.Obs).HasMaxLength(2000);

            b.HasIndex(x => new { x.TenantId, x.Email });
            b.HasIndex(x => new { x.TenantId, x.VagaId });

            b.HasOne(x => x.Vaga)
                .WithMany()
                .HasForeignKey(x => x.VagaId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasMany(x => x.Documentos)
                .WithOne(x => x.Candidato)
                .HasForeignKey(x => x.CandidatoId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<CandidatoDocumento>(b =>
        {
            b.ToTable("CandidatoDocumentos");
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.NomeArquivo).HasMaxLength(200).IsRequired();
            b.Property(x => x.ContentType).HasMaxLength(120);
            b.Property(x => x.Descricao).HasMaxLength(240);
            b.Property(x => x.StorageFileName).HasMaxLength(260);
            b.Property(x => x.Url).HasMaxLength(400);

            b.HasIndex(x => new { x.TenantId, x.CandidatoId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<InboxItem>(b =>
        {
            b.ToTable("InboxItems");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Remetente).HasMaxLength(180);
            b.Property(x => x.Assunto).HasMaxLength(220);
            b.Property(x => x.Destinatario).HasMaxLength(200);
            b.Property(x => x.ProcessamentoEtapa).HasMaxLength(120);
            b.Property(x => x.ProcessamentoUltimoErro).HasMaxLength(400);

            b.HasIndex(x => new { x.TenantId, x.Origem });
            b.HasIndex(x => new { x.TenantId, x.Status });
            b.HasIndex(x => new { x.TenantId, x.RecebidoEm });

            b.HasOne(x => x.Vaga)
                .WithMany()
                .HasForeignKey(x => x.VagaId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasMany(x => x.Anexos)
                .WithOne(x => x.InboxItem)
                .HasForeignKey(x => x.InboxItemId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<InboxAnexo>(b =>
        {
            b.ToTable("InboxAttachments");
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Nome).HasMaxLength(200).IsRequired();
            b.Property(x => x.Tipo).HasMaxLength(20);
            b.Property(x => x.Hash).HasMaxLength(120);

            b.HasIndex(x => new { x.TenantId, x.InboxItemId });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<AgendaEventType>(b =>
        {
            b.ToTable("AgendaEventTypes");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Code).HasMaxLength(40).IsRequired();
            b.Property(x => x.Label).HasMaxLength(120).IsRequired();
            b.Property(x => x.Color).HasMaxLength(20).IsRequired();
            b.Property(x => x.Icon).HasMaxLength(80).IsRequired();
            b.Property(x => x.IsActive).IsRequired();

            b.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<AgendaEvent>(b =>
        {
            b.ToTable("AgendaEvents");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Title).HasMaxLength(240).IsRequired();
            b.Property(x => x.Status).HasMaxLength(40).IsRequired();
            b.Property(x => x.Location).HasMaxLength(160);
            b.Property(x => x.Owner).HasMaxLength(120);
            b.Property(x => x.Candidate).HasMaxLength(160);
            b.Property(x => x.VagaTitle).HasMaxLength(200);
            b.Property(x => x.VagaCode).HasMaxLength(40);
            b.Property(x => x.Notes).HasMaxLength(2000);

            b.HasOne(x => x.Type)
                .WithMany()
                .HasForeignKey(x => x.TypeId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasIndex(x => new { x.TenantId, x.StartAtUtc });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<AuditTransaction>(b =>
        {
            b.ToTable("AuditTransactions");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.TransactionId).HasMaxLength(120).IsRequired();
            b.Property(x => x.CorrelationId).HasMaxLength(200);
            b.Property(x => x.TraceId).HasMaxLength(200);
            b.Property(x => x.SpanId).HasMaxLength(200);
            b.Property(x => x.ParentSpanId).HasMaxLength(200);
            b.Property(x => x.Environment).HasMaxLength(40);
            b.Property(x => x.AppVersion).HasMaxLength(40);
            b.Property(x => x.Method).HasMaxLength(16).IsRequired();
            b.Property(x => x.Path).HasMaxLength(512).IsRequired();
            b.Property(x => x.QueryString).HasMaxLength(1024);
            b.Property(x => x.RouteTemplate).HasMaxLength(512);
            b.Property(x => x.Controller).HasMaxLength(120);
            b.Property(x => x.Action).HasMaxLength(120);
            b.Property(x => x.UserId).HasMaxLength(120);
            b.Property(x => x.UserName).HasMaxLength(200);
            b.Property(x => x.ClientId).HasMaxLength(120);
            b.Property(x => x.Ip).HasMaxLength(80);
            b.Property(x => x.UserAgent).HasMaxLength(400);
            b.Property(x => x.Host).HasMaxLength(200);
            b.Property(x => x.RequestBodyHash).HasMaxLength(64);
            b.Property(x => x.ResponseBodyHash).HasMaxLength(64);

            b.HasIndex(x => x.TransactionId).IsUnique();
            b.HasIndex(x => x.StartedAt);
            b.HasIndex(x => new { x.TenantId, x.StartedAt });
            b.HasIndex(x => x.UserId);
            b.HasIndex(x => x.Path);
            b.HasIndex(x => x.StatusCode);
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<AuditEvent>(b =>
        {
            b.ToTable("AuditEvents");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.EventType).HasMaxLength(40).IsRequired();
            b.Property(x => x.Name).HasMaxLength(200).IsRequired();
            b.Property(x => x.DataJson).HasColumnType("jsonb");

            b.HasOne(x => x.Transaction)
                .WithMany(t => t.Events)
                .HasForeignKey(x => x.AuditTransactionId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(x => new { x.AuditTransactionId, x.Order });
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<AuditEntityChange>(b =>
        {
            b.ToTable("AuditEntityChanges");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.EntityName).HasMaxLength(200).IsRequired();
            b.Property(x => x.TableName).HasMaxLength(200);
            b.Property(x => x.State).HasMaxLength(20).IsRequired();
            b.Property(x => x.PrimaryKeyJson).HasColumnType("jsonb").IsRequired();
            b.Property(x => x.BeforeJson).HasColumnType("jsonb");
            b.Property(x => x.AfterJson).HasColumnType("jsonb");
            b.Property(x => x.ChangedColumns).HasMaxLength(500);
            b.Property(x => x.DataJson).HasColumnType("jsonb");

            b.HasOne(x => x.Transaction)
                .WithMany()
                .HasForeignKey(x => x.AuditTransactionId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(x => x.Event)
                .WithMany(e => e.EntityChanges)
                .HasForeignKey(x => x.AuditEventId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasIndex(x => new { x.TenantId, x.EntityName });
            b.HasIndex(x => new { x.TenantId, x.OccurredAt });
            b.HasIndex(x => x.AuditTransactionId);
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });

        modelBuilder.Entity<AuditEntityPropertyChange>(b =>
        {
            b.ToTable("AuditEntityPropertyChanges");
            b.HasKey(x => x.Id);
            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.PropertyName).HasMaxLength(200).IsRequired();
            b.Property(x => x.BeforeValue).HasMaxLength(2000);
            b.Property(x => x.AfterValue).HasMaxLength(2000);

            b.HasOne(x => x.EntityChange)
                .WithMany(c => c.PropertyChanges)
                .HasForeignKey(x => x.AuditEntityChangeId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(x => x.AuditEntityChangeId);
            b.HasQueryFilter(x => x.TenantId == _tenantContext.TenantId);
        });


    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTimeOffset.UtcNow;

        foreach (var entry in ChangeTracker.Entries())
        {
            if (entry.Entity is ITenantEntity tenantEntity)
            {
                if (entry.State == EntityState.Added)
                    tenantEntity.TenantId = _tenantContext.TenantId;
            }

            if (entry.Entity is Tenant tenant)
            {
                if (entry.State == EntityState.Added)
                {
                    tenant.CreatedAtUtc = now;
                    tenant.UpdatedAtUtc = now;
                }

                if (entry.State == EntityState.Modified)
                    tenant.UpdatedAtUtc = now;
            }

            if (entry.Entity is ApplicationUser user)
            {
                if (entry.State == EntityState.Added)
                    user.CreatedAtUtc = now;

                if (entry.State is EntityState.Added or EntityState.Modified)
                    user.UpdatedAtUtc = now;
            }

            if (entry.Entity is ApplicationRole role)
            {
                if (entry.State == EntityState.Added)
                    role.CreatedAtUtc = now;

                if (entry.State is EntityState.Added or EntityState.Modified)
                    role.UpdatedAtUtc = now;
            }

            if (entry.Entity is Menu menu)
            {
                if (entry.State == EntityState.Added)
                    menu.CreatedAtUtc = now;

                if (entry.State is EntityState.Added or EntityState.Modified)
                    menu.UpdatedAtUtc = now;
            }

            if (entry.Entity is RoleMenu roleMenu)
            {
                if (entry.State == EntityState.Added)
                    roleMenu.CreatedAtUtc = now;
            }

            if (entry.Entity is Department dep)
            {
                if (entry.State == EntityState.Added)
                    dep.CreatedAtUtc = now;

                if (entry.State is EntityState.Added or EntityState.Modified)
                    dep.UpdatedAtUtc = now;
            }

            if (entry.Entity is CostCenter cc)
            {
                if (entry.State == EntityState.Added)
                    cc.CreatedAtUtc = now;

                if (entry.State is EntityState.Added or EntityState.Modified)
                    cc.UpdatedAtUtc = now;
            }

            if (entry.Entity is Unit unit)
            {
                if (entry.State == EntityState.Added)
                    unit.CreatedAtUtc = now;

                if (entry.State is EntityState.Added or EntityState.Modified)
                    unit.UpdatedAtUtc = now;
            }

            if (entry.Entity is JobPosition jp)
            {
                if (entry.State == EntityState.Added)
                    jp.CreatedAtUtc = now;

                if (entry.State is EntityState.Added or EntityState.Modified)
                    jp.UpdatedAtUtc = now;
            }

            if (entry.Entity is Manager m)
            {
                if (entry.State == EntityState.Added)
                    m.CreatedAtUtc = now;

                if (entry.State is EntityState.Added or EntityState.Modified)
                    m.UpdatedAtUtc = now;
            }

            if (entry.Entity is Vaga v)
            {
                if (entry.State == EntityState.Added) v.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) v.UpdatedAtUtc = now;
            }

            if (entry.Entity is VagaBeneficio vb)
            {
                if (entry.State == EntityState.Added) vb.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) vb.UpdatedAtUtc = now;
            }

            if (entry.Entity is VagaRequisito vr)
            {
                if (entry.State == EntityState.Added) vr.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) vr.UpdatedAtUtc = now;
            }

            if (entry.Entity is VagaEtapa ve)
            {
                if (entry.State == EntityState.Added) ve.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) ve.UpdatedAtUtc = now;
            }

            if (entry.Entity is VagaPergunta vp)
            {
                if (entry.State == EntityState.Added) vp.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) vp.UpdatedAtUtc = now;
            }

            if (entry.Entity is Candidato c)
            {
                if (entry.State == EntityState.Added) c.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) c.UpdatedAtUtc = now;
            }

            if (entry.Entity is CandidatoDocumento cd)
            {
                if (entry.State == EntityState.Added) cd.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) cd.UpdatedAtUtc = now;
            }

            if (entry.Entity is InboxItem inbox)
            {
                if (entry.State == EntityState.Added) inbox.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) inbox.UpdatedAtUtc = now;
            }

            if (entry.Entity is InboxAnexo inboxAnexo)
            {
                if (entry.State == EntityState.Added) inboxAnexo.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) inboxAnexo.UpdatedAtUtc = now;
            }

            if (entry.Entity is AgendaEventType agendaType)
            {
                if (entry.State == EntityState.Added) agendaType.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) agendaType.UpdatedAtUtc = now;
            }

            if (entry.Entity is AgendaEvent agendaEvent)
            {
                if (entry.State == EntityState.Added) agendaEvent.CreatedAtUtc = now;
                if (entry.State is EntityState.Added or EntityState.Modified) agendaEvent.UpdatedAtUtc = now;
            }
        }
        return await base.SaveChangesAsync(cancellationToken);
    }
}
