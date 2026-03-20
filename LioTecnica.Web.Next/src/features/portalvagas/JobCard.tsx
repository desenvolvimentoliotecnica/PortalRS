"use client";

import { Button } from "@/components/ui/button";

type JobItem = {
  id: string;
  titulo: string;
  area?: string | null;
  modalidade?: string | null;
  tipoContratacao?: string | null;
  senioridade?: string | null;
  cidade?: string | null;
  uf?: string | null;
  tagsKeywordsRaw?: string | null;
  tagsStackRaw?: string | null;
  tagsResponsabilidadesRaw?: string | null;
  salarioMinimo?: number | null;
  salarioMaximo?: number | null;
  empresaNome?: string | null;
  tenantName?: string | null;
};

const HERO_GRADIENTS = [
  "linear-gradient(135deg, #1e3a8a, #0ea5e9)",
  "linear-gradient(135deg, #0f766e, #22c55e)",
  "linear-gradient(135deg, #7c3aed, #ec4899)",
  "linear-gradient(135deg, #d97706, #f97316)",
  "linear-gradient(135deg, #1d4ed8, #38bdf8)",
  "linear-gradient(135deg, #4f46e5, #6366f1)",
];

function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw.split(/[,;|]/g).map((t) => t.trim()).filter(Boolean);
}

function buildTags(job: JobItem): string[] {
  const all = [
    ...parseTags(job.tagsKeywordsRaw),
    ...parseTags(job.tagsStackRaw),
    ...parseTags(job.tagsResponsabilidadesRaw),
  ];
  return Array.from(new Set(all)).slice(0, 6);
}

function money(min?: number | null, max?: number | null) {
  if (!max) return "A combinar";
  const f = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  return `${f(min || 0)} - ${f(max)}`;
}

function formatLocation(job: JobItem) {
  const city = (job.cidade || "").trim();
  const uf = (job.uf || "").trim();
  if (city && uf) return `${city}, ${uf}`;
  if (city) return city;
  if (uf) return uf;
  return job.modalidade || "Não informado";
}

interface JobCardProps {
  job: JobItem;
  index: number;
  onDetails: () => void;
  onApply: () => void;
}

export default function JobCard({ job, index, onDetails, onApply }: JobCardProps) {
  const tagList = buildTags(job);
  const company = job.empresaNome || job.tenantName || "Portal RH";
  const location = formatLocation(job);
  const mode = job.modalidade || "—";
  const type = job.tipoContratacao || "—";
  const level = job.senioridade || "—";
  const area = job.area || "—";
  const hero = HERO_GRADIENTS[index % HERO_GRADIENTS.length];

  return (
    <article className="rounded-xl border border-[rgba(16,82,144,.12)] bg-white overflow-hidden h-full flex flex-col">
      <div
        className="p-4 text-white min-h-[100px] flex flex-col justify-end"
        style={{ background: hero }}
      >
        <h3 className="font-extrabold text-lg leading-tight">{job.titulo}</h3>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-medium">{mode}</span>
          <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-medium">{type}</span>
          <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-medium">{level}</span>
        </div>
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <div className="text-muted-foreground text-sm mb-2">{company}</div>
        <div className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
          <span>{location}</span>
          <span className="w-1 h-1 rounded-full bg-muted-foreground" />
          <span>{area}</span>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tagList.length > 0 ? (
            tagList.map((t, i) => (
              <span key={`${job.id}-${i}`} className="rounded-full border border-border/60 px-2 py-0.5 text-xs bg-slate-50">
                {t}
              </span>
            ))
          ) : (
            <span className="rounded-full border border-border/60 px-2 py-0.5 text-xs bg-slate-50">Geral</span>
          )}
        </div>
        <div className="text-sm text-muted-foreground mt-auto">Faixa: {money(job.salarioMinimo, job.salarioMaximo)}</div>
        <div className="mt-3 flex gap-2">
          <Button variant="outline" size="sm" onClick={onDetails}>
            Detalhes
          </Button>
          <Button size="sm" onClick={onApply}>
            Candidatar-se
          </Button>
        </div>
      </div>
    </article>
  );
}
