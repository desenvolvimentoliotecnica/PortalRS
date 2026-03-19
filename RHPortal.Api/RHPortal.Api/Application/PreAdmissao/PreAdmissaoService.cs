using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Contracts.PreAdmissao;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Messaging.Email;

namespace RhPortal.Api.Application.PreAdmissao;

public interface IPreAdmissaoService
{
    Task<IReadOnlyList<PreAdmissaoGridRow>> ListAsync(PreAdmissaoListQuery query, CancellationToken ct);
    Task<PreAdmissaoDetailResponse?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<PreAdmissaoDetailResponse> CreateAsync(PreAdmissaoCreateRequest request, CancellationToken ct);
    Task<PreAdmissaoDetailResponse?> UpdateAsync(Guid id, PreAdmissaoUpdateRequest request, CancellationToken ct);
    Task<PreAdmissaoDetailResponse?> SubmitAsync(Guid id, CancellationToken ct);
    Task<PreAdmissaoDetailResponse?> ApproveAsync(Guid id, Guid aprovadorId, PreAdmissaoApproveRequest request, CancellationToken ct);
    Task<PreAdmissaoDetailResponse?> RejectAsync(Guid id, PreAdmissaoRejectRequest request, CancellationToken ct);
    Task<BuscaCpfResponse> BuscarPorCpfAsync(string cpf, CancellationToken ct);
    Task<PreAdmissaoDocumentoResponse> UploadDocumentoAsync(Guid preAdmissaoId, TipoDocumento tipo, string nomeArquivo, string contentType, long tamanho, Stream stream, CancellationToken ct);
    Task<bool> DeleteDocumentoAsync(Guid preAdmissaoId, Guid docId, CancellationToken ct);
}

