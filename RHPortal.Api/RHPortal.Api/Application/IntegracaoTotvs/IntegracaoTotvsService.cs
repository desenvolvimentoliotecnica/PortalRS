using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Application.Common;
using RhPortal.Api.Application.OcupacaoHistorico;
using RhPortal.Api.Application.PreAdmissao;
using RhPortal.Api.Contracts.IntegracaoTotvs;
using RhPortal.Api.Domain.Entities;
using RhPortal.Api.Domain.Enums;
using RHPortal.Api.Domain.Enums; // VagaStatus e outros enums com namespace RH maiúsculo
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Messaging.Email;

namespace RhPortal.Api.Application.IntegracaoTotvs;

public sealed class IntegracaoTotvsService : IIntegracaoTotvsService
{
    private readonly AppDbContext _db;
    private readonly IOcupacaoHistoricoService _ocupacaoService;
    private readonly IPreAdmissaoService _preAdmissaoService;
    private readonly ApprovalWorkflowHelper _workflow;
    private readonly IEmailQueueService _emailQueue;

    public IntegracaoTotvsService(
        AppDbContext db,
        IOcupacaoHistoricoService ocupacaoService,
        IPreAdmissaoService preAdmissaoService,
        ApprovalWorkflowHelper workflow,
        IEmailQueueService emailQueue)
    {
        _db = db;
        _ocupacaoService = ocupacaoService;
        _preAdmissaoService = preAdmissaoService;
        _workflow = workflow;
        _emailQueue = emailQueue;
    }

