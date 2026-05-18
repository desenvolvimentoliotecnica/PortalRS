import { apiFetch } from "@/lib/api";

/** Prefixo vazio na página de detalhes; `/app` no modal da lista. */
export function buildCandidatoDocumentoDownloadPath(
  candidatoId: string,
  documentoId: string,
  apiPathPrefix = "",
): string {
  const base = apiPathPrefix.replace(/\/$/, "");
  const segment = `/api/candidatos/${encodeURIComponent(candidatoId)}/documentos/${encodeURIComponent(documentoId)}/download`;
  return base ? `${base}${segment}` : segment;
}

/** URL retornada pela API quando o arquivo existe em disco. */
export function isCandidatoDocumentoApiDownloadUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  return /\/api\/candidatos\/[^/]+\/documentos\/[^/]+\/download\/?$/i.test(url.trim());
}

/** `temArquivo` do JSON da API; fallback legado pela URL de download. */
export function candidatoDocumentoTemArquivo(row: Record<string, unknown> | null | undefined): boolean {
  if (!row) return false;
  const v = row.temArquivo ?? row.TemArquivo;
  if (v === true || v === "true") return true;
  if (v === false || v === "false") return false;
  const url = typeof row.url === "string" ? row.url : typeof row.Url === "string" ? row.Url : "";
  return isCandidatoDocumentoApiDownloadUrl(url);
}

export async function downloadCandidatoDocumento(path: string, suggestedName: string): Promise<void> {
  const res = await apiFetch(path, { method: "GET", headers: { Accept: "*/*" } }, 120_000);
  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    let msg = raw?.trim() || `HTTP ${res.status}`;
    try {
      const j = JSON.parse(raw) as Record<string, unknown>;
      const detail = typeof j.detail === "string" ? j.detail.trim() : "";
      const m = typeof j.message === "string" ? j.message.trim() : "";
      const title = typeof j.title === "string" ? j.title.trim() : "";
      msg = detail || m || title || msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = suggestedName.trim() || "documento";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}