public sealed class PreAdmissaoService : IPreAdmissaoService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IEmailQueueService _emailQueue;
    private readonly ILogger<PreAdmissaoService> _logger;

    public PreAdmissaoService(
        AppDbContext db,
        ITenantContext tenantContext,
        UserManager<ApplicationUser> userManager,
        IEmailQueueService emailQueue,
        ILogger<PreAdmissaoService> logger)
    {
        _db = db;
        _tenantContext = tenantContext;
        _userManager = userManager;
        _emailQueue = emailQueue;
        _logger = logger;
    }

    // ── List ──

    public async Task<IReadOnlyList<PreAdmissaoGridRow>> ListAsync(PreAdmissaoListQuery query, CancellationToken ct)
    {
        var q = _db.Set<Domain.Entities.PreAdmissao>().AsNoTracking()
            .Include(x => x.JobPosition)
            .Include(x => x.Area)
            .Include(x => x.Unit)
            .AsQueryable();

        if (query.Status.HasValue)
            q = q.Where(x => x.Status == query.Status.Value);

        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var term = query.Q.Trim().ToLower();
            q = q.Where(x => x.Nome.ToLower().Contains(term) || (x.Cpf != null && x.Cpf.Contains(term)) || (x.Email != null && x.Email.ToLower().Contains(term)));
        }

        q = q.OrderByDescending(x => x.CreatedAtUtc);

        var page = Math.Max(1, query.Page ?? 1);
        var size = Math.Clamp(query.PageSize ?? 25, 1, 100);
        q = q.Skip((page - 1) * size).Take(size);

        return await q.Select(x => new PreAdmissaoGridRow(
            x.Id, x.Nome, x.Cpf, x.Email,
            x.JobPosition != null ? x.JobPosition.Name : null,
            x.Area != null ? x.Area.Name : null,
            x.Unit != null ? x.Unit.Name : null,
            x.Status, x.DataAdmissao, x.Salario, x.PreenchidoPor, x.CreatedAtUtc
        )).ToListAsync(ct);
    }

    // ── Get ──

    public async Task<PreAdmissaoDetailResponse?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var e = await _db.Set<Domain.Entities.PreAdmissao>().AsNoTracking()
            .Include(x => x.Unit).Include(x => x.Area).Include(x => x.JobPosition)
            .Include(x => x.RevisadoPor).Include(x => x.AprovadoPor)
            .Include(x => x.Documentos)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        return e is null ? null : MapDetail(e);
    }

    // ── Create ──

    public async Task<PreAdmissaoDetailResponse> CreateAsync(PreAdmissaoCreateRequest request, CancellationToken ct)
    {
        var entity = new Domain.Entities.PreAdmissao
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            Status = PreAdmissaoStatus.Rascunho,
            PreenchidoPor = request.PreenchidoPor,
            CandidatoId = request.CandidatoId,
            Nome = request.Nome.Trim(),
            Cpf = request.Cpf?.Trim(),
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        _db.Set<Domain.Entities.PreAdmissao>().Add(entity);
        await _db.SaveChangesAsync(ct);
        return (await GetByIdAsync(entity.Id, ct))!;
    }

    // ── Update ──

    public async Task<PreAdmissaoDetailResponse?> UpdateAsync(Guid id, PreAdmissaoUpdateRequest r, CancellationToken ct)
    {
        var e = await _db.Set<Domain.Entities.PreAdmissao>().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return null;
        if (e.Status != PreAdmissaoStatus.Rascunho && e.Status != PreAdmissaoStatus.PreenchimentoPendente)
            throw new InvalidOperationException("Só é possível editar pré-admissões em rascunho.");

        // Pessoal
        e.Nome = r.Nome.Trim();
        e.Cpf = r.Cpf?.Trim(); e.Rg = r.Rg?.Trim(); e.RgOrgaoExpedidor = r.RgOrgaoExpedidor?.Trim();
        e.RgDataExpedicao = r.RgDataExpedicao; e.DataNascimento = r.DataNascimento;
        e.Sexo = r.Sexo ?? Sexo.NaoInformado; e.EstadoCivil = r.EstadoCivil ?? EstadoCivil.NaoInformado;
        e.Nacionalidade = r.Nacionalidade?.Trim(); e.NomeMae = r.NomeMae?.Trim(); e.NomePai = r.NomePai?.Trim();
        e.NaturalCidade = r.NaturalCidade?.Trim(); e.NaturalUf = r.NaturalUf?.Trim();

        // Estrangeiro
        e.Passaporte = r.Passaporte?.Trim(); e.RnmRne = r.RnmRne?.Trim();
        e.ValidadeVisto = r.ValidadeVisto; e.TipoVisto = r.TipoVisto?.Trim();

        // Endereço
        e.Cep = r.Cep?.Trim(); e.Logradouro = r.Logradouro?.Trim(); e.Numero = r.Numero?.Trim();
        e.Complemento = r.Complemento?.Trim(); e.Bairro = r.Bairro?.Trim();
        e.Cidade = r.Cidade?.Trim(); e.Uf = r.Uf?.Trim();

        // Contato
        e.Email = r.Email?.Trim(); e.Telefone = r.Telefone?.Trim(); e.Celular = r.Celular?.Trim();
        e.ContatoEmergenciaNome = r.ContatoEmergenciaNome?.Trim(); e.ContatoEmergenciaFone = r.ContatoEmergenciaFone?.Trim();

        // Bancário
        e.BancoCodigo = r.BancoCodigo?.Trim(); e.BancoNome = r.BancoNome?.Trim();
        e.Agencia = r.Agencia?.Trim(); e.AgenciaDigito = r.AgenciaDigito?.Trim();
        e.Conta = r.Conta?.Trim(); e.ContaDigito = r.ContaDigito?.Trim(); e.TipoConta = r.TipoConta;

        // Trabalhista
        e.EstabelecimentoCodigo = r.EstabelecimentoCodigo?.Trim();
        e.UnitId = r.UnitId; e.AreaId = r.AreaId; e.JobPositionId = r.JobPositionId;
        e.RequisitoCategoriaId = r.RequisitoCategoriaId;
        e.DataAdmissao = r.DataAdmissao; e.Salario = r.Salario;
        e.TipoContratacao = r.TipoContratacao; e.CargaHorariaSemanal = r.CargaHorariaSemanal;
        e.PisPasep = r.PisPasep?.Trim();

        // Docs avulsos
        e.TituloEleitorNumero = r.TituloEleitorNumero?.Trim();
        e.TituloEleitorZona = r.TituloEleitorZona?.Trim();
        e.TituloEleitorSecao = r.TituloEleitorSecao?.Trim();
        e.ReservistaNumero = r.ReservistaNumero?.Trim();
        e.CategoriaCnh = r.CategoriaCnh?.Trim(); e.ValidadeCnh = r.ValidadeCnh;
        e.Ctps = r.Ctps?.Trim(); e.CtpsSerie = r.CtpsSerie?.Trim(); e.CtpsUf = r.CtpsUf?.Trim();

        e.ValidacaoSalarioJustificativa = r.ValidacaoSalarioJustificativa?.Trim();

        e.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    // ── Submit (Rascunho → EmRevisão) ──

    public async Task<PreAdmissaoDetailResponse?> SubmitAsync(Guid id, CancellationToken ct)
    {
        var e = await _db.Set<Domain.Entities.PreAdmissao>().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return null;
        if (e.Status != PreAdmissaoStatus.Rascunho && e.Status != PreAdmissaoStatus.PreenchimentoPendente)
            throw new InvalidOperationException("Só rascunhos podem ser submetidos.");

        // Run validations
        e.ValidacaoCpfOk = ValidarCpf(e.Cpf);
        e.ValidacaoCepOk = !string.IsNullOrWhiteSpace(e.Cep);
        e.ValidacaoBancoOk = !string.IsNullOrWhiteSpace(e.BancoCodigo) && !string.IsNullOrWhiteSpace(e.Conta);

        // Salary validation
        if (e.Salario.HasValue && e.JobPositionId.HasValue)
        {
            var faixa = await _db.Set<FaixaSalarial>().FirstOrDefaultAsync(
                f => f.JobPositionId == e.JobPositionId && (e.EstabelecimentoCodigo == null || f.EstabelecimentoCodigo == e.EstabelecimentoCodigo), ct);
            e.ValidacaoSalarioOk = faixa is null || (e.Salario.Value >= faixa.SalarioMinimo && e.Salario.Value <= faixa.SalarioMaximo);
        }
        else
        {
            e.ValidacaoSalarioOk = true;
        }

        e.Status = PreAdmissaoStatus.EmRevisao;
        e.SubmittedAtUtc = DateTimeOffset.UtcNow;
        e.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    // ── Approve ──

    public async Task<PreAdmissaoDetailResponse?> ApproveAsync(Guid id, Guid aprovadorId, PreAdmissaoApproveRequest request, CancellationToken ct)
    {
        var e = await _db.Set<Domain.Entities.PreAdmissao>().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return null;
        if (e.Status != PreAdmissaoStatus.EmRevisao)
            throw new InvalidOperationException("Só é possível aprovar pré-admissões em revisão.");

        e.Status = PreAdmissaoStatus.Aprovada;
        e.AprovadoPorId = aprovadorId;
        e.ObservacaoRh = request.Observacao;
        e.ApprovedAtUtc = DateTimeOffset.UtcNow;
        e.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        // ── Auto-create User + Funcionario ──
        await CriarColaboradorAsync(e, ct);

        return await GetByIdAsync(id, ct);
    }

    /// <summary>Creates ApplicationUser + Funcionario from approved PreAdmissão.</summary>
    private async Task CriarColaboradorAsync(Domain.Entities.PreAdmissao pa, CancellationToken ct)
    {
        // Skip if no email
        var email = pa.Email?.Trim();
        if (string.IsNullOrWhiteSpace(email)) return;

        // Check if user already exists
        var existing = await _userManager.FindByEmailAsync(email);
        if (existing is not null) return;

        // Temporary password: first 4 CPF digits + random suffix for uniqueness
        var cpfDigits = (pa.Cpf ?? "").Replace(".", "").Replace("-", "").PadRight(4, '0')[..4];
        var rand = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(6))
            .Replace("+", "A").Replace("/", "B").Replace("=", "C")[..6];
        var tempPassword = $"{cpfDigits}{rand}Rh!";

        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            TenantId = pa.TenantId,
        };
        var result = await _userManager.CreateAsync(user, tempPassword);
        if (!result.Succeeded) return;

        // Create Funcionario
        var func = new Funcionario
        {
            Id = Guid.NewGuid(),
            TenantId = pa.TenantId,
            Name = pa.Nome,
            Email = email,
            Phone = pa.Celular ?? pa.Telefone,
            Status = FuncionarioStatus.Active,
            UserId = user.Id,
            UnitId = pa.UnitId,
            AreaId = pa.AreaId,
            JobPositionId = pa.JobPositionId,
            RequisitoCategoriaId = pa.RequisitoCategoriaId,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        _db.Set<Funcionario>().Add(func);
        await _db.SaveChangesAsync(ct);

        // Notificar o novo colaborador por email
        try
        {
            await _emailQueue.EnqueueRawAsync(
                to: email,
                subject: "Bem-vindo ao RenderRH — seu acesso foi criado",
                bodyHtml: $"""
                    <p>Olá, <strong>{pa.Nome}</strong>!</p>
                    <p>Sua admissão foi aprovada e seu acesso ao sistema foi criado.</p>
                    <p><strong>Senha temporária:</strong> <code>{tempPassword}</code></p>
                    <p>Por segurança, altere sua senha no primeiro acesso.</p>
                    """,
                bodyText: $"Olá {pa.Nome}! Sua admissão foi aprovada. Senha temporária: {tempPassword}. Altere no primeiro acesso.",
                isSystem: true,
                source: "PreAdmissao.CriarColaborador",
                ct: ct);
        }
        catch (Exception ex)
        {
            // Não bloquear o fluxo se o email falhar — só logar
            _logger.LogWarning(ex, "Falha ao enfileirar email de boas-vindas para {Email}", email);
        }
    }

    // ── Reject ──

    public async Task<PreAdmissaoDetailResponse?> RejectAsync(Guid id, PreAdmissaoRejectRequest request, CancellationToken ct)
    {
        var e = await _db.Set<Domain.Entities.PreAdmissao>().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return null;
        if (e.Status != PreAdmissaoStatus.EmRevisao)
            throw new InvalidOperationException("Só é possível rejeitar pré-admissões em revisão.");

        e.Status = PreAdmissaoStatus.Rejeitada;
        e.MotivoRejeicao = request.Motivo;
        e.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    // ── Busca CPF (readmissão) ──

    public async Task<BuscaCpfResponse> BuscarPorCpfAsync(string cpf, CancellationToken ct)
    {
        var cleaned = cpf.Replace(".", "").Replace("-", "").Trim();
        var pessoa = await _db.Set<Pessoa>().AsNoTracking()
            .FirstOrDefaultAsync(p => p.Cpf != null && p.Cpf.Replace(".", "").Replace("-", "") == cleaned, ct);

        if (pessoa is null)
            return new BuscaCpfResponse(false, null, null, null, null, null, null, null, null, null, null, null, null, null, null);

        return new BuscaCpfResponse(
            true, pessoa.Id, pessoa.Nome, pessoa.Email, pessoa.Fone,
            pessoa.Cpf, pessoa.Rg, pessoa.Cep, pessoa.Logradouro, pessoa.Numero,
            pessoa.Complemento, pessoa.Bairro, pessoa.Cidade, pessoa.Uf, pessoa.DataNascimento
        );
    }

    // ── Documentos ──

    public async Task<PreAdmissaoDocumentoResponse> UploadDocumentoAsync(
        Guid preAdmissaoId, TipoDocumento tipo, string nomeArquivo, string contentType, long tamanho, Stream stream, CancellationToken ct)
    {
        var storagePath = $"documentos/pre-admissao/{preAdmissaoId}/{Guid.NewGuid()}{Path.GetExtension(nomeArquivo)}";
        var fullPath = Path.Combine("wwwroot", storagePath);
        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
        using (var fs = File.Create(fullPath))
            await stream.CopyToAsync(fs, ct);

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
        await _db.SaveChangesAsync(ct);
        return new PreAdmissaoDocumentoResponse(doc.Id, doc.Tipo, doc.NomeArquivo, doc.ContentType, doc.TamanhoBytes, doc.Status, null, doc.CreatedAtUtc);
    }

    public async Task<bool> DeleteDocumentoAsync(Guid preAdmissaoId, Guid docId, CancellationToken ct)
    {
        var doc = await _db.Set<PreAdmissaoDocumento>().FirstOrDefaultAsync(d => d.Id == docId && d.PreAdmissaoId == preAdmissaoId, ct);
        if (doc is null) return false;
        var fullPath = Path.Combine("wwwroot", doc.StoragePath);
        if (File.Exists(fullPath)) File.Delete(fullPath);
        _db.Set<PreAdmissaoDocumento>().Remove(doc);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    // ── Helpers ──

    private static bool ValidarCpf(string? cpf)
    {
        if (string.IsNullOrWhiteSpace(cpf)) return false;
        var digits = cpf.Replace(".", "").Replace("-", "").Trim();
        if (digits.Length != 11 || digits.All(c => c == digits[0])) return false;
        int sum = 0;
        for (int i = 0; i < 9; i++) sum += (digits[i] - '0') * (10 - i);
        int rem = sum % 11;
        int d1 = rem < 2 ? 0 : 11 - rem;
        if (digits[9] - '0' != d1) return false;
        sum = 0;
        for (int i = 0; i < 10; i++) sum += (digits[i] - '0') * (11 - i);
        rem = sum % 11;
        int d2 = rem < 2 ? 0 : 11 - rem;
        return digits[10] - '0' == d2;
    }

    private static PreAdmissaoDetailResponse MapDetail(Domain.Entities.PreAdmissao e) => new(
        e.Id, e.Status, e.PreenchidoPor, e.CandidatoId,
        e.RevisadoPor?.Name, e.AprovadoPor?.Name,
        e.ObservacaoRh, e.MotivoRejeicao,
        e.Nome, e.Cpf, e.Rg, e.RgOrgaoExpedidor, e.RgDataExpedicao,
        e.DataNascimento, e.Sexo, e.EstadoCivil, e.Nacionalidade,
        e.NomeMae, e.NomePai, e.NaturalCidade, e.NaturalUf,
        e.Passaporte, e.RnmRne, e.ValidadeVisto, e.TipoVisto,
        e.Cep, e.Logradouro, e.Numero, e.Complemento, e.Bairro, e.Cidade, e.Uf,
        e.Email, e.Telefone, e.Celular, e.ContatoEmergenciaNome, e.ContatoEmergenciaFone,
        e.BancoCodigo, e.BancoNome, e.Agencia, e.AgenciaDigito, e.Conta, e.ContaDigito, e.TipoConta,
        e.EstabelecimentoCodigo, e.MatriculaRM,
        e.UnitId, e.Unit?.Name, e.AreaId, e.Area?.Name,
        e.JobPositionId, e.JobPosition?.Name, e.RequisitoCategoriaId,
        e.DataAdmissao, e.Salario, e.TipoContratacao, e.CargaHorariaSemanal, e.PisPasep,
        e.TituloEleitorNumero, e.TituloEleitorZona, e.TituloEleitorSecao,
        e.ReservistaNumero, e.CategoriaCnh, e.ValidadeCnh, e.Ctps, e.CtpsSerie, e.CtpsUf,
        e.ValidacaoCpfOk, e.ValidacaoCepOk, e.ValidacaoBancoOk, e.ValidacaoSalarioOk, e.ValidacaoSalarioJustificativa,
        e.CreatedAtUtc, e.SubmittedAtUtc, e.ApprovedAtUtc,
        e.Documentos.Select(d => new PreAdmissaoDocumentoResponse(d.Id, d.Tipo, d.NomeArquivo, d.ContentType, d.TamanhoBytes, d.Status, d.ObservacaoRh, d.CreatedAtUtc)).ToList()
    );
}
