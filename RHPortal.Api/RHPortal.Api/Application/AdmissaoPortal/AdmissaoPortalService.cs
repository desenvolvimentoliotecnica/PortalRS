using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.PreAdmissao;
using RhPortal.Api.Contracts.AdmissaoPortal;
using RhPortal.Api.Contracts.PreAdmissao;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Notifications;
using RhPortal.Api.Infrastructure.Storage;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Application.AdmissaoPortal;

public interface IAdmissaoPortalService
{
    Task<AdmissaoPortalLoginResponse?> LoginAsync(AdmissaoPortalLoginRequest request, CancellationToken ct);
    Task<AdmissaoPortalDataResponse?> GetDataAsync(Guid preAdmissaoId, string cpf, CancellationToken ct);
    Task<BlipDocumentosResponse?> GetDocumentosByIdentificadorAsync(string? cpf, string? telefone, CancellationToken ct);
    Task<BlipDocumentosResponse?> UploadDocBlipAsync(BlipUploadDocumentoRequest request, CancellationToken ct);
    Task<bool> SaveDadosAsync(Guid preAdmissaoId, string cpf, PortalSalvarDadosRequest request, CancellationToken ct);
    Task<PreAdmissaoDocumentoResponse?> UploadDocAsync(Guid preAdmissaoId, string cpf, TipoDocumento tipo, LadoDocumento lado, string nomeArquivo, string contentType, long tamanho, Stream stream, CancellationToken ct);
    Task<bool> SubmitAsync(Guid preAdmissaoId, string cpf, CancellationToken ct);
    Task<DocumentValidationResponse?> ValidateDocumentAsync(Guid preAdmissaoId, string cpf, DocumentValidationRequest request, CancellationToken ct);
    Task<IReadOnlyList<PreAdmissaoDependenteResponse>> ListDependentesAsync(Guid preAdmissaoId, string cpf, CancellationToken ct);
    Task<PreAdmissaoDependenteResponse?> AddDependenteAsync(Guid preAdmissaoId, string cpf, DependenteCreateRequest request, CancellationToken ct);
    Task<PreAdmissaoDependenteResponse?> UpdateDependenteAsync(Guid preAdmissaoId, string cpf, Guid dependenteId, DependenteUpdateRequest request, CancellationToken ct);
    Task<bool> RemoveDependenteAsync(Guid preAdmissaoId, string cpf, Guid dependenteId, CancellationToken ct);
    Task<bool> SaveWizardProgressAsync(Guid preAdmissaoId, string cpf, int currentStep, int completionPercent, CancellationToken ct);
}

