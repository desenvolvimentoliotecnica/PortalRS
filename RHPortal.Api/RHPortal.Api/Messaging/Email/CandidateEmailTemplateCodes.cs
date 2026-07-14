namespace RhPortal.Api.Messaging.Email;

/// <summary>Códigos estáveis dos templates de e-mail ao candidato (campo EmailTemplate.Name).</summary>
public static class CandidateEmailTemplateCodes
{
    public const string CandidaturaConfirmacao = "CandidaturaConfirmacao";
    public const string EtapaEmTriagem = "EtapaEmTriagem";
    public const string EtapaEntrevista = "EtapaEntrevista";
    public const string EtapaEntrevistaTecnica = "EtapaEntrevistaTecnica";
    public const string EtapaTeste = "EtapaTeste";
    public const string PropostaVaga = "PropostaVaga";
    public const string EtapaReprovadoRh = "EtapaReprovadoRh";
    public const string EtapaReprovadoGestor = "EtapaReprovadoGestor";
    public const string EtapaRecusado = "EtapaRecusado";
    public const string EtapaDesistiu = "EtapaDesistiu";
    public const string EtapaContratado = "EtapaContratado";
    public const string PreAdmissaoLink = "PreAdmissaoLink";
    public const string PreAdmissaoReenvioDocumentos = "PreAdmissaoReenvioDocumentos";
    public const string PreAdmissaoCriarUsuario = "PreAdmissaoCriarUsuario";
    public const string AdmissaoPortalOtp = "AdmissaoPortalOtp";
    public const string SolicitarCompletarDados = "SolicitarCompletarDados";
    public const string SolicitacaoDocumentacaoAdmissional = "SolicitacaoDocumentacaoAdmissional";

    public static readonly string[] All =
    [
        CandidaturaConfirmacao,
        EtapaEmTriagem,
        EtapaEntrevista,
        EtapaEntrevistaTecnica,
        EtapaTeste,
        PropostaVaga,
        EtapaReprovadoRh,
        EtapaReprovadoGestor,
        EtapaRecusado,
        EtapaDesistiu,
        EtapaContratado,
        PreAdmissaoLink,
        PreAdmissaoReenvioDocumentos,
        PreAdmissaoCriarUsuario,
        AdmissaoPortalOtp,
        SolicitarCompletarDados,
        SolicitacaoDocumentacaoAdmissional,
    ];
}
