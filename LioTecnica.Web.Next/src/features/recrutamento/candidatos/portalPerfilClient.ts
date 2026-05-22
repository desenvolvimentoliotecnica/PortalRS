import { apiFetch } from "@/lib/api";
import type { CandidatoPortalPerfilCompleto } from "./CandidatoPortalPerfilReadonly";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Lê propriedade em camelCase ou PascalCase (respostas System.Text.Json sem naming policy). */
function pick<T>(o: Record<string, unknown>, camel: string, pascal: string): T | undefined {
  if (o[camel] !== undefined && o[camel] !== null) return o[camel] as T;
  if (o[pascal] !== undefined && o[pascal] !== null) return o[pascal] as T;
  return undefined;
}

/** Converte chaves PascalCase → camelCase (DTOs .NET sem PropertyNamingPolicy). */
function toCamelKeysRecord(input: unknown): Record<string, unknown> | null {
  const o = asRecord(input);
  if (!o) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    const camel = /^[A-Z]/.test(k) ? k.charAt(0).toLowerCase() + k.slice(1) : k;
    out[camel] = v;
  }
  return out;
}

function normalizePerfilBasico(raw: unknown): CandidatoPortalPerfilCompleto["perfilBasico"] {
  const o = asRecord(raw);
  if (!o) return null;
  const cur = asRecord(pick(o, "curriculo", "Curriculo"));
  return {
    id: pick(o, "id", "Id") != null ? String(pick(o, "id", "Id")) : undefined,
    nome: (pick(o, "nome", "Nome") as string | null | undefined) ?? null,
    email: (pick(o, "email", "Email") as string | null | undefined) ?? null,
    fone: (pick(o, "fone", "Fone") as string | null | undefined) ?? null,
    celular: (pick(o, "celular", "Celular") as string | null | undefined) ?? null,
    cidade: (pick(o, "cidade", "Cidade") as string | null | undefined) ?? null,
    uf: (pick(o, "uf", "Uf") as string | null | undefined) ?? null,
    linkedinUrl: (pick(o, "linkedinUrl", "LinkedinUrl") as string | null | undefined) ?? null,
    resumoProfissional: (pick(o, "resumoProfissional", "ResumoProfissional") as string | null | undefined) ?? null,
    avatarUrl: (pick(o, "avatarUrl", "AvatarUrl") as string | null | undefined) ?? null,
    curriculo: cur
      ? {
          id: pick(cur, "id", "Id") != null ? String(pick(cur, "id", "Id")) : undefined,
          nomeArquivo: (pick(cur, "nomeArquivo", "NomeArquivo") as string | null | undefined) ?? null,
          createdAtUtc: (pick(cur, "createdAtUtc", "CreatedAtUtc") as string | null | undefined) ?? null,
        }
      : null,
    trabalhandoAtualmente: (pick(o, "trabalhandoAtualmente", "TrabalhandoAtualmente") as boolean | null | undefined) ?? null,
  };
}

function normalizeEducation(raw: unknown): CandidatoPortalPerfilCompleto["education"] {
  const o = asRecord(raw);
  if (!o) return null;
  const summary = asRecord(pick(o, "summary", "Summary"));
  const itemsRaw = pick<unknown>(o, "items", "Items");
  const items = Array.isArray(itemsRaw)
    ? itemsRaw.map((row) => {
        const it = asRecord(row) ?? {};
        return {
          id: pick(it, "id", "Id") != null ? String(pick(it, "id", "Id")) : undefined,
          curso: (pick(it, "curso", "Curso") as string | null | undefined) ?? null,
          instituicao: (pick(it, "instituicao", "Instituicao") as string | null | undefined) ?? null,
          tipo: (pick(it, "tipo", "Tipo") as string | null | undefined) ?? null,
          status: (pick(it, "status", "Status") as string | null | undefined) ?? null,
          inicio: (pick(it, "inicio", "Inicio") as string | null | undefined) ?? null,
          fim: (pick(it, "fim", "Fim") as string | null | undefined) ?? null,
          observacoes: (pick(it, "observacoes", "Observacoes") as string | null | undefined) ?? null,
          link: (pick(it, "link", "Link") as string | null | undefined) ?? null,
        };
      })
    : [];
  return {
    summary: (toCamelKeysRecord(summary) ?? summary) as CandidatoPortalPerfilCompleto["education"] extends { summary?: infer S } ? S : never,
    items,
  } as CandidatoPortalPerfilCompleto["education"];
}

