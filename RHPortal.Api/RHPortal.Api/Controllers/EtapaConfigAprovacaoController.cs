using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RhPortal.Api.Application.EtapasConfigAprovacao;
using RhPortal.Api.Contracts.Common;
using RhPortal.Api.Domain.Enums;

namespace RhPortal.Api.Controllers;

[ApiController]
[Route("api/etapas-config-aprovacao")]
[Authorize]
public sealed class EtapaConfigAprovacaoController : ControllerBase
{
    private readonly IEtapaConfigAprovacaoService _service;
    private readonly Infrastructure.Tenancy.ICurrentUserContext _userContext;

    public EtapaConfigAprovacaoController(
        IEtapaConfigAprovacaoService service,
        Infrastructure.Tenancy.ICurrentUserContext userContext)
    {
        _service = service;
        _userContext = userContext;
    }

    [HttpGet("{tipoFluxo:int}")]
    public async Task<IActionResult> Get(int tipoFluxo, CancellationToken ct)
    {
        if (!Enum.IsDefined(typeof(TipoFluxoAprovacao), (short)tipoFluxo))
            return BadRequest("Tipo de fluxo inválido.");
        var result = await _service.ListAsync((TipoFluxoAprovacao)(short)tipoFluxo, ct);
        return Ok(result);
    }

    [HttpPut("{tipoFluxo:int}")]
    public async Task<IActionResult> Put(
        int tipoFluxo,
        [FromBody] List<EtapaConfigAprovacaoSaveRequest> etapas,
        CancellationToken ct)
    {
        if (!_userContext.IsAdmin) return Forbid();
        if (!Enum.IsDefined(typeof(TipoFluxoAprovacao), (short)tipoFluxo))
            return BadRequest("Tipo de fluxo inválido.");
        var result = await _service.UpsertAsync((TipoFluxoAprovacao)(short)tipoFluxo, etapas, ct);
        return Ok(result);
    }

    [HttpGet("{tipoFluxo:int}/global")]
    public async Task<IActionResult> GetGlobal(int tipoFluxo, CancellationToken ct)
    {
        if (!Enum.IsDefined(typeof(TipoFluxoAprovacao), (short)tipoFluxo))
            return BadRequest("Tipo de fluxo inválido.");
        var result = await _service.GetConfigGlobalAsync((TipoFluxoAprovacao)(short)tipoFluxo, ct);
        return Ok(result);
    }

    [HttpPut("{tipoFluxo:int}/global")]
    public async Task<IActionResult> PutGlobal(
        int tipoFluxo,
        [FromBody] FluxoAprovacaoConfigSaveRequest req,
        CancellationToken ct)
    {
        if (!_userContext.IsAdmin) return Forbid();
        if (!Enum.IsDefined(typeof(TipoFluxoAprovacao), (short)tipoFluxo))
            return BadRequest("Tipo de fluxo inválido.");
        var result = await _service.SaveConfigGlobalAsync((TipoFluxoAprovacao)(short)tipoFluxo, req, ct);
        return Ok(result);
    }
}
