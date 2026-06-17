using LiotecnicaHub.Web.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace LiotecnicaHub.Web.Infrastructure.Data;

public class HubDbContext : DbContext
{
    public HubDbContext(DbContextOptions<HubDbContext> options) : base(options) { }

    public DbSet<HubApplication> Applications => Set<HubApplication>();
    public DbSet<HubApplicationAccessRule> ApplicationAccessRules => Set<HubApplicationAccessRule>();
    public DbSet<HubEntraConfig> EntraConfigs => Set<HubEntraConfig>();
    public DbSet<HubAdmin> Admins => Set<HubAdmin>();

    public DbSet<HubUser> Users => Set<HubUser>();
    public DbSet<HubProfile> Profiles => Set<HubProfile>();
    public DbSet<HubSystem> Systems => Set<HubSystem>();
    public DbSet<HubSystemModule> SystemModules => Set<HubSystemModule>();
    public DbSet<HubPermission> Permissions => Set<HubPermission>();
    public DbSet<HubUserProfile> UserProfiles => Set<HubUserProfile>();
    public DbSet<HubProfilePermission> ProfilePermissions => Set<HubProfilePermission>();
    public DbSet<HubAccessScope> AccessScopes => Set<HubAccessScope>();
    public DbSet<HubUserProfileScope> UserProfileScopes => Set<HubUserProfileScope>();
    public DbSet<HubAccessAudit> AccessAudits => Set<HubAccessAudit>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<HubApplication>(e =>
        {
            e.ToTable("HubApplications");
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.Description).HasMaxLength(1000);
            e.Property(x => x.IconUrl).HasMaxLength(500);
            e.Property(x => x.LaunchUrl).HasMaxLength(2000).IsRequired();
            e.HasIndex(x => x.SortOrder);
            e.HasOne(x => x.System)
                .WithMany(x => x.Applications)
                .HasForeignKey(x => x.SystemId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<HubApplicationAccessRule>(e =>
        {
            e.ToTable("HubApplicationAccessRules");
            e.HasKey(x => x.Id);
            e.Property(x => x.Value).HasMaxLength(500);
            e.HasOne(x => x.Application)
                .WithMany(x => x.AccessRules)
                .HasForeignKey(x => x.HubApplicationId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<HubEntraConfig>(e =>
        {
            e.ToTable("HubEntraConfigs");
            e.HasKey(x => x.Id);
            e.Property(x => x.EntraTenantId).HasMaxLength(100);
            e.Property(x => x.ClientId).HasMaxLength(100);
            e.Property(x => x.ClientSecretProtected).HasMaxLength(4000);
            e.Property(x => x.CallbackPath).HasMaxLength(500);
            e.Property(x => x.HubBaseUrl).HasMaxLength(500);
        });

        modelBuilder.Entity<HubAdmin>(e =>
        {
            e.ToTable("HubAdmins");
            e.HasKey(x => x.Id);
            e.Property(x => x.Email).HasMaxLength(320).IsRequired();
            e.HasIndex(x => x.Email).IsUnique();
        });

        modelBuilder.Entity<HubUser>(e =>
        {
            e.ToTable("HubUsers");
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(150).IsRequired();
            e.Property(x => x.Email).HasMaxLength(200).IsRequired();
            e.HasIndex(x => x.Email).IsUnique();
        });

        modelBuilder.Entity<HubProfile>(e =>
        {
            e.ToTable("HubProfiles");
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(100).IsRequired();
            e.Property(x => x.Code).HasMaxLength(100).IsRequired();
            e.Property(x => x.Description).HasMaxLength(300);
            e.HasIndex(x => x.Code).IsUnique();
        });

        modelBuilder.Entity<HubSystem>(e =>
        {
            e.ToTable("HubSystems");
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(120).IsRequired();
            e.Property(x => x.Code).HasMaxLength(80).IsRequired();
            e.Property(x => x.Description).HasMaxLength(300);
            e.Property(x => x.Url).HasMaxLength(500);
            e.Property(x => x.IconKey).HasMaxLength(100);
            e.HasIndex(x => x.Code).IsUnique();
        });

        modelBuilder.Entity<HubSystemModule>(e =>
        {
            e.ToTable("HubSystemModules");
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(120).IsRequired();
            e.Property(x => x.Code).HasMaxLength(100).IsRequired();
            e.Property(x => x.Description).HasMaxLength(300);
            e.HasIndex(x => new { x.SystemId, x.Code }).IsUnique();
            e.HasOne(x => x.System)
                .WithMany(x => x.Modules)
                .HasForeignKey(x => x.SystemId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<HubPermission>(e =>
        {
            e.ToTable("HubPermissions");
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(150).IsRequired();
            e.Property(x => x.Code).HasMaxLength(180).IsRequired();
            e.Property(x => x.Description).HasMaxLength(300);
            e.HasIndex(x => x.Code).IsUnique();
            e.HasOne(x => x.System)
                .WithMany(x => x.Permissions)
                .HasForeignKey(x => x.SystemId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Module)
                .WithMany(x => x.Permissions)
                .HasForeignKey(x => x.ModuleId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<HubUserProfile>(e =>
        {
            e.ToTable("HubUserProfiles");
            e.HasKey(x => new { x.UserId, x.ProfileId });
            e.HasOne(x => x.User)
                .WithMany(x => x.UserProfiles)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Profile)
                .WithMany(x => x.UserProfiles)
                .HasForeignKey(x => x.ProfileId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<HubProfilePermission>(e =>
        {
            e.ToTable("HubProfilePermissions");
            e.HasKey(x => new { x.ProfileId, x.PermissionId });
            e.HasOne(x => x.Profile)
                .WithMany(x => x.ProfilePermissions)
                .HasForeignKey(x => x.ProfileId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Permission)
                .WithMany(x => x.ProfilePermissions)
                .HasForeignKey(x => x.PermissionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<HubAccessScope>(e =>
        {
            e.ToTable("HubAccessScopes");
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(150).IsRequired();
            e.Property(x => x.ExternalCode).HasMaxLength(100);
            e.HasIndex(x => new { x.ScopeType, x.ExternalCode });
        });

        modelBuilder.Entity<HubUserProfileScope>(e =>
        {
            e.ToTable("HubUserProfileScopes");
            e.HasKey(x => x.Id);
            e.HasOne(x => x.User)
                .WithMany(x => x.UserProfileScopes)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Profile)
                .WithMany(x => x.UserProfileScopes)
                .HasForeignKey(x => x.ProfileId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Scope)
                .WithMany(x => x.UserProfileScopes)
                .HasForeignKey(x => x.ScopeId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<HubAccessAudit>(e =>
        {
            e.ToTable("HubAccessAudits");
            e.HasKey(x => x.Id);
            e.Property(x => x.Action).HasMaxLength(100).IsRequired();
            e.Property(x => x.Justification).HasMaxLength(500);
            e.HasIndex(x => x.OccurredAtUtc);
        });
    }
}