function normalizeExperienceProjects(raw: unknown): CandidatoPortalPerfilCompleto["experienceProjects"] {
  const o = asRecord(raw);
  if (!o) return null;
  const exRaw = pick<unknown>(o, "experiences", "Experiences");
  const prRaw = pick<unknown>(o, "projects", "Projects");
  const experiences = Array.isArray(exRaw)
    ? exRaw.map((row) => {
        const x = asRecord(row) ?? {};
        return {
          id: pick(x, "id", "Id") != null ? String(pick(x, "id", "Id")) : undefined,
          empresa: (pick(x, "empresa", "Empresa") as string | null | undefined) ?? null,
          cargo: (pick(x, "cargo", "Cargo") as string | null | undefined) ?? null,
          inicio: (pick(x, "inicio", "Inicio") as string | null | undefined) ?? null,
          fim: (pick(x, "fim", "Fim") as string | null | undefined) ?? null,
          local: (pick(x, "local", "Local") as string | null | undefined) ?? null,
          atividades: (pick(x, "atividades", "Atividades") as string | null | undefined) ?? null,
        };
      })
    : [];
  const projects = Array.isArray(prRaw)
    ? prRaw.map((row) => {
        const x = asRecord(row) ?? {};
        return {
          id: pick(x, "id", "Id") != null ? String(pick(x, "id", "Id")) : undefined,
          nome: (pick(x, "nome", "Nome") as string | null | undefined) ?? null,
          periodo: (pick(x, "periodo", "Periodo") as string | null | undefined) ?? null,
          descricao: (pick(x, "descricao", "Descricao") as string | null | undefined) ?? null,
          link: (pick(x, "link", "Link") as string | null | undefined) ?? null,
          stack: (pick(x, "stack", "Stack") as string | null | undefined) ?? null,
          destaques: (pick(x, "destaques", "Destaques") as string | null | undefined) ?? null,
        };
      })
    : [];
  return { experiences, projects };
}

function normalizeSkillsPortfolio(raw: unknown): CandidatoPortalPerfilCompleto["skillsPortfolio"] {
  const o = asRecord(raw);
  if (!o) return null;
  const skillsRaw = pick<unknown>(o, "skills", "Skills");
  const certsRaw = pick<unknown>(o, "certifications", "Certifications");
  const links = asRecord(pick(o, "links", "Links"));
  const prefs = asRecord(pick(o, "preferences", "Preferences"));
  const skills = Array.isArray(skillsRaw)
    ? skillsRaw.map((row) => {
        const x = asRecord(row) ?? {};
        return {
          id: pick(x, "id", "Id") != null ? String(pick(x, "id", "Id")) : undefined,
          tipo: (pick(x, "tipo", "Tipo") as string | null | undefined) ?? null,
          nome: (pick(x, "nome", "Nome") as string | null | undefined) ?? null,
          nivel: (pick(x, "nivel", "Nivel") as string | null | undefined) ?? null,
          evidencia: (pick(x, "evidencia", "Evidencia") as string | null | undefined) ?? null,
        };
      })
    : [];
  const certifications = Array.isArray(certsRaw)
    ? certsRaw.map((row) => {
        const x = asRecord(row) ?? {};
        return {
          id: pick(x, "id", "Id") != null ? String(pick(x, "id", "Id")) : undefined,
          nome: (pick(x, "nome", "Nome") as string | null | undefined) ?? null,
          instituicao: (pick(x, "instituicao", "Instituicao") as string | null | undefined) ?? null,
          ano: (pick(x, "ano", "Ano") as string | null | undefined) ?? null,
          link: (pick(x, "link", "Link") as string | null | undefined) ?? null,
        };
      })
    : [];
  return {
    skills,
    certifications,
    links: links
      ? {
          linkedin: (pick(links, "linkedin", "Linkedin") as string | null | undefined) ?? null,
          github: (pick(links, "github", "Github") as string | null | undefined) ?? null,
          portfolio: (pick(links, "portfolio", "Portfolio") as string | null | undefined) ?? null,
          drive: (pick(links, "drive", "Drive") as string | null | undefined) ?? null,
        }
      : null,
    preferences: prefs
      ? {
          workModel: (pick(prefs, "workModel", "WorkModel") as string | null | undefined) ?? null,
          availability: (pick(prefs, "availability", "Availability") as string | null | undefined) ?? null,
          salary: (pick(prefs, "salary", "Salary") as string | null | undefined) ?? null,
          shift: (pick(prefs, "shift", "Shift") as string | null | undefined) ?? null,
          note: (pick(prefs, "note", "Note") as string | null | undefined) ?? null,
        }
      : null,
    tags: (pick(o, "tags", "Tags") as string | null | undefined) ?? null,
  };
}

