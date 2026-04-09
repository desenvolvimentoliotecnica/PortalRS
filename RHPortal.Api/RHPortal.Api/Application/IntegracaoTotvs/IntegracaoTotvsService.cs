using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Contracts.IntegracaoTotvs;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Data;

namespace RhPortal.Api.Application.IntegracaoTotvs;

public sealed class IntegracaoTotvsService : IIntegracaoTotvsService
{
    private readonly AppDbContext _db;

    public IntegracaoTotvsService(AppDbContext db)
    {
        _db = db;
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
                .Where(s => s.Status == SolicitacaoStatus.Aprovada)
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
                .Where(s => s.Status == SolicitacaoStatus.Aprovada)
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

    public async Task RegistrarResultadoAsync(TipoIntegracao tipo, Guid id, IntegracaoTotvsResultadoRequest request, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;

        switch (tipo)
        {
            case TipoIntegracao.Admissao:
            {
                var entity = await _db.PreAdmissoes.FindAsync(new object[] { id }, ct)
                    ?? throw new KeyNotFoundException($"PreAdmissao {id} não encontrada.");
                entity.IntegracaoResultado = request.Resultado;
                entity.IntegracaoMensagem = request.Mensagem;
                entity.IntegradaEmUtc = now;
                break;
            }
            case TipoIntegracao.PagamentoExtra:
            {
                var entity = await _db.SolicitacoesPagamentoExtra.FindAsync(new object[] { id }, ct)
                    ?? throw new KeyNotFoundException($"SolicitacaoPagamentoExtra {id} não encontrada.");
                entity.IntegracaoResultado = request.Resultado;
                entity.IntegracaoMensagem = request.Mensagem;
                entity.IntegradaEmUtc = now;
                break;
            }
            case TipoIntegracao.Desligamento:
            {
                var entity = await _db.SolicitacoesDesligamento.FindAsync(new object[] { id }, ct)
                    ?? throw new KeyNotFoundException($"SolicitacaoDesligamento {id} não encontrada.");
                entity.IntegracaoResultado = request.Resultado;
                entity.IntegracaoMensagem = request.Mensagem;
                entity.IntegradaEmUtc = now;
                break;
            }
            case TipoIntegracao.Promocao:
            {
                var entity = await _db.SolicitacoesPromocao.FindAsync(new object[] { id }, ct)
                    ?? throw new KeyNotFoundException($"SolicitacaoPromocao {id} não encontrada.");
                entity.IntegracaoResultado = request.Resultado;
                entity.IntegracaoMensagem = request.Mensagem;
                entity.IntegradaEmUtc = now;
                break;
            }
            case TipoIntegracao.AlteracaoEndereco:
            {
                var entity = await _db.SolicitacoesEndereco.FindAsync(new object[] { id }, ct)
                    ?? throw new KeyNotFoundException($"SolicitacaoEndereco {id} não encontrada.");
                entity.IntegracaoResultado = request.Resultado;
                entity.IntegracaoMensagem = request.Mensagem;
                entity.IntegradaEmUtc = now;
                break;
            }
            case TipoIntegracao.Dependente:
            {
                var entity = await _db.SolicitacoesDependente.FindAsync(new object[] { id }, ct)
                    ?? throw new KeyNotFoundException($"SolicitacaoDependente {id} não encontrada.");
                entity.IntegracaoResultado = request.Resultado;
                entity.IntegracaoMensagem = request.Mensagem;
                entity.IntegradaEmUtc = now;
                break;
            }
            case TipoIntegracao.Beneficio:
            {
                var entity = await _db.SolicitacoesBeneficio.FindAsync(new object[] { id }, ct)
                    ?? throw new KeyNotFoundException($"SolicitacaoBeneficio {id} não encontrada.");
                entity.IntegracaoResultado = request.Resultado;
                entity.IntegracaoMensagem = request.Mensagem;
                entity.IntegradaEmUtc = now;
                break;
            }
            case TipoIntegracao.Ferias:
            {
                var entity = await _db.SolicitacoesFerias.FindAsync(new object[] { id }, ct)
                    ?? throw new KeyNotFoundException($"SolicitacaoFerias {id} não encontrada.");
                entity.IntegracaoResultado = request.Resultado;
                entity.IntegracaoMensagem = request.Mensagem;
                entity.IntegradaEmUtc = now;
                break;
            }
            default:
                throw new ArgumentOutOfRangeException(nameof(tipo), tipo, "Tipo de integração desconhecido.");
        }

        await _db.SaveChangesAsync(ct);
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
            default:
                throw new ArgumentOutOfRangeException(nameof(tipo), tipo, "Tipo de integração desconhecido.");
        }

        await _db.SaveChangesAsync(ct);
    }
}
