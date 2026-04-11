using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Domain.Entities;

namespace RhPortal.Api.Infrastructure.Data;

public sealed class MasterDbContext : DbContext
{
    public MasterDbContext(DbContextOptions<MasterDbContext> options)
        : base(options)
    {
    }

    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<Owner> Owners => Set<Owner>();
    public DbSet<AiProviderKey> AiProviderKeys => Set<AiProviderKey>();
    public DbSet<AiModel> AiModels => Set<AiModel>();
    public DbSet<AiUsageRecord> AiUsageRecords => Set<AiUsageRecord>();
    public DbSet<OwnerAwsSettings> OwnerAwsSettings => Set<OwnerAwsSettings>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Tenant>(b =>
        {
            b.ToTable("Tenants");
            b.HasKey(x => x.TenantId);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.Name).HasMaxLength(120).IsRequired();
            b.Property(x => x.IsActive).IsRequired();
            b.Property(x => x.CreatedAtUtc).IsRequired();
            b.Property(x => x.UpdatedAtUtc).IsRequired();
            b.Property(x => x.CreatedByOwnerId);

            b.HasOne(x => x.CreatedByOwner)
                .WithMany()
                .HasForeignKey(x => x.CreatedByOwnerId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Owner>(b =>
        {
            b.ToTable("Owners");
            b.HasKey(x => x.Id);

            b.Property(x => x.Email).HasMaxLength(256).IsRequired();
            b.Property(x => x.PasswordHash).HasMaxLength(500).IsRequired();
            b.Property(x => x.IsActive).IsRequired();
            b.HasIndex(x => x.Email).IsUnique();
        });

        modelBuilder.Entity<AiProviderKey>(b =>
        {
            b.ToTable("AiProviderKeys");
            b.HasKey(x => x.Id);

            b.Property(x => x.Provider).HasMaxLength(64).IsRequired();
            b.Property(x => x.Name).HasMaxLength(120).IsRequired();
            b.Property(x => x.EncryptedKey).HasMaxLength(500).IsRequired();
            b.Property(x => x.IsActive).IsRequired();
            b.Property(x => x.IsDefault).IsRequired();
            b.Property(x => x.CreatedAtUtc).IsRequired();
            b.Property(x => x.UpdatedAtUtc).IsRequired();
        });

        modelBuilder.Entity<AiModel>(b =>
        {
            b.ToTable("AiModels");
            b.HasKey(x => x.Id);

            b.Property(x => x.ModelId).HasMaxLength(120).IsRequired();
            b.Property(x => x.DisplayName).HasMaxLength(160).IsRequired();
            b.Property(x => x.IsDefault).IsRequired();

            b.HasOne(x => x.AiProviderKey)
                .WithMany()
                .HasForeignKey(x => x.AiProviderKeyId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasIndex(x => x.AiProviderKeyId);
        });

        modelBuilder.Entity<AiUsageRecord>(b =>
        {
            b.ToTable("AiUsageRecords");
            b.HasKey(x => x.Id);

            b.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            b.Property(x => x.UserName).HasMaxLength(200);
            b.Property(x => x.Module).HasMaxLength(120).IsRequired();
            b.Property(x => x.Cost).HasPrecision(18, 6).IsRequired();
            b.Property(x => x.ActionDescription).HasMaxLength(500);
            b.Property(x => x.RequestMessage).HasMaxLength(8000);
            b.Property(x => x.CreatedAtUtc).IsRequired();

            b.HasOne(x => x.AiModel)
                .WithMany()
                .HasForeignKey(x => x.AiModelId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasIndex(x => x.TenantId);
            b.HasIndex(x => x.UserId);
            b.HasIndex(x => x.CreatedAtUtc);
            b.HasIndex(x => x.Module);
        });

        modelBuilder.Entity<OwnerAwsSettings>(b =>
        {
            b.ToTable("OwnerAwsSettings");
            b.HasKey(x => x.Id);
            b.Property(x => x.Region).HasMaxLength(50);
            b.Property(x => x.BucketName).HasMaxLength(200);
        });
    }
}