function normalizeReferences(raw: unknown): CandidatoPortalPerfilCompleto["references"] {
  const o = asRecord(raw);
  if (!o) return null;
  const itemsRaw = pick<unknown>(o, "items", "Items");
  const items = Array.isArray(itemsRaw)
    ? itemsRaw.map((row) => {
        const x = asRecord(row) ?? {};
        return {
          id: pick(x, "id", "Id") != null ? String(pick(x, "id", "Id")) : undefined,
          nome: (pick(x, "nome", "Nome") as string | null | undefined) ?? null,
          relacao: (pick(x, "relacao", "Relacao") as string | null | undefined) ?? null,
          empresa: (pick(x, "empresa", "Empresa") as string | null | undefined) ?? null,
          cargo: (pick(x, "cargo", "Cargo") as string | null | undefined) ?? null,
          contato: (pick(x, "contato", "Contato") as string | null | undefined) ?? null,
          periodo: (pick(x, "periodo", "Periodo") as string | null | undefined) ?? null,
          linkedin: (pick(x, "linkedin", "Linkedin") as string | null | undefined) ?? null,
          observacoes: (pick(x, "observacoes", "Observacoes") as string | null | undefined) ?? null,
          podeContatar: (pick(x, "podeContatar", "PodeContatar") as boolean | null | undefined) ?? null,
          updatedAtUtc: (pick(x, "updatedAtUtc", "UpdatedAtUtc") as string | null | undefined) ?? null,
        };
      })
    : [];
  return { items };
}

function normalizePortalDocuments(raw: unknown): CandidatoPortalPerfilCompleto["portalDocuments"] {
  const o = asRecord(raw);
  if (!o) return null;
  const itemsRaw = pick<unknown>(o, "items", "Items");
  const items = Array.isArray(itemsRaw)
    ? itemsRaw.map((row) => {
        const x = asRecord(row) ?? {};
        const temArquivoRaw = pick(x, "temArquivo", "TemArquivo");
        return {
          id: pick(x, "id", "Id") != null ? String(pick(x, "id", "Id")) : undefined,
          tipo: (pick(x, "tipo", "Tipo") as string | null | undefined) ?? null,
          nome: (pick(x, "nome", "Nome") as string | null | undefined) ?? null,
          link: (pick(x, "link", "Link") as string | null | undefined) ?? null,
          data: (pick(x, "data", "Data") as string | null | undefined) ?? null,
          observacoes: (pick(x, "observacoes", "Observacoes") as string | null | undefined) ?? null,
          fileName: (pick(x, "fileName", "FileName") as string | null | undefined) ?? null,
          createdAtUtc: (pick(x, "createdAtUtc", "CreatedAtUtc") as string | null | undefined) ?? null,
          temArquivo: temArquivoRaw === true || temArquivoRaw === "true",
        };
      })
    : [];
  return { items };
}

function normalizeAgenda(raw: unknown): CandidatoPortalPerfilCompleto["agenda"] {
  const o = asRecord(raw);
  if (!o) return null;
  const prefs = asRecord(pick(o, "preferences", "Preferences"));
  const blocksRaw = pick<unknown>(o, "blocks", "Blocks");
  const blocks = Array.isArray(blocksRaw)
    ? blocksRaw.map((row) => {
        const x = asRecord(row) ?? {};
        return {
          id: pick(x, "id", "Id") != null ? String(pick(x, "id", "Id")) : undefined,
          tipo: (pick(x, "tipo", "Tipo") as string | null | undefined) ?? null,
          titulo: (pick(x, "titulo", "Titulo") as string | null | undefined) ?? null,
          data: (pick(x, "data", "Data") as string | null | undefined) ?? null,
          horario: (pick(x, "horario", "Horario") as string | null | undefined) ?? null,
          observacoes: (pick(x, "observacoes", "Observacoes") as string | null | undefined) ?? null,
          updatedAtUtc: (pick(x, "updatedAtUtc", "UpdatedAtUtc") as string | null | undefined) ?? null,
        };
      })
    : [];
  return {
    preferences: (toCamelKeysRecord(prefs) ?? prefs) as CandidatoPortalPerfilCompleto["agenda"] extends { preferences?: infer P } ? P : never,
    blocks,
  } as CandidatoPortalPerfilCompleto["agenda"];
}

