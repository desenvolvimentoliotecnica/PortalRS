using System.Security.Claims;
using RHPortal.Api.Domain.Enums;

namespace RhPortal.Api.Infrastructure.Tenancy;

/// <summary>
/// Contexto do usuário autenticado na requisição (roles, funcionário/área, unidades de acesso).
/// Usado para filtrar listagens e detalhes por área (perfil Gestor) e por unidade.
/// </summary>
public interface ICurrentUserContext
{
    /// <summary>ID do usuário quando autenticado.</summary>
    Guid? UserId { get; }

    /// <summary>Indica se a requisição tem usuário autenticado.</summary>
    bool IsAuthenticated { get; }

    /// <summary>Verifica se o usuário tem a role informada.</summary>
    bool IsInRole(string role);

    /// <summary>True quando o usuário tem role Admin (acesso sem restrição por área/unidade).</summary>
    bool IsAdmin { get; }

    /// <summary>True quando o usuário tem perfil de RH (visão total de solicitações sem filtro por solicitante).</summary>
    bool IsRH { get; }

    /// <summary>True quando o usuário é Owner global (multi-tenant). Owner não pode assumir etapas de consenso.</summary>
    bool IsOwner { get; }

    /// <summary>ID do funcionário vinculado ao usuário (quando perfil Gestor).</summary>
    Guid? FuncionarioId { get; }

    /// <summary>
    /// ID do centro de custo do funcionário vinculado (quando perfil Gestor com FuncionarioId).
    /// Em 31.2, CentroCusto absorveu Area: o mesmo escopo organizacional que antes era "área"
    /// agora é representado pelo Centro de Custo do funcionário.
    /// </summary>
    Guid? CentroCustoId { get; }

    /// <summary>True quando o usuário é Gestor e tem centro de custo definido (deve filtrar por CentroCustoId).</summary>
    bool IsGestorWithCentroCusto { get; }

    /// <summary>IDs das unidades às quais o usuário tem acesso (vazio = sem restrição por unidade ou nenhuma unidade).</summary>
    IReadOnlyList<Guid> UnitIds { get; }

    /// <summary>Escopo de visão do perfil (estrutura completa ou restrito à área/recrutador).</summary>
    ProfileVisibilityScope VisibilityScope { get; }

    /// <summary>Escopo de dados para vagas: todas, por área ou por recrutador.</summary>
    VagasDataScope VagasDataScope { get; }

    /// <summary>True quando o perfil é somente leitura (bloquear POST/PUT/DELETE).</summary>
    bool IsReadOnly { get; }

    /// <summary>E-mail do usuário autenticado (extraído do JWT).</summary>
    string? Email { get; }
}
