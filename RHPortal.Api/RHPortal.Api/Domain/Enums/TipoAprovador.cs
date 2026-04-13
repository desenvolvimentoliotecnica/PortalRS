namespace RhPortal.Api.Domain.Enums;

public enum TipoAprovador : short
{
    /// <summary>Gestor direto do solicitante (Funcionario.GestorDiretoId).</summary>
    GestorDireto            = 0,
    /// <summary>Gestor do gestor direto (2º nível da hierarquia de pessoas).</summary>
    GestorDoGestor          = 1,
    /// <summary>Responsável da unidade de lotação do funcionário envolvido (UnidadeLotacao.OwnerFuncionarioId).</summary>
    ResponsavelUnidade      = 2,
    /// <summary>Responsável da unidade pai (gerência – Parent.OwnerFuncionarioId).</summary>
    ResponsavelUnidadePai   = 3,
    /// <summary>Responsável da unidade raiz (diretoria – walk ParentId até null).</summary>
    ResponsavelUnidadeRaiz  = 4,
    /// <summary>Funcionário fixo específico (FuncionarioFixoId).</summary>
    FuncionarioFixo         = 5,
    /// <summary>Fila de perfil: qualquer usuário do RoleFilaId pode assumir e aprovar.</summary>
    FilaDePerfil            = 6,
    /// <summary>Etapa automática: cria a Vaga em rascunho. Sem aprovador. Auto-avança para a próxima etapa.</summary>
    CriarVagaRascunho       = 7,
    /// <summary>Etapa automática: marca a solicitação como Aprovada e aciona a fila de integração TOTVS. Auto-avança.</summary>
    EnviarIntegracao        = 8,
    /// <summary>Etapa manual de revisão pelo RH: alguém do perfil configurado (RoleFilaId) revisa e confirma os dados.</summary>
    RevisaoRH               = 9,
}
