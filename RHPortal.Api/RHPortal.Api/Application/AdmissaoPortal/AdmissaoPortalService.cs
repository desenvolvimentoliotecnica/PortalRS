using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.PreAdmissao;
using RhPortal.Api.Contracts.AdmissaoPortal;
using RhPortal.Api.Contracts.PreAdmissao;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Storage;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.AdmissaoPortal;

public interface IAdmissaoPortalService
{
    Task<AdmissaoPortalLoginResponse?> LoginAsync(AdmissaoPortalLoginRequest request, CancellationToken ct);
    Task<AdmissaoPortalDataResponse?> GetDataAsync(Guid preAdmissaoId, string cpf, CancellationToken ct);
    Task<bool> SaveDadosAsync(Guid preAdmissaoId, string cpf, PortalSalvarDadosRequest request, CancellationToken ct);
    Task<PreAdmissaoDocumentoResponse?> UploadDocAsync(Guid preAdmissaoId, string cpf, TipoDocumento tipo, string nomeArquivo, string contentType, long tamanho, Stream stream, CancellationToken ct);
    Task<bool> SubmitAsync(Guid preAdmissaoId, string cpf, CancellationToken ct);
}

public sealed class AdmissaoPortalService : IAdmissaoPortalService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly IS3StorageService _storage;

    public AdmissaoPortalService(AppDbContext db, ITenantContext tenantContext, IS3StorageService storage)
    {
        _db = db;
        _tenantContext = tenantContext;
        _storage = storage;
    }

    public async Task<AdmissaoPortalLoginResponse?> LoginAsync(AdmissaoPortalLoginRequest request, CancellationToken ct)
    {
        var cpfNorm = NormalizeCpf(request.Cpf);
        if (string.IsNullOrWhiteSpace(cpfNorm) || cpfNorm.Length < 11) return null;

        var pa = await _db.Set<Domain.Entities.PreAdmissao>()
            .FirstOrDefaultAsync(x => x.Id == request.PreAdmissaoId && x.AccessToken != null, ct);

        if (pa is null) return null;
        if (NormalizeCpf(pa.Cpf ?? "") != cpfNorm) return null;
        if (pa.Status != PreAdmissaoStatus.Enviado
            && pa.Status != PreAdmissaoStatus.Acessado
            && pa.Status != PreAdmissaoStatus.PreenchidoParcial
            && pa.Status != PreAdmissaoStatus.Preenchido) return null;

        // Transição automática: Enviado → Acessado
        if (pa.Status == PreAdmissaoStatus.Enviado)
        {
            pa.Status = PreAdmissaoStatus.Acessado;
            pa.UpdatedAtUtc = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync(ct);
        }

        return new AdmissaoPortalLoginResponse(pa.Id, pa.Nome, _tenantContext.TenantId);
    }

    public async Task<AdmissaoPortalDataResponse?> GetDataAsync(Guid preAdmissaoId, string cpf, CancellationToken ct)
    {
        var pa = await LoadAndValidate(preAdmissaoId, cpf, ct);
        if (pa is null) return null;

        var solicitados = pa.DocumentosSolicitados.Select(ds =>
        {
            var jaEnviado = pa.Documentos.Any(d => d.Tipo == ds.TipoDocumento);
            return new PortalDocumentoSolicitadoItem(
                (int)ds.TipoDocumento,
                PreAdmissaoService.TipoDocumentoLabel(ds.TipoDocumento),
                ds.Obrigatorio,
                jaEnviado);
        }).ToList();

        var enviados = pa.Documentos.Select(d => new PortalDocumentoEnviadoItem(
            d.Id, (int)d.Tipo, d.NomeArquivo, d.TamanhoBytes,
            (int)d.Status, d.ObservacaoRh, _storage.GetPresignedUrl(d.StoragePath))).ToList();

        var dados = new PortalDadosPessoais(
            pa.Nome, pa.Cpf, pa.Rg, pa.RgOrgaoExpedidor,
            pa.DataNascimento?.ToString("yyyy-MM-dd"), (int?)pa.Sexo, (int?)pa.EstadoCivil,
            pa.Nacionalidade, pa.NomeMae, pa.NomePai,
            pa.Cep, pa.Logradouro, pa.Numero, pa.Complemento, pa.Bairro, pa.Cidade, pa.Uf,
            pa.Email, pa.Telefone, pa.Celular, pa.ContatoEmergenciaNome, pa.ContatoEmergenciaFone,
            pa.BancoCodigo, pa.BancoNome, pa.Agencia, pa.AgenciaDigito, pa.Conta, pa.ContaDigito, (int?)pa.TipoConta,
            pa.PisPasep, pa.Ctps, pa.CtpsSerie, pa.CtpsUf,
            pa.GrupoSanguineo, pa.FatorRh, pa.PossuiDeficiencia,
            pa.DocMilitarTipo, pa.DocMilitarNumero, pa.DocMilitarSerie, pa.DocMilitarRegiao,
            pa.CartaoSus, pa.TituloEleitorCidade, pa.TituloEleitorUf,
            pa.CtpsModelo, pa.Altura, pa.Peso);

        return new AdmissaoPortalDataResponse(pa.Id, pa.Nome, (int)pa.Status, solicitados, enviados, dados);
    }

    public async Task<bool> SaveDadosAsync(Guid preAdmissaoId, string cpf, PortalSalvarDadosRequest r, CancellationToken ct)
    {
        var pa = await LoadAndValidateTracked(preAdmissaoId, cpf, ct);
        if (pa is null) return false;

        if (!string.IsNullOrWhiteSpace(r.Nome)) pa.Nome = r.Nome.Trim();
        pa.Rg = r.Rg?.Trim(); pa.RgOrgaoExpedidor = r.RgOrgaoExpedidor?.Trim();
        if (!string.IsNullOrWhiteSpace(r.DataNascimento) && DateOnly.TryParse(r.DataNascimento, out var dn))
            pa.DataNascimento = dn;
        if (r.Sexo.HasValue) pa.Sexo = (Sexo)r.Sexo.Value;
        if (r.EstadoCivil.HasValue) pa.EstadoCivil = (EstadoCivil)r.EstadoCivil.Value;
        pa.Nacionalidade = r.Nacionalidade?.Trim();
        pa.NomeMae = r.NomeMae?.Trim(); pa.NomePai = r.NomePai?.Trim();

        pa.Cep = r.Cep?.Trim(); pa.Logradouro = r.Logradouro?.Trim(); pa.Numero = r.Numero?.Trim();
        pa.Complemento = r.Complemento?.Trim(); pa.Bairro = r.Bairro?.Trim();
        pa.Cidade = r.Cidade?.Trim(); pa.Uf = r.Uf?.Trim();

        pa.Email = r.Email?.Trim(); pa.Telefone = r.Telefone?.Trim(); pa.Celular = r.Celular?.Trim();
        pa.ContatoEmergenciaNome = r.ContatoEmergenciaNome?.Trim(); pa.ContatoEmergenciaFone = r.ContatoEmergenciaFone?.Trim();

        pa.BancoCodigo = r.BancoCodigo?.Trim(); pa.BancoNome = r.BancoNome?.Trim();
        pa.Agencia = r.Agencia?.Trim(); pa.AgenciaDigito = r.AgenciaDigito?.Trim();
        pa.Conta = r.Conta?.Trim(); pa.ContaDigito = r.ContaDigito?.Trim();
        if (r.TipoConta.HasValue) pa.TipoConta = (TipoContaBancaria)r.TipoConta.Value;

        pa.PisPasep = r.PisPasep?.Trim(); pa.Ctps = r.Ctps?.Trim();
        pa.CtpsSerie = r.CtpsSerie?.Trim(); pa.CtpsUf = r.CtpsUf?.Trim();

        // Saúde e docs complementares TOTVS
        pa.GrupoSanguineo = r.GrupoSanguineo;
        pa.FatorRh = r.FatorRh;
        pa.PossuiDeficiencia = r.PossuiDeficiencia?.Trim();
        pa.DocMilitarTipo = r.DocMilitarTipo;
        pa.DocMilitarNumero = r.DocMilitarNumero?.Trim();
        pa.DocMilitarSerie = r.DocMilitarSerie?.Trim();
        pa.DocMilitarRegiao = r.DocMilitarRegiao;
        pa.CartaoSus = r.CartaoSus?.Trim();
        pa.TituloEleitorCidade = r.TituloEleitorCidade?.Trim();
        pa.TituloEleitorUf = r.TituloEleitorUf?.Trim();
        pa.CtpsModelo = r.CtpsModelo;
        pa.Altura = r.Altura;
        pa.Peso = r.Peso;

        pa.UpdatedAtUtc = DateTimeOffset.UtcNow;

        // Transição automática: Enviado/Acessado → PreenchidoParcial ao salvar dados
        if (pa.Status == PreAdmissaoStatus.Enviado || pa.Status == PreAdmissaoStatus.Acessado)
            pa.Status = PreAdmissaoStatus.PreenchidoParcial;

        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<PreAdmissaoDocumentoResponse?> UploadDocAsync(
        Guid preAdmissaoId, string cpf, TipoDocumento tipo, string nomeArquivo,
        string contentType, long tamanho, Stream stream, CancellationToken ct)
    {
        var pa = await LoadAndValidateTracked(preAdmissaoId, cpf, ct);
        if (pa is null) return null;

        var folder = pa.CandidatoId.HasValue
            ? $"{_tenantContext.TenantId}/candidatos/{pa.CandidatoId.Value:N}"
            : $"{_tenantContext.TenantId}/admissao/{preAdmissaoId:N}";
        var ext = Path.GetExtension(nomeArquivo);
        var storagePath = $"{folder}/{(int)tipo}_{Guid.NewGuid():N}{ext}";

        await _storage.UploadAsync(stream, storagePath, contentType, ct);

        var doc = new PreAdmissaoDocumento
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            PreAdmissaoId = preAdmissaoId,
            Tipo = tipo,
            NomeArquivo = nomeArquivo,
            ContentType = contentType,
            TamanhoBytes = tamanho,
            StoragePath = storagePath,
            Status = StatusDocumento.PendenteValidacao,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        _db.Set<PreAdmissaoDocumento>().Add(doc);

        // Transição automática: Enviado/Acessado → PreenchidoParcial ao enviar doc
        if (pa.Status == PreAdmissaoStatus.Enviado || pa.Status == PreAdmissaoStatus.Acessado)
            pa.Status = PreAdmissaoStatus.PreenchidoParcial;

        await _db.SaveChangesAsync(ct);

        return new PreAdmissaoDocumentoResponse(
            doc.Id, doc.Tipo, doc.NomeArquivo, doc.ContentType, doc.TamanhoBytes,
            doc.Status, null, doc.CreatedAtUtc, _storage.GetPresignedUrl(doc.StoragePath));
    }

    public async Task<bool> SubmitAsync(Guid preAdmissaoId, string cpf, CancellationToken ct)
    {
        var pa = await LoadAndValidateTracked(preAdmissaoId, cpf, ct);
        if (pa is null) return false;
        var submitAllowed = new[] { PreAdmissaoStatus.Enviado, PreAdmissaoStatus.Acessado, PreAdmissaoStatus.PreenchidoParcial };
        if (!submitAllowed.Contains(pa.Status)) return false;

        pa.Status = PreAdmissaoStatus.Preenchido;
        pa.SubmittedAtUtc = DateTimeOffset.UtcNow;
        pa.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return true;
    }

    // ── Helpers ──

    private async Task<Domain.Entities.PreAdmissao?> LoadAndValidate(Guid id, string cpf, CancellationToken ct)
    {
        var cpfNorm = NormalizeCpf(cpf);
        var pa = await _db.Set<Domain.Entities.PreAdmissao>().AsNoTracking()
            .Include(x => x.Documentos)
            .Include(x => x.DocumentosSolicitados)
            .FirstOrDefaultAsync(x => x.Id == id && x.AccessToken != null, ct);
        if (pa is null || NormalizeCpf(pa.Cpf ?? "") != cpfNorm) return null;
        var allowedStatuses = new[] { PreAdmissaoStatus.Enviado, PreAdmissaoStatus.Acessado, PreAdmissaoStatus.PreenchidoParcial, PreAdmissaoStatus.Preenchido };
        if (!allowedStatuses.Contains(pa.Status)) return null;
        return pa;
    }

    private async Task<Domain.Entities.PreAdmissao?> LoadAndValidateTracked(Guid id, string cpf, CancellationToken ct)
    {
        var cpfNorm = NormalizeCpf(cpf);
        var pa = await _db.Set<Domain.Entities.PreAdmissao>()
            .FirstOrDefaultAsync(x => x.Id == id && x.AccessToken != null, ct);
        if (pa is null || NormalizeCpf(pa.Cpf ?? "") != cpfNorm) return null;
        var allowed = new[] { PreAdmissaoStatus.Enviado, PreAdmissaoStatus.Acessado, PreAdmissaoStatus.PreenchidoParcial, PreAdmissaoStatus.Preenchido };
        if (!allowed.Contains(pa.Status)) return null;
        return pa;
    }

    private static string NormalizeCpf(string cpf) => cpf.Replace(".", "").Replace("-", "").Replace(" ", "").Trim();
}
