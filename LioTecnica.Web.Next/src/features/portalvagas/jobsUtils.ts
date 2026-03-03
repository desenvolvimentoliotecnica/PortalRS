export const SECTION_IMAGE_MAP: { match: string; title: string; image: string }[] = [
  { match: "industrial", title: "Industrial & Produção", image: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=1600" },
  { match: "qualidade", title: "Qualidade & P&D", image: "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&q=80&w=1600" },
  { match: "logistica", title: "Logística & Supply", image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=1600" },
  { match: "rh", title: "Administrativo & RH", image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&q=80&w=1600" },
  { match: "administrativo", title: "Administrativo & RH", image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&q=80&w=1600" },
  { match: "comercial", title: "Vendas & Marketing", image: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&q=80&w=1600" },
  { match: "marketing", title: "Vendas & Marketing", image: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&q=80&w=1600" },
];

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&q=80&w=1600";

function normalizeKey(value: string): string {
  return (value || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function getSectionInfo(area: string | null | undefined): { title: string; image: string } {
  const key = normalizeKey(area || "");
  const match = SECTION_IMAGE_MAP.find((x) => key.includes(x.match));
  if (match) return match;
  return {
    title: area || "Outras oportunidades",
    image: DEFAULT_IMAGE,
  };
}

export function parseTagsResponsabilidades(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;|.\n]/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function buildSummary(job: { titulo?: string | null; empresaNome?: string | null; tenantName?: string | null; tagsKeywordsRaw?: string | null; tagsStackRaw?: string | null; tagsResponsabilidadesRaw?: string | null }): string {
  const title = job.titulo || "Vaga";
  const company = job.empresaNome || job.tenantName || "Portal RH";
  const tags = [
    ...(job.tagsKeywordsRaw || "").split(/[,;|]/g).map((t) => t.trim()).filter(Boolean),
    ...(job.tagsStackRaw || "").split(/[,;|]/g).map((t) => t.trim()).filter(Boolean),
    ...(job.tagsResponsabilidadesRaw || "").split(/[,;|]/g).map((t) => t.trim()).filter(Boolean),
  ].slice(0, 3);
  if (!tags.length) return `${title} em ${company}.`;
  return `${title} em ${company}, com foco em ${tags.join(", ")}.`;
}
