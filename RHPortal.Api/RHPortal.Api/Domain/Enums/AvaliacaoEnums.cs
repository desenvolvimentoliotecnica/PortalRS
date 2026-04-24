namespace RhPortal.Api.Domain.Enums;

public enum AvaliacaoCicloStatus : short
{
    Aberto = 0,
    Fechado = 1,
    /// <summary>Ciclo em preparação — não aceita respostas até ser ativado.</summary>
    Rascunho = 2,
    /// <summary>Respostas encerradas; comitê calibrando notas.</summary>
    EmCalibragem = 3,
}

/// <summary>Relação de avaliação gerada automaticamente ao ativar um ciclo.</summary>
public enum AvaliacaoConviteTipo : short
{
    /// <summary>Funcionário avalia a si mesmo.</summary>
    Autoavaliacao = 0,
    /// <summary>Gestor direto avalia um subordinado.</summary>
    GestorParaDireto = 1,
    /// <summary>Subordinado avalia o próprio gestor direto.</summary>
    DiretoParaGestor = 2,
    /// <summary>Avaliação entre pares (mesmo gestor direto).</summary>
    Par = 3,
}

public enum AvaliacaoConviteStatus : short
{
    /// <summary>Convite criado; aguardando resposta.</summary>
    Pendente = 0,
    /// <summary>Avaliador já submeteu resposta para o avaliando.</summary>
    Respondido = 1,
    /// <summary>Convite cancelado (ciclo fechado sem resposta, por exemplo).</summary>
    Cancelado = 2,
}

/// <summary>Estado da linha de calibragem para um avaliando dentro do ciclo.</summary>
public enum AvaliacaoCalibragemStatus : short
{
    /// <summary>Linha criada com nota do gestor; comitê ainda não ajustou.</summary>
    Pendente = 0,
    /// <summary>Comitê registrou a nota calibrada (pode divergir do gestor).</summary>
    Calibrado = 1,
    /// <summary>Gestor deu palavra final escolhendo a versão (Gestor ou Comitê).</summary>
    Decidido = 2,
}

/// <summary>Versão da nota finalmente homologada para o avaliando.</summary>
public enum AvaliacaoCalibragemVersao : short
{
    /// <summary>Ainda não houve decisão final.</summary>
    Indefinida = 0,
    /// <summary>Gestor manteve sua avaliação original.</summary>
    Gestor = 1,
    /// <summary>Gestor acatou a calibragem do comitê.</summary>
    Comite = 2,
}
