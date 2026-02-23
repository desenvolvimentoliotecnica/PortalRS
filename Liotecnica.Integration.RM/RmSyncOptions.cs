namespace Liotecnica.Integration.RM;

/// <summary>
/// Opções do worker de sincronização RM (intervalo entre ciclos e flags por entidade).
/// </summary>
public sealed class RmSyncOptions
{
    public const string SectionName = "RmSync";

    /// <summary>Intervalo em minutos entre cada ciclo completo de sincronização. Padrão: 5.</summary>
    public int IntervalMinutes { get; set; } = 5;

    /// <summary>Se true, unidades/estabelecimentos (GFILIAL) estão ativas no integrador. Padrão: true.</summary>
    public bool SyncUnits { get; set; } = true;

    /// <summary>Se true, executa o envio de unidades para api/units. Padrão: false (ainda não executa o código).</summary>
    public bool SyncUnitsExecute { get; set; }

    /// <summary>Se true, integra vagas em aberto (RM → Portal). Padrão: true.</summary>
    public bool SyncVagas { get; set; } = true;

    /// <summary>Se true, executa APENAS extração de vagas em aberto + envio de vagas para api/vagas (não extrai nem envia áreas, cargos, unidades, pessoas, funcionários). Use para não duplicar os outros dados. Padrão: false.</summary>
    public bool SyncVagasOnly { get; set; }

    /// <summary>Código da Área já cadastrada no Portal (synced de PSECAO). Se informado, as vagas usarão essa área em vez da primeira da lista. Ex.: "01".</summary>
    public string? VagaDefaultAreaCode { get; set; }

    /// <summary>Código do Departamento já cadastrado no Portal. Se informado, as vagas usarão esse departamento em vez do primeiro da lista. Ex.: "DEP-01".</summary>
    public string? VagaDefaultDepartmentCode { get; set; }

    /// <summary>Se true, após o sync de vagas extrai candidatos por vaga (VRS) para candidato_vaga.json e registra no log. Use para diagnosticar se há candidatos para sincronizar. Só aplica quando VagaTable é VRSVAGAS.</summary>
    public bool SyncCandidatosVagaDiagnostic { get; set; }

    /// <summary>Se true, após extrair candidato_vaga.json envia candidatos para api/candidatos (cria ou atualiza por VagaId + Email). Requer candidato_vaga.json (SyncCandidatosVagaDiagnostic ou extração prévia).</summary>
    public bool SyncCandidatosVaga { get; set; } = true;

    /// <summary>Se true, após extrair candidato_vaga extrai perfil CV (formação, experiência, competências, certificações) para candidato_perfil.json e o sync envia CvText no candidato. Requer tabelas VFORMACAOACAD, SCVATUACAOPROFISSIONAL, VCOMPETENCIAPESSOA, VCERTIFICACAOPESSOA no RM.</summary>
    public bool SyncCandidatosPerfilCv { get; set; } = true;

    /// <summary>Se definido, limita quantos talentos são sincronizados por ciclo (ex.: 1 para validar). Null = sem limite.</summary>
    public int? MaxTalentosToSync { get; set; }

    /// <summary>Se definido, limita quantos candidatos (por vaga) são sincronizados por ciclo (ex.: 1 para validar). Null = sem limite.</summary>
    public int? MaxCandidatosToSync { get; set; }

    /// <summary>Se definido, processa apenas este e-mail (ex.: claytonhamada@gmail.com para validar um talento/candidato). Null = todos.</summary>
    public string? SyncOnlyEmail { get; set; }
}