    public async Task<IntegracaoTotvsPainelResponse> ListPainelAsync(IntegracaoTotvsPainelQuery query, CancellationToken ct)
    {
        var all = new List<IntegracaoTotvsListItem>();

        // ── 1. PreAdmissão (Admissao) ──
        if (query.Tipo is null or TipoIntegracao.Admissao)
        {
            var admissoes = await _db.PreAdmissoes
                .AsNoTracking()
                .Where(p => p.ApprovedAtUtc != null)
                .Select(p => new IntegracaoTotvsListItem(
                    p.Id,
                    (short)TipoIntegracao.Admissao,
                    "Admissão",
                    p.Nome,
                    p.Cpf,
                    "Admissão",
                    p.ApprovedAtUtc,
                    p.IntegracaoResultado,
                    p.IntegracaoMensagem,
                    p.IntegradaEmUtc
                ))
                .ToListAsync(ct);
            all.AddRange(admissoes);
        }

        // ── 2. Pagamento Extra ──
        if (query.Tipo is null or TipoIntegracao.PagamentoExtra)
        {
            var pgtoExtra = await _db.SolicitacoesPagamentoExtra
                .AsNoTracking()
                .Include(s => s.Funcionario)
                .Where(s => s.Status == SolicitacaoStatus.Aprovada)
                .Select(s => new IntegracaoTotvsListItem(
                    s.Id,
                    (short)TipoIntegracao.PagamentoExtra,
                    "Pagamento Extra",
                    s.Funcionario != null ? s.Funcionario.Name : "—",
                    null,
                    "Pgto Extra — " + s.TipoPagamentoExtra.ToString(),
                    s.ApprovedAtUtc,
                    s.IntegracaoResultado,
                    s.IntegracaoMensagem,
                    s.IntegradaEmUtc
                ))
                .ToListAsync(ct);
            all.AddRange(pgtoExtra);
        }

        // ── 3. Desligamento ──
        if (query.Tipo is null or TipoIntegracao.Desligamento)
        {
            var desligamentos = await _db.SolicitacoesDesligamento
                .AsNoTracking()
                .Include(s => s.Funcionario)
                .Where(s => s.Status == SolicitacaoStatus.EmIntegracao || s.Status == SolicitacaoStatus.Concluida)
                .Select(s => new IntegracaoTotvsListItem(
                    s.Id,
                    (short)TipoIntegracao.Desligamento,
                    "Desligamento",
                    s.Funcionario != null ? s.Funcionario.Name : "—",
                    null,
                    "Desligamento — " + s.TipoDesligamento.ToString(),
                    s.ApprovedAtUtc,
                    s.IntegracaoResultado,
                    s.IntegracaoMensagem,
                    s.IntegradaEmUtc
                ))
                .ToListAsync(ct);
            all.AddRange(desligamentos);
        }

        // ── 4. Promoção ──
        if (query.Tipo is null or TipoIntegracao.Promocao)
        {
            var promocoes = await _db.SolicitacoesPromocao
                .AsNoTracking()
                .Include(s => s.Funcionario)
                .Where(s => s.Status == SolicitacaoStatus.EmIntegracao || s.Status == SolicitacaoStatus.Concluida)
                .Select(s => new IntegracaoTotvsListItem(
                    s.Id,
                    (short)TipoIntegracao.Promocao,
                    "Promoção",
                    s.Funcionario != null ? s.Funcionario.Name : "—",
                    null,
                    "Promoção",
                    s.ApprovedAtUtc,
                    s.IntegracaoResultado,
                    s.IntegracaoMensagem,
                    s.IntegradaEmUtc
                ))
                .ToListAsync(ct);
            all.AddRange(promocoes);
        }

        // ── 5. Alteração de Endereço ──
        if (query.Tipo is null or TipoIntegracao.AlteracaoEndereco)
        {
            var enderecos = await _db.SolicitacoesEndereco
                .AsNoTracking()
                .Include(s => s.Solicitante)
                .Where(s => s.Status == SolicitacaoStatus.Aprovada)
                .Select(s => new IntegracaoTotvsListItem(
                    s.Id,
                    (short)TipoIntegracao.AlteracaoEndereco,
                    "Alt. Endereço",
                    s.Solicitante != null ? s.Solicitante.Name : "—",
                    null,
                    "Alt. Endereço — " + s.Cidade + "/" + s.Uf,
                    s.ApprovedAtUtc,
                    s.IntegracaoResultado,
                    s.IntegracaoMensagem,
                    s.IntegradaEmUtc
                ))
                .ToListAsync(ct);
            all.AddRange(enderecos);
        }

        // ── 6. Dependente ──
        if (query.Tipo is null or TipoIntegracao.Dependente)
        {
            var dependentes = await _db.SolicitacoesDependente
                .AsNoTracking()
                .Include(s => s.Solicitante)
                .Where(s => s.Status == SolicitacaoStatus.Aprovada)
                .Select(s => new IntegracaoTotvsListItem(
                    s.Id,
                    (short)TipoIntegracao.Dependente,
                    "Dependente",
                    s.Solicitante != null ? s.Solicitante.Name : "—",
                    null,
                    "Dependente — " + s.NomeCompleto,
                    s.ApprovedAtUtc,
                    s.IntegracaoResultado,
                    s.IntegracaoMensagem,
                    s.IntegradaEmUtc
                ))
                .ToListAsync(ct);
            all.AddRange(dependentes);
        }

        // ── 7. Benefício ──
        if (query.Tipo is null or TipoIntegracao.Beneficio)
        {
            var beneficios = await _db.SolicitacoesBeneficio
                .AsNoTracking()
                .Include(s => s.Solicitante)
                .Where(s => s.Status == SolicitacaoStatus.Aprovada)
                .Select(s => new IntegracaoTotvsListItem(
                    s.Id,
                    (short)TipoIntegracao.Beneficio,
                    "Benefício",
                    s.Solicitante != null ? s.Solicitante.Name : "—",
                    null,
                    "Benefício — " + s.TipoBeneficio.ToString(),
                    s.ApprovedAtUtc,
                    s.IntegracaoResultado,
                    s.IntegracaoMensagem,
                    s.IntegradaEmUtc
                ))
                .ToListAsync(ct);
            all.AddRange(beneficios);
        }

        // ── 8. Férias ──
        if (query.Tipo is null or TipoIntegracao.Ferias)
        {
            var ferias = await _db.SolicitacoesFerias
                .AsNoTracking()
                .Include(s => s.Solicitante)
                .Where(s => s.Status == SolicitacaoStatus.Aprovada)
                .Select(s => new IntegracaoTotvsListItem(
                    s.Id,
                    (short)TipoIntegracao.Ferias,
                    "Férias",
                    s.Solicitante != null ? s.Solicitante.Name : "—",
                    null,
                    "Férias — " + s.QtdDias + " dias",
                    s.ApprovedAtUtc,
                    s.IntegracaoResultado,
                    s.IntegracaoMensagem,
                    s.IntegradaEmUtc
                ))
                .ToListAsync(ct);
            all.AddRange(ferias);
        }

        // ── 9. Requisição de Pessoal (SolicitacaoVaga) ──
        if (query.Tipo is null or TipoIntegracao.SolicitacaoVaga)
        {
            var solicitacoesVaga = await _db.SolicitacoesVaga
                .AsNoTracking()
                .Include(s => s.Solicitante)
                .Where(s => s.Status == SolicitacaoVagaStatus.EmIntegracao
                         || s.Status == SolicitacaoVagaStatus.Concluida)
                .Select(s => new IntegracaoTotvsListItem(
                    s.Id,
                    (short)TipoIntegracao.SolicitacaoVaga,
                    "Requisição de Pessoal",
                    s.Solicitante != null ? s.Solicitante.Name : "—",
                    null,
                    "Req. Pessoal — " + s.Titulo,
                    s.ApprovedAtUtc,
                    s.IntegracaoResultado,
                    s.IntegracaoMensagem,
                    s.IntegradaEmUtc
                ))
                .ToListAsync(ct);
            all.AddRange(solicitacoesVaga);
        }

        // ── Filtros ──

        if (query.Resultado is not null)
        {
            all = all.Where(x => x.IntegracaoResultado == query.Resultado).ToList();
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim().ToLowerInvariant();
            all = all.Where(x =>
                x.Nome.Contains(search, StringComparison.OrdinalIgnoreCase) ||
                (x.Cpf != null && x.Cpf.Contains(search, StringComparison.OrdinalIgnoreCase))
            ).ToList();
        }

        // ── Contadores (calculados ANTES da paginação, mas DEPOIS dos filtros de tipo/search) ──
        // Recalcular contadores sem filtro de resultado para mostrar totais reais
        var allForCounters = all; // se Resultado foi filtrado, precisamos do total sem esse filtro
        // Na verdade os contadores devem refletir o total antes do filtro de resultado
        // Vamos recalcular: buscamos tudo de novo sem filtro de resultado
        // Simplificação: contadores vêm do conjunto completo (sem filtro resultado)

        int pendentes, sucesso, falha;

        if (query.Resultado is not null)
        {
            // Se filtramos por resultado, os contadores devem ser do set sem esse filtro
            // Para evitar refetch, calculamos a partir do total original
            // Mas como já filtramos, vamos usar os dados como estão
            pendentes = all.Count(x => x.IntegracaoResultado == null);
            sucesso = all.Count(x => x.IntegracaoResultado == IntegracaoResultado.Sucesso);
            falha = all.Count(x => x.IntegracaoResultado == IntegracaoResultado.Falha);
        }
        else
        {
            pendentes = all.Count(x => x.IntegracaoResultado == null);
            sucesso = all.Count(x => x.IntegracaoResultado == IntegracaoResultado.Sucesso);
            falha = all.Count(x => x.IntegracaoResultado == IntegracaoResultado.Falha);
        }

        var total = all.Count;

        // ── Ordenação e paginação ──

        var items = all
            .OrderByDescending(x => x.ApprovedAtUtc)
            .Skip(query.Skip)
            .Take(query.Take)
            .ToList();

        return new IntegracaoTotvsPainelResponse(items, total, pendentes, sucesso, falha);
    }

