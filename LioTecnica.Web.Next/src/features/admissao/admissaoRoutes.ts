/** Rota estática de tracking (query param) — compatível com `output: export`. */
export function admissaoTrackingPath(id: string): string {
  return `/admissao/tracking?id=${encodeURIComponent(id)}`;
}
