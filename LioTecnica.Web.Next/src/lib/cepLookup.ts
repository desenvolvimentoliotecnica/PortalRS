/**
 * Sessão 31.8 — Helper de busca de CEP via ViaCEP (API pública dos Correios,
 * mantida pela comunidade — https://viacep.com.br). Free, sem auth, suporta CORS,
 * retorna JSON.
 *
 * <b>Uso típico</b>: no `onBlur` do campo CEP de um formulário, dispara a busca
 * e preenche os campos de endereço (logradouro, bairro, cidade, UF) automaticamente.
 *
 * @example
 * ```tsx
 * <Input
 *   value={cep}
 *   onChange={(e) => setCep(e.target.value)}
 *   onBlur={async () => {
 *     const r = await lookupCep(cep);
 *     if (r) {
 *       setLogradouro(r.logradouro);
 *       setBairro(r.bairro);
 *       setCidade(r.cidade);
 *       setUf(r.uf);
 *     }
 *   }}
 * />
 * ```
 */
export interface CepLookupResult {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  complemento: string;
}

/** Resposta crua do ViaCEP (com nomes dos campos como retornam da API). */
interface ViaCepResponse {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  complemento?: string;
  erro?: boolean | string;
}

/**
 * Sanitiza CEP — remove tudo que não é dígito, retorna apenas 8 dígitos
 * ou null se inválido.
 */
function normalizeCep(raw: string): string | null {
  const digits = (raw || "").replace(/\D/g, "");
  return digits.length === 8 ? digits : null;
}

/**
 * Busca endereço por CEP no ViaCEP. Retorna null se:
 * - CEP malformado (menos de 8 dígitos)
 * - Rede indisponível
 * - CEP inexistente (ViaCEP retorna `{erro: true}`)
 *
 * Não lança — sempre retorna null em erro para a UX seguir fluida.
 */
export async function lookupCep(rawCep: string): Promise<CepLookupResult | null> {
  const cep = normalizeCep(rawCep);
  if (!cep) return null;

  try {
    // Timeout via AbortController — ViaCEP às vezes fica lento; 5s é tolerável
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      signal: controller.signal,
      cache: "force-cache", // CEPs não mudam — cachear no browser é ok
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;

    const data = (await res.json()) as ViaCepResponse;
    if (data.erro) return null; // ViaCEP retorna 200 com {erro: true} quando inexistente

    return {
      cep: data.cep ?? cep,
      logradouro: data.logradouro ?? "",
      bairro: data.bairro ?? "",
      cidade: data.localidade ?? "",
      uf: data.uf ?? "",
      complemento: data.complemento ?? "",
    };
  } catch {
    return null;
  }
}