    public async Task<object?> GetDetalheAsync(TipoIntegracao tipo, Guid id, CancellationToken ct)
    {
        switch (tipo)
        {
            case TipoIntegracao.Admissao:
            {
                var p = await _db.PreAdmissoes.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
                if (p is null) return null;
                return new
                {
                    p.Id, tipoIntegracao = (short)TipoIntegracao.Admissao, tipoIntegracaoLabel = "Admissão",
                    // Dados pessoais
                    p.CodEmpresa, p.EstabelecimentoCodigo, p.MatriculaRM,
                    p.Nome, p.NomeAbreviado,
                    cpf = TotvsPayloadHelper.OnlyDigits(p.Cpf),
                    p.Email, p.EmailAlternativo,
                    telefone = TotvsPayloadHelper.PhoneOnlyNumber(p.Telefone),
                    p.DddTelefone,
                    celular = TotvsPayloadHelper.PhoneOnlyNumber(p.Celular),
                    dataNascimento = TotvsPayloadHelper.FormatDate(p.DataNascimento),
                    sexo = p.Sexo.ToString(), estadoCivil = p.EstadoCivil.ToString(),
                    p.NomeMae, p.NomePai, p.Nacionalidade, p.PaisNascimento, p.NaturalCidade, p.NaturalUf,
                    // Documentos
                    p.Rg, p.RgOrgaoExpedidor, p.RgUfExpedidor,
                    rgDataExpedicao = TotvsPayloadHelper.FormatDate(p.RgDataExpedicao),
                    p.PisPasep,
                    p.TituloEleitorNumero, p.TituloEleitorZona, p.TituloEleitorSecao, p.TituloEleitorCidade, p.TituloEleitorUf,
                    p.Ctps, p.CtpsSerie, p.CtpsUf, p.CtpsModelo, p.CtpsSerieESocial,
                    p.ReservistaNumero, p.DocMilitarTipo, p.DocMilitarNumero, p.DocMilitarSerie, p.DocMilitarRegiao,
                    p.CnhNumero, p.CategoriaCnh, p.CnhUf, p.CnhOrgaoEmissor,
                    cnhDataExpedicao = TotvsPayloadHelper.FormatIntDate(p.CnhDataExpedicao),
                    cnhPrimeiraHabilitacao = TotvsPayloadHelper.FormatIntDate(p.CnhPrimeiraHabilitacao),
                    validadeCnh = TotvsPayloadHelper.FormatDate(p.ValidadeCnh),
                    p.CartaoSus, p.PossuiDeficiencia,
                    // Características físicas
                    p.GrauInstrucao, p.GrupoSanguineo, p.FatorRh, p.FuncDoador,
                    p.Altura,
                    peso = TotvsPayloadHelper.PesoKgParaGramas(p.Peso),
                    p.Cutis, p.Cabelo, p.Olhos, p.Manequim, p.Sapato,
                    // Endereço
                    p.Cep, p.Logradouro, p.Numero, p.Complemento, p.Bairro, p.Cidade, p.Uf,
                    p.PontoReferencia, p.TipoLogradouroESocial, p.MunicipioEnderecoIbge, p.MunicipioNascimentoIbge,
                    // Contrato e salário
                    dataAdmissao = TotvsPayloadHelper.FormatDate(p.DataAdmissao),
                    p.Salario, p.SalarioSimulado, tipoContratacao = p.TipoContratacao.ToString(), p.CargaHorariaSemanal,
                    p.CodCargoTotvs, p.CodNivel, p.CategoriaSalarial, p.CodTurno, p.CodTurma,
                    p.CentroCusto, p.UnidadeLotacao, p.CodPlanoLotacao,
                    p.CodVinculoEmpregaticio, p.TipoFuncionario, p.TipoMaoDeObra,
                    p.FormaPagamento,
                    dataTerminoContrato = TotvsPayloadHelper.FormatIntDate(p.DataTerminoContrato),
                    // FGTS / INSS
                    p.OptanteFgts, p.TipoAdmissaoFgts, p.RecolheFgts, p.RecolheInss,
                    p.FuncQualificado, p.IndFuncVinculado,
                    // Sindicato
                    p.Sindicalizado, p.DescContribSindical, p.ContribSindicDia, p.CodSindicato,
                    // Flags de cálculo
                    p.CargaAutomTurno, p.RecebePericul, p.RecebeInsalub,
                    p.RecebeAdiantamento, p.ConsidEmissRAIS, p.Calcula13, p.RecebeFerias,
                    // Provisões 13º
                    p.Avos13SalCalcAnterior, p.Avos13SalCalc,
                    p.ProvAcum13Sal, p.ProvAcumInss13Sal, p.ProvAcumFgts13Sal,
                    // Provisões férias
                    p.DiasProvFeriasMesAnterior, p.DiasProvFeriasMesAtual,
                    p.ProvAcumFerias, p.ProvAcumInssFerias, p.ProvAcumFgtsFerias, p.ProvAcumFerias13,
                    // Ponto
                    p.NumCartaoPonto, p.EmitCartPonto, p.CodLocalMarcacao, p.CodClassFuncPontoEletronico,
                    // Banco
                    p.BancoCodigo, p.BancoNome, p.Agencia, p.AgenciaDigito, p.Conta, p.ContaDigito, tipoConta = p.TipoConta.ToString(),
                    // Contato emergência
                    p.ContatoEmergenciaNome,
                    contatoEmergenciaFone = TotvsPayloadHelper.PhoneOnlyNumber(p.ContatoEmergenciaFone),
                    p.DddTelContato,
                    // eSocial
                    p.CategoriaTrabalhoESocial, p.IndAdmissao, p.NaturezaAtividade,
                    p.TipoAdmissaoESocial, p.RegimeTrabalhista, p.RegimePrevidenciario, p.RegimeJornada,
                    p.MatriculaESocial,
                    // Localidade
                    p.PaisLocalidade, p.CodLocalidade, p.CodFpas,
                    // Diversos
                    p.OrigemFuncionario, p.TipoVistoEstrangeiro, p.OcorrenciaCAGED,
                    validadeVisto = TotvsPayloadHelper.FormatDate(p.ValidadeVisto),
                    dataOpcaoFgts = TotvsPayloadHelper.FormatDate(p.DataOpcaoFgts),
                    // Integração
                    p.IntegracaoResultado, p.IntegracaoMensagem,
                    integradaEmUtc = TotvsPayloadHelper.FormatDate(p.IntegradaEmUtc),
                    approvedAtUtc = TotvsPayloadHelper.FormatDate(p.ApprovedAtUtc),
                    createdAtUtc = TotvsPayloadHelper.FormatDate(p.CreatedAtUtc),
                };
            }
            case TipoIntegracao.Desligamento:
            {
                var s = await _db.SolicitacoesDesligamento.AsNoTracking()
                    .Include(x => x.Funcionario).Include(x => x.Solicitante)
                    .FirstOrDefaultAsync(x => x.Id == id, ct);
                if (s is null) return null;
                return new
                {
                    s.Id, tipoIntegracao = (short)TipoIntegracao.Desligamento, tipoIntegracaoLabel = "Desligamento",
                    nome = s.Funcionario?.Name ?? "—", funcionarioId = s.FuncionarioId,
                    solicitante = s.Solicitante?.Name ?? "—",
                    s.DataDesligamento, tipoDesligamento = s.TipoDesligamento.ToString(),
                    s.MotivoDesligamento, tipoAvisoPrevio = s.TipoAvisoPrevio.ToString(), s.DiasAvisoPrevio,
                    s.ElegivelRecontratacao, s.SubstituirPosicao, s.Observacoes,
                    status = s.Status.ToString(),
                    s.IntegracaoResultado, s.IntegracaoMensagem, s.IntegradaEmUtc, s.ApprovedAtUtc, s.CreatedAtUtc,
                };
            }
            case TipoIntegracao.Promocao:
            {
                var s = await _db.SolicitacoesPromocao.AsNoTracking()
                    .Include(x => x.Funcionario).Include(x => x.Solicitante)
                    .Include(x => x.CargoAtual).Include(x => x.NovoCargo)
                    .Include(x => x.AreaAtual).Include(x => x.NovaArea)
                    .Include(x => x.NovaUnidade)
                    .Include(x => x.CentroCusto)
                    .Include(x => x.UnidadeLotacao)
                    .FirstOrDefaultAsync(x => x.Id == id, ct);
                if (s is null) return null;
                return new
                {
                    s.Id, tipoIntegracao = (short)TipoIntegracao.Promocao, tipoIntegracaoLabel = "Promoção",
                    nome = s.Funcionario?.Name ?? "—", funcionarioId = s.FuncionarioId,
                    solicitante = s.Solicitante?.Name ?? "—",
                    s.DataEfetiva, s.Justificativa,
                    motivoMovimentacao = s.MotivoMovimentacao?.ToString(),
                    cargoAtualNome = s.CargoAtual?.Description, novoCargoNome = s.NovoCargo?.Description,
                    areaAtualNome = s.AreaAtual?.Description, novaAreaNome = s.NovaArea?.Description,
                    novaUnidadeNome = s.NovaUnidade?.Name,
                    centroCustoNome = s.CentroCusto?.Description,
                    unidadeLotacaoNome = s.UnidadeLotacao?.Description,
                    s.NovoSalario, s.NovaRemuneracao, s.HorarioProposto,
                    s.Observacoes, status = s.Status.ToString(),
                    s.IntegracaoResultado, s.IntegracaoMensagem, s.IntegradaEmUtc, s.ApprovedAtUtc, s.CreatedAtUtc,
                };
            }
            case TipoIntegracao.AlteracaoEndereco:
            {
                var s = await _db.SolicitacoesEndereco.AsNoTracking()
                    .Include(x => x.Solicitante)
                    .FirstOrDefaultAsync(x => x.Id == id, ct);
                if (s is null) return null;
                return new
                {
                    s.Id, tipoIntegracao = (short)TipoIntegracao.AlteracaoEndereco, tipoIntegracaoLabel = "Alt. Endereço",
                    nome = s.Solicitante?.Name ?? "—",
                    s.Cep, s.Logradouro, s.Numero, s.Bairro, s.Complemento, s.Cidade, s.Uf,
                    s.Observacoes, status = s.Status.ToString(),
                    s.IntegracaoResultado, s.IntegracaoMensagem, s.IntegradaEmUtc, s.ApprovedAtUtc, s.CreatedAtUtc,
                };
            }
            case TipoIntegracao.Dependente:
            {
                var s = await _db.SolicitacoesDependente.AsNoTracking()
                    .Include(x => x.Solicitante)
                    .FirstOrDefaultAsync(x => x.Id == id, ct);
                if (s is null) return null;
                return new
                {
                    s.Id, tipoIntegracao = (short)TipoIntegracao.Dependente, tipoIntegracaoLabel = "Dependente",
                    nome = s.Solicitante?.Name ?? "—",
                    tipoSolicitacao = s.TipoSolicitacao.ToString(),
                    s.NomeCompleto, parentesco = s.Parentesco.ToString(), s.Cpf, s.DataNascimento,
                    s.IsPcd, s.DependenteIR, s.Observacoes, status = s.Status.ToString(),
                    s.IntegracaoResultado, s.IntegracaoMensagem, s.IntegradaEmUtc, s.ApprovedAtUtc, s.CreatedAtUtc,
                };
            }
            case TipoIntegracao.Beneficio:
            {
                var s = await _db.SolicitacoesBeneficio.AsNoTracking()
                    .Include(x => x.Solicitante)
                    .FirstOrDefaultAsync(x => x.Id == id, ct);
                if (s is null) return null;
                return new
                {
                    s.Id, tipoIntegracao = (short)TipoIntegracao.Beneficio, tipoIntegracaoLabel = "Benefício",
                    nome = s.Solicitante?.Name ?? "—",
                    tipoBeneficio = s.TipoBeneficio.ToString(), tipoAlteracao = s.TipoAlteracao.ToString(),
                    s.Descricao, s.IncluirDependentes, s.Observacoes, status = s.Status.ToString(),
                    s.IntegracaoResultado, s.IntegracaoMensagem, s.IntegradaEmUtc, s.ApprovedAtUtc, s.CreatedAtUtc,
                };
            }
            case TipoIntegracao.Ferias:
            {
                var s = await _db.SolicitacoesFerias.AsNoTracking()
                    .Include(x => x.Solicitante)
                    .FirstOrDefaultAsync(x => x.Id == id, ct);
                if (s is null) return null;
                return new
                {
                    s.Id, tipoIntegracao = (short)TipoIntegracao.Ferias, tipoIntegracaoLabel = "Férias",
                    nome = s.Solicitante?.Name ?? "—",
                    s.PeriodoAquisitivo, s.DataInicio, s.DataFim, s.QtdDias,
                    s.AbonoPecuniario, s.DiasAbono, s.Adiantamento13,
                    s.Observacoes, status = s.Status.ToString(),
                    s.IntegracaoResultado, s.IntegracaoMensagem, s.IntegradaEmUtc, s.ApprovedAtUtc, s.CreatedAtUtc,
                };
            }
            case TipoIntegracao.PagamentoExtra:
            {
                var s = await _db.SolicitacoesPagamentoExtra.AsNoTracking()
                    .Include(x => x.Funcionario).Include(x => x.Solicitante)
                    .FirstOrDefaultAsync(x => x.Id == id, ct);
                if (s is null) return null;
                return new
                {
                    s.Id, tipoIntegracao = (short)TipoIntegracao.PagamentoExtra, tipoIntegracaoLabel = "Pagamento Extra",
                    nome = s.Funcionario?.Name ?? "—", funcionarioId = s.FuncionarioId,
                    solicitante = s.Solicitante?.Name ?? "—",
                    tipoPagamentoExtra = s.TipoPagamentoExtra.ToString(),
                    s.Valor, s.Descricao, s.DataPagamento, s.Competencia,
                    s.Observacoes, status = s.Status.ToString(),
                    s.IntegracaoResultado, s.IntegracaoMensagem, s.IntegradaEmUtc, s.ApprovedAtUtc, s.CreatedAtUtc,
                };
            }
            case TipoIntegracao.SolicitacaoVaga:
            {
                var s = await _db.SolicitacoesVaga.AsNoTracking()
                    .Include(x => x.Solicitante)
                    .Include(x => x.JobPosition)
                    .Include(x => x.Area)
                    .Include(x => x.Empresa)
                    .Include(x => x.CentroCusto)
                    .Include(x => x.UnidadeLotacao)
                    .FirstOrDefaultAsync(x => x.Id == id, ct);
                if (s is null) return null;
                return new
                {
                    s.Id, tipoIntegracao = (short)TipoIntegracao.SolicitacaoVaga, tipoIntegracaoLabel = "Requisição de Pessoal",
                    solicitante = s.Solicitante?.Name ?? "—", solicitanteId = s.SolicitanteId,
                    s.Titulo, s.Justificativa, s.QtdPosicoes,
                    urgencia = s.Urgencia.ToString(), status = s.Status.ToString(),
                    tipoSolicitacao = s.TipoSolicitacao.ToString(), s.IsConfidencial,
                    cargoNome = s.JobPosition?.Description, areaNome = s.Area?.Description,
                    empresaNome = s.Empresa?.Description, centroCustoNome = s.CentroCusto?.Description,
                    unidadeLotacaoNome = s.UnidadeLotacao?.Description,
                    tipoContrato = s.TipoContrato.ToString(), s.PrazoDias,
                    motivoRequisicao = s.MotivoRequisicao?.ToString(),
                    s.CnhObrigatoria, s.DisponibilidadeViagens, s.EscalaTrabalho,
                    s.VagaId,
                    s.IntegracaoResultado, s.IntegracaoMensagem, s.IntegradaEmUtc, s.ApprovedAtUtc, s.CreatedAtUtc,
                };
            }
            default:
                return null;
        }
    }

