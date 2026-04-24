using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace RhPortal.Api.Application.Ai.Agent;

/// <summary>
/// Contrato de uma ferramenta do agente de IA (Function Calling).
///
/// <para>Cada implementação representa uma consulta estruturada ao banco (ex.:
/// "listar vagas abertas", "contar candidatos por etapa", "buscar candidato por
/// nome"). O Qwen recebe o catálogo de ferramentas no system prompt e decide
/// quando invocar qual, passando argumentos JSON que são validados pelo schema.</para>
///
/// <para><b>Segurança</b>: toda tool executa no contexto do tenant do usuário
/// autenticado (via <c>ITenantContext</c> injetado no scope). Não há como
/// vazar dados entre tenants — é garantido pelo <c>QueryFilter</c> do EF Core
/// aplicado em todas as entidades via <c>AppDbContext</c>.</para>
/// </summary>
public interface IAgentTool
{
    /// <summary>
    /// Nome único da ferramenta — usado pelo LLM no campo <c>tool_calls.function.name</c>.
    /// Formato snake_case ou dot.notation (ex.: <c>vagas_listar</c>, <c>candidatos_info</c>).
    /// </summary>
    string Name { get; }

    /// <summary>
    /// Descrição clara do que a tool faz, em PT-BR. O LLM lê isto pra decidir
    /// se usa esta tool. Ex.: "Lista vagas em aberto do tenant filtradas por status ou centro de custo".
    /// </summary>
    string Description { get; }

    /// <summary>
    /// JSON Schema dos parâmetros (padrão OpenAI function calling).
    /// Ex.: <c>{"type":"object","properties":{"status":{"type":"string"}},"required":[]}</c>
    /// </summary>
    JsonElement ParametersSchema { get; }

    /// <summary>
    /// Executa a tool com os argumentos fornecidos pelo LLM. Retorna objeto serializável
    /// que será convertido pra JSON e devolvido como <c>role:"tool"</c> no chat.
    /// </summary>
    /// <param name="args">Argumentos já parseados do JSON enviado pelo LLM.</param>
    /// <returns>Qualquer objeto — será serializado. Use classes com nomes de campos pt-BR pra o LLM ler com clareza.</returns>
    Task<object> ExecuteAsync(JsonElement args, CancellationToken ct);
}
