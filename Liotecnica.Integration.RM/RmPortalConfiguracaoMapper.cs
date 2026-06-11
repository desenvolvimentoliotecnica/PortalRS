using Liotecnica.Integration.RM.Schema;

namespace Liotecnica.Integration.RM;

public static class RmPortalConfiguracaoMapper
{
    public static void Apply(this RmSchemaOptions options, RmPortalConfiguracaoDto config)
    {
        options.Schema = config.Schema;
        options.AreaTable = config.AreaTable;
        options.DepartamentoTable = config.DepartamentoTable;
        options.FuncaoTable = config.FuncaoTable;
        options.CargoTable = config.CargoTable;
        options.VagaTable = config.VagaTable;
        options.UnidadeTable = config.UnidadeTable;
        options.FuncionarioTable = config.FuncionarioTable;
        options.PessoaTable = config.PessoaTable;
        options.HierarquiaTable = config.HierarquiaTable;
        options.HierarquiaColigadaExternaTable = config.HierarquiaColigadaExternaTable ?? options.HierarquiaColigadaExternaTable;
        options.DesligamentoTable = config.DesligamentoTable;
        options.AumentoQuadroTable = config.AumentoQuadroTable;
        options.SubstituicaoTable = config.SubstituicaoTable;
        options.TransferenciaPromocaoTable = config.TransferenciaPromocaoTable;
    }
}
