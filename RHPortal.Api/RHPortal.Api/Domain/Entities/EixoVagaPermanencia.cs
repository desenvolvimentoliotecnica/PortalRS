namespace RhPortal.Api.Domain.Entities;

/// <summary>Formata permanência (turnover) configurada no tipo de vaga.</summary>
public static class EixoVagaPermanencia
{
    public static string Formatar(bool naoAplica, int? dias, int? meses)
    {
        if (naoAplica)
            return "N/A";
        if (meses is > 0)
            return meses == 1 ? "1 mês" : $"{meses} meses";
        if (dias is > 0)
            return dias == 1 ? "1 dia" : $"{dias} dias";
        return "—";
    }

    public static void Validar(bool naoAplica, int? dias, int? meses)
    {
        if (naoAplica)
        {
            if (dias is > 0 || meses is > 0)
                throw new InvalidOperationException("Quando permanência é N/A, não informe dias ou meses.");
            return;
        }

        var temDias = dias is > 0;
        var temMeses = meses is > 0;
        if (temDias == temMeses)
            throw new InvalidOperationException("Informe permanência em dias OU em meses (ou marque N/A).");
    }
}
