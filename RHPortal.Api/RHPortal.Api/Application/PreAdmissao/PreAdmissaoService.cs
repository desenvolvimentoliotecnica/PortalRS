using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RhPortal.Api.Application.IntegracaoTotvs;
using RhPortal.Api.Application.ItaloIntegracao;
using RhPortal.Api.Application.OcupacaoHistorico;
using RhPortal.Api.Contracts.PreAdmissao;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Storage;
using RhPortal.Api.Infrastructure.Tenancy;
using RhPortal.Api.Messaging.Email;

namespace RhPortal.Api.Application.PreAdmissao;

public interface IPreAdmissaoService
{
    Task<IReadOnlyList<PreAdmissaoGridRow>> ListAsync(PreAdmissaoListQuery query, CancellationToken ct);
    Task<PreAdmissaoDetailResponse?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<PreAdmissaoDetailResponse> CreateAsync(PreAdmissaoCreateRequest request, CancellationToken ct);
    Task<PreAdmissaoDetailResponse?> UpdateAsync(Guid id, PreAdmissaoUpdateRequest request, bool isPrivileged, CancellationToken ct);
    Task<PreAdmissaoDetailResponse?> SubmitAsync(Guid id, CancellationToken ct);
    Task<PreAdmissaoDetailResponse?> ApproveAsync(Guid id, Guid aprovadorId, PreAdmissaoApproveRequest request, CancellationToken ct);
    Task<PreAdmissaoDetailResponse?> RejectAsync(Guid id, PreAdmissaoRejectRequest request, CancellationToken ct);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct);
    Task<BuscaCpfResponse> BuscarPorCpfAsync(string cpf, CancellationToken ct);
    Task<PreAdmissaoDocumentoResponse> UploadDocumentoAsync(Guid preAdmissaoId, TipoDocumento tipo, string nomeArquivo, string contentType, long tamanho, Stream stream, CancellationToken ct);
    Task<bool> DeleteDocumentoAsync(Guid preAdmissaoId, Guid docId, CancellationToken ct);
    Task<IReadOnlyList<DocumentoSolicitadoResponse>> SalvarDocumentosSolicitadosAsync(Guid preAdmissaoId, SalvarDocumentosSolicitadosRequest request, CancellationToken ct);
    Task<GerarLinkResponse?> GerarLinkAsync(Guid preAdmissaoId, GerarLinkRequest request, CancellationToken ct);
    Task<ValidarDocumentoResponse?> ValidarDocumentoAsync(Guid preAdmissaoId, Guid docId, ValidarDocumentoRequest request, CancellationToken ct);
    Task<IReadOnlyList<PreAdmissaoPendenteIntegracaoRow>> ListPendentesIntegracaoAsync(CancellationToken ct);
    Task<IReadOnlyList<PreAdmissaoPainelIntegracaoRow>> ListPainelIntegracaoAsync(IntegracaoResultado? filtro, CancellationToken ct);
    Task<(PreAdmissaoDetailResponse? Result, string? Error)> RegistrarResultadoIntegracaoAsync(Guid id, IntegracaoResultadoRequest request, CancellationToken ct);
    Task<IReadOnlyList<OwnerPainelIntegracaoRow>> OwnerListPainelIntegracaoAsync(string? tenantId, IntegracaoResultado? filtro, CancellationToken ct);

    /// <summary>
    /// Gestor aprova contratação — cria pré-admissão com status PreenchimentoPendente
    /// e notifica o Ítalo para iniciar coleta de documentos via WhatsApp.
    /// </summary>
    Task<PreAdmissaoDetailResponse> AprovarContratacaoAsync(AprovarContratacaoRequest request, CancellationToken ct);

    /// <summary>
    /// Webhook do Ítalo — recebe dados OCR de um documento processado e persiste
    /// no registro de pré-admissão. Avança para EmRevisão quando RG + Comprovante chegam.
    /// </summary>
    Task<PreAdmissaoDetailResponse?> ReceberDocumentosExternosAsync(Guid id, DocumentoExternoRequest request, CancellationToken ct);

    /// <summary>
    /// RH inicia admissão manual a partir de um candidato aprovado no recrutamento.
    /// Cria pré-admissão em Rascunho pré-preenchida com os dados básicos do candidato.
    /// </summary>
    Task<PreAdmissaoDetailResponse> IniciarManualAsync(IniciarManualRequest request, CancellationToken ct);

    /// <summary>
    /// Chamado pelo webhook do TOTVS quando a admissão é confirmada (Sucesso).
    /// Cria o Funcionario a partir dos dados da PreAdmissão e marca FuncionarioIdMaterializado.
    /// É idempotente: chamadas repetidas são no-op.
    /// </summary>
    Task MaterializarFuncionarioAsync(Guid preAdmissaoId, string? cdnFuncionario, CancellationToken ct);

    /// <summary>
    /// RH efetiva a admissão aprovada — move para EmIntegracao (aguardando TOTVS).
    /// Análogo ao EfetivarAsync de SolicitacaoDesligamento.
    /// </summary>
    Task<PreAdmissaoDetailResponse?> EfetivarAsync(Guid id, CancellationToken ct);
}