/** Aceita JSON camelCase ou PascalCase no payload raiz e nos blocos usados na UI. */
export function normalizePortalPerfilPayload(json: unknown): CandidatoPortalPerfilCompleto | null {
  const r = asRecord(json);
  if (!r) return null;
  const pbRaw = pick(r, "perfilBasico", "PerfilBasico");
  const edRaw = pick(r, "education", "Education");
  const spRaw = pick(r, "skillsPortfolio", "SkillsPortfolio");
  const refRaw = pick(r, "references", "References");
  const docRaw = pick(r, "portalDocuments", "PortalDocuments");
  const agRaw = pick(r, "agenda", "Agenda");
  return {
    perfilBasico: normalizePerfilBasico(pbRaw),
    skillsPortfolio: normalizeSkillsPortfolio(spRaw),
    education: normalizeEducation(edRaw),
    preferences: toCamelKeysRecord(pick(r, "preferences", "Preferences")) as CandidatoPortalPerfilCompleto["preferences"],
    accessibility: toCamelKeysRecord(pick(r, "accessibility", "Accessibility")) as CandidatoPortalPerfilCompleto["accessibility"],
    agenda: normalizeAgenda(agRaw),
    notifications: toCamelKeysRecord(pick(r, "notifications", "Notifications")) as CandidatoPortalPerfilCompleto["notifications"],
    portalDocuments: normalizePortalDocuments(docRaw),
    lgpd: toCamelKeysRecord(pick(r, "lgpd", "Lgpd")) as CandidatoPortalPerfilCompleto["lgpd"],
    references: normalizeReferences(refRaw),
    experienceProjects: normalizeExperienceProjects(pick(r, "experienceProjects", "ExperienceProjects")),
  };
}

/** Extrai mensagem legível de corpos JSON (RFC 7807 / ASP.NET ProblemDetails / validação). */
export function parseApiProblemDetailsBody(text: string): string {
  const raw = text?.trim() ?? "";
  if (!raw) return "";
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    const detail = typeof j.detail === "string" ? j.detail.trim() : "";
    const msg = typeof j.message === "string" ? j.message.trim() : "";
    const title = typeof j.title === "string" ? j.title.trim() : "";
    const traceId =
      (typeof j.traceId === "string" && j.traceId.trim()) ||
      (() => {
        const ext = (j.extensions ?? j.Extensions) as Record<string, unknown> | undefined;
        const tid = ext?.traceId ?? ext?.TraceId;
        return typeof tid === "string" ? tid.trim() : "";
      })();

    let errors = "";
    const errObj = j.errors;
    if (errObj && typeof errObj === "object" && !Array.isArray(errObj)) {
      errors = Object.entries(errObj as Record<string, unknown>)
        .map(([k, v]) => {
          if (Array.isArray(v)) return `${k}: ${(v as unknown[]).map(String).join(", ")}`;
          return `${k}: ${String(v)}`;
        })
        .join("; ");
    }

    // ProblemDetails: priorizar `detail` (onde a API coloca a exceção), não `title` genérico.
    const primary = detail || msg || errors || title || raw.slice(0, 1200);
    return traceId ? `${primary} [traceId: ${traceId}]` : primary;
  } catch {
    return raw.slice(0, 1200);
  }
}

/**
 * GET agregado do perfil portal (RH autenticado).
 * @param pathPrefix ex.: `/app` quando a UI chama via mesmo host; vazio para `/api/...` direto.
 */
export async function fetchCandidatoPortalPerfil(
  candidatoId: string,
  pathPrefix = "",
): Promise<{ data: CandidatoPortalPerfilCompleto | null; error: string | null }> {
  const base = pathPrefix.replace(/\/$/, "");
  const path = `${base}/api/candidatos/${encodeURIComponent(candidatoId)}/perfil-portal`;
  try {
    const res = await apiFetch(path, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      const parsed = parseApiProblemDetailsBody(text);
      const hint =
        res.status === 404
          ? " Confirme se a API publicada inclui GET …/perfil-portal e se o candidato existe neste tenant."
          : res.status === 401 || res.status === 403
            ? " Sessão expirada ou sem permissão para este candidato."
            : "";
      return { data: null, error: `HTTP ${res.status}${parsed ? `: ${parsed}` : ""}.${hint}` };
    }
    if (!text?.trim()) return { data: null, error: "Resposta vazia da API." };
    let raw: unknown;
    try {
      raw = JSON.parse(text) as unknown;
    } catch {
      return { data: null, error: "Resposta inválida (não é JSON)." };
    }
    return { data: normalizePortalPerfilPayload(raw), error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { data: null, error: msg || "Falha de rede ao carregar perfil portal." };
  }
}
