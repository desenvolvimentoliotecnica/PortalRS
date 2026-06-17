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
    }
}
