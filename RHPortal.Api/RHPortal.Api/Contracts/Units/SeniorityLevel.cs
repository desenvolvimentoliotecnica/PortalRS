using System.ComponentModel.DataAnnotations;

namespace RhPortal.Api.Domain.Enums;

public enum SeniorityLevel
{
    [Display(Name = "Junior", ShortName = "Junior")]
    Junior = 1,

    [Display(Name = "Pleno", ShortName = "Pleno")]
    Pleno = 2,

    [Display(Name = "Senior", ShortName = "Senior")]
    Senior = 3,

    [Display(Name = "Especialista", ShortName = "Especialista")]
    Especialista = 4,

    [Display(Name = "Gestao", ShortName = "Gestao")]
    Gestao = 5,

    [Display(Name = "Estagio", ShortName = "Estagio")]
    Estagio = 6,

    [Display(Name = "Coordenacao", ShortName = "Coordenacao")]
    Coordenacao = 7,

    [Display(Name = "Gerencia", ShortName = "Gerencia")]
    Gerencia = 8,

    [Display(Name = "Diretoria", ShortName = "Diretoria")]
    Diretoria = 9
}
