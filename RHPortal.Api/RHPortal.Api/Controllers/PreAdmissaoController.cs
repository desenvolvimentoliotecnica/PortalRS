using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.PreAdmissao;
using RhPortal.Api.Contracts.PreAdmissao;
using RhPortal.Api.Domain.Enums;
using RhPortal.Api.Infrastructure.Tenancy;

namespace RhPortal.Api.Controllers;

/// <summary>
/// Portal de Admissão — pré-admissão de funcionários com workflow de aprovação.
/// </summary>
[ApiController]
[Route("api/pre-admissao")]
[Authorize]
public sealed class PreAdmissaoController : ControllerBase
{
    private readonly IPreAdmissaoService _service;
    private readonly ICurrentUserContext _userContext;

    public PreAdmissaoController(IPreAdmissaoService service, ICurrentUserContext userContext)
    {
        _service = service;
        _userContext = userContext;
    }

    /// <summary>Lista pré-admissões com filtro e paginação.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<PreAdmissaoGridRow>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] string? q,
        [FromQuery] PreAdmissaoStatus? status,
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        CancellationToken ct)
    {
        var query = new PreAdmissaoListQuery(q, status, page, pageSize);
        return Ok(await _service.ListAsync(query, ct));
    }

    /// <summary>Retorna detalhe de uma pré-admissão.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(PreAdmissaoDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await _service.GetByIdAsync(id, ct);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>Cria uma nova pré-admissão (rascunho).</summary>
    [HttpPost]
    [ProducesResponseType(typeof(PreAdmissaoDetailResponse), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] PreAdmissaoCreateRequest request, CancellationToken ct)
    {
        var result = await _service.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    /// <summary>Atualiza dados de uma pré-admissão em rascunho.</summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(PreAdmissaoDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid id, [FromBody] PreAdmissaoUpdateRequest request, CancellationToken ct)
    {
        var result = await _service.UpdateAsync(id, request, ct);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>Submete a pré-admissão para revisão do RH (Rascunho → EmRevisão).</summary>
    [HttpPost("{id:guid}/submit")]
    [ProducesResponseType(typeof(PreAdmissaoDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Submit(Guid id, CancellationToken ct)
    {
        var result = await _service.SubmitAsync(id, ct);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>Aprova a pré-admissão (EmRevisão → Aprovada).</summary>
    [HttpPost("{id:guid}/approve")]
    [ProducesResponseType(typeof(PreAdmissaoDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Approve(Guid id, [FromBody] PreAdmissaoApproveRequest request, CancellationToken ct)
    {
        if (_userContext.FuncionarioId is not { } aprovadorId)
            return Forbid();
        var result = await _service.ApproveAsync(id, aprovadorId, request, ct);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>Rejeita a pré-admissão (EmRevisão → Rejeitada).</summary>
    [HttpPost("{id:guid}/reject")]
    [ProducesResponseType(typeof(PreAdmissaoDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Reject(Guid id, [FromBody] PreAdmissaoRejectRequest request, CancellationToken ct)
    {
        var result = await _service.RejectAsync(id, request, ct);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>Busca por CPF para readmissão — retorna dados da pessoa se existir.</summary>
    [HttpGet("buscar-cpf/{cpf}")]
    [ProducesResponseType(typeof(BuscaCpfResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> BuscarCpf(string cpf, CancellationToken ct)
    {
        var result = await _service.BuscarPorCpfAsync(cpf, ct);
        return Ok(result);
    }

    /// <summary>Upload de documento na pré-admissão (máx 10 MB).</summary>
    [HttpPost("{id:guid}/documentos")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(PreAdmissaoDocumentoResponse), StatusCodes.Status201Created)]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<IActionResult> UploadDocumento(Guid id, [FromForm] UploadDocumentoRequest request, CancellationToken ct)
    {
        var ext = Path.GetExtension(request.File.FileName).ToLower();
        if (ext is not (".pdf" or ".jpg" or ".jpeg" or ".png"))
            return BadRequest("Tipo de arquivo não permitido. Use PDF, JPG ou PNG.");

        using var stream = request.File.OpenReadStream();
        var result = await _service.UploadDocumentoAsync(id, request.Tipo, request.File.FileName, request.File.ContentType, request.File.Length, stream, ct);
        return Created("", result);
    }

    /// <summary>Remove um documento da pré-admissão.</summary>
    [HttpDelete("{id:guid}/documentos/{docId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteDocumento(Guid id, Guid docId, CancellationToken ct)
    {
        return await _service.DeleteDocumentoAsync(id, docId, ct) ? NoContent() : NotFound();
    }

    /// <summary>RH define quais documentos solicitar ao candidato (checkbox).</summary>
    [HttpPost("{id:guid}/documentos-solicitados")]
    [ProducesResponseType(typeof(IReadOnlyList<DocumentoSolicitadoResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> SalvarDocumentosSolicitados(
        Guid id, [FromBody] SalvarDocumentosSolicitadosRequest request, CancellationToken ct)
    {
        try { return Ok(await _service.SalvarDocumentosSolicitadosAsync(id, request, ct)); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    /// <summary>RH gera link de acesso externo para o candidato preencher dados e documentos.</summary>
    [HttpPost("{id:guid}/gerar-link")]
    [ProducesResponseType(typeof(GerarLinkResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GerarLink(
        Guid id, [FromBody] GerarLinkRequest request, CancellationToken ct)
    {
        try
        {
            var result = await _service.GerarLinkAsync(id, request, ct);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    /// <summary>RH valida (aprova/rejeita) um documento individual da pré-admissão.</summary>
    [HttpPatch("{id:guid}/documentos/{docId:guid}/validar")]
    [ProducesResponseType(typeof(ValidarDocumentoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ValidarDocumento(
        Guid id, Guid docId, [FromBody] ValidarDocumentoRequest request, CancellationToken ct)
    {
        try
        {
            var result = await _service.ValidarDocumentoAsync(id, docId, request, ct);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    // ── Admissão Manual ──

    /// <summary>
    /// RH inicia admissão manual a partir de um candidato aprovado no recrutamento.
    /// </summary>
    /// <remarks>
    /// Cria uma pré-admissão com status <b>Rascunho</b> pré-preenchida com os dados do candidato.
    /// O RH preenche os demais dados no wizard e sobe os documentos normalmente.
    ///
    /// **Pré-requisito:** candidato deve estar com status <c>Aprovado</c> no módulo de R&amp;S.
    /// </remarks>
    [HttpPost("iniciar-manual")]
    [ProducesResponseType(typeof(PreAdmissaoDetailResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> IniciarManual([FromBody] IniciarManualRequest request, CancellationToken ct)
    {
        try
        {
            var result = await _service.IniciarManualAsync(request, ct);
            return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // ── Fluxo Ítalo — Gestor aprova contratação ──

    /// <summary>
    /// Gestor aprova a contratação do candidato — inicia coleta de documentos via Ítalo (WhatsApp).
    /// </summary>
    /// <remarks>
    /// Cria uma pré-admissão com status **PreenchimentoPendente (1)** e notifica a API do Ítalo
    /// para que o candidato receba uma mensagem no WhatsApp solicitando RG, CPF e comprovante de residência.
    ///
    /// **Fluxo a partir daqui:**
    /// 1. Ítalo envia documentos ao candidato → candidato responde → Lambda OCR processa
    /// 2. Ítalo chama `POST /api/pre-admissao/{id}/documentos-externos` com dados extraídos
    /// 3. Quando RG + Comprovante chegam → status muda para **EmRevisão (2)**
    /// 4. RH revisa e aprova → status **Aprovada (3)** → aparece para Gabriel
    /// </remarks>
    [HttpPost("aprovar-contratacao")]
    [ProducesResponseType(typeof(PreAdmissaoDetailResponse), StatusCodes.Status201Created)]
    public async Task<IActionResult> AprovarContratacao([FromBody] AprovarContratacaoRequest request, CancellationToken ct)
    {
        var result = await _service.AprovarContratacaoAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    /// <summary>
    /// [Ítalo] Webhook que recebe dados OCR de documentos coletados via WhatsApp.
    /// </summary>
    /// <remarks>
    /// Chamado pela API do Ítalo após processar cada documento enviado pelo candidato.
    /// Preenche os campos da pré-admissão com os dados extraídos e salva o documento.
    ///
    /// **Tipos de documento aceitos:**
    /// - `"rg"` → preenche Nome, RG, CPF (se ausente)
    /// - `"cpf"` → preenche CPF (se ausente)
    /// - `"comprovante_residencia"` → preenche CEP, logradouro, bairro, cidade, UF
    ///
    /// Quando **RG + Comprovante** chegam, o status avança automaticamente para **EmRevisão (2)**.
    ///
    /// **Autenticação:** exclusivamente via `X-Api-Key`.
    /// </remarks>
    /// <param name="id">ID da pré-admissão retornado em `POST /api/pre-admissao/aprovar-contratacao`.</param>
    [HttpPost("{id:guid}/documentos-externos")]
    [Authorize(Roles = "ApiKey")]
    [ProducesResponseType(typeof(PreAdmissaoDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ReceberDocumentosExternos(Guid id, [FromBody] DocumentoExternoRequest request, CancellationToken ct)
    {
        var result = await _service.ReceberDocumentosExternosAsync(id, request, ct);
        return result is null ? NotFound() : Ok(result);
    }

    // ── Integração TOTVS — Node.js (API Key only) ──

    /// <summary>
    /// [TOTVS] Fila de pré-admissões aguardando integração com TOTVS Progress Datasul.
    /// </summary>
    /// <remarks>
    /// Retorna todas as pré-admissões do tenant com status **Aprovada (3)** ordenadas por data de aprovação (FIFO).
    /// Cada item representa um colaborador pronto para ser cadastrado no Progress.
    ///
    /// **Autenticação:** exclusivamente via `X-Api-Key` — não aceita JWT humano.
    /// O tenant é resolvido automaticamente a partir da chave fornecida; é obrigatório também enviar `X-Tenant-Id`.
    ///
    /// **Fluxo recomendado:**
    /// 1. `GET /api/pre-admissao/integracao/pendentes` → obtém a fila
    /// 2. Para cada `id`, `GET /api/pre-admissao/{id}` → obtém todos os dados do colaborador
    /// 3. Cadastra no Progress Datasul
    /// 4. `POST /api/pre-admissao/{id}/integracao/resultado` → reporta sucesso ou falha
    /// </remarks>
    [HttpGet("integracao/pendentes")]
    [Authorize(Roles = "ApiKey")]
    [ProducesResponseType(typeof(IReadOnlyList<PreAdmissaoPendenteIntegracaoRow>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListPendentesIntegracao(CancellationToken ct)
        => Ok(await _service.ListPendentesIntegracaoAsync(ct));

    /// <summary>
    /// [TOTVS] Reporta o resultado de uma tentativa de integração com TOTVS Progress Datasul.
    /// </summary>
    /// <remarks>
    /// Deve ser chamado após cada tentativa de cadastro no Progress, independente do resultado.
    ///
    /// **Comportamento por resultado:**
    /// - `"sucesso"` → status muda para **Integrada (5)**, preenche `integradaEmUtc`. Sai da fila permanentemente.
    /// - `"falha"` → status **permanece Aprovada (3)**, registro volta para a fila na próxima chamada de pendentes. Use `mensagem` para registrar o erro.
    ///
    /// **Body:**
    /// ```json
    /// {
    ///   "status": "sucesso",   // ou "falha" (obrigatório, case-insensitive)
    ///   "mensagem": "..."      // opcional — erro ou confirmação do Progress
    /// }
    /// ```
    ///
    /// **Autenticação:** exclusivamente via `X-Api-Key`.
    /// </remarks>
    /// <param name="id">ID (GUID) da pré-admissão retornado pela fila de pendentes.</param>
    [HttpPost("{id:guid}/integracao/resultado")]
    [Authorize(Roles = "ApiKey")]
    [ProducesResponseType(typeof(PreAdmissaoDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RegistrarResultadoIntegracao(
        Guid id, [FromBody] IntegracaoResultadoRequest request, CancellationToken ct)
    {
        var statusLower = request.Status?.ToLower();
        if (statusLower is not ("sucesso" or "falha"))
            return BadRequest("O campo 'status' deve ser 'sucesso' ou 'falha'.");

        var (result, error) = await _service.RegistrarResultadoIntegracaoAsync(id, request, ct);
        if (result is null && error is null) return NotFound();
        if (error is not null) return BadRequest(new { message = error });
        return Ok(result);
    }

    // ── Painel de Integração — usuários do tenant (JWT) ──

    /// <summary>
    /// Painel de integração TOTVS do tenant — histórico de Aprovadas e Integradas.
    /// </summary>
    /// <remarks>
    /// Exibe pré-admissões nos status **Aprovada (3)** (pendentes) e **Integrada (5)** (concluídas).
    /// Filtro opcional por resultado: **1 = Sucesso**, **2 = Falha**.
    /// Autenticação via JWT. Usuário vê apenas dados do seu próprio tenant.
    /// </remarks>
    /// <param name="resultado">Filtro opcional: 1 = Sucesso, 2 = Falha. Omitir retorna todos.</param>
    [HttpGet("integracao/painel")]
    [ProducesResponseType(typeof(IReadOnlyList<PreAdmissaoPainelIntegracaoRow>), StatusCodes.Status200OK)]
    public async Task<IActionResult> PainelIntegracao(
        [FromQuery] IntegracaoResultado? resultado, CancellationToken ct)
        => Ok(await _service.ListPainelIntegracaoAsync(resultado, ct));
}