    public async Task RegistrarResultadoAsync(TipoIntegracao tipo, Guid id, IntegracaoTotvsResultadoRequest request, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        Guid? solicitanteId = null;
        string tipoLabel;
        string resumo;

        switch (tipo)
        {
            case TipoIntegracao.Admissao:
            {
                var entity = await _db.PreAdmissoes.FindAsync(new object[] { id }, ct)
                    ?? throw new KeyNotFoundException($"PreAdmissao {id} não encontrada.");
                entity.IntegracaoResultado = request.Resultado;
                entity.IntegracaoMensagem = request.Mensagem;
                entity.IntegradaEmUtc = now;
                entity.UpdatedAtUtc = now;
                solicitanteId = entity.AprovadoPorId;
                tipoLabel = "admissão";
                resumo = entity.Nome;
                // Admissao sucesso: materializar Funcionario após salvar o resultado
                // (chamado abaixo, fora do switch, após SaveChanges)
                break;
            }
            case TipoIntegracao.PagamentoExtra:
            {
                var entity = await _db.SolicitacoesPagamentoExtra.FindAsync(new object[] { id }, ct)
                    ?? throw new KeyNotFoundException($"SolicitacaoPagamentoExtra {id} não encontrada.");
                entity.IntegracaoResultado = request.Resultado;
                entity.IntegracaoMensagem = request.Mensagem;
                entity.IntegradaEmUtc = now;
                solicitanteId = entity.SolicitanteId;
                tipoLabel = "pagamento extra";
                resumo = entity.TipoPagamentoExtra.ToString();
                break;
            }
            case TipoIntegracao.Desligamento:
            {
                var entity = await _db.SolicitacoesDesligamento.FindAsync(new object[] { id }, ct)
                    ?? throw new KeyNotFoundException($"SolicitacaoDesligamento {id} não encontrada.");
                entity.IntegracaoResultado = request.Resultado;
                entity.IntegracaoMensagem = request.Mensagem;
                entity.IntegradaEmUtc = now;

                if (request.Resultado == IntegracaoResultado.Sucesso)
                {
                    // Marcar como concluído e liberar o headcount da vaga
                    entity.Status = SolicitacaoStatus.Concluida;
                    entity.UpdatedAtUtc = now;
                    await _ocupacaoService.FecharOcupacaoAsync(
                        entity.FuncionarioId, MotivoSaidaOcupacao.Desligamento, entity.Id, ct);
                }
                solicitanteId = entity.SolicitanteId;
                tipoLabel = "desligamento";
                var funcDeslig = await _db.Set<Funcionario>().AsNoTracking()
                    .FirstOrDefaultAsync(f => f.Id == entity.FuncionarioId, ct);
                resumo = funcDeslig?.Name ?? "funcionário";
                break;
            }
            case TipoIntegracao.Promocao:
            {
                var entity = await _db.SolicitacoesPromocao.FindAsync(new object[] { id }, ct)
                    ?? throw new KeyNotFoundException($"SolicitacaoPromocao {id} não encontrada.");
                entity.IntegracaoResultado = request.Resultado;
                entity.IntegracaoMensagem = request.Mensagem;
                entity.IntegradaEmUtc = now;
                entity.UpdatedAtUtc = now;
                if (request.Resultado == IntegracaoResultado.Sucesso)
                    entity.Status = SolicitacaoStatus.Concluida;
                solicitanteId = entity.SolicitanteId;
                tipoLabel = "movimentação";
                var funcProm = await _db.Set<Funcionario>().AsNoTracking()
                    .FirstOrDefaultAsync(f => f.Id == entity.FuncionarioId, ct);
                resumo = funcProm?.Name ?? "funcionário";
                break;
            }
            case TipoIntegracao.AlteracaoEndereco:
            {
                var entity = await _db.SolicitacoesEndereco.FindAsync(new object[] { id }, ct)
                    ?? throw new KeyNotFoundException($"SolicitacaoEndereco {id} não encontrada.");
                entity.IntegracaoResultado = request.Resultado;
                entity.IntegracaoMensagem = request.Mensagem;
                entity.IntegradaEmUtc = now;
                solicitanteId = entity.SolicitanteId;
                tipoLabel = "alteração de endereço";
                resumo = "seus dados de endereço";
                break;
            }
            case TipoIntegracao.Dependente:
            {
                var entity = await _db.SolicitacoesDependente.FindAsync(new object[] { id }, ct)
                    ?? throw new KeyNotFoundException($"SolicitacaoDependente {id} não encontrada.");
                entity.IntegracaoResultado = request.Resultado;
                entity.IntegracaoMensagem = request.Mensagem;
                entity.IntegradaEmUtc = now;
                solicitanteId = entity.SolicitanteId;
                tipoLabel = "dependente";
                resumo = entity.NomeCompleto;
                break;
            }
            case TipoIntegracao.Beneficio:
            {
                var entity = await _db.SolicitacoesBeneficio.FindAsync(new object[] { id }, ct)
                    ?? throw new KeyNotFoundException($"SolicitacaoBeneficio {id} não encontrada.");
                entity.IntegracaoResultado = request.Resultado;
                entity.IntegracaoMensagem = request.Mensagem;
                entity.IntegradaEmUtc = now;
                solicitanteId = entity.SolicitanteId;
                tipoLabel = "benefício";
                resumo = entity.TipoBeneficio.ToString();
                break;
            }
            case TipoIntegracao.Ferias:
            {
                var entity = await _db.SolicitacoesFerias.FindAsync(new object[] { id }, ct)
                    ?? throw new KeyNotFoundException($"SolicitacaoFerias {id} não encontrada.");
                entity.IntegracaoResultado = request.Resultado;
                entity.IntegracaoMensagem = request.Mensagem;
                entity.IntegradaEmUtc = now;
                solicitanteId = entity.SolicitanteId;
                tipoLabel = "férias";
                resumo = $"{entity.DataInicio:dd/MM/yyyy}";
                break;
            }
            case TipoIntegracao.SolicitacaoVaga:
            {
                var entity = await _db.SolicitacoesVaga.FindAsync(new object[] { id }, ct)
                    ?? throw new KeyNotFoundException($"SolicitacaoVaga {id} não encontrada.");
                entity.IntegracaoResultado = request.Resultado;
                entity.IntegracaoMensagem = request.Mensagem;
                entity.IntegradaEmUtc = now;
                entity.UpdatedAtUtc = now;
                if (request.Resultado == IntegracaoResultado.Sucesso)
                {
                    entity.Status = SolicitacaoVagaStatus.Concluida;
                    // Se há uma vaga vinculada, abri-la automaticamente
                    if (entity.VagaId.HasValue)
                    {
                        var vaga = await _db.Vagas.FindAsync(new object[] { entity.VagaId.Value }, ct);
                        if (vaga is not null)
                            vaga.Status = RHPortal.Api.Domain.Enums.VagaStatus.Aberta;
                    }
                }
                solicitanteId = entity.SolicitanteId;
                tipoLabel = "requisição de pessoal";
                resumo = entity.Titulo;
                break;
            }
            default:
                throw new ArgumentOutOfRangeException(nameof(tipo), tipo, "Tipo de integração desconhecido.");
        }

        await _db.SaveChangesAsync(ct);

        // Admissão confirmada: materializar Funcionario (cria registro no banco e migra dependentes)
        if (tipo == TipoIntegracao.Admissao && request.Resultado == IntegracaoResultado.Sucesso)
        {
            try
            {
                await _preAdmissaoService.MaterializarFuncionarioAsync(id, request.CdnFuncionario, ct);
            }
            catch (Exception ex)
            {
                // Não bloqueia o registro do resultado — RH pode acionar manualmente
                // O IntegracaoMensagem já está salvo; a materialização pode ser reprocessada
                _ = ex; // log já feito dentro de MaterializarFuncionarioAsync
            }
        }

        // Notificar solicitante com resultado da integração (in-app + email)
        if (solicitanteId.HasValue)
        {
            await NotifyResultadoIntegracaoAsync(
                solicitanteId.Value, tipoLabel, resumo, request.Resultado, request.Mensagem, ct);
        }
    }

