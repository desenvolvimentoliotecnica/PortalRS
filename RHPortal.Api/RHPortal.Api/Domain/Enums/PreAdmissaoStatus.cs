namespace RhPortal.Api.Domain.Enums;

public enum PreAdmissaoStatus : short
{
    Rascunho = 0,
    Enviado = 1,              // Link enviado, candidato não abriu ainda
    Preenchido = 2,           // Tudo completo, todos os documentos enviados
    Aprovada = 3,
    Rejeitada = 4,
    Integrada = 5,
    Acessado = 6,             // Candidato abriu o link (autenticou com CPF)
    PreenchidoParcial = 7,    // Dados pessoais preenchidos, documentos incompletos
    EmIntegracao = 8          // RH efetivou; enviado ao TOTVS, aguardando confirmação
}