public sealed class PreAdmissaoService : IPreAdmissaoService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenantContext;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IEmailQueueService _emailQueue;
    private readonly IItaloIntegrationService _italoService;
    private readonly IS3StorageService _storage;
    private readonly ILogger<PreAdmissaoService> _logger;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly IOcupacaoHistoricoService _ocupacaoService;

    public PreAdmissaoService(
        AppDbContext db,
        ITenantContext tenantContext,
        UserManager<ApplicationUser> userManager,
        IEmailQueueService emailQueue,
        IItaloIntegrationService italoService,
        IS3StorageService storage,
        ILogger<PreAdmissaoService> logger,
        IHttpContextAccessor httpContextAccessor,
        IOcupacaoHistoricoService ocupacaoService)
    {
        _db = db;
        _tenantContext = tenantContext;
        _userManager = userManager;
        _emailQueue = emailQueue;
        _italoService = italoService;
        _httpContextAccessor = httpContextAccessor;
        _storage = storage;
        _logger = logger;
        _ocupacaoService = ocupacaoService;
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
            x.Status, x.DataAdmissao, x.Salario, x.PreenchidoPor, x.CreatedAtUtc,
            x.DocumentosSolicitados.Count(),
            x.DocumentosSolicitados.Count() - x.Documentos.Select(d => d.Tipo).Distinct().Count(),
            x.Documentos.Select(d => d.Tipo).Distinct().Count(),
            x.Documentos.Count(d => d.Status == StatusDocumento.Rejeitado),
            x.WizardCurrentStep,
            x.WizardCompletionPercent,
            x.LastActivityUtc,
            x.IntegracaoResultado,
            x.IntegracaoMensagem
        )).ToListAsync(ct);
    }

    // ── Get ──

    public async Task<PreAdmissaoDetailResponse?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var e = await _db.Set<Domain.Entities.PreAdmissao>().AsNoTracking()
            .Include(x => x.Unit).Include(x => x.Area).Include(x => x.JobPosition)
            .Include(x => x.RevisadoPor).Include(x => x.AprovadoPor)
            .Include(x => x.Documentos)
            .Include(x => x.DocumentosSolicitados)
            .Include(x => x.Dependentes)
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

        // Aplica defaults obrigatórios do TOTVS/Datasul (país=BRA, optanteFGTS=S, etc).
        // Evita que o RH precise preencher valores-padrão manualmente e falhar na integração.
        await PreAdmissaoDefaultsSeeder.ApplyAsync(entity, _db, _tenantContext.TenantId!, ct);

        _db.Set<Domain.Entities.PreAdmissao>().Add(entity);
        await _db.SaveChangesAsync(ct);
        return (await GetByIdAsync(entity.Id, ct))!;
    }

    // ── Update ──

    public async Task<PreAdmissaoDetailResponse?> UpdateAsync(Guid id, PreAdmissaoUpdateRequest r, bool isPrivileged, CancellationToken ct)
    {
        var e = await _db.Set<Domain.Entities.PreAdmissao>().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return null;

        var isDraft = e.Status == PreAdmissaoStatus.Rascunho || e.Status == PreAdmissaoStatus.Enviado;
        var isPostFill = e.Status is PreAdmissaoStatus.Acessado or PreAdmissaoStatus.PreenchidoParcial or PreAdmissaoStatus.Preenchido;
        // RH pode re-editar quando a integração TOTVS falhou (permite corrigir e reenviar).
        // Status fica em EmIntegracao + IntegracaoResultado=Falha — ex: "iDocMilitarTipo < 1" retornado pelo Datasul.
        var isIntegracaoFalha = e.Status == PreAdmissaoStatus.EmIntegracao
                               && (e.IntegracaoResultado == IntegracaoResultado.Falha
                                   || e.IntegracaoResultado == IntegracaoResultado.FalhaDefinitiva);

        if (!isDraft && !(isPostFill && isPrivileged) && !(isIntegracaoFalha && isPrivileged))
            throw new InvalidOperationException("Não é possível editar uma admissão neste status.");

        // Pessoal
        e.Nome = r.Nome.Trim();
        e.NomeSocial = r.NomeSocial?.Trim(); e.NomeAbreviado = r.NomeAbreviado?.Trim();
        // CPF é sempre persistido só com dígitos — qualquer máscara vinda da UI é removida aqui.
        e.Cpf = TotvsPayloadHelper.OnlyDigits(r.Cpf?.Trim()); e.Rg = r.Rg?.Trim(); e.RgOrgaoExpedidor = r.RgOrgaoExpedidor?.Trim();
        e.RgUfExpedidor = r.RgUfExpedidor?.Trim();
        e.RgDataExpedicao = r.RgDataExpedicao; e.DataNascimento = r.DataNascimento;
        e.Sexo = r.Sexo ?? Sexo.NaoInformado; e.EstadoCivil = r.EstadoCivil ?? EstadoCivil.NaoInformado;
        e.Nacionalidade = r.Nacionalidade?.Trim(); e.PaisNacionalidade = r.PaisNacionalidade?.Trim();
        e.NomeMae = r.NomeMae?.Trim(); e.NomePai = r.NomePai?.Trim();
        e.NaturalCidade = r.NaturalCidade?.Trim(); e.NaturalUf = r.NaturalUf?.Trim();
        e.PaisNascimento = r.PaisNascimento?.Trim();

        // Estrangeiro
        e.Passaporte = r.Passaporte?.Trim(); e.RnmRne = r.RnmRne?.Trim();
        e.ValidadeVisto = r.ValidadeVisto; e.TipoVisto = r.TipoVisto?.Trim();
        e.ResideExterior = r.ResideExterior?.Trim(); e.TipoVistoEstrangeiro = r.TipoVistoEstrangeiro;

        // RIC (Registro Identidade Civil)
        e.RegIdentidCivilNumero = r.RegIdentidCivilNumero?.Trim();
        e.RegIdentidCivilUf = r.RegIdentidCivilUf?.Trim();
        e.RegIdentidCivilCidade = r.RegIdentidCivilCidade?.Trim();
        e.RegIdentidCivilOrgEmiss = r.RegIdentidCivilOrgEmiss?.Trim();
        e.RegIdentidCivilDataExped = r.RegIdentidCivilDataExped;

        // Endereço — CEP só dígitos
        e.Cep = TotvsPayloadHelper.OnlyDigits(r.Cep?.Trim()); e.Logradouro = r.Logradouro?.Trim(); e.Numero = r.Numero?.Trim();
        e.Complemento = r.Complemento?.Trim(); e.Bairro = r.Bairro?.Trim();
        e.Cidade = r.Cidade?.Trim(); e.Uf = r.Uf?.Trim();
        e.PontoReferencia = r.PontoReferencia?.Trim();
        e.TipoLogradouroESocial = r.TipoLogradouroESocial?.Trim();
        e.MunicipioEnderecoIbge = r.MunicipioEnderecoIbge;

        // Contato
        e.Email = r.Email?.Trim(); e.EmailAlternativo = r.EmailAlternativo?.Trim();
        e.Telefone = r.Telefone?.Trim(); e.Celular = r.Celular?.Trim();
        e.DddTelefone = r.DddTelefone; e.DddTelContato = r.DddTelContato;
        e.ContatoEmergenciaNome = r.ContatoEmergenciaNome?.Trim(); e.ContatoEmergenciaFone = r.ContatoEmergenciaFone?.Trim();

        // Bancário
        e.BancoCodigo = r.BancoCodigo?.Trim(); e.BancoNome = r.BancoNome?.Trim();
        e.Agencia = r.Agencia?.Trim(); e.AgenciaDigito = r.AgenciaDigito?.Trim();
        e.Conta = r.Conta?.Trim(); e.ContaDigito = r.ContaDigito?.Trim(); e.TipoConta = r.TipoConta;

        // Trabalhista
        e.EstabelecimentoCodigo = r.EstabelecimentoCodigo?.Trim(); e.CodEmpresa = r.CodEmpresa?.Trim();
        e.UnitId = r.UnitId; e.AreaId = r.AreaId; e.JobPositionId = r.JobPositionId;
        e.RequisitoCategoriaId = r.RequisitoCategoriaId;
        e.DataAdmissao = r.DataAdmissao; e.Salario = r.Salario;
        e.TipoContratacao = r.TipoContratacao; e.CargaHorariaSemanal = r.CargaHorariaSemanal;
        // PIS/PASEP só dígitos — TOTVS recusa máscara.
        e.PisPasep = TotvsPayloadHelper.OnlyDigits(r.PisPasep?.Trim());

        // TOTVS: Cargo/Vinculo
        e.CodCargoTotvs = r.CodCargoTotvs; e.CodVinculoEmpregaticio = r.CodVinculoEmpregaticio;
        e.TipoFuncionario = r.TipoFuncionario; e.CategoriaSalarial = r.CategoriaSalarial;
        e.GrauInstrucao = r.GrauInstrucao; e.CodTurno = r.CodTurno;
        e.CentroCusto = r.CentroCusto?.Trim(); e.UnidadeLotacao = r.UnidadeLotacao?.Trim();
        e.CodPlanoLotacao = r.CodPlanoLotacao; e.CodTurma = r.CodTurma;
        e.NumCartaoPonto = r.NumCartaoPonto; e.CodNivel = r.CodNivel;
        e.TipoMaoDeObra = r.TipoMaoDeObra?.Trim(); e.FormaPagamento = r.FormaPagamento;
        e.SalarioSimulado = r.SalarioSimulado;
        e.OrigemFuncionario = r.OrigemFuncionario; e.IndFuncVinculado = r.IndFuncVinculado;
        e.FuncQualificado = r.FuncQualificado?.Trim();

        // FGTS/INSS
        e.OptanteFgts = r.OptanteFgts?.Trim(); e.DataOpcaoFgts = r.DataOpcaoFgts;
        e.TipoAdmissaoFgts = r.TipoAdmissaoFgts;
        e.RecolheFgts = r.RecolheFgts?.Trim(); e.RecolheInss = r.RecolheInss?.Trim();

        // Sindicato
        e.Sindicalizado = r.Sindicalizado?.Trim(); e.DescContribSindical = r.DescContribSindical?.Trim();
        e.ContribSindicDia = r.ContribSindicDia?.Trim(); e.CodSindicato = r.CodSindicato;

        // Flags calculo
        e.CargaAutomTurno = r.CargaAutomTurno?.Trim(); e.RecebePericul = r.RecebePericul?.Trim();
        e.RecebeInsalub = r.RecebeInsalub?.Trim(); e.RecebeAdiantamento = r.RecebeAdiantamento?.Trim();
        e.ConsidEmissRAIS = r.ConsidEmissRAIS?.Trim(); e.Calcula13 = r.Calcula13?.Trim();
        e.RecebeFerias = r.RecebeFerias?.Trim();

        // Provisoes 13
        e.Avos13SalCalcAnterior = r.Avos13SalCalcAnterior; e.Avos13SalCalc = r.Avos13SalCalc;
        e.ProvAcum13Sal = r.ProvAcum13Sal; e.ProvAcumInss13Sal = r.ProvAcumInss13Sal;
        e.ProvAcumFgts13Sal = r.ProvAcumFgts13Sal;

        // Provisoes Ferias
        e.DiasProvFeriasMesAnterior = r.DiasProvFeriasMesAnterior; e.DiasProvFeriasMesAtual = r.DiasProvFeriasMesAtual;
        e.ProvAcumFerias = r.ProvAcumFerias; e.ProvAcumInssFerias = r.ProvAcumInssFerias;
        e.ProvAcumFgtsFerias = r.ProvAcumFgtsFerias; e.ProvAcumFerias13 = r.ProvAcumFerias13;

        // Ponto
        e.EmitCartPonto = r.EmitCartPonto?.Trim(); e.CodLocalMarcacao = r.CodLocalMarcacao;
        e.CodClassFuncPontoEletronico = r.CodClassFuncPontoEletronico;

        // Docs avulsos
        e.TituloEleitorNumero = r.TituloEleitorNumero?.Trim();
        e.TituloEleitorZona = r.TituloEleitorZona?.Trim();
        e.TituloEleitorSecao = r.TituloEleitorSecao?.Trim();
        e.TituloEleitorCidade = r.TituloEleitorCidade?.Trim();
        e.TituloEleitorUf = r.TituloEleitorUf?.Trim();
        e.ReservistaNumero = r.ReservistaNumero?.Trim();
        e.CategoriaCnh = r.CategoriaCnh?.Trim(); e.ValidadeCnh = r.ValidadeCnh;
        e.Ctps = r.Ctps?.Trim(); e.CtpsSerie = r.CtpsSerie?.Trim(); e.CtpsUf = r.CtpsUf?.Trim();
        e.CtpsModelo = r.CtpsModelo; e.CtpsSerieESocial = r.CtpsSerieESocial?.Trim();

        // CNH completo
        e.CnhNumero = r.CnhNumero?.Trim(); e.CnhUf = r.CnhUf?.Trim();
        e.CnhOrgaoEmissor = r.CnhOrgaoEmissor?.Trim();
        e.CnhDataExpedicao = r.CnhDataExpedicao; e.CnhPrimeiraHabilitacao = r.CnhPrimeiraHabilitacao;

        // Doc Militar
        e.DocMilitarTipo = r.DocMilitarTipo; e.DocMilitarNumero = r.DocMilitarNumero?.Trim();
        e.DocMilitarSerie = r.DocMilitarSerie?.Trim(); e.DocMilitarRegiao = r.DocMilitarRegiao;
        e.DocMilitarCircunscricao = r.DocMilitarCircunscricao;

        // Saude
        e.GrupoSanguineo = r.GrupoSanguineo; e.FatorRh = r.FatorRh;
        e.PossuiDeficiencia = r.PossuiDeficiencia?.Trim(); e.FuncDoador = r.FuncDoador?.Trim();
        e.CartaoSus = r.CartaoSus?.Trim(); e.Altura = r.Altura; e.Peso = r.Peso;
        e.Cutis = r.Cutis; e.Cabelo = r.Cabelo; e.Olhos = r.Olhos;
        e.Manequim = r.Manequim; e.Sapato = r.Sapato;

        // Contrato
        e.DataTerminoContrato = r.DataTerminoContrato;

        // Localidade
        e.PaisLocalidade = r.PaisLocalidade?.Trim(); e.CodLocalidade = r.CodLocalidade; e.CodFpas = r.CodFpas;

        // eSocial
        e.CategoriaTrabalhoESocial = r.CategoriaTrabalhoESocial; e.IndAdmissao = r.IndAdmissao;
        e.NaturezaAtividade = r.NaturezaAtividade; e.MunicipioNascimentoIbge = r.MunicipioNascimentoIbge;
        e.TipoAdmissaoESocial = r.TipoAdmissaoESocial;
        e.RegimeTrabalhista = r.RegimeTrabalhista; e.RegimePrevidenciario = r.RegimePrevidenciario;
        e.RegimeJornada = r.RegimeJornada; e.MatriculaESocial = r.MatriculaESocial?.Trim();

        // CAGED
        e.OcorrenciaCAGED = r.OcorrenciaCAGED;

        // Estatística
        e.TipoEstatistica = r.TipoEstatistica;

        // Registro exterior
        e.CodRegistroExterior = r.CodRegistroExterior?.Trim();

        e.ValidacaoSalarioJustificativa = r.ValidacaoSalarioJustificativa?.Trim();

        // Edit em Aprovada+Falha: limpa estado de integração TOTVS para que o worker
        // (ou um Retry manual) reintegre com os dados corrigidos.
        if (isIntegracaoFalha)
        {
            e.IntegracaoResultado = null;
            e.IntegracaoMensagem = null;
            e.IntegradaEmUtc = null;
            e.TentativasIntegracao = 0;
            e.UltimaTentativaUtc = null;
        }

        e.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    // ── Submit (Rascunho → EmRevisão) ──

    public async Task<PreAdmissaoDetailResponse?> SubmitAsync(Guid id, CancellationToken ct)
    {
        var e = await _db.Set<Domain.Entities.PreAdmissao>().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return null;
        var submissíveis = new[]
        {
            PreAdmissaoStatus.Rascunho,
            PreAdmissaoStatus.Enviado,
            PreAdmissaoStatus.Acessado,
            PreAdmissaoStatus.PreenchidoParcial,
            PreAdmissaoStatus.Preenchido,
        };
        if (!submissíveis.Contains(e.Status))
            throw new InvalidOperationException("Não é possível submeter uma admissão neste status.");

        // Re-aplica defaults TOTVS — garante que pré-admissões criadas antes do
        // seeder (ou com IniciarManualAsync reusando registro antigo) tenham
        // codEmpresa, flags S/N, país BRA, etc. Seeder só preenche se o campo
        // ainda está null, então não sobrescreve valores do RH.
        await PreAdmissaoDefaultsSeeder.ApplyAsync(e, _db, _tenantContext.TenantId!, ct);

        // Run validations
        e.ValidacaoCpfOk = ValidarCpf(e.Cpf);
        e.ValidacaoCepOk = !string.IsNullOrWhiteSpace(e.Cep);
        e.ValidacaoBancoOk = !string.IsNullOrWhiteSpace(e.BancoCodigo) && !string.IsNullOrWhiteSpace(e.Conta);

        // Validação de salário: só marca como inválido quando ultrapassa o TETO da faixa
        // (salário abaixo do mínimo é ok — não exige justificativa). Quando acima do máximo,
        // exige que RH preencha `ValidacaoSalarioJustificativa` pra explicar.
        if (e.Salario.HasValue && e.JobPositionId.HasValue)
        {
            var faixa = await _db.Set<FaixaSalarial>().FirstOrDefaultAsync(
                f => f.JobPositionId == e.JobPositionId && (e.EstabelecimentoCodigo == null || f.EstabelecimentoCodigo == e.EstabelecimentoCodigo), ct);
            e.ValidacaoSalarioOk = faixa is null || e.Salario.Value <= faixa.SalarioMaximo;
        }
        else
        {
            e.ValidacaoSalarioOk = true;
        }

        e.Status = PreAdmissaoStatus.Preenchido;
        e.SubmittedAtUtc = DateTimeOffset.UtcNow;
        e.UpdatedAtUtc = DateTimeOffset.UtcNow;

        // Auto-aprovar: se os campos obrigatórios do TOTVS estiverem todos preenchidos,
        // já avança direto para Aprovada (Pendente TOTVS), sem exigir ação manual do RH.
        // Se a validação falhar, mantém Preenchido e relança os erros para o chamador.
        var issues = PreAdmissaoTotvsValidator.Validate(e);
        if (issues.Count == 0)
        {
            e.Status = PreAdmissaoStatus.Aprovada;
            e.ApprovedAtUtc = DateTimeOffset.UtcNow;
        }

        await _db.SaveChangesAsync(ct);

        if (issues.Count > 0)
            throw new TotvsValidationException(issues);

        // Se auto-aprovou, criar acesso ao portal (mesmo fluxo de ApproveAsync).
        if (e.Status == PreAdmissaoStatus.Aprovada)
        {
            try
            {
                await CriarUsuarioAsync(e, ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha ao criar usuário automaticamente para PreAdmissão {Id}. A auto-aprovação foi concluída, mas o acesso ao portal precisa ser criado manualmente.", id);
            }
        }

        return await GetByIdAsync(id, ct);
    }

    // ── Approve ──

    public async Task<PreAdmissaoDetailResponse?> ApproveAsync(Guid id, Guid aprovadorId, PreAdmissaoApproveRequest request, CancellationToken ct)
    {
        var e = await _db.Set<Domain.Entities.PreAdmissao>().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return null;
        if (e.Status != PreAdmissaoStatus.Preenchido)
            throw new InvalidOperationException("Só é possível aprovar pré-admissões em revisão.");

        // ── Auto-fill cargo TOTVS a partir do JobPosition (mesma lógica do DefaultsSeeder) ──
        // ApproveAsync não chama o seeder, então garante aqui antes da validação.
        await PreAdmissaoDefaultsSeeder.ApplyAsync(e, _db, _tenantContext.TenantId!, ct);

        // ── Validação TOTVS: garante que todos os campos obrigatórios/condicionais
        //    estão preenchidos antes de concluir a admissão.
        var issues = PreAdmissaoTotvsValidator.Validate(e);
        if (issues.Count > 0)
            throw new TotvsValidationException(issues);

        e.Status = PreAdmissaoStatus.Aprovada;
        // Só setar AprovadoPorId se é um FuncionarioId válido (existe na tabela Funcionarios)
        if (aprovadorId != Guid.Empty)
        {
            var funcExists = await _db.Set<Funcionario>().AnyAsync(f => f.Id == aprovadorId, ct);
            if (funcExists) e.AprovadoPorId = aprovadorId;
        }
        e.ObservacaoRh = request.Observacao;
        e.ApprovedAtUtc = DateTimeOffset.UtcNow;
        e.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        // ── Auto-create ApplicationUser (candidato precisa acessar o portal enquanto aguarda TOTVS) ──
        // O Funcionario é criado DEPOIS, quando o TOTVS confirma a integração via webhook (MaterializarFuncionarioAsync).
        try
        {
            await CriarUsuarioAsync(e, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao criar usuário automaticamente para PreAdmissão {Id}. A aprovação foi concluída, mas o acesso ao portal precisa ser criado manualmente.", id);
        }

        return await GetByIdAsync(id, ct);
    }

    /// <summary>
    /// Cria o ApplicationUser para o candidato aprovado.
    /// Chamado em ApproveAsync para dar acesso imediato ao portal.
    /// O Funcionario só é criado após TOTVS confirmar (MaterializarFuncionarioAsync).
    /// </summary>
    private async Task CriarUsuarioAsync(Domain.Entities.PreAdmissao pa, CancellationToken ct)
    {
        var email = pa.Email?.Trim();
        if (string.IsNullOrWhiteSpace(email)) return;

        var existing = await _userManager.FindByEmailAsync(email);
        if (existing is not null) return;

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
                    <p>Seu cadastro completo no sistema será finalizado após confirmação da integração com o ERP.</p>
                    """,
                bodyText: $"Olá {pa.Nome}! Sua admissão foi aprovada. Senha temporária: {tempPassword}. Altere no primeiro acesso.",
                isSystem: true,
                source: "PreAdmissao.CriarUsuario",
                ct: ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao enfileirar email de boas-vindas para {Email}", email);
        }
    }

    /// <summary>
    /// Materializa o Funcionario a partir da PreAdmissão após TOTVS confirmar a integração.
    /// É idempotente: se FuncionarioIdMaterializado já estiver preenchido, retorna sem fazer nada.
    /// </summary>
    public async Task MaterializarFuncionarioAsync(Guid preAdmissaoId, string? cdnFuncionario, CancellationToken ct)
    {
        var pa = await _db.Set<Domain.Entities.PreAdmissao>()
            .Include(x => x.Dependentes)
            .FirstOrDefaultAsync(x => x.Id == preAdmissaoId, ct);
        if (pa is null) return;

        // Idempotência
        if (pa.FuncionarioIdMaterializado.HasValue) return;

        // Encontrar ApplicationUser criado na aprovação (pelo email)
        Guid? userId = null;
        var email = pa.Email?.Trim();
        if (!string.IsNullOrWhiteSpace(email))
        {
            var user = await _userManager.FindByEmailAsync(email);
            userId = user?.Id;
        }

        var func = new Funcionario
        {
            Id = Guid.NewGuid(),
            TenantId = pa.TenantId,
            Name = pa.Nome,
            Email = email,
            Phone = pa.Celular ?? pa.Telefone,
            Status = FuncionarioStatus.Active,
            // Headcount = 1: representa uma posição ocupada — valor padrão para funcionário
            // ativo. Sem isso (0), o Funcionario fica invisível em relatórios de headcount
            // e bloqueia fluxos posteriores (ex: solicitação de desligamento que espera
            // ocupação > 0).
            Headcount = 1,
            UserId = userId,
            UnitId = pa.UnitId,
            AreaId = pa.AreaId,
            JobPositionId = pa.JobPositionId,
            RequisitoCategoriaId = pa.RequisitoCategoriaId,
            CdnFuncionario = cdnFuncionario,
            CdnEmpresa = pa.CodEmpresa,
            CdnEstab = pa.EstabelecimentoCodigo,
            DataAdmissao = pa.DataAdmissao,
            DataNascimento = pa.DataNascimento,
            Sexo = pa.Sexo == Sexo.Masculino ? "M" : pa.Sexo == Sexo.Feminino ? "F" : null,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        _db.Set<Funcionario>().Add(func);

        foreach (var pd in pa.Dependentes)
        {
            _db.Set<Dependente>().Add(new Dependente
            {
                Id = Guid.NewGuid(),
                TenantId = pa.TenantId,
                FuncionarioId = func.Id,
                NomeCompleto = pd.NomeCompleto,
                Parentesco = pd.Parentesco,
                Cpf = pd.Cpf,
                DataNascimento = pd.DataNascimento,
                IsPcd = pd.IsPcd,
                CreatedAtUtc = DateTimeOffset.UtcNow,
                UpdatedAtUtc = DateTimeOffset.UtcNow,
            });
        }

        pa.FuncionarioIdMaterializado = func.Id;
        // Persiste o código TOTVS na PreAdmissão — é o MatriculaRM exibido na UI
        // e no JSON exportado pelo botão "Exportar JSON" (IntegracaoTotvsService.GetDetalheAsync).
        if (!string.IsNullOrWhiteSpace(cdnFuncionario))
            pa.MatriculaRM = cdnFuncionario;
        pa.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);

        if (pa.VagaId.HasValue)
        {
            var dataEntrada = pa.DataAdmissao?.ToDateTime(TimeOnly.MinValue) ?? DateTime.UtcNow;
            await _ocupacaoService.AbrirOcupacaoAsync(func.Id, pa.VagaId.Value, dataEntrada, null, ct);
        }

        _logger.LogInformation(
            "Funcionário materializado para PreAdmissão {PreAdmissaoId}: FuncionarioId={FuncionarioId}, CdnFuncionario={CdnFuncionario}",
            preAdmissaoId, func.Id, cdnFuncionario);
    }

    // ── Efetivar (Aprovada → EmIntegracao) ──

    public async Task<PreAdmissaoDetailResponse?> EfetivarAsync(Guid id, CancellationToken ct)
    {
        var e = await _db.Set<Domain.Entities.PreAdmissao>()
            .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == _tenantContext.TenantId, ct);
        if (e is null) return null;

        if (e.Status != PreAdmissaoStatus.Aprovada)
            throw new InvalidOperationException("Apenas admissões com status 'Aprovada' podem ser efetivadas.");

        e.Status = PreAdmissaoStatus.EmIntegracao;
        e.UpdatedAtUtc = DateTimeOffset.UtcNow;

        // Amarração: se a pré-admissão veio de um Candidato com VagaId, marca a SolicitacaoVaga
        // correspondente como tendo esse candidato contratado. Suporta o cenário "saiu um analista,
        // entrou outro analista" — a vaga original fica vinculada ao novo contratado.
        if (e.CandidatoId.HasValue)
        {
            var cand = await _db.Set<Candidato>().FirstOrDefaultAsync(c => c.Id == e.CandidatoId.Value, ct);
            if (cand is not null && cand.VagaId.HasValue)
            {
                var solVaga = await _db.SolicitacoesVaga
                    .Where(s => s.VagaId == cand.VagaId.Value && !s.CandidatoContratadoId.HasValue)
                    .OrderByDescending(s => s.ApprovedAtUtc ?? s.CreatedAtUtc)
                    .FirstOrDefaultAsync(ct);
                if (solVaga is not null)
                {
                    solVaga.CandidatoContratadoId = cand.Id;
                    solVaga.UpdatedAtUtc = DateTimeOffset.UtcNow;
                }
            }
        }

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    // ── Reject ──

    public async Task<PreAdmissaoDetailResponse?> RejectAsync(Guid id, PreAdmissaoRejectRequest request, CancellationToken ct)
    {
        var e = await _db.Set<Domain.Entities.PreAdmissao>().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return null;

        PreAdmissaoStatus[] terminais = [PreAdmissaoStatus.Aprovada, PreAdmissaoStatus.EmIntegracao, PreAdmissaoStatus.Integrada, PreAdmissaoStatus.Rejeitada];
        if (terminais.Contains(e.Status))
            throw new InvalidOperationException($"Não é possível cancelar uma admissão com status '{e.Status}'.");

        e.Status = PreAdmissaoStatus.Rejeitada;
        e.MotivoRejeicao = request.Motivo;
        e.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    // ── Delete ──

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var e = await _db.Set<Domain.Entities.PreAdmissao>()
            .Include(x => x.Documentos)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return false;

        PreAdmissaoStatus[] terminaisNaoDeletaveis = [PreAdmissaoStatus.Integrada];
        if (terminaisNaoDeletaveis.Contains(e.Status))
            throw new InvalidOperationException("Não é possível excluir uma admissão já integrada ao TOTVS.");

        foreach (var doc in e.Documentos)
        {
            try { await _storage.DeleteAsync(doc.StoragePath, ct); }
            catch { /* best-effort */ }
        }

        _db.Set<Domain.Entities.PreAdmissao>().Remove(e);
        await _db.SaveChangesAsync(ct);
        return true;
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
        var pa = await _db.Set<Domain.Entities.PreAdmissao>().AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == preAdmissaoId, ct)
            ?? throw new InvalidOperationException("Pré-admissão não encontrada.");
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
        await _db.SaveChangesAsync(ct);
        return new PreAdmissaoDocumentoResponse(doc.Id, doc.Tipo, doc.Lado, doc.NomeArquivo, doc.ContentType, doc.TamanhoBytes, doc.Status, null, doc.CreatedAtUtc, _storage.GetPresignedUrl(doc.StoragePath));
    }

    public async Task<bool> DeleteDocumentoAsync(Guid preAdmissaoId, Guid docId, CancellationToken ct)
    {
        var doc = await _db.Set<PreAdmissaoDocumento>().FirstOrDefaultAsync(d => d.Id == docId && d.PreAdmissaoId == preAdmissaoId, ct);
        if (doc is null) return false;
        await _storage.DeleteAsync(doc.StoragePath, ct);
        _db.Set<PreAdmissaoDocumento>().Remove(doc);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    // ── Solicitação de documentos / link / validação ──

    public async Task<IReadOnlyList<DocumentoSolicitadoResponse>> SalvarDocumentosSolicitadosAsync(
        Guid preAdmissaoId, SalvarDocumentosSolicitadosRequest request, CancellationToken ct)
    {
        var pa = await _db.Set<Domain.Entities.PreAdmissao>()
            .Include(x => x.DocumentosSolicitados)
            .FirstOrDefaultAsync(x => x.Id == preAdmissaoId, ct)
            ?? throw new InvalidOperationException("Pré-admissão não encontrada.");

        if (pa.Status != PreAdmissaoStatus.Enviado && pa.Status != PreAdmissaoStatus.Rascunho)
            throw new InvalidOperationException("Só é possível configurar documentos quando status é Rascunho ou Preenchimento Pendente.");

        _db.Set<PreAdmissaoDocumentoSolicitado>().RemoveRange(pa.DocumentosSolicitados);

        var novos = request.Documentos.Select(d => new PreAdmissaoDocumentoSolicitado
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            PreAdmissaoId = preAdmissaoId,
            TipoDocumento = d.TipoDocumento,
            Obrigatorio = d.Obrigatorio,
            CreatedAtUtc = DateTimeOffset.UtcNow,
        }).ToList();

        _db.Set<PreAdmissaoDocumentoSolicitado>().AddRange(novos);
        await _db.SaveChangesAsync(ct);

        return novos.Select(d => new DocumentoSolicitadoResponse(d.TipoDocumento, TipoDocumentoLabel(d.TipoDocumento), d.Obrigatorio)).ToList();
    }

    public async Task<GerarLinkResponse?> GerarLinkAsync(Guid preAdmissaoId, GerarLinkRequest request, CancellationToken ct)
    {
        var pa = await _db.Set<Domain.Entities.PreAdmissao>()
            .FirstOrDefaultAsync(x => x.Id == preAdmissaoId, ct);
        if (pa is null) return null;

        // Permite gerar/reenviar link em qualquer status exceto já integrado/aprovado
        if (pa.Status == PreAdmissaoStatus.Integrada)
            throw new InvalidOperationException("Admissão já integrada. Não é possível reenviar o link.");

        pa.Cpf = string.IsNullOrWhiteSpace(request.Cpf) ? null : NormalizeCpf(request.Cpf);
        pa.AccessToken ??= Guid.NewGuid().ToString("N");
        pa.Status = PreAdmissaoStatus.Enviado;
        pa.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        // Construir URL pública — usa o host do request mas porta 3000 (Next.js)
        var httpCtx = _httpContextAccessor?.HttpContext;
        var scheme = httpCtx?.Request.Scheme ?? "http";
        var host = httpCtx?.Request.Host.Host ?? "localhost";
        var url = $"{scheme}://{host}:3000/app/DocumentoAdmissao?tenantId={_tenantContext.TenantId}&preAdmissaoId={pa.Id}";

        // Enviar email ao candidato
        var emailEnviado = false;
        if (!string.IsNullOrWhiteSpace(pa.Email))
        {
            var tokens = new Dictionary<string, string?>
            {
                ["nome"] = pa.Nome,
                ["url"] = url,
                ["empresa"] = _tenantContext.TenantId,
            };

            // Try to use configurable template from DB
            var template = await _db.EmailTemplates.AsNoTracking()
                .FirstOrDefaultAsync(t => t.Name == "PreAdmissaoLink" && t.IsActive, ct);

            string subject;
            string body;
            if (template is not null)
            {
                subject = Messaging.Email.EmailTemplateRenderer.Render(template.SubjectTemplate, tokens);
                body = Messaging.Email.EmailTemplateRenderer.Render(template.BodyHtml, tokens);
            }
            else
            {
                // Fallback inline
                subject = "Preencha seus dados para admissão";
                body = $@"<p>Olá <b>{pa.Nome}</b>,</p>
<p>Você foi aprovado(a) e precisa preencher seus dados para admissão.</p>
<p><a href=""{url}"" style=""background:#2563eb;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;display:inline-block;"">Preencher meus dados</a></p>
<p>Ou copie e cole este link no navegador:<br/><small>{url}</small></p>
<p>Atenciosamente,<br/>Equipe RH</p>";
            }

            try
            {
                await _emailQueue.EnqueueRawAsync(pa.Email, subject, body, null, true, "pre-admissao-link", ct);
                emailEnviado = true;
            }
            catch { /* best-effort: email pode não estar configurado */ }
        }

        return new GerarLinkResponse(pa.AccessToken, url, emailEnviado);
    }

    public async Task<ValidarDocumentoResponse?> ValidarDocumentoAsync(
        Guid preAdmissaoId, Guid docId, ValidarDocumentoRequest request, CancellationToken ct)
    {
        var doc = await _db.Set<PreAdmissaoDocumento>()
            .FirstOrDefaultAsync(d => d.Id == docId && d.PreAdmissaoId == preAdmissaoId, ct);
        if (doc is null) return null;

        if (request.Status == StatusDocumento.Rejeitado && string.IsNullOrWhiteSpace(request.ObservacaoRh))
            throw new InvalidOperationException("Observação é obrigatória ao rejeitar um documento.");

        doc.Status = request.Status;
        doc.ObservacaoRh = request.ObservacaoRh?.Trim();
        doc.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        return new ValidarDocumentoResponse(doc.Id, doc.Status, doc.ObservacaoRh, doc.UpdatedAtUtc);
    }

    private static string NormalizeCpf(string cpf) => cpf.Replace(".", "").Replace("-", "").Replace(" ", "").Trim();

    // ── Integração TOTVS ──

    public async Task<IReadOnlyList<PreAdmissaoPendenteIntegracaoRow>> ListPendentesIntegracaoAsync(CancellationToken ct)
    {
        // TOTVS só deve ver registros em EmIntegracao que NUNCA foram reportados (IntegracaoResultado == null).
        // Se o ERP reportou Falha, o registro permanece em EmIntegracao e volta à fila após retry manual.
        return await _db.Set<Domain.Entities.PreAdmissao>()
            .AsNoTracking()
            .Where(x => x.TenantId == _tenantContext.TenantId
                     && x.Status == PreAdmissaoStatus.EmIntegracao
                     && x.IntegracaoResultado == null)
            .OrderBy(x => x.ApprovedAtUtc)
            .Select(x => new PreAdmissaoPendenteIntegracaoRow(x.Id, x.Nome, x.Cpf, x.DataAdmissao, x.Status))
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<PreAdmissaoPainelIntegracaoRow>> ListPainelIntegracaoAsync(IntegracaoResultado? filtro, CancellationToken ct)
    {
        var q = _db.Set<Domain.Entities.PreAdmissao>()
            .AsNoTracking()
            .Where(x => x.TenantId == _tenantContext.TenantId
                     && (x.Status == PreAdmissaoStatus.Aprovada
                      || x.Status == PreAdmissaoStatus.EmIntegracao
                      || x.Status == PreAdmissaoStatus.Integrada));

        if (filtro.HasValue)
            q = q.Where(x => x.IntegracaoResultado == filtro.Value);

        return await q
            .OrderByDescending(x => x.ApprovedAtUtc)
            .Select(x => new PreAdmissaoPainelIntegracaoRow(
                x.Id, x.Nome, x.Cpf, x.DataAdmissao, x.Status,
                x.IntegracaoResultado, x.IntegracaoMensagem,
                x.ApprovedAtUtc, x.IntegradaEmUtc))
            .ToListAsync(ct);
    }

    public async Task<(PreAdmissaoDetailResponse? Result, string? Error)> RegistrarResultadoIntegracaoAsync(
        Guid id, IntegracaoResultadoRequest request, CancellationToken ct)
    {
        var e = await _db.Set<Domain.Entities.PreAdmissao>()
            .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == _tenantContext.TenantId, ct);

        if (e is null) return (null, null);
        if (e.Status != PreAdmissaoStatus.EmIntegracao)
            return (null, $"Pré-admissão não está no status 'EmIntegracao' (atual: {e.Status}).");

        var isSucesso = string.Equals(request.Status, "sucesso", StringComparison.OrdinalIgnoreCase);
        e.IntegracaoMensagem = request.Mensagem?.Trim();
        e.UpdatedAtUtc = DateTimeOffset.UtcNow;

        if (isSucesso)
        {
            e.Status = PreAdmissaoStatus.Integrada;
            e.IntegracaoResultado = IntegracaoResultado.Sucesso;
            e.IntegradaEmUtc = DateTimeOffset.UtcNow;
        }
        else
        {
            // Permanece EmIntegracao → reaparece na fila após retry manual (que zera IntegracaoResultado)
            e.IntegracaoResultado = IntegracaoResultado.Falha;
        }

        await _db.SaveChangesAsync(ct);
        return (await GetByIdAsync(id, ct), null);
    }

    public async Task<IReadOnlyList<OwnerPainelIntegracaoRow>> OwnerListPainelIntegracaoAsync(
        string? tenantId, IntegracaoResultado? filtro, CancellationToken ct)
    {
        var q = _db.Set<Domain.Entities.PreAdmissao>()
            .AsNoTracking()
            .IgnoreQueryFilters()   // cross-tenant: Owner vê todos os tenants
            .Where(x => x.Status == PreAdmissaoStatus.Aprovada
                     || x.Status == PreAdmissaoStatus.EmIntegracao
                     || x.Status == PreAdmissaoStatus.Integrada);

        if (!string.IsNullOrWhiteSpace(tenantId))
            q = q.Where(x => x.TenantId == tenantId);

        if (filtro.HasValue)
            q = q.Where(x => x.IntegracaoResultado == filtro.Value);

        return await q
            .OrderByDescending(x => x.ApprovedAtUtc)
            .Select(x => new OwnerPainelIntegracaoRow(
                x.TenantId, x.Id, x.Nome, x.Cpf, x.DataAdmissao, x.Status,
                x.IntegracaoResultado, x.IntegracaoMensagem,
                x.ApprovedAtUtc, x.IntegradaEmUtc))
            .ToListAsync(ct);
    }

    // ── Admissão Manual — RH inicia a partir de candidato aprovado ──

    public async Task<PreAdmissaoDetailResponse> IniciarManualAsync(IniciarManualRequest request, CancellationToken ct)
    {
        var candidato = await _db.Set<Candidato>()
            .FirstOrDefaultAsync(c => c.Id == request.CandidatoId && c.TenantId == _tenantContext.TenantId, ct)
            ?? throw new InvalidOperationException("Candidato não encontrado.");

        // Auto-aprovar candidato ao iniciar admissão
        if (candidato.Status != CandidateStatus.Aprovado)
        {
            candidato.Status = CandidateStatus.Aprovado;
            candidato.UpdatedAtUtc = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync(ct);
        }

        // Buscar dados da vaga (com JobPosition) para preencher automaticamente
        var vaga = candidato.VagaId != Guid.Empty
            ? await _db.Vagas
                .Include(v => v.JobPosition)
                .AsNoTracking()
                .FirstOrDefaultAsync(v => v.Id == candidato.VagaId, ct)
            : null;

        // JobPositionId: prioridade para o que vier no request; fallback da vaga
        var jobPositionId = request.JobPositionId ?? vaga?.JobPositionId;

        // Se o JobPosition ainda não foi carregado (request veio com Id diferente do da vaga)
        JobPosition? jobPosition = vaga?.JobPosition;
        if (jobPositionId.HasValue && jobPosition?.Id != jobPositionId)
        {
            jobPosition = await _db.Set<JobPosition>()
                .AsNoTracking()
                .FirstOrDefaultAsync(jp => jp.Id == jobPositionId.Value, ct);
        }

        // Reusar pré-admissão existente do candidato (evita duplicar)
        var existing = await _db.Set<Domain.Entities.PreAdmissao>()
            .Where(pa => pa.CandidatoId == candidato.Id
                && pa.Status != PreAdmissaoStatus.Rejeitada
                && pa.Status != PreAdmissaoStatus.Integrada)
            .OrderByDescending(pa => pa.CreatedAtUtc)
            .FirstOrDefaultAsync(ct);

        Console.Error.WriteLine($"[IniciarManual] CandidatoId={candidato.Id}, existing={existing?.Id}, status={existing?.Status}");

        if (existing != null)
        {
            if (request.TipoContratacao.HasValue)
                existing.TipoContratacao = request.TipoContratacao;
            // Preencher cargo TOTVS automaticamente se ainda estiver vazio
            if (existing.CodCargoTotvs == null && jobPosition?.TotvsCargoBasicId != null)
                existing.CodCargoTotvs = jobPosition.TotvsCargoBasicId;
            if (existing.JobPositionId == null && jobPositionId.HasValue)
                existing.JobPositionId = jobPositionId;
            if (existing.VagaId == null && candidato.VagaId != Guid.Empty)
                existing.VagaId = candidato.VagaId;
            existing.UpdatedAtUtc = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync(ct);
            return (await GetByIdAsync(existing.Id, ct))!;
        }

        var entity = new Domain.Entities.PreAdmissao
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            Status = PreAdmissaoStatus.Rascunho,
            PreenchidoPor = PreenchidoPor.RH,
            CandidatoId = candidato.Id,
            Nome = candidato.Nome.Trim(),
            Email = candidato.Email?.Trim(),
            Celular = candidato.Fone?.Trim(),
            JobPositionId = jobPositionId,
            CodCargoTotvs = jobPosition?.TotvsCargoBasicId,
            AreaId = request.AreaId ?? vaga?.AreaId,
            UnitId = request.UnitId,
            VagaId = candidato.VagaId != Guid.Empty ? candidato.VagaId : null,
            DataAdmissao = request.DataAdmissao,
            Salario = request.Salario,
            TipoContratacao = request.TipoContratacao ?? (vaga?.TipoContratacao.HasValue == true ? (TipoContratacaoAdmissao?)(int)vaga.TipoContratacao.Value : null),
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };

        _db.Set<Domain.Entities.PreAdmissao>().Add(entity);
        await _db.SaveChangesAsync(ct);

        // Carrega configuração padrão do tenant; se não houver, usa lista hardcoded por tipo de contratação
        var configsPadrao = await _db.Set<DocumentacaoPadraoConfig>()
            .Where(c => c.Configuracao != 2)
            .ToListAsync(ct);

        if (configsPadrao.Count > 0)
        {
            foreach (var config in configsPadrao)
            {
                _db.Set<PreAdmissaoDocumentoSolicitado>().Add(new PreAdmissaoDocumentoSolicitado
                {
                    Id = Guid.NewGuid(),
                    TenantId = _tenantContext.TenantId,
                    PreAdmissaoId = entity.Id,
                    TipoDocumento = (TipoDocumento)config.TipoDocumento,
                    Obrigatorio = config.Configuracao == 0,
                    CreatedAtUtc = DateTimeOffset.UtcNow,
                });
            }
        }
        else
        {
            // Fallback: lista padrão por tipo de contratação
            var docsTipo = entity.TipoContratacao switch
            {
                TipoContratacaoAdmissao.PJ => new[] { TipoDocumento.CNPJ, TipoDocumento.ContratoSocialMEI, TipoDocumento.RG, TipoDocumento.CPF, TipoDocumento.ContaBancariaPJ, TipoDocumento.CertidoesNegativas },
                _ => new[] { TipoDocumento.RG, TipoDocumento.CPF, TipoDocumento.ComprovanteResidencia, TipoDocumento.CarteiraTrabalhoCTPS, TipoDocumento.TituloEleitor, TipoDocumento.PisPasep, TipoDocumento.Foto3x4, TipoDocumento.CertidaoNascimentoCasamento, TipoDocumento.Escolaridade, TipoDocumento.ComprovanteBancario },
            };
            foreach (var tipo in docsTipo)
            {
                _db.Set<PreAdmissaoDocumentoSolicitado>().Add(new PreAdmissaoDocumentoSolicitado
                {
                    Id = Guid.NewGuid(),
                    TenantId = _tenantContext.TenantId,
                    PreAdmissaoId = entity.Id,
                    TipoDocumento = tipo,
                    Obrigatorio = true,
                    CreatedAtUtc = DateTimeOffset.UtcNow,
                });
            }
        }
        await _db.SaveChangesAsync(ct);

        return (await GetByIdAsync(entity.Id, ct))!;
    }

    // ── Fluxo Ítalo — Gestor aprova contratação ──

    public async Task<PreAdmissaoDetailResponse> AprovarContratacaoAsync(AprovarContratacaoRequest request, CancellationToken ct)
    {
        var entity = new Domain.Entities.PreAdmissao
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            Status = PreAdmissaoStatus.Enviado,
            PreenchidoPor = PreenchidoPor.Candidato,
            CandidatoId = request.CandidatoId,
            Nome = request.Nome.Trim(),
            Cpf = request.Cpf?.Trim(),
            Email = request.Email?.Trim(),
            Celular = request.Celular?.Trim(),
            UnitId = request.UnitId,
            AreaId = request.AreaId,
            JobPositionId = request.JobPositionId,
            DataAdmissao = request.DataAdmissao,
            Salario = request.Salario,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow,
        };
        _db.Set<Domain.Entities.PreAdmissao>().Add(entity);
        await _db.SaveChangesAsync(ct);

        // Notifica Ítalo para iniciar coleta de documentos via WhatsApp
        await _italoService.NotificarCandidatoAsync(entity.Id, entity.Nome, entity.Celular, entity.Email, ct);

        return (await GetByIdAsync(entity.Id, ct))!;
    }

    // ── Fluxo Ítalo — Webhook recebe dados OCR ──

    public async Task<PreAdmissaoDetailResponse?> ReceberDocumentosExternosAsync(Guid id, DocumentoExternoRequest request, CancellationToken ct)
    {
        var e = await _db.Set<Domain.Entities.PreAdmissao>()
            .Include(x => x.Documentos)
            .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == _tenantContext.TenantId, ct);
        if (e is null) return null;

        var tipoLower = request.TipoDocumento?.ToLower() ?? "";

        // Mapeia dados OCR → campos da pré-admissão
        if (tipoLower is "rg" && request.DadosRg is { } rg)
        {
            if (!string.IsNullOrWhiteSpace(rg.NomeCompleto) && string.IsNullOrWhiteSpace(e.Nome))
                e.Nome = rg.NomeCompleto.Trim();
            if (!string.IsNullOrWhiteSpace(rg.NumeroRg))
                e.Rg = rg.NumeroRg.Trim();
            if (!string.IsNullOrWhiteSpace(rg.NumeroCpf) && string.IsNullOrWhiteSpace(e.Cpf))
                e.Cpf = rg.NumeroCpf.Trim();
        }

        if (tipoLower is "cpf" && request.DadosCpf is { } cpf)
        {
            if (!string.IsNullOrWhiteSpace(cpf.NumeroCpf) && string.IsNullOrWhiteSpace(e.Cpf))
                e.Cpf = cpf.NumeroCpf.Trim();
        }

        if (tipoLower is "comprovante_residencia" && request.DadosComprovante is { } comp)
        {
            if (!string.IsNullOrWhiteSpace(comp.Cep)) e.Cep = comp.Cep.Trim();
            if (!string.IsNullOrWhiteSpace(comp.Logradouro)) e.Logradouro = comp.Logradouro.Trim();
            if (!string.IsNullOrWhiteSpace(comp.Numero)) e.Numero = comp.Numero.Trim();
            if (!string.IsNullOrWhiteSpace(comp.Bairro)) e.Bairro = comp.Bairro.Trim();
            if (!string.IsNullOrWhiteSpace(comp.Cidade)) e.Cidade = comp.Cidade.Trim();
            if (!string.IsNullOrWhiteSpace(comp.Uf)) e.Uf = comp.Uf.Trim();
        }

        // Salva documento (base64 → arquivo local)
        if (!string.IsNullOrWhiteSpace(request.DocumentoBase64))
        {
            try
            {
                var tipoDoc = tipoLower switch
                {
                    "rg" => TipoDocumento.RG,
                    "cpf" => TipoDocumento.CPF,
                    "comprovante_residencia" => TipoDocumento.ComprovanteResidencia,
                    _ => TipoDocumento.Outro,
                };
                var ext = request.ContentType switch
                {
                    "image/jpeg" or "image/jpg" => ".jpg",
                    "image/png" => ".png",
                    "application/pdf" => ".pdf",
                    _ => Path.GetExtension(request.NomeArquivo ?? "") is { Length: > 0 } x ? x : ".bin",
                };
                var nomeArquivo = request.NomeArquivo ?? $"{tipoLower}{ext}";
                var folder = e.CandidatoId.HasValue
                    ? $"{_tenantContext.TenantId}/candidatos/{e.CandidatoId.Value:N}"
                    : $"{_tenantContext.TenantId}/admissao/{id:N}";
                var storagePath = $"{folder}/{(int)tipoDoc}_{Guid.NewGuid():N}{ext}";
                var bytes = Convert.FromBase64String(request.DocumentoBase64);
                using var ms = new MemoryStream(bytes);
                await _storage.UploadAsync(ms, storagePath, request.ContentType ?? "application/octet-stream", ct);

                var doc = new PreAdmissaoDocumento
                {
                    Id = Guid.NewGuid(),
                    TenantId = _tenantContext.TenantId,
                    PreAdmissaoId = id,
                    Tipo = tipoDoc,
                    NomeArquivo = nomeArquivo,
                    ContentType = request.ContentType ?? "application/octet-stream",
                    TamanhoBytes = bytes.LongLength,
                    StoragePath = storagePath,
                    Status = StatusDocumento.PendenteValidacao,
                    CreatedAtUtc = DateTimeOffset.UtcNow,
                    UpdatedAtUtc = DateTimeOffset.UtcNow,
                };
                _db.Set<PreAdmissaoDocumento>().Add(doc);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha ao salvar documento externo para pré-admissão {Id}", id);
            }
        }

        // Avança para EmRevisão quando RG + Comprovante de Residência chegaram
        if (e.Status == PreAdmissaoStatus.Enviado)
        {
            var tiposRecebidos = e.Documentos
                .Select(d => d.Tipo)
                .ToHashSet();

            // Inclui o documento atual (ainda não salvo na lista em memória)
            var tipoAtual = tipoLower switch
            {
                "rg" => (TipoDocumento?)TipoDocumento.RG,
                "cpf" => TipoDocumento.CPF,
                "comprovante_residencia" => TipoDocumento.ComprovanteResidencia,
                _ => null,
            };
            if (tipoAtual.HasValue) tiposRecebidos.Add(tipoAtual.Value);

            if (tiposRecebidos.Contains(TipoDocumento.RG) && tiposRecebidos.Contains(TipoDocumento.ComprovanteResidencia))
            {
                e.Status = PreAdmissaoStatus.Preenchido;
                e.SubmittedAtUtc = DateTimeOffset.UtcNow;
            }
        }

        e.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
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

    private PreAdmissaoDetailResponse MapDetail(Domain.Entities.PreAdmissao e) => new(
        e.Id, e.Status, e.PreenchidoPor, e.CandidatoId,
        e.RevisadoPor?.Name, e.AprovadoPor?.Name,
        e.ObservacaoRh, e.MotivoRejeicao,
        // Pessoal
        e.Nome, e.NomeSocial, e.NomeAbreviado,
        e.Cpf, e.Rg, e.RgOrgaoExpedidor, e.RgUfExpedidor,
        e.RgDataExpedicao, e.DataNascimento,
        e.Sexo, e.EstadoCivil,
        e.Nacionalidade, e.PaisNacionalidade,
        e.NomeMae, e.NomePai,
        e.NaturalCidade, e.NaturalUf, e.PaisNascimento,
        // Estrangeiro
        e.Passaporte, e.RnmRne, e.ValidadeVisto, e.TipoVisto,
        e.ResideExterior, e.TipoVistoEstrangeiro,
        // RIC
        e.RegIdentidCivilNumero, e.RegIdentidCivilUf,
        e.RegIdentidCivilCidade, e.RegIdentidCivilOrgEmiss,
        e.RegIdentidCivilDataExped,
        // Endereco
        e.Cep, e.Logradouro, e.Numero, e.Complemento, e.Bairro, e.Cidade, e.Uf,
        e.PontoReferencia, e.TipoLogradouroESocial, e.MunicipioEnderecoIbge,
        // Contato
        e.Email, e.EmailAlternativo, e.Telefone, e.Celular,
        e.DddTelefone, e.DddTelContato,
        e.ContatoEmergenciaNome, e.ContatoEmergenciaFone,
        // Bancario
        e.BancoCodigo, e.BancoNome, e.Agencia, e.AgenciaDigito, e.Conta, e.ContaDigito, e.TipoConta,
        // Trabalhista
        e.EstabelecimentoCodigo, e.CodEmpresa, e.MatriculaRM,
        e.UnitId, e.Unit?.Name, e.AreaId, e.Area?.Name,
        e.JobPositionId, e.JobPosition?.Name, e.RequisitoCategoriaId,
        e.DataAdmissao, e.Salario, e.TipoContratacao, e.CargaHorariaSemanal, e.PisPasep,
        // TOTVS Cargo/Vinculo
        e.CodCargoTotvs, e.CodVinculoEmpregaticio, e.TipoFuncionario,
        e.CategoriaSalarial, e.GrauInstrucao, e.CodTurno,
        e.CentroCusto, e.UnidadeLotacao,
        e.CodPlanoLotacao, e.CodTurma, e.NumCartaoPonto, e.CodNivel,
        e.TipoMaoDeObra, e.FormaPagamento, e.SalarioSimulado,
        e.OrigemFuncionario, e.IndFuncVinculado, e.FuncQualificado,
        // FGTS/INSS
        e.OptanteFgts, e.DataOpcaoFgts, e.TipoAdmissaoFgts,
        e.RecolheFgts, e.RecolheInss,
        // Sindicato
        e.Sindicalizado, e.DescContribSindical, e.ContribSindicDia, e.CodSindicato,
        // Flags calculo
        e.CargaAutomTurno, e.RecebePericul, e.RecebeInsalub,
        e.RecebeAdiantamento, e.ConsidEmissRAIS, e.Calcula13, e.RecebeFerias,
        // Provisoes 13
        e.Avos13SalCalcAnterior, e.Avos13SalCalc,
        e.ProvAcum13Sal, e.ProvAcumInss13Sal, e.ProvAcumFgts13Sal,
        // Provisoes Ferias
        e.DiasProvFeriasMesAnterior, e.DiasProvFeriasMesAtual,
        e.ProvAcumFerias, e.ProvAcumInssFerias, e.ProvAcumFgtsFerias, e.ProvAcumFerias13,
        // Ponto
        e.EmitCartPonto, e.CodLocalMarcacao, e.CodClassFuncPontoEletronico,
        // Docs avulsos
        e.TituloEleitorNumero, e.TituloEleitorZona, e.TituloEleitorSecao,
        e.TituloEleitorCidade, e.TituloEleitorUf,
        e.ReservistaNumero, e.CategoriaCnh, e.ValidadeCnh,
        e.Ctps, e.CtpsSerie, e.CtpsUf, e.CtpsModelo, e.CtpsSerieESocial,
        // CNH
        e.CnhNumero, e.CnhUf, e.CnhOrgaoEmissor, e.CnhDataExpedicao, e.CnhPrimeiraHabilitacao,
        // Doc Militar
        e.DocMilitarTipo, e.DocMilitarNumero, e.DocMilitarSerie, e.DocMilitarRegiao, e.DocMilitarCircunscricao,
        // Saude
        e.GrupoSanguineo, e.FatorRh, e.PossuiDeficiencia, e.FuncDoador,
        e.CartaoSus, e.Altura, e.Peso,
        e.Cutis, e.Cabelo, e.Olhos, e.Manequim, e.Sapato,
        // Contrato
        e.DataTerminoContrato,
        // Localidade
        e.PaisLocalidade, e.CodLocalidade, e.CodFpas,
        // eSocial
        e.CategoriaTrabalhoESocial, e.IndAdmissao, e.NaturezaAtividade,
        e.MunicipioNascimentoIbge, e.TipoAdmissaoESocial,
        e.RegimeTrabalhista, e.RegimePrevidenciario, e.RegimeJornada,
        e.MatriculaESocial, e.PaisNacionalidade,
        // CAGED
        e.OcorrenciaCAGED,
        // Registro exterior
        e.CodRegistroExterior,
        // Validacoes
        e.ValidacaoCpfOk, e.ValidacaoCepOk, e.ValidacaoBancoOk, e.ValidacaoSalarioOk, e.ValidacaoSalarioJustificativa,
        // Timestamps
        e.CreatedAtUtc, e.SubmittedAtUtc, e.ApprovedAtUtc,
        // Wizard
        e.WizardCurrentStep, e.WizardCompletionPercent, e.LastActivityUtc,
        // Documentos
        e.Documentos.Select(d => new PreAdmissaoDocumentoResponse(
            d.Id, d.Tipo, d.Lado, d.NomeArquivo, d.ContentType, d.TamanhoBytes, d.Status, d.ObservacaoRh,
            d.CreatedAtUtc, _storage.GetPresignedUrl(d.StoragePath))).ToList(),
        (e.DocumentosSolicitados ?? []).Select(ds => new DocumentoSolicitadoResponse(
            ds.TipoDocumento, TipoDocumentoLabel(ds.TipoDocumento), ds.Obrigatorio)).ToList(),
        // Dependentes
        (e.Dependentes ?? []).Select(d => new PreAdmissaoDependenteDetailResponse(
            d.Id, d.NomeCompleto, d.Parentesco, d.Cpf, d.DataNascimento, d.IsPcd)).ToList(),
        e.AccessToken,
        e.IntegracaoResultado, e.IntegracaoMensagem, e.IntegradaEmUtc
    );

    internal static string TipoDocumentoLabel(TipoDocumento tipo) => tipo switch
    {
        TipoDocumento.RG => "RG",
        TipoDocumento.CPF => "CPF",
        TipoDocumento.CNH => "CNH",
        TipoDocumento.TituloEleitor => "Título de Eleitor",
        TipoDocumento.Reservista => "Reservista",
        TipoDocumento.ComprovanteResidencia => "Comprovante de Residência",
        TipoDocumento.CertidaoNascimentoCasamento => "Certidão Nasc./Casamento",
        TipoDocumento.PisPasep => "PIS/PASEP",
        TipoDocumento.Outro => "Outro",
        TipoDocumento.CarteiraTrabalhoCTPS => "Carteira de Trabalho (CTPS)",
        TipoDocumento.DeclaracaoUniaoEstavel => "Declaração de União Estável",
        TipoDocumento.RGFilho => "RG dos Filhos",
        TipoDocumento.CertidaoNascimentoFilho => "Certidão de Nascimento dos Filhos",
        TipoDocumento.CarteiraVacinacaoFilho => "Carteira de Vacinação dos Filhos",
        TipoDocumento.ComprovanteBancario => "Comprovante Bancário",
        TipoDocumento.Foto3x4 => "Foto 3x4",
        _ => tipo.ToString(),
    };
}
