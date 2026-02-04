using System.Net.Http;
using LioTecnica.Web.Infrastructure.ApiClients;
using LioTecnica.Web.Infrastructure.Security;
using LioTecnica.Web.ViewModels;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using RhPortal.Web.Infrastructure.ApiClients;

namespace LioTecnica.Web.Controllers;

public sealed class UnidadesController : Controller
{
    private readonly UnitsApiClient _unitsApi;
    private readonly FuncionariosApiClient _funcionariosApi;
    private readonly OwnerTenantsApiClient _ownerTenantsApi;
    private readonly PortalTenantContext _tenantContext;

    [ActivatorUtilitiesConstructor]
    public UnidadesController(
        UnitsApiClient unitsApi,
        FuncionariosApiClient funcionariosApi,
        OwnerTenantsApiClient ownerTenantsApi,
        PortalTenantContext tenantContext)
    {
        _unitsApi = unitsApi;
        _funcionariosApi = funcionariosApi;
        _ownerTenantsApi = ownerTenantsApi;
        _tenantContext = tenantContext;
    }

    [HttpGet("/Unidades")]
    public IActionResult Index()
    {
        var vm = new PageSeedViewModel
        {
            SeedJson = "{}"
        };

        return View("Index", vm);
    }

    [HttpGet("/Unidades/_api")]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;

        // Owner: agregar unidades de todos os tenants (mostrar tudo)
        if (string.Equals(tenantId, "owner", StringComparison.OrdinalIgnoreCase))
        {
            var tenants = await _ownerTenantsApi.ListTenantsAsync(ct);
            var allItems = new List<UnitApiItem>();
            if (tenants is { Count: > 0 })
            {
                foreach (var t in tenants.Where(x => x.IsActive))
                {
                    var paged = await _ownerTenantsApi.ListTenantUnitsAsync(t.TenantId, ct);
                    if (paged?.Items is { Count: > 0 })
                        allItems.AddRange(paged.Items);
                }
            }
            var items = allItems.Select(MapToFrontUnidade).ToList();
            return Ok(new
            {
                items,
                Page = 1,
                PageSize = items.Count,
                TotalItems = items.Count,
                TotalPages = items.Count == 0 ? 0 : 1
            });
        }

        var api = await _unitsApi.GetUnitsAsync(tenantId, ct);

        var itemsNormal = (api?.Items is { Count: > 0 })
            ? api.Items.Select(MapToFrontUnidade).ToList()
            : new List<object>();

        return Ok(new
        {
            items = itemsNormal,
            api!.Page,
            api.PageSize,
            api.TotalItems,
            api.TotalPages
        });
    }

    [HttpGet("/Unidades/_api/{id:guid}")]
    public async Task<IActionResult> GetById([FromRoute] Guid id, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var item = await _unitsApi.GetByIdAsync(tenantId, id, ct);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost("/Unidades/_api")]
    public async Task<IActionResult> Create([FromBody] UnitCreateRequest request, CancellationToken ct)
    {
        if (request is null)
            return BadRequest(new { message = "Corpo da requisição inválido." });

        // API exige Code, Name e Status (enum). Normaliza para não enviar null.
        var payload = new UnitCreateRequest
        {
            Code = (request.Code ?? "").Trim(),
            Name = (request.Name ?? "").Trim(),
            Status = NormalizeStatus(request.Status),
            City = request.City?.Trim(),
            Uf = request.Uf?.Trim(),
            AddressLine = request.AddressLine?.Trim(),
            Neighborhood = request.Neighborhood?.Trim(),
            ZipCode = request.ZipCode?.Trim(),
            Email = request.Email?.Trim(),
            Phone = request.Phone?.Trim(),
            ResponsibleName = request.ResponsibleName?.Trim(),
            Type = request.Type?.Trim(),
            Headcount = request.Headcount,
            Notes = request.Notes?.Trim()
        };

        if (string.IsNullOrEmpty(payload.Code) || string.IsNullOrEmpty(payload.Name))
            return BadRequest(new { message = "Código e nome são obrigatórios." });

        var tenantId = _tenantContext.TenantId;
        try
        {
            var created = await _unitsApi.CreateAsync(tenantId, payload, ct);
            return Ok(created);
        }
        catch (HttpRequestException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>Garante status aceito pela API: Active ou Inactive.</summary>
    private static string NormalizeStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status)) return "Active";
        var s = status.Trim();
        if (s.Equals("Inactive", StringComparison.OrdinalIgnoreCase)) return "Inactive";
        return "Active";
    }

    [HttpPut("/Unidades/_api/{id:guid}")]
    public async Task<IActionResult> Update([FromRoute] Guid id, [FromBody] UnitUpdateRequest request, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var updated = await _unitsApi.UpdateAsync(tenantId, id, request, ct);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("/Unidades/_api/{id:guid}")]
    public async Task<IActionResult> Delete([FromRoute] Guid id, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;
        var ok = await _unitsApi.DeleteAsync(tenantId, id, ct);
        return ok ? NoContent() : NotFound();
    }

    [HttpGet("/api/lookup/units")]
    public async Task<IActionResult> UnitsLookup(CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;

        var api = await _unitsApi.GetUnitsAsync(tenantId, ct);

        var items = (api?.Items is { Count: > 0 })
            ? api.Items
                .Select(u => (object)new
                {
                    id = u.Id.ToString(),
                    code = u.Code ?? "",
                    name = u.Name ?? ""
                })
                .ToList()
            : new List<object>();

        return Ok(items); // array direto
    }

    [HttpGet("/Unidades/{id:guid}/funcionarios")]
    public async Task<IActionResult> FuncionariosDaUnidade([FromRoute] Guid id, CancellationToken ct)
    {
        var tenantId = _tenantContext.TenantId;

        var api = await _funcionariosApi.GetFuncionariosByUnitAsync(tenantId, id, page: 1, pageSize: 200, ct);

        var items = (api?.Items ?? new()).Select(m => new
        {
            id = m.Id,
            nome = m.Name,
            email = m.Email,
            cargo = m.JobPositionName,
            area = m.AreaName,
            unidade = m.UnitName,
            status = m.Status == 1 ? "ativo" : "inativo",
            headcount = m.Headcount
        });

        return Ok(new { items });
    }

    // ====== MAPEAMENTO ======
    private static object MapToFrontUnidade(UnitApiItem u)
    {
        static string MapStatus(string? s)
        {
            if (string.IsNullOrWhiteSpace(s)) return "inativo";
            return s.Equals("Active", StringComparison.OrdinalIgnoreCase) ? "ativo" : "inativo";
        }

        // O JS usa:
        // id, codigo, nome, status, cidade, uf, endereco, bairro, cep, email, telefone, responsavel, tipo, headcount, observacao
        return new
        {
            id = u.Id.ToString(),
            codigo = u.Code ?? "",
            nome = u.Name ?? "",
            status = MapStatus(u.Status),
            headcount = u.Headcount,
            email = u.Email ?? "",
            telefone = u.Phone ?? "",
            tipo = u.Type ?? "",
            cidade = u.City ?? "",
            uf = (u.Uf ?? "").ToUpperInvariant(),

            endereco = u.AddressLine ?? "",
            bairro = u.Neighborhood ?? "",
            cep = u.ZipCode ?? "",
            responsavel = u.ResponsibleName ?? "",
            observacao = u.Notes ?? "",
        };
    }
}
