using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.Colaborador;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.Colaborador;

public interface IColaboradorService
{
    Task<ColaboradorPerfilResponse?> GetPerfilAsync(Guid funcionarioId, CancellationToken ct);
    Task<ColaboradorPerfilResponse?> UpdatePerfilAsync(Guid funcionarioId, ColaboradorPerfilUpdateRequest request, CancellationToken ct);

    Task<IReadOnlyList<DependenteResponse>> ListDependentesAsync(Guid funcionarioId, CancellationToken ct);
    Task<DependenteResponse> CreateDependenteAsync(Guid funcionarioId, DependenteCreateRequest request, CancellationToken ct);
    Task<DependenteResponse?> UpdateDependenteAsync(Guid funcionarioId, Guid dependenteId, DependenteUpdateRequest request, CancellationToken ct);
    Task<bool> DeleteDependenteAsync(Guid funcionarioId, Guid dependenteId, CancellationToken ct);

    Task<IReadOnlyList<DocumentoResponse>> ListDocumentosAsync(Guid funcionarioId, CancellationToken ct);
    Task<DocumentoResponse> UploadDocumentoAsync(Guid funcionarioId, TipoDocumento tipo, string nomeArquivo, string contentType, long tamanho, Stream stream, CancellationToken ct);
    Task<bool> DeleteDocumentoAsync(Guid funcionarioId, Guid docId, CancellationToken ct);

    Task<IdentityResult> AlterarSenhaAsync(Guid userId, string senhaAtual, string novaSenha, CancellationToken ct);
    Task<string?> UploadAvatarAsync(Guid funcionarioId, string fileName, string contentType, Stream stream, CancellationToken ct);
    Task<(Stream stream, string contentType, string fileName)?> GetAvatarAsync(Guid funcionarioId, CancellationToken ct);
    Task<bool> DeleteAvatarAsync(Guid funcionarioId, CancellationToken ct);

    // ── Histórico de Carreira ──
    Task<IReadOnlyList<HistoricoCarreiraItemResponse>> GetHistoricoCarreiraAsync(Guid funcionarioId, CancellationToken ct);

    // ── Dados Bancários ──
    Task<DadosBancariosResponse?> GetDadosBancariosAsync(Guid funcionarioId, CancellationToken ct);
    Task<DadosBancariosResponse> UpsertDadosBancariosAsync(Guid funcionarioId, DadosBancariosUpsertRequest request, CancellationToken ct);

    // ── Holerites ──
    Task<IReadOnlyList<HoleriteResponse>> ListHoleritesAsync(Guid funcionarioId, int? ano, CancellationToken ct);
    Task<(Stream stream, string contentType, string fileName)?> DownloadHoleriteAsync(Guid funcionarioId, Guid holeriteId, CancellationToken ct);
    Task<HoleriteResponse> UploadHoleriteRhAsync(Guid funcionarioIdAlvo, Guid enviadoPorId, int mes, int ano, string nomeArquivo, string contentType, long tamanho, Stream stream, CancellationToken ct);
    Task<bool> DeleteHoleriteAsync(Guid holeriteId, CancellationToken ct);
}