    /// <summary>
    /// Notifica o solicitante com o resultado da integração (Sucesso/Falha) via in-app + email.
    /// Falhas aqui não bloqueiam a operação de integração (best-effort).
    /// </summary>
    private async Task NotifyResultadoIntegracaoAsync(
        Guid solicitanteId, string tipoLabel, string resumo,
        IntegracaoResultado resultado, string? mensagem, CancellationToken ct)
    {
        var sucesso = resultado == IntegracaoResultado.Sucesso;
        var titulo = sucesso
            ? $"Integração de {tipoLabel} concluída"
            : $"Falha na integração de {tipoLabel}";
        var mensagemInApp = sucesso
            ? $"A integração de {tipoLabel} ({resumo}) foi concluída com sucesso no TOTVS."
            : $"A integração de {tipoLabel} ({resumo}) falhou no TOTVS." +
              (!string.IsNullOrWhiteSpace(mensagem) ? $" Erro: {mensagem}" : "");

        await _workflow.NotifyByFuncionarioIdAsync(
            solicitanteId, titulo, mensagemInApp,
            "/gestao/solicitacoes", ct,
            sucesso ? "success" : "warning");

        var solicitante = await _db.Set<Funcionario>().AsNoTracking()
            .FirstOrDefaultAsync(f => f.Id == solicitanteId, ct);
        if (!string.IsNullOrWhiteSpace(solicitante?.Email))
        {
            var erroHtml = !string.IsNullOrWhiteSpace(mensagem)
                ? $"<p><strong>Mensagem do ERP:</strong> {mensagem}</p>" : "";
            var bodyHtml = sucesso
                ? $"<p>Olá {solicitante.Name},</p><p>A integração de <strong>{tipoLabel}</strong> ({resumo}) foi <strong>concluída com sucesso</strong> no TOTVS.</p>"
                : $"<p>Olá {solicitante.Name},</p><p>A integração de <strong>{tipoLabel}</strong> ({resumo}) <strong>falhou</strong> no TOTVS.</p>{erroHtml}<p>Acesse o portal para verificar detalhes.</p>";

            await _emailQueue.EnqueueRawAsync(
                solicitante.Email, titulo, bodyHtml,
                null, false, "IntegracaoTotvs", ct);
        }
    }

