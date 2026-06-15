namespace Liotecnica.Integration.RM;

public sealed class RmPortalConfiguracaoDto
{
    public string? SqlServer { get; set; }
    public string? SqlDatabase { get; set; }
    public string? SqlUserId { get; set; }
    public string? SqlPassword { get; set; }
    public bool SqlEncrypt { get; set; } = true;
    public bool SqlTrustServerCertificate { get; set; } = true;
    public int SqlConnectTimeoutSeconds { get; set; } = 15;
    public string? SqlApplicationIntent { get; set; } = "ReadOnly";

    public bool SyncUnits { get; set; } = true;
    public bool SyncUnitsExecute { get; set; } = true;
    public bool SyncVagas { get; set; } = true;
    public bool SyncVagasOnly { get; set; }
    public bool SyncEmpresas { get; set; } = true;
    public bool SyncHierarquia { get; set; } = true;
    public bool SyncDesligamentos { get; set; } = true;
    public bool SyncCandidatosVagaDiagnostic { get; set; } = true;
    public bool SyncCandidatosVaga { get; set; } = true;
    public bool SyncCandidatosPerfilCv { get; set; } = true;
    public bool UseGestorHierarquiaPosicao { get; set; } = true;
    public bool UseHierarquiaOrganogramaPosicao { get; set; } = true;
    public int? MaxTalentosToSync { get; set; }
    public int? MaxCandidatosToSync { get; set; }
    public int? MaxPessoasToSync { get; set; }
    public int? MaxFuncionariosToSync { get; set; }
    public string? SyncOnlyEmail { get; set; }
    public string? VagaDefaultAreaCode { get; set; }

    public string Schema { get; set; } = "dbo";
    public string AreaTable { get; set; } = "BAREA";
    public string DepartamentoTable { get; set; } = "PSECAO";
    public string FuncaoTable { get; set; } = "PFUNCAO";
    public string CargoTable { get; set; } = "PCARGO";
    public string VagaTable { get; set; } = "VRSVAGAS";
    public string UnidadeTable { get; set; } = "GFILIAL";
    public string FuncionarioTable { get; set; } = "PFUNC";
    public string PessoaTable { get; set; } = "PPESSOA";
    public string HierarquiaTable { get; set; } = "VHIERARQUIA";
    public string? HierarquiaColigadaExternaTable { get; set; } = "VHIERARQUIACOLIGADAEXTERNA";
    public string DesligamentoTable { get; set; } = "VREQDESLIGAMENTO";
    public string AumentoQuadroTable { get; set; } = "VREQAUMENTOQUADRO";
    public string SubstituicaoTable { get; set; } = "VREQSUBSTITUICAO";
    public string TransferenciaPromocaoTable { get; set; } = "VREQTRANSFPROMOCAO";
}