public sealed class AdmissaoPortalService : IAdmissaoPortalService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly IS3StorageService _storage;
    private readonly DocumentAiExtractor _aiExtractor;
    private readonly IHubContext<NotificationsHub> _hub;

    public AdmissaoPortalService(
        AppDbContext db,
        ITenantContext tenantContext,
        IS3StorageService storage,
        DocumentAiExtractor aiExtractor,
        IHubContext<NotificationsHub> hub)
    {
        _db = db;
        _tenantContext = tenantContext;
        _storage = storage;
        _aiExtractor = aiExtractor;
        _hub = hub;
    }

    public async Task<AdmissaoPortalLoginResponse?> LoginAsync(AdmissaoPortalLoginRequest request, CancellationToken ct)
    {
        var cpfNorm = NormalizeCpf(request.Cpf);
        if (string.IsNullOrWhiteSpace(cpfNorm) || cpfNorm.Length < 11) return null;

        var pa = await _db.Set<Domain.Entities.PreAdmissao>()
            .FirstOrDefaultAsync(x => x.Id == request.PreAdmissaoId && x.AccessToken != null, ct);

        if (pa is null) return null;

        // Se nenhum CPF foi pré-definido pelo RH, o candidato registra o próprio CPF no primeiro acesso
        var modified = false;
        if (string.IsNullOrWhiteSpace(pa.Cpf))
        {
            pa.Cpf = cpfNorm;
            pa.UpdatedAtUtc = DateTimeOffset.UtcNow;
            modified = true;
        }
        else if (NormalizeCpf(pa.Cpf) != cpfNorm) return null;

        if (pa.Status != PreAdmissaoStatus.Enviado
            && pa.Status != PreAdmissaoStatus.Acessado
            && pa.Status != PreAdmissaoStatus.PreenchidoParcial
            && pa.Status != PreAdmissaoStatus.Preenchido) return null;

        // Transição automática: Enviado → Acessado
        if (pa.Status == PreAdmissaoStatus.Enviado)
        {
            pa.Status = PreAdmissaoStatus.Acessado;
            pa.UpdatedAtUtc = DateTimeOffset.UtcNow;
            modified = true;
        }

        if (modified)
            await _db.SaveChangesAsync(ct);

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
            d.Id, (int)d.Tipo, (int)d.Lado, d.NomeArquivo, d.TamanhoBytes,
            (int)d.Status, d.ObservacaoRh, _storage.GetPresignedUrl(d.StoragePath))).ToList();

        var dados = new PortalDadosPessoais(
            // Pessoal
            pa.Nome, pa.NomeSocial, pa.NomeAbreviado,
            pa.Cpf, pa.Rg, pa.RgOrgaoExpedidor,
            pa.RgUfExpedidor, pa.RgDataExpedicao?.ToString("yyyy-MM-dd"),
            pa.DataNascimento?.ToString("yyyy-MM-dd"), (int?)pa.Sexo, (int?)pa.EstadoCivil,
            pa.Nacionalidade, pa.PaisNacionalidade,
            pa.NomeMae, pa.NomePai,
            pa.PaisNascimento, pa.NaturalCidade, pa.NaturalUf,
            pa.GrauInstrucao, pa.FuncDoador,
            // Endereco
            pa.Cep, pa.Logradouro, pa.Numero, pa.Complemento, pa.Bairro, pa.Cidade, pa.Uf,
            pa.PontoReferencia, pa.ResideExterior,
            // Contato
            pa.Email, pa.EmailAlternativo,
            pa.Telefone, pa.Celular,
            pa.DddTelefone, pa.DddTelContato,
            pa.ContatoEmergenciaNome, pa.ContatoEmergenciaFone,
            // Bancario
            pa.BancoCodigo, pa.BancoNome, pa.Agencia, pa.AgenciaDigito, pa.Conta, pa.ContaDigito, (int?)pa.TipoConta,
            // Trabalhista
            pa.PisPasep, pa.Ctps, pa.CtpsSerie, pa.CtpsUf, pa.CtpsModelo,
            // Titulo Eleitor
            pa.TituloEleitorNumero, pa.TituloEleitorZona, pa.TituloEleitorSecao,
            pa.TituloEleitorCidade, pa.TituloEleitorUf,
            // CNH
            pa.CnhNumero, pa.CategoriaCnh, pa.CnhUf,
            pa.CnhOrgaoEmissor, pa.CnhDataExpedicao, pa.CnhPrimeiraHabilitacao,
            pa.ValidadeCnh?.ToString("yyyy-MM-dd"),
            // Reservista / Doc Militar
            pa.ReservistaNumero,
            pa.DocMilitarTipo, pa.DocMilitarNumero, pa.DocMilitarSerie,
            pa.DocMilitarRegiao, pa.DocMilitarCircunscricao,
            // Estrangeiro
            pa.Passaporte, pa.RnmRne, pa.ValidadeVisto?.ToString("yyyy-MM-dd"), pa.TipoVisto,
            // Saude e caracteristicas fisicas
            pa.GrupoSanguineo, pa.FatorRh, pa.PossuiDeficiencia,
            pa.CartaoSus, pa.Altura, pa.Peso,
            pa.Cutis, pa.Cabelo, pa.Olhos, pa.Manequim, pa.Sapato);

        var dependentes = pa.Dependentes.Select(d => new PreAdmissaoDependenteResponse(
            d.Id, d.NomeCompleto, (int)d.Parentesco, d.Cpf,
            d.DataNascimento.ToString("yyyy-MM-dd"), d.IsPcd)).ToList();

        return new AdmissaoPortalDataResponse(pa.Id, pa.Nome, (int)pa.Status, solicitados, enviados, dados,
            dependentes, pa.WizardCurrentStep, pa.WizardCompletionPercent);
    }

    public async Task<bool> SaveDadosAsync(Guid preAdmissaoId, string cpf, PortalSalvarDadosRequest r, CancellationToken ct)
    {
        var pa = await LoadAndValidateTracked(preAdmissaoId, cpf, ct);
        if (pa is null) return false;

        // Pessoal
        if (!string.IsNullOrWhiteSpace(r.Nome)) pa.Nome = r.Nome.Trim();
        pa.NomeSocial = r.NomeSocial?.Trim();
        pa.NomeAbreviado = r.NomeAbreviado?.Trim();
        pa.Rg = r.Rg?.Trim(); pa.RgOrgaoExpedidor = r.RgOrgaoExpedidor?.Trim();
        pa.RgUfExpedidor = r.RgUfExpedidor?.Trim();
        if (!string.IsNullOrWhiteSpace(r.RgDataExpedicao) && DateOnly.TryParse(r.RgDataExpedicao, out var rgDt))
            pa.RgDataExpedicao = rgDt;
        if (!string.IsNullOrWhiteSpace(r.DataNascimento) && DateOnly.TryParse(r.DataNascimento, out var dn))
            pa.DataNascimento = dn;
        if (r.Sexo.HasValue) pa.Sexo = (Sexo)r.Sexo.Value;
        if (r.EstadoCivil.HasValue) pa.EstadoCivil = (EstadoCivil)r.EstadoCivil.Value;
        pa.Nacionalidade = r.Nacionalidade?.Trim();
        pa.PaisNacionalidade = r.PaisNacionalidade?.Trim();
        pa.NomeMae = r.NomeMae?.Trim(); pa.NomePai = r.NomePai?.Trim();
        pa.PaisNascimento = r.PaisNascimento?.Trim();
        pa.NaturalCidade = r.NaturalCidade?.Trim(); pa.NaturalUf = r.NaturalUf?.Trim();
        pa.GrauInstrucao = r.GrauInstrucao;
        pa.FuncDoador = r.FuncDoador?.Trim();

        // Endereco
        pa.Cep = r.Cep?.Trim(); pa.Logradouro = r.Logradouro?.Trim(); pa.Numero = r.Numero?.Trim();
        pa.Complemento = r.Complemento?.Trim(); pa.Bairro = r.Bairro?.Trim();
        pa.Cidade = r.Cidade?.Trim(); pa.Uf = r.Uf?.Trim();
        pa.PontoReferencia = r.PontoReferencia?.Trim();
        pa.ResideExterior = r.ResideExterior?.Trim();

        // Contato
        pa.Email = r.Email?.Trim(); pa.EmailAlternativo = r.EmailAlternativo?.Trim();
        pa.Telefone = r.Telefone?.Trim(); pa.Celular = r.Celular?.Trim();
        pa.DddTelefone = r.DddTelefone; pa.DddTelContato = r.DddTelContato;
        pa.ContatoEmergenciaNome = r.ContatoEmergenciaNome?.Trim(); pa.ContatoEmergenciaFone = r.ContatoEmergenciaFone?.Trim();

        // Bancario
        pa.BancoCodigo = r.BancoCodigo?.Trim(); pa.BancoNome = r.BancoNome?.Trim();
        pa.Agencia = r.Agencia?.Trim(); pa.AgenciaDigito = r.AgenciaDigito?.Trim();
        pa.Conta = r.Conta?.Trim(); pa.ContaDigito = r.ContaDigito?.Trim();
        if (r.TipoConta.HasValue) pa.TipoConta = (TipoContaBancaria)r.TipoConta.Value;

        // Trabalhista
        pa.PisPasep = r.PisPasep?.Trim(); pa.Ctps = r.Ctps?.Trim();
        pa.CtpsSerie = r.CtpsSerie?.Trim(); pa.CtpsUf = r.CtpsUf?.Trim();
        pa.CtpsModelo = r.CtpsModelo;

        // Titulo Eleitor
        pa.TituloEleitorNumero = r.TituloEleitorNumero?.Trim();
        pa.TituloEleitorZona = r.TituloEleitorZona?.Trim();
        pa.TituloEleitorSecao = r.TituloEleitorSecao?.Trim();
        pa.TituloEleitorCidade = r.TituloEleitorCidade?.Trim();
        pa.TituloEleitorUf = r.TituloEleitorUf?.Trim();

        // CNH
        pa.CnhNumero = r.CnhNumero?.Trim();
        pa.CategoriaCnh = r.CategoriaCnh?.Trim();
        pa.CnhUf = r.CnhUf?.Trim();
        pa.CnhOrgaoEmissor = r.CnhOrgaoEmissor?.Trim();
        pa.CnhDataExpedicao = r.CnhDataExpedicao;
        pa.CnhPrimeiraHabilitacao = r.CnhPrimeiraHabilitacao;
        if (!string.IsNullOrWhiteSpace(r.ValidadeCnh) && DateOnly.TryParse(r.ValidadeCnh, out var cnhVal))
            pa.ValidadeCnh = cnhVal;

        // Reservista / Doc Militar
        pa.ReservistaNumero = r.ReservistaNumero?.Trim();
        pa.DocMilitarTipo = r.DocMilitarTipo;
        pa.DocMilitarNumero = r.DocMilitarNumero?.Trim();
        pa.DocMilitarSerie = r.DocMilitarSerie?.Trim();
        pa.DocMilitarRegiao = r.DocMilitarRegiao;
        pa.DocMilitarCircunscricao = r.DocMilitarCircunscricao;

        // Estrangeiro
        pa.Passaporte = r.Passaporte?.Trim();
        pa.RnmRne = r.RnmRne?.Trim();
        if (!string.IsNullOrWhiteSpace(r.ValidadeVisto) && DateOnly.TryParse(r.ValidadeVisto, out var vistoVal))
            pa.ValidadeVisto = vistoVal;
        pa.TipoVisto = r.TipoVisto?.Trim();

        // Saude e caracteristicas fisicas
        pa.GrupoSanguineo = r.GrupoSanguineo;
        pa.FatorRh = r.FatorRh;
        pa.PossuiDeficiencia = r.PossuiDeficiencia?.Trim();
        pa.CartaoSus = r.CartaoSus?.Trim();
        pa.Altura = r.Altura;
        pa.Peso = r.Peso;
        pa.Cutis = r.Cutis; pa.Cabelo = r.Cabelo; pa.Olhos = r.Olhos;
        pa.Manequim = r.Manequim; pa.Sapato = r.Sapato;

        pa.UpdatedAtUtc = DateTimeOffset.UtcNow;
        pa.LastActivityUtc = DateTimeOffset.UtcNow;

        // Transição automática: Enviado/Acessado → PreenchidoParcial ao salvar dados
        if (pa.Status == PreAdmissaoStatus.Enviado || pa.Status == PreAdmissaoStatus.Acessado)
            pa.Status = PreAdmissaoStatus.PreenchidoParcial;

        await _db.SaveChangesAsync(ct);
        await BroadcastProgressAsync(pa, "save_dados", ct);
        return true;
    }

    public async Task<PreAdmissaoDocumentoResponse?> UploadDocAsync(
        Guid preAdmissaoId, string cpf, TipoDocumento tipo, LadoDocumento lado, string nomeArquivo,
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
            Lado = lado,
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
        pa.LastActivityUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        await BroadcastProgressAsync(pa, "upload_doc", ct);

        return new PreAdmissaoDocumentoResponse(
            doc.Id, doc.Tipo, doc.Lado, doc.NomeArquivo, doc.ContentType, doc.TamanhoBytes,
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
        pa.LastActivityUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        await BroadcastProgressAsync(pa, "submit", ct);
        return true;
    }

    // ── Helpers ──

    public async Task<BlipDocumentosResponse?> GetDocumentosByIdentificadorAsync(string? cpf, string? telefone, CancellationToken ct)
    {
        var cpfNorm = string.IsNullOrWhiteSpace(cpf) ? null : NormalizeCpf(cpf);
        var telNorm = string.IsNullOrWhiteSpace(telefone) ? null
            : new string(telefone.Where(char.IsDigit).ToArray());

        if (cpfNorm is null && telNorm is null) return null;

        var allowedStatuses = new[]
        {
            PreAdmissaoStatus.Enviado, PreAdmissaoStatus.Acessado,
            PreAdmissaoStatus.PreenchidoParcial, PreAdmissaoStatus.Preenchido
        };

        var pa = await _db.Set<Domain.Entities.PreAdmissao>()
            .AsNoTracking()
            .Include(x => x.Documentos)
            .Include(x => x.DocumentosSolicitados)
            .Where(x => allowedStatuses.Contains(x.Status))
            .Where(x => (cpfNorm != null && x.Cpf == cpfNorm)
                     || (telNorm != null && (x.Telefone == telNorm || x.Celular == telNorm)))
            .OrderByDescending(x => x.CreatedAtUtc)
            .FirstOrDefaultAsync(ct);

        if (pa is null) return null;

        var documentos = pa.DocumentosSolicitados
            .Where(ds => ds.Obrigatorio)
            .Select(ds =>
            {
                var enviados = pa.Documentos
                    .Where(d => d.Tipo == ds.TipoDocumento)
                    .Select(d => new BlipDocumentoEnviadoItem((int)d.Lado, d.NomeArquivo, (int)d.Status))
                    .ToList();

                return new BlipDocumentoItem(
                    Tipo: (int)ds.TipoDocumento,
                    Label: PreAdmissaoService.TipoDocumentoLabel(ds.TipoDocumento),
                    Obrigatorio: true,
                    JaEnviado: enviados.Any(),
                    Enviados: enviados);
            }).ToList();

        return new BlipDocumentosResponse(pa.Nome, pa.Celular, documentos);
    }

    public async Task<BlipDocumentosResponse?> UploadDocBlipAsync(BlipUploadDocumentoRequest request, CancellationToken ct)
    {
        var cpfNorm = NormalizeCpf(request.Cpf);
        if (string.IsNullOrWhiteSpace(cpfNorm)) return null;

        var allowedStatuses = new[]
        {
            PreAdmissaoStatus.Enviado, PreAdmissaoStatus.Acessado,
            PreAdmissaoStatus.PreenchidoParcial, PreAdmissaoStatus.Preenchido
        };

        var pa = await _db.Set<Domain.Entities.PreAdmissao>()
            .Include(x => x.Documentos)
            .Include(x => x.DocumentosSolicitados)
            .Where(x => allowedStatuses.Contains(x.Status) && x.Cpf == cpfNorm)
            .OrderByDescending(x => x.CreatedAtUtc)
            .FirstOrDefaultAsync(ct);

        if (pa is null) return null;

        // Decodifica base64 e faz upload
        var bytes = Convert.FromBase64String(request.Base64);
        var tipo = (TipoDocumento)request.Tipo;
        var lado = (LadoDocumento)request.Lado;

        var folder = pa.CandidatoId.HasValue
            ? $"{_tenantContext.TenantId}/candidatos/{pa.CandidatoId.Value:N}"
            : $"{_tenantContext.TenantId}/admissao/{pa.Id:N}";
        var ext = Path.GetExtension(request.NomeArquivo).ToLowerInvariant();
        var storagePath = $"{folder}/{(int)tipo}_{Guid.NewGuid():N}{ext}";

        using var stream = new MemoryStream(bytes);
        await _storage.UploadAsync(stream, storagePath, request.MimeType, ct);

        var doc = new PreAdmissaoDocumento
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            PreAdmissaoId = pa.Id,
            Tipo = tipo,
            Lado = lado,
            NomeArquivo = request.NomeArquivo,
            ContentType = request.MimeType,
            TamanhoBytes = bytes.Length,
            StoragePath = storagePath,
            Status = StatusDocumento.PendenteValidacao,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        _db.Set<PreAdmissaoDocumento>().Add(doc);

        if (pa.Status == PreAdmissaoStatus.Enviado || pa.Status == PreAdmissaoStatus.Acessado)
            pa.Status = PreAdmissaoStatus.PreenchidoParcial;
        pa.LastActivityUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        await BroadcastProgressAsync(pa, "blip_upload_doc", ct);

        // Retorna lista atualizada (com o doc recém-enviado já marcado como enviado)
        return await GetDocumentosByIdentificadorAsync(request.Cpf, null, ct);
    }

    private async Task<Domain.Entities.PreAdmissao?> LoadAndValidate(Guid id, string cpf, CancellationToken ct)
    {
        var cpfNorm = NormalizeCpf(cpf);
        var pa = await _db.Set<Domain.Entities.PreAdmissao>().AsNoTracking()
            .Include(x => x.Documentos)
            .Include(x => x.DocumentosSolicitados)
            .Include(x => x.Dependentes)
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

    // ── Validação de documento por IA ──

    public async Task<DocumentValidationResponse?> ValidateDocumentAsync(
        Guid preAdmissaoId, string cpf, DocumentValidationRequest request, CancellationToken ct)
    {
        var pa = await LoadAndValidateTracked(preAdmissaoId, cpf, ct);
        if (pa is null) return null;

        var tipo = (TipoDocumento)request.TipoDocumento;
        return await _aiExtractor.ExtractAsync(_tenantContext.TenantId, tipo, request.ImageBase64, request.MediaType, ct);
    }

    // ── Dependentes CRUD ──

    public async Task<IReadOnlyList<PreAdmissaoDependenteResponse>> ListDependentesAsync(
        Guid preAdmissaoId, string cpf, CancellationToken ct)
    {
        var pa = await LoadAndValidate(preAdmissaoId, cpf, ct);
        if (pa is null) return Array.Empty<PreAdmissaoDependenteResponse>();

        return pa.Dependentes.Select(d => new PreAdmissaoDependenteResponse(
            d.Id, d.NomeCompleto, (int)d.Parentesco, d.Cpf,
            d.DataNascimento.ToString("yyyy-MM-dd"), d.IsPcd)).ToList();
    }

    public async Task<PreAdmissaoDependenteResponse?> AddDependenteAsync(
        Guid preAdmissaoId, string cpf, DependenteCreateRequest request, CancellationToken ct)
    {
        var pa = await LoadAndValidateTracked(preAdmissaoId, cpf, ct);
        if (pa is null) return null;

        var dep = new PreAdmissaoDependente
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            PreAdmissaoId = preAdmissaoId,
            NomeCompleto = request.NomeCompleto.Trim(),
            Parentesco = (Parentesco)request.Parentesco,
            Cpf = NormalizeCpf(request.Cpf ?? ""),
            DataNascimento = DateOnly.Parse(request.DataNascimento),
            IsPcd = request.IsPcd,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        _db.Set<PreAdmissaoDependente>().Add(dep);

        pa.LastActivityUtc = DateTimeOffset.UtcNow;
        if (pa.Status == PreAdmissaoStatus.Enviado || pa.Status == PreAdmissaoStatus.Acessado)
            pa.Status = PreAdmissaoStatus.PreenchidoParcial;

        await _db.SaveChangesAsync(ct);
        await BroadcastProgressAsync(pa, "add_dependente", ct);

        return new PreAdmissaoDependenteResponse(
            dep.Id, dep.NomeCompleto, (int)dep.Parentesco, dep.Cpf,
            dep.DataNascimento.ToString("yyyy-MM-dd"), dep.IsPcd);
    }

    public async Task<PreAdmissaoDependenteResponse?> UpdateDependenteAsync(
        Guid preAdmissaoId, string cpf, Guid dependenteId, DependenteUpdateRequest request, CancellationToken ct)
    {
        var pa = await LoadAndValidateTracked(preAdmissaoId, cpf, ct);
        if (pa is null) return null;

        var dep = await _db.Set<PreAdmissaoDependente>()
            .FirstOrDefaultAsync(x => x.Id == dependenteId && x.PreAdmissaoId == preAdmissaoId, ct);
        if (dep is null) return null;

        dep.NomeCompleto = request.NomeCompleto.Trim();
        dep.Parentesco = (Parentesco)request.Parentesco;
        dep.Cpf = NormalizeCpf(request.Cpf ?? "");
        dep.DataNascimento = DateOnly.Parse(request.DataNascimento);
        dep.IsPcd = request.IsPcd;
        dep.UpdatedAtUtc = DateTimeOffset.UtcNow;

        pa.LastActivityUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        await BroadcastProgressAsync(pa, "update_dependente", ct);

        return new PreAdmissaoDependenteResponse(
            dep.Id, dep.NomeCompleto, (int)dep.Parentesco, dep.Cpf,
            dep.DataNascimento.ToString("yyyy-MM-dd"), dep.IsPcd);
    }

    public async Task<bool> RemoveDependenteAsync(Guid preAdmissaoId, string cpf, Guid dependenteId, CancellationToken ct)
    {
        var pa = await LoadAndValidateTracked(preAdmissaoId, cpf, ct);
        if (pa is null) return false;

        var dep = await _db.Set<PreAdmissaoDependente>()
            .FirstOrDefaultAsync(x => x.Id == dependenteId && x.PreAdmissaoId == preAdmissaoId, ct);
        if (dep is null) return false;

        _db.Set<PreAdmissaoDependente>().Remove(dep);
        pa.LastActivityUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        await BroadcastProgressAsync(pa, "remove_dependente", ct);
        return true;
    }

    // ── Wizard progress ──

    public async Task<bool> SaveWizardProgressAsync(Guid preAdmissaoId, string cpf, int currentStep, int completionPercent, CancellationToken ct)
    {
        var pa = await LoadAndValidateTracked(preAdmissaoId, cpf, ct);
        if (pa is null) return false;

        pa.WizardCurrentStep = currentStep;
        pa.WizardCompletionPercent = completionPercent;
        pa.LastActivityUtc = DateTimeOffset.UtcNow;
        pa.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        await BroadcastProgressAsync(pa, "wizard_progress", ct);
        return true;
    }

    // ── SignalR broadcast ──

    private async Task BroadcastProgressAsync(Domain.Entities.PreAdmissao pa, string action, CancellationToken ct)
    {
        try
        {
            await _hub.Clients
                .Group(NotificationsHub.GetTenantGroup(_tenantContext.TenantId))
                .SendAsync("admissao.progress", new
                {
                    preAdmissaoId = pa.Id,
                    step = pa.WizardCurrentStep,
                    completionPercent = pa.WizardCompletionPercent,
                    status = (int)pa.Status,
                    lastAction = action,
                    timestamp = DateTimeOffset.UtcNow,
                }, ct);
        }
        catch { /* SignalR failure should not block the main operation */ }
    }

    private static string NormalizeCpf(string cpf) => cpf.Replace(".", "").Replace("-", "").Replace(" ", "").Trim();
}