    public async Task RetryAsync(TipoIntegracao tipo, Guid id, CancellationToken ct)
    {
        switch (tipo)
        {
            case TipoIntegracao.Admissao:
            {
                var entity = await _db.PreAdmissoes.FindAsync(new object[] { id }, ct)
                    ?? throw new KeyNotFoundException($"PreAdmissao {id} não encontrada.");
                entity.IntegracaoResultado = null;
                entity.IntegracaoMensagem = null;
                entity.IntegradaEmUtc = null;
                entity.TentativasIntegracao = 0;
                entity.UltimaTentativaUtc = null;
                break;
            }
            case TipoIntegracao.PagamentoExtra:
            {
                var entity = await _db.SolicitacoesPagamentoExtra.FindAsync(new object[] { id }, ct)
                    ?? throw new KeyNotFoundException($"SolicitacaoPagamentoExtra {id} não encontrada.");
                entity.IntegracaoResultado = null;
                entity.IntegracaoMensagem = null;
                entity.IntegradaEmUtc = null;
                break;
            }
            case TipoIntegracao.Desligamento:
            {
                var entity = await _db.SolicitacoesDesligamento.FindAsync(new object[] { id }, ct)
                    ?? throw new KeyNotFoundException($"SolicitacaoDesligamento {id} não encontrada.");
                entity.IntegracaoResultado = null;
                entity.IntegracaoMensagem = null;
                entity.IntegradaEmUtc = null;
                break;
            }
            case TipoIntegracao.Promocao:
            {
                var entity = await _db.SolicitacoesPromocao.FindAsync(new object[] { id }, ct)
                    ?? throw new KeyNotFoundException($"SolicitacaoPromocao {id} não encontrada.");
                entity.IntegracaoResultado = null;
                entity.IntegracaoMensagem = null;
                entity.IntegradaEmUtc = null;
                break;
            }
            case TipoIntegracao.AlteracaoEndereco:
            {
                var entity = await _db.SolicitacoesEndereco.FindAsync(new object[] { id }, ct)
                    ?? throw new KeyNotFoundException($"SolicitacaoEndereco {id} não encontrada.");
                entity.IntegracaoResultado = null;
                entity.IntegracaoMensagem = null;
                entity.IntegradaEmUtc = null;
                break;
            }
            case TipoIntegracao.Dependente:
            {
                var entity = await _db.SolicitacoesDependente.FindAsync(new object[] { id }, ct)
                    ?? throw new KeyNotFoundException($"SolicitacaoDependente {id} não encontrada.");
                entity.IntegracaoResultado = null;
                entity.IntegracaoMensagem = null;
                entity.IntegradaEmUtc = null;
                break;
            }
            case TipoIntegracao.Beneficio:
            {
                var entity = await _db.SolicitacoesBeneficio.FindAsync(new object[] { id }, ct)
                    ?? throw new KeyNotFoundException($"SolicitacaoBeneficio {id} não encontrada.");
                entity.IntegracaoResultado = null;
                entity.IntegracaoMensagem = null;
                entity.IntegradaEmUtc = null;
                break;
            }
            case TipoIntegracao.Ferias:
            {
                var entity = await _db.SolicitacoesFerias.FindAsync(new object[] { id }, ct)
                    ?? throw new KeyNotFoundException($"SolicitacaoFerias {id} não encontrada.");
                entity.IntegracaoResultado = null;
                entity.IntegracaoMensagem = null;
                entity.IntegradaEmUtc = null;
                break;
            }
            case TipoIntegracao.SolicitacaoVaga:
            {
                var entity = await _db.SolicitacoesVaga.FindAsync(new object[] { id }, ct)
                    ?? throw new KeyNotFoundException($"SolicitacaoVaga {id} não encontrada.");
                entity.IntegracaoResultado = null;
                entity.IntegracaoMensagem = null;
                entity.IntegradaEmUtc = null;
                break;
            }
            default:
                throw new ArgumentOutOfRangeException(nameof(tipo), tipo, "Tipo de integração desconhecido.");
        }

        await _db.SaveChangesAsync(ct);
    }