public sealed class ColaboradorService : IColaboradorService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly UserManager<ApplicationUser> _userManager;

    public ColaboradorService(AppDbContext db, ITenantContext tenantContext, UserManager<ApplicationUser> userManager)
    {
        _db = db;
        _tenantContext = tenantContext;
        _userManager = userManager;
    }

    // ── Perfil ──

    public async Task<ColaboradorPerfilResponse?> GetPerfilAsync(Guid funcionarioId, CancellationToken ct)
    {
        var f = await _db.Funcionarios.AsNoTracking()
            .Include(x => x.CentroCusto)
            .Include(x => x.Unit)
            .Include(x => x.JobPosition)
            .FirstOrDefaultAsync(x => x.Id == funcionarioId, ct);
        return f is null ? null : MapPerfil(f);
    }

    public async Task<ColaboradorPerfilResponse?> UpdatePerfilAsync(Guid funcionarioId, ColaboradorPerfilUpdateRequest request, CancellationToken ct)
    {
        var f = await _db.Funcionarios.FirstOrDefaultAsync(x => x.Id == funcionarioId, ct);
        if (f is null) return null;

        f.Name = request.Nome.Trim();
        f.Phone = request.Telefone?.Trim();
        f.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return await GetPerfilAsync(funcionarioId, ct);
    }

    private static ColaboradorPerfilResponse MapPerfil(Funcionario f) => new(
        f.Id,
        f.Name,
        f.Email ?? string.Empty,
        f.Phone,
        f.CentroCusto?.Description,
        f.Unit?.Name,
        f.JobPosition?.Name,
        string.IsNullOrWhiteSpace(f.AvatarFileName) ? null : $"/api/colaborador/perfil/avatar"
    );

    // ── Dependentes ──

    public async Task<IReadOnlyList<DependenteResponse>> ListDependentesAsync(Guid funcionarioId, CancellationToken ct) =>
        await _db.Set<Dependente>().AsNoTracking()
            .Where(d => d.FuncionarioId == funcionarioId)
            .OrderBy(d => d.NomeCompleto)
            .Select(d => new DependenteResponse(d.Id, d.NomeCompleto, d.Parentesco, d.Cpf, d.DataNascimento, d.IsPcd, d.CreatedAtUtc))
            .ToListAsync(ct);

    public async Task<DependenteResponse> CreateDependenteAsync(Guid funcionarioId, DependenteCreateRequest request, CancellationToken ct)
    {
        var entity = new Dependente
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            FuncionarioId = funcionarioId,
            NomeCompleto = request.NomeCompleto.Trim(),
            Parentesco = request.Parentesco,
            Cpf = request.Cpf?.Trim(),
            DataNascimento = request.DataNascimento,
            IsPcd = request.IsPcd,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        _db.Set<Dependente>().Add(entity);
        await _db.SaveChangesAsync(ct);
        return new DependenteResponse(entity.Id, entity.NomeCompleto, entity.Parentesco, entity.Cpf, entity.DataNascimento, entity.IsPcd, entity.CreatedAtUtc);
    }

    public async Task<DependenteResponse?> UpdateDependenteAsync(Guid funcionarioId, Guid dependenteId, DependenteUpdateRequest request, CancellationToken ct)
    {
        var entity = await _db.Set<Dependente>().FirstOrDefaultAsync(d => d.Id == dependenteId && d.FuncionarioId == funcionarioId, ct);
        if (entity is null) return null;

        entity.NomeCompleto = request.NomeCompleto.Trim();
        entity.Parentesco = request.Parentesco;
        entity.Cpf = request.Cpf?.Trim();
        entity.DataNascimento = request.DataNascimento;
        entity.IsPcd = request.IsPcd;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return new DependenteResponse(entity.Id, entity.NomeCompleto, entity.Parentesco, entity.Cpf, entity.DataNascimento, entity.IsPcd, entity.CreatedAtUtc);
    }

    public async Task<bool> DeleteDependenteAsync(Guid funcionarioId, Guid dependenteId, CancellationToken ct)
    {
        var entity = await _db.Set<Dependente>().FirstOrDefaultAsync(d => d.Id == dependenteId && d.FuncionarioId == funcionarioId, ct);
        if (entity is null) return false;
        _db.Set<Dependente>().Remove(entity);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    // ── Documentos ──

    public async Task<IReadOnlyList<DocumentoResponse>> ListDocumentosAsync(Guid funcionarioId, CancellationToken ct) =>
        await _db.Set<DocumentoColaborador>().AsNoTracking()
            .Where(d => d.FuncionarioId == funcionarioId)
            .OrderByDescending(d => d.CreatedAtUtc)
            .Select(d => new DocumentoResponse(d.Id, d.Tipo, d.NomeArquivo, d.ContentType, d.TamanhoBytes, d.Status, d.ObservacaoRh, d.CreatedAtUtc))
            .ToListAsync(ct);

    public async Task<DocumentoResponse> UploadDocumentoAsync(
        Guid funcionarioId, TipoDocumento tipo, string nomeArquivo, string contentType, long tamanho, Stream stream, CancellationToken ct)
    {
        // Store file to disk (future: blob storage)
        var storagePath = $"documentos/{funcionarioId}/{Guid.NewGuid()}{Path.GetExtension(nomeArquivo)}";
        var fullPath = Path.Combine("wwwroot", storagePath);
        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
        using (var fs = File.Create(fullPath))
        {
            await stream.CopyToAsync(fs, ct);
        }

        var entity = new DocumentoColaborador
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            FuncionarioId = funcionarioId,
            Tipo = tipo,
            NomeArquivo = nomeArquivo,
            ContentType = contentType,
            TamanhoBytes = tamanho,
            StoragePath = storagePath,
            Status = StatusDocumento.PendenteValidacao,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        _db.Set<DocumentoColaborador>().Add(entity);
        await _db.SaveChangesAsync(ct);
        return new DocumentoResponse(entity.Id, entity.Tipo, entity.NomeArquivo, entity.ContentType, entity.TamanhoBytes, entity.Status, null, entity.CreatedAtUtc);
    }

    public async Task<bool> DeleteDocumentoAsync(Guid funcionarioId, Guid docId, CancellationToken ct)
    {
        var entity = await _db.Set<DocumentoColaborador>().FirstOrDefaultAsync(d => d.Id == docId && d.FuncionarioId == funcionarioId, ct);
        if (entity is null) return false;

        // Delete file from disk
        var fullPath = Path.Combine("wwwroot", entity.StoragePath);
        if (File.Exists(fullPath)) File.Delete(fullPath);

        _db.Set<DocumentoColaborador>().Remove(entity);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    // ── Senha ──

    public async Task<IdentityResult> AlterarSenhaAsync(Guid userId, string senhaAtual, string novaSenha, CancellationToken ct)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user is null)
            return IdentityResult.Failed(new IdentityError { Description = "Usuário não encontrado." });

        return await _userManager.ChangePasswordAsync(user, senhaAtual, novaSenha);
    }

    // ── Avatar ──

    public async Task<string?> UploadAvatarAsync(Guid funcionarioId, string fileName, string contentType, Stream stream, CancellationToken ct)
    {
        var func = await _db.Set<Funcionario>().FirstOrDefaultAsync(f => f.Id == funcionarioId && f.TenantId == _tenantContext.TenantId, ct);
        if (func is null) return null;

        // Delete old avatar file if exists
        if (!string.IsNullOrWhiteSpace(func.AvatarFileName))
        {
            var oldPath = Path.Combine("wwwroot", "avatars", func.TenantId.ToString(), func.AvatarFileName);
            if (File.Exists(oldPath)) File.Delete(oldPath);
        }

        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        var storedName = $"{funcionarioId}{ext}";
        var dir = Path.Combine("wwwroot", "avatars", func.TenantId.ToString());
        Directory.CreateDirectory(dir);
        var fullPath = Path.Combine(dir, storedName);

        using (var fs = File.Create(fullPath))
        {
            await stream.CopyToAsync(fs, ct);
        }

        func.AvatarFileName = storedName;
        func.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        return $"/api/colaborador/perfil/avatar";
    }

    public async Task<(Stream stream, string contentType, string fileName)?> GetAvatarAsync(Guid funcionarioId, CancellationToken ct)
    {
        var func = await _db.Set<Funcionario>().AsNoTracking()
            .FirstOrDefaultAsync(f => f.Id == funcionarioId && f.TenantId == _tenantContext.TenantId, ct);
        if (func is null || string.IsNullOrWhiteSpace(func.AvatarFileName)) return null;

        var fullPath = Path.Combine("wwwroot", "avatars", func.TenantId.ToString(), func.AvatarFileName);
        if (!File.Exists(fullPath)) return null;

        var ext = Path.GetExtension(func.AvatarFileName).ToLowerInvariant();
        var ct2 = ext switch { ".png" => "image/png", ".gif" => "image/gif", ".webp" => "image/webp", _ => "image/jpeg" };
        return (File.OpenRead(fullPath), ct2, func.AvatarFileName);
    }

    public async Task<bool> DeleteAvatarAsync(Guid funcionarioId, CancellationToken ct)
    {
        var func = await _db.Set<Funcionario>().FirstOrDefaultAsync(f => f.Id == funcionarioId && f.TenantId == _tenantContext.TenantId, ct);
        if (func is null || string.IsNullOrWhiteSpace(func.AvatarFileName)) return false;

        var fullPath = Path.Combine("wwwroot", "avatars", func.TenantId.ToString(), func.AvatarFileName);
        if (File.Exists(fullPath)) File.Delete(fullPath);

        func.AvatarFileName = null;
        func.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return true;
    }

    // ── Histórico de Carreira ──

    public async Task<IReadOnlyList<HistoricoCarreiraItemResponse>> GetHistoricoCarreiraAsync(Guid funcionarioId, CancellationToken ct)
    {
        var list = await _db.OcupacoesHistorico.AsNoTracking()
            .Include(h => h.Vaga)
                .ThenInclude(v => v!.JobPosition)
            .Include(h => h.Vaga)
                .ThenInclude(v => v!.CentroCusto)
            .Where(h => h.FuncionarioId == funcionarioId && h.TenantId == _tenantContext.TenantId)
            .OrderByDescending(h => h.DataEntrada)
            .ToListAsync(ct);

        return list.Select(h => new HistoricoCarreiraItemResponse(
            h.Id,
            h.Vaga?.Titulo,
            h.Vaga?.JobPosition?.Description,
            h.Vaga?.CentroCusto?.Description,
            h.DataEntrada,
            h.DataSaida,
            h.MotivoSaida?.ToString(),
            h.IsProvisorio
        )).ToList();
    }

    // ── Dados Bancários ──

    public async Task<DadosBancariosResponse?> GetDadosBancariosAsync(Guid funcionarioId, CancellationToken ct)
    {
        var db = await _db.DadosBancarios.AsNoTracking()
            .FirstOrDefaultAsync(x => x.FuncionarioId == funcionarioId && x.TenantId == _tenantContext.TenantId, ct);
        if (db is null) return null;
        return new DadosBancariosResponse(db.Id, db.Banco, db.Agencia, db.Conta, db.TipoConta, db.Pix, db.UpdatedAtUtc);
    }

    public async Task<DadosBancariosResponse> UpsertDadosBancariosAsync(Guid funcionarioId, DadosBancariosUpsertRequest request, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var entity = await _db.DadosBancarios
            .FirstOrDefaultAsync(x => x.FuncionarioId == funcionarioId && x.TenantId == _tenantContext.TenantId, ct);

        if (entity is null)
        {
            entity = new DadosBancarios
            {
                Id = Guid.NewGuid(),
                TenantId = _tenantContext.TenantId,
                FuncionarioId = funcionarioId,
                CreatedAtUtc = now
            };
            _db.DadosBancarios.Add(entity);
        }

        entity.Banco = request.Banco;
        entity.Agencia = request.Agencia;
        entity.Conta = request.Conta;
        entity.TipoConta = request.TipoConta;
        entity.Pix = request.Pix;
        entity.UpdatedAtUtc = now;

        await _db.SaveChangesAsync(ct);
        return new DadosBancariosResponse(entity.Id, entity.Banco, entity.Agencia, entity.Conta, entity.TipoConta, entity.Pix, entity.UpdatedAtUtc);
    }

    // ── Holerites ──

    private string HoleritesDir(string tenantId) =>
        Path.Combine("wwwroot", "holerites", tenantId);

    public async Task<IReadOnlyList<HoleriteResponse>> ListHoleritesAsync(Guid funcionarioId, int? ano, CancellationToken ct)
    {
        var q = _db.Holerites.AsNoTracking()
            .Include(h => h.EnviadoPor)
            .Where(h => h.FuncionarioId == funcionarioId && h.TenantId == _tenantContext.TenantId);
        if (ano.HasValue) q = q.Where(h => h.AnoReferencia == ano.Value);
        var list = await q.OrderByDescending(h => h.AnoReferencia).ThenByDescending(h => h.MesReferencia).ToListAsync(ct);
        return list.Select(h => new HoleriteResponse(
            h.Id, h.MesReferencia, h.AnoReferencia, h.ArquivoNome, h.TamanhoBytes,
            h.EnviadoPorId, h.EnviadoPor?.Name, h.EnviadoEmUtc)).ToList();
    }

    public async Task<(Stream stream, string contentType, string fileName)?> DownloadHoleriteAsync(Guid funcionarioId, Guid holeriteId, CancellationToken ct)
    {
        var h = await _db.Holerites.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == holeriteId && x.FuncionarioId == funcionarioId && x.TenantId == _tenantContext.TenantId, ct);
        if (h is null) return null;

        var fullPath = Path.Combine(HoleritesDir(_tenantContext.TenantId), h.ArquivoPath);
        if (!File.Exists(fullPath)) return null;

        return (File.OpenRead(fullPath), "application/pdf", h.ArquivoNome);
    }

    public async Task<HoleriteResponse> UploadHoleriteRhAsync(
        Guid funcionarioIdAlvo, Guid enviadoPorId,
        int mes, int ano,
        string nomeArquivo, string contentType, long tamanho, Stream stream,
        CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var dir = HoleritesDir(_tenantContext.TenantId);
        Directory.CreateDirectory(dir);

        var storedName = $"{funcionarioIdAlvo}_{ano}_{mes:D2}_{Guid.NewGuid():N}.pdf";
        var fullPath = Path.Combine(dir, storedName);
        using (var fs = File.Create(fullPath))
        {
            await stream.CopyToAsync(fs, ct);
        }

        // Remove holerite anterior do mesmo mês/ano se existir
        var existing = await _db.Holerites
            .FirstOrDefaultAsync(h => h.FuncionarioId == funcionarioIdAlvo
                && h.TenantId == _tenantContext.TenantId
                && h.AnoReferencia == ano && h.MesReferencia == mes, ct);
        if (existing is not null)
        {
            var oldPath = Path.Combine(dir, existing.ArquivoPath);
            if (File.Exists(oldPath)) File.Delete(oldPath);
            _db.Holerites.Remove(existing);
        }

        var entity = new Holerite
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            FuncionarioId = funcionarioIdAlvo,
            MesReferencia = mes,
            AnoReferencia = ano,
            ArquivoPath = storedName,
            ArquivoNome = nomeArquivo,
            TamanhoBytes = tamanho,
            EnviadoPorId = enviadoPorId,
            EnviadoEmUtc = now,
            CreatedAtUtc = now
        };
        _db.Holerites.Add(entity);
        await _db.SaveChangesAsync(ct);

        return new HoleriteResponse(entity.Id, mes, ano, nomeArquivo, tamanho, enviadoPorId, null, now);
    }

    public async Task<bool> DeleteHoleriteAsync(Guid holeriteId, CancellationToken ct)
    {
        var h = await _db.Holerites.FirstOrDefaultAsync(x => x.Id == holeriteId && x.TenantId == _tenantContext.TenantId, ct);
        if (h is null) return false;

        var fullPath = Path.Combine(HoleritesDir(_tenantContext.TenantId), h.ArquivoPath);
        if (File.Exists(fullPath)) File.Delete(fullPath);

        _db.Holerites.Remove(h);
        await _db.SaveChangesAsync(ct);
        return true;
    }
}
