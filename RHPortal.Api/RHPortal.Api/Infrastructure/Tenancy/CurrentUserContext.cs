using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using RhPortal.Api.Infrastructure.Data;
using RhPortal.Api.Infrastructure.Security;
using RHPortal.Api.Domain.Enums;

namespace RhPortal.Api.Infrastructure.Tenancy;

public sealed class CurrentUserContext : ICurrentUserContext
{
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly AppDbContext _db;
    private Guid? _userId;
    private bool _userIdResolved;
    private Guid? _funcionarioId;
    private Guid? _centroCustoId;
    private bool _claimsResolved;
    private IReadOnlyList<string>? _roleNames;
    private IReadOnlyList<Guid>? _unitIds;
    private bool _unitIdsResolved;
    private ProfileVisibilityScope _visibilityScope;
    private VagasDataScope _vagasDataScope;
    private bool _isReadOnly;
    private string? _email;

    public CurrentUserContext(IHttpContextAccessor httpContextAccessor, AppDbContext db)
    {
        _httpContextAccessor = httpContextAccessor;
        _db = db;
    }

    public Guid? UserId
    {
        get
        {
            if (_userIdResolved)
                return _userId;
            var user = _httpContextAccessor.HttpContext?.User;
            if (user?.Identity?.IsAuthenticated != true)
            {
                _userIdResolved = true;
                return _userId;
            }
            var idClaim = user.FindFirstValue(ClaimTypes.NameIdentifier);
            _userId = Guid.TryParse(idClaim, out var uid) ? uid : null;
            _userIdResolved = true;
            return _userId;
        }
    }

    public bool IsAuthenticated => _httpContextAccessor.HttpContext?.User?.Identity?.IsAuthenticated == true;

    public bool IsInRole(string role)
    {
        if (string.IsNullOrEmpty(role))
            return false;
        EnsureClaimsResolved();
        return _roleNames?.Contains(role, StringComparer.OrdinalIgnoreCase) ?? false;
    }

    public bool IsOwner => IsInRole("Owner");
    public bool IsAdmin => IsInRole("Admin") || IsInRole("Owner") || IsInRole("Administrador");
    public bool IsRH => IsInRole("RH");

    public Guid? FuncionarioId
    {
        get
        {
            EnsureClaimsResolved();
            return _funcionarioId;
        }
    }

    public Guid? CentroCustoId
    {
        get
        {
            EnsureClaimsResolved();
            return _centroCustoId;
        }
    }

    public bool IsGestorWithCentroCusto => IsInRole("Gestor") && CentroCustoId.HasValue && CentroCustoId.Value != Guid.Empty;

    public ProfileVisibilityScope VisibilityScope
    {
        get
        {
            EnsureClaimsResolved();
            return _visibilityScope;
        }
    }

    public VagasDataScope VagasDataScope
    {
        get
        {
            EnsureClaimsResolved();
            return _vagasDataScope;
        }
    }

    public bool IsReadOnly
    {
        get
        {
            EnsureClaimsResolved();
            return _isReadOnly;
        }
    }

    public string? Email
    {
        get
        {
            EnsureClaimsResolved();
            return _email;
        }
    }

    public IReadOnlyList<Guid> UnitIds
    {
        get
        {
            if (_unitIdsResolved)
                return _unitIds ?? Array.Empty<Guid>();
            _unitIdsResolved = true;
            var uid = UserId;
            if (!uid.HasValue)
                return _unitIds = Array.Empty<Guid>();
            _unitIds = _db.UserUnits
                .AsNoTracking()
                .Where(x => x.UserId == uid.Value)
                .Select(x => x.UnitId)
                .ToList();
            return _unitIds;
        }
    }

    private void EnsureClaimsResolved()
    {
        if (_claimsResolved)
            return;
        _claimsResolved = true;
        var user = _httpContextAccessor.HttpContext?.User;
        if (user is null)
            return;
        _roleNames = user.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();
        _email = user.FindFirstValue(ClaimTypes.Email);
        var funcionarioIdClaim = user.FindFirst("funcionario_id")?.Value;
        _funcionarioId = Guid.TryParse(funcionarioIdClaim, out var fid) ? fid : null;
        // 31.2: claim "area_id" renomeada para "centro_custo_id"; mantemos fallback em leitura
        // para tokens antigos ainda válidos, mas emitimos sempre "centro_custo_id" em AuthenticationService.
        var centroCustoIdClaim = user.FindFirst("centro_custo_id")?.Value
            ?? user.FindFirst("area_id")?.Value;
        _centroCustoId = Guid.TryParse(centroCustoIdClaim, out var ccid) ? ccid : null;

        var visibilityScopeClaim = user.FindFirst(PermissionConstants.ClaimVisibilityScope)?.Value;
        if (short.TryParse(visibilityScopeClaim, out var vs) && Enum.IsDefined(typeof(ProfileVisibilityScope), (ProfileVisibilityScope)vs))
            _visibilityScope = (ProfileVisibilityScope)vs;
        else
            _visibilityScope = IsGestorWithCentroCusto ? ProfileVisibilityScope.RestrictedByAreaOrRecruiter : ProfileVisibilityScope.FullStructure;

        var vagasDataScopeClaim = user.FindFirst(PermissionConstants.ClaimVagasDataScope)?.Value;
        if (short.TryParse(vagasDataScopeClaim, out var vds) && Enum.IsDefined(typeof(VagasDataScope), (VagasDataScope)vds))
            _vagasDataScope = (VagasDataScope)vds;
        else
            _vagasDataScope = IsGestorWithCentroCusto ? VagasDataScope.ByArea : VagasDataScope.All;

        var accessModeClaim = user.FindFirst(PermissionConstants.ClaimAccessMode)?.Value;
        if (short.TryParse(accessModeClaim, out var am) && Enum.IsDefined(typeof(ProfileAccessMode), (ProfileAccessMode)am))
            _isReadOnly = (ProfileAccessMode)am == ProfileAccessMode.ReadOnly;
        else
            _isReadOnly = false;
    }
}