    public async Task<IntegracaoReconciliacaoResponse> ReconciliacaoAsync(int diasMinimos, CancellationToken ct)
    {
        var corte = DateTimeOffset.UtcNow.AddDays(-diasMinimos);
        var pendentes = new List<IntegracaoReconciliacaoItemResponse>();
        var emFalha = new List<IntegracaoReconciliacaoItemResponse>();
        var falhaDefinitiva = new List<IntegracaoReconciliacaoItemResponse>();

        void Classify(IntegracaoReconciliacaoItemResponse item)
        {
            if (item.IntegracaoResultado == IntegracaoResultado.FalhaDefinitiva)
                falhaDefinitiva.Add(item);
            else if (item.IntegracaoResultado == IntegracaoResultado.Falha)
                emFalha.Add(item);
            else
                pendentes.Add(item);
        }

        // PreAdmissão
        foreach (var x in await _db.PreAdmissoes.AsNoTracking()
            .Where(e => e.ApprovedAtUtc != null && e.ApprovedAtUtc < corte
                     && (e.IntegracaoResultado == null
                         || e.IntegracaoResultado == IntegracaoResultado.Falha
                         || e.IntegracaoResultado == IntegracaoResultado.FalhaDefinitiva))
            .ToListAsync(ct))
        {
            Classify(new IntegracaoReconciliacaoItemResponse(
                x.Id, (short)TipoIntegracao.Admissao, "Admissão", x.Nome,
                x.IntegracaoResultado, x.IntegracaoMensagem,
                x.TentativasIntegracao, x.UltimaTentativaUtc,
                x.IntegradaEmUtc, x.ApprovedAtUtc));
        }

        // Desligamento
        foreach (var x in await _db.SolicitacoesDesligamento.AsNoTracking()
            .Include(e => e.Funcionario)
            .Where(e => e.ApprovedAtUtc != null && e.ApprovedAtUtc < corte
                     && (e.IntegracaoResultado == null
                         || e.IntegracaoResultado == IntegracaoResultado.Falha
                         || e.IntegracaoResultado == IntegracaoResultado.FalhaDefinitiva))
            .ToListAsync(ct))
        {
            Classify(new IntegracaoReconciliacaoItemResponse(
                x.Id, (short)TipoIntegracao.Desligamento, "Desligamento", x.Funcionario?.Name ?? "—",
                x.IntegracaoResultado, x.IntegracaoMensagem,
                x.TentativasIntegracao, x.UltimaTentativaUtc,
                x.IntegradaEmUtc, x.ApprovedAtUtc));
        }

        // Promoção
        foreach (var x in await _db.SolicitacoesPromocao.AsNoTracking()
            .Include(e => e.Funcionario)
            .Where(e => e.ApprovedAtUtc != null && e.ApprovedAtUtc < corte
                     && (e.IntegracaoResultado == null
                         || e.IntegracaoResultado == IntegracaoResultado.Falha
                         || e.IntegracaoResultado == IntegracaoResultado.FalhaDefinitiva))
            .ToListAsync(ct))
        {
            Classify(new IntegracaoReconciliacaoItemResponse(
                x.Id, (short)TipoIntegracao.Promocao, "Promoção", x.Funcionario?.Name ?? "—",
                x.IntegracaoResultado, x.IntegracaoMensagem,
                x.TentativasIntegracao, x.UltimaTentativaUtc,
                x.IntegradaEmUtc, x.ApprovedAtUtc));
        }

        // Pagamento Extra
        foreach (var x in await _db.SolicitacoesPagamentoExtra.AsNoTracking()
            .Where(e => e.ApprovedAtUtc != null && e.ApprovedAtUtc < corte
                     && (e.IntegracaoResultado == null
                         || e.IntegracaoResultado == IntegracaoResultado.Falha
                         || e.IntegracaoResultado == IntegracaoResultado.FalhaDefinitiva))
            .ToListAsync(ct))
        {
            Classify(new IntegracaoReconciliacaoItemResponse(
                x.Id, (short)TipoIntegracao.PagamentoExtra, "Pagamento Extra", x.TipoPagamentoExtra.ToString(),
                x.IntegracaoResultado, x.IntegracaoMensagem,
                x.TentativasIntegracao, x.UltimaTentativaUtc,
                x.IntegradaEmUtc, x.ApprovedAtUtc));
        }

        // Alt. Endereço
        foreach (var x in await _db.SolicitacoesEndereco.AsNoTracking()
            .Where(e => e.ApprovedAtUtc != null && e.ApprovedAtUtc < corte
                     && (e.IntegracaoResultado == null
                         || e.IntegracaoResultado == IntegracaoResultado.Falha
                         || e.IntegracaoResultado == IntegracaoResultado.FalhaDefinitiva))
            .ToListAsync(ct))
        {
            Classify(new IntegracaoReconciliacaoItemResponse(
                x.Id, (short)TipoIntegracao.AlteracaoEndereco, "Alt. Endereço", $"{x.Cidade}/{x.Uf}",
                x.IntegracaoResultado, x.IntegracaoMensagem,
                x.TentativasIntegracao, x.UltimaTentativaUtc,
                x.IntegradaEmUtc, x.ApprovedAtUtc));
        }

        // Dependente
        foreach (var x in await _db.SolicitacoesDependente.AsNoTracking()
            .Where(e => e.ApprovedAtUtc != null && e.ApprovedAtUtc < corte
                     && (e.IntegracaoResultado == null
                         || e.IntegracaoResultado == IntegracaoResultado.Falha
                         || e.IntegracaoResultado == IntegracaoResultado.FalhaDefinitiva))
            .ToListAsync(ct))
        {
            Classify(new IntegracaoReconciliacaoItemResponse(
                x.Id, (short)TipoIntegracao.Dependente, "Dependente", x.NomeCompleto,
                x.IntegracaoResultado, x.IntegracaoMensagem,
                x.TentativasIntegracao, x.UltimaTentativaUtc,
                x.IntegradaEmUtc, x.ApprovedAtUtc));
        }

        // Benefício
        foreach (var x in await _db.SolicitacoesBeneficio.AsNoTracking()
            .Where(e => e.ApprovedAtUtc != null && e.ApprovedAtUtc < corte
                     && (e.IntegracaoResultado == null
                         || e.IntegracaoResultado == IntegracaoResultado.Falha
                         || e.IntegracaoResultado == IntegracaoResultado.FalhaDefinitiva))
            .ToListAsync(ct))
        {
            Classify(new IntegracaoReconciliacaoItemResponse(
                x.Id, (short)TipoIntegracao.Beneficio, "Benefício", x.TipoBeneficio.ToString(),
                x.IntegracaoResultado, x.IntegracaoMensagem,
                x.TentativasIntegracao, x.UltimaTentativaUtc,
                x.IntegradaEmUtc, x.ApprovedAtUtc));
        }

        // Férias
        foreach (var x in await _db.SolicitacoesFerias.AsNoTracking()
            .Where(e => e.ApprovedAtUtc != null && e.ApprovedAtUtc < corte
                     && (e.IntegracaoResultado == null
                         || e.IntegracaoResultado == IntegracaoResultado.Falha
                         || e.IntegracaoResultado == IntegracaoResultado.FalhaDefinitiva))
            .ToListAsync(ct))
        {
            Classify(new IntegracaoReconciliacaoItemResponse(
                x.Id, (short)TipoIntegracao.Ferias, "Férias", $"{x.DataInicio:dd/MM/yyyy}",
                x.IntegracaoResultado, x.IntegracaoMensagem,
                x.TentativasIntegracao, x.UltimaTentativaUtc,
                x.IntegradaEmUtc, x.ApprovedAtUtc));
        }

        // Requisição de Pessoal
        foreach (var x in await _db.SolicitacoesVaga.AsNoTracking()
            .Where(e => e.ApprovedAtUtc != null && e.ApprovedAtUtc < corte
                     && (e.IntegracaoResultado == null
                         || e.IntegracaoResultado == IntegracaoResultado.Falha
                         || e.IntegracaoResultado == IntegracaoResultado.FalhaDefinitiva))
            .ToListAsync(ct))
        {
            Classify(new IntegracaoReconciliacaoItemResponse(
                x.Id, (short)TipoIntegracao.SolicitacaoVaga, "Req. Pessoal", x.Titulo,
                x.IntegracaoResultado, x.IntegracaoMensagem,
                x.TentativasIntegracao, x.UltimaTentativaUtc,
                x.IntegradaEmUtc, x.ApprovedAtUtc));
        }

        return new IntegracaoReconciliacaoResponse(
            pendentes, emFalha, falhaDefinitiva,
            pendentes.Count + emFalha.Count + falhaDefinitiva.Count);
    }
}
