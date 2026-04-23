"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Plus, RefreshCw, Pencil, Trash2, X } from "lucide-react";
import { apiFetch } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import PaginationBar from "@/components/pagination/PaginationBar";
import { useClientPagination } from "@/hooks/useClientPagination";

// ── Categorias DNALIO (espelham backend `DescricaoCargoItemCategoria`) ──
type Categoria =
  | "AtividadeEspecifica"
  | "AtividadeComum"
  | "VivenciaEspecifica"
  | "CompetenciaDnalio"
  | "CompetenciaLideranca"
  | "CompetenciaFuncional"
  | "CompetenciaTecnica"
  | "RequisitoObrigatorio";

const CATEGORIA_LABEL: Record<Categoria, string> = {
  AtividadeEspecifica: "Atividades Específicas",
  AtividadeComum: "Atividades Comuns ao Nível do Cargo",
  VivenciaEspecifica: "Vivências/Experiências Específicas",
  CompetenciaDnalio: "Competências Comportamentais — DNALIO",
  CompetenciaLideranca: "Competências de Liderança e Relacionamento",
  CompetenciaFuncional: "Competências Comportamentais — Funcionais",
  CompetenciaTecnica: "Competências Técnicas — Conhecimentos e Habilidades",
  RequisitoObrigatorio: "Requisitos Obrigatórios / Perfil da Vaga",
};

const CATEGORIA_HINT: Record<Categoria, string> = {
  AtividadeEspecifica: "Tarefas técnicas do dia-a-dia da função",
  AtividadeComum: "Atividades alinhadas com missão e valores da empresa",
  VivenciaEspecifica: "Experiências esperadas do candidato (Obrigatório/Desejável)",
  CompetenciaDnalio: "Pilares de cultura (ex.: Prioridade ao Cliente, Alta Performance)",
  CompetenciaLideranca: "Trabalho em equipe, relacionamento, liderança",
  CompetenciaFuncional: "Habilidades comportamentais (ex.: Organização, Dinamismo)",
  CompetenciaTecnica: "Conhecimentos técnicos. Subcategoria sugerida: Hardware, Software, Idioma, Segurança",
  RequisitoObrigatorio: "Linha de corte do recrutamento",
};

const CATEGORIAS_USAM_OBRIGATORIA: Categoria[] = ["VivenciaEspecifica", "CompetenciaTecnica", "RequisitoObrigatorio"];

interface ItemResponse {
  id: string;
  categoria: Categoria;
  texto: string;
  isObrigatoria: boolean;
  nivelMinimo: string | null;
  subcategoria: string | null;
  ordem: number;
}

interface Item {
  id: string;
  code: string;
  title: string;
  areaTemplate?: string | null;
  cboCodigo?: string | null;
  summary?: string | null;
  formacaoMinima?: string | null;
  formacaoDesejavel?: string | null;
  formacaoAreaEstudo?: string | null;
  experienciaTempoMinimo?: string | null;
  experienciaTempoDesejavel?: string | null;
  experienciaEspecificacao?: string | null;
  revisaoNumero?: string | null;
  revisaoData?: string | null;
  revisaoNatureza?: string | null;
  gestorNome?: string | null;
  gestorEmail?: string | null;
  responsibilities?: string | null;
  requirements?: string | null;
  niceToHave?: string | null;
  benefits?: string | null;
  isTemplate: boolean;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
  nivelCargoId?: string | null;
  nivelCargoNome?: string | null;
  itens: ItemResponse[];
}

/** State local de cada item — strings p/ inputs editáveis */
interface ItemDraft {
  categoria: Categoria;
  texto: string;
  isObrigatoria: boolean;
  nivelMinimo: string;
  subcategoria: string;
  ordem: number;
}

interface Draft {
  id?: string;
  code: string;
  title: string;
  areaTemplate: string;
  cboCodigo: string;
  summary: string;
  formacaoMinima: string;
  formacaoDesejavel: string;
  formacaoAreaEstudo: string;
  experienciaTempoMinimo: string;
  experienciaTempoDesejavel: string;
  experienciaEspecificacao: string;
  revisaoNumero: string;
  revisaoData: string;
  revisaoNatureza: string;
  gestorNome: string;
  gestorEmail: string;
  responsibilities: string;
  requirements: string;
  niceToHave: string;
  benefits: string;
  isTemplate: boolean;
  isActive: boolean;
  nivelCargoId: string;
  itens: ItemDraft[];
}

interface NivelCargoOption {
  id: string;
  code: string;
  description: string;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(url, { ...init, headers: { Accept: "application/json", ...(init?.headers || {}) }, cache: "no-store" });
  if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(`HTTP ${res.status}: ${t || res.statusText}`); }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

function statusBadge(active: boolean) {
  return active ? (
    <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">Ativo</span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-zinc-400/15 px-2.5 py-0.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">Inativo</span>
  );
}

function templateBadge(isTemplate: boolean) {
  return isTemplate ? (
    <span className="inline-flex items-center rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-400">Template</span>
  ) : null;
}

const emptyDraft: Draft = {
  code: "", title: "", areaTemplate: "", cboCodigo: "", summary: "",
  formacaoMinima: "", formacaoDesejavel: "", formacaoAreaEstudo: "",
  experienciaTempoMinimo: "", experienciaTempoDesejavel: "", experienciaEspecificacao: "",
  revisaoNumero: "", revisaoData: "", revisaoNatureza: "", gestorNome: "", gestorEmail: "",
  responsibilities: "", requirements: "", niceToHave: "", benefits: "",
  isTemplate: false, isActive: true, nivelCargoId: "",
  itens: [],
};

const ALL_CATEGORIAS: Categoria[] = [
  "AtividadeEspecifica", "AtividadeComum", "VivenciaEspecifica",
  "CompetenciaDnalio", "CompetenciaLideranca", "CompetenciaFuncional", "CompetenciaTecnica",
  "RequisitoObrigatorio",
];

export default function DescricaoCargoCadastroScreen() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Item[]>([]);
  const [niveis, setNiveis] = useState<NivelCargoOption[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [templateFilter, setTemplateFilter] = useState("all");
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>({ ...emptyDraft });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);

  const syncList = useCallback(async () => {
    try {
      setLoading(true);
      const items = await fetchJson<Item[]>("/api/descricoes-cargo?take=2000");
      setRows(Array.isArray(items) ? items : []);
    } catch {
      toast.error("Erro ao carregar descrições de cargo");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadNiveis = useCallback(async () => {
    try {
      const items = await fetchJson<NivelCargoOption[]>("/api/nivel-cargo/lookup");
      setNiveis(Array.isArray(items) ? items : []);
    } catch {
      setNiveis([]);
    }
  }, []);

  useEffect(() => { syncList(); loadNiveis(); }, [syncList, loadNiveis]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((x) => {
      if (statusFilter === "ativo" && !x.isActive) return false;
      if (statusFilter === "inativo" && x.isActive) return false;
      if (templateFilter === "template" && !x.isTemplate) return false;
      if (templateFilter === "uso-direto" && x.isTemplate) return false;
      if (!q) return true;
      return x.code.toLowerCase().includes(q) ||
        x.title.toLowerCase().includes(q) ||
        (x.summary?.toLowerCase().includes(q) ?? false);
    });
  }, [search, statusFilter, templateFilter, rows]);

  const { page, setPage, pageSize, setPageSize, slice } = useClientPagination(filtered.length, {
    initialPageSize: 20,
    resetDeps: [search, statusFilter, templateFilter],
  });
  const paged = useMemo(() => filtered.slice(slice.start, slice.end), [filtered, slice.start, slice.end]);

  const kpis = useMemo(() => ({
    total: rows.length,
    ativas: rows.filter((r) => r.isActive).length,
    templates: rows.filter((r) => r.isTemplate).length,
    comDnalio: rows.filter((r) => (r.itens?.length ?? 0) > 0).length,
  }), [rows]);

  // ── Itens DNALIO: helpers ───────────────────────────────────────────────

  function addItem(cat: Categoria) {
    setDraft((d) => ({
      ...d,
      itens: [...d.itens, {
        categoria: cat,
        texto: "",
        isObrigatoria: true,
        nivelMinimo: "",
        subcategoria: "",
        ordem: d.itens.filter((i) => i.categoria === cat).length,
      }],
    }));
  }

  function removeItem(globalIdx: number) {
    setDraft((d) => ({ ...d, itens: d.itens.filter((_, idx) => idx !== globalIdx) }));
  }

  function updateItem(globalIdx: number, field: keyof ItemDraft, value: string | boolean) {
    setDraft((d) => ({
      ...d,
      itens: d.itens.map((it, idx) => idx === globalIdx ? { ...it, [field]: value } : it),
    }));
  }

  /** Quando abre p/ editar, busca a versão completa (com Itens) do backend */
  async function openEdit(item: Item) {
    let fullItem: Item = item;
    try {
      fullItem = await fetchJson<Item>(`/api/descricoes-cargo/${item.id}`);
    } catch {
      // Fallback: usa item da lista
    }
    setDraft({
      id: fullItem.id,
      code: fullItem.code,
      title: fullItem.title,
      areaTemplate: fullItem.areaTemplate ?? "",
      cboCodigo: fullItem.cboCodigo ?? "",
      summary: fullItem.summary ?? "",
      formacaoMinima: fullItem.formacaoMinima ?? "",
      formacaoDesejavel: fullItem.formacaoDesejavel ?? "",
      formacaoAreaEstudo: fullItem.formacaoAreaEstudo ?? "",
      experienciaTempoMinimo: fullItem.experienciaTempoMinimo ?? "",
      experienciaTempoDesejavel: fullItem.experienciaTempoDesejavel ?? "",
      experienciaEspecificacao: fullItem.experienciaEspecificacao ?? "",
      revisaoNumero: fullItem.revisaoNumero ?? "",
      revisaoData: fullItem.revisaoData ?? "",
      revisaoNatureza: fullItem.revisaoNatureza ?? "",
      gestorNome: fullItem.gestorNome ?? "",
      gestorEmail: fullItem.gestorEmail ?? "",
      responsibilities: fullItem.responsibilities ?? "",
      requirements: fullItem.requirements ?? "",
      niceToHave: fullItem.niceToHave ?? "",
      benefits: fullItem.benefits ?? "",
      isTemplate: fullItem.isTemplate,
      isActive: fullItem.isActive,
      nivelCargoId: fullItem.nivelCargoId ?? "",
      itens: (fullItem.itens ?? []).map((i) => ({
        categoria: i.categoria,
        texto: i.texto,
        isObrigatoria: i.isObrigatoria,
        nivelMinimo: i.nivelMinimo ?? "",
        subcategoria: i.subcategoria ?? "",
        ordem: i.ordem,
      })),
    });
    setEditOpen(true);
  }

  const save = async () => {
    if (!draft.code.trim() || !draft.title.trim()) {
      toast.error("Código e Cargo (Title) são obrigatórios");
      return;
    }

    // Validação: nenhum item vazio
    const emptyIdx = draft.itens.findIndex((i) => !i.texto.trim());
    if (emptyIdx >= 0) {
      toast.error(`Item #${emptyIdx + 1} está sem texto`);
      return;
    }

    try {
      setSaving(true);
      const payload = {
        code: draft.code.trim(),
        title: draft.title.trim(),
        areaTemplate: draft.areaTemplate.trim() || null,
        cboCodigo: draft.cboCodigo.trim() || null,
        summary: draft.summary.trim() || null,
        formacaoMinima: draft.formacaoMinima.trim() || null,
        formacaoDesejavel: draft.formacaoDesejavel.trim() || null,
        formacaoAreaEstudo: draft.formacaoAreaEstudo.trim() || null,
        experienciaTempoMinimo: draft.experienciaTempoMinimo.trim() || null,
        experienciaTempoDesejavel: draft.experienciaTempoDesejavel.trim() || null,
        experienciaEspecificacao: draft.experienciaEspecificacao.trim() || null,
        revisaoNumero: draft.revisaoNumero.trim() || null,
        revisaoData: draft.revisaoData || null,
        revisaoNatureza: draft.revisaoNatureza.trim() || null,
        gestorNome: draft.gestorNome.trim() || null,
        gestorEmail: draft.gestorEmail.trim() || null,
        responsibilities: draft.responsibilities.trim() || null,
        requirements: draft.requirements.trim() || null,
        niceToHave: draft.niceToHave.trim() || null,
        benefits: draft.benefits.trim() || null,
        isTemplate: draft.isTemplate,
        isActive: draft.isActive,
        nivelCargoId: draft.nivelCargoId || null,
        itens: draft.itens.map((i, idx) => ({
          categoria: i.categoria,
          texto: i.texto.trim(),
          isObrigatoria: i.isObrigatoria,
          nivelMinimo: i.nivelMinimo.trim() || null,
          subcategoria: i.subcategoria.trim() || null,
          ordem: idx,
        })),
      };
      if (draft.id) {
        await fetchJson(`/api/descricoes-cargo/${draft.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast.success("Descrição de cargo atualizada");
      } else {
        await fetchJson("/api/descricoes-cargo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast.success("Descrição de cargo criada");
      }
      setEditOpen(false);
      await syncList();
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const bodyStart = raw.indexOf(": ");
      const body = bodyStart >= 0 ? raw.slice(bodyStart + 2) : raw;
      let friendly = raw;
      try {
        const parsed = JSON.parse(body) as { message?: string };
        if (parsed?.message) friendly = parsed.message;
      } catch { /* não JSON */ }
      toast.error(friendly, { duration: 8000 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-lg font-bold">Descrição de Cargos</h4>
          <div className="text-muted-foreground text-sm">
            Template DNALIO — cabeçalho, atividades, formação, experiência, vivências, competências (4 categorias) e requisitos. O matching de candidatos consome essas seções estruturadas.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={syncList} disabled={loading}>
            <RefreshCw className="size-4" /><span className="hidden sm:inline ml-1">Atualizar</span>
          </Button>
          <Button size="sm" onClick={() => { setDraft({ ...emptyDraft }); setEditOpen(true); }}>
            <Plus className="size-4" /><span className="hidden sm:inline ml-1">Nova descrição</span>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "Total", value: kpis.total, color: "text-primary" },
          { label: "Ativas", value: kpis.ativas, color: "text-emerald-600" },
          { label: "Templates", value: kpis.templates, color: "text-violet-600" },
          { label: "Com itens DNALIO", value: kpis.comDnalio, color: "text-blue-600" },
          { label: "Exibindo", value: filtered.length, color: "text-primary" },
        ].map((k) => (
          <div key={k.label} className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
            <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">{k.label}</div>
            <div className={`mt-1 text-2xl font-bold ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-semibold">Lista de descrições</div>
            <div className="text-muted-foreground text-sm">Clique em Editar para abrir o template completo.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="w-[220px] pl-8" placeholder="código, cargo, sumário..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="all">Todos status</option>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
            <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={templateFilter} onChange={(e) => { setTemplateFilter(e.target.value); setPage(1); }}>
              <option value="all">Todos tipos</option>
              <option value="template">Templates</option>
              <option value="uso-direto">Uso direto</option>
            </select>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Área</TableHead>
              <TableHead>Nível</TableHead>
              <TableHead className="text-right">Itens DNALIO</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Carregando…</TableCell></TableRow>
            ) : paged.length ? paged.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-sm">{item.code}</TableCell>
                <TableCell className="text-sm">
                  <div className="flex items-center gap-2">
                    <span>{item.title}</span>
                    {templateBadge(item.isTemplate)}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{item.areaTemplate || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{item.nivelCargoNome || "—"}</TableCell>
                <TableCell className="text-xs text-right font-mono">{item.itens?.length ?? 0}</TableCell>
                <TableCell>{statusBadge(item.isActive)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="outline" size="icon-xs" title="Editar" onClick={() => openEdit(item)}>
                      <Pencil />
                    </Button>
                    <Button variant="destructive" size="icon-xs" title="Excluir" onClick={() => setDeleteTarget(item)}>
                      <Trash2 />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Nenhuma descrição encontrada.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>

        <PaginationBar page={page} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      {/* Edit Dialog — template DNALIO */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Editar descrição de cargo" : "Nova descrição de cargo (template DNALIO)"}</DialogTitle>
            <DialogDescription>Preencha o template completo. As seções estruturadas alimentam o matching de candidatos.</DialogDescription>
          </DialogHeader>

          {/* ── Cabeçalho ── */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cabeçalho</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Código *</label>
                <Input placeholder="DC-0001" value={draft.code} onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))} maxLength={30} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Cargo *</label>
                <Input placeholder="Assistente de Suporte Técnico" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} maxLength={200} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Área</label>
                <Input placeholder="Tecnologia da Informação" value={draft.areaTemplate} onChange={(e) => setDraft((d) => ({ ...d, areaTemplate: e.target.value }))} maxLength={120} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">CBO</label>
                <Input placeholder="2124-05" value={draft.cboCodigo} onChange={(e) => setDraft((d) => ({ ...d, cboCodigo: e.target.value }))} maxLength={20} />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Descrição Sumária</label>
                <textarea className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" placeholder="Resumo da função (1-2 parágrafos)..." value={draft.summary} onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))} maxLength={2000} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Nível de cargo (opcional)</label>
                <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.nivelCargoId} onChange={(e) => setDraft((d) => ({ ...d, nivelCargoId: e.target.value }))}>
                  <option value="">— nenhum —</option>
                  {niveis.map((n) => (
                    <option key={n.id} value={n.id}>{n.code} — {n.description}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
                  <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.isActive ? "ativo" : "inativo"} onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.value === "ativo" }))}>
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Tipo</label>
                  <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.isTemplate ? "template" : "uso-direto"} onChange={(e) => setDraft((d) => ({ ...d, isTemplate: e.target.value === "template" }))}>
                    <option value="uso-direto">Uso direto</option>
                    <option value="template">Template (reutilizável)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* ── Formação ── */}
          <div className="pt-4 border-t border-border/40 space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Formação</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Mínima</label>
                <Input placeholder="Ensino superior Completo" value={draft.formacaoMinima} onChange={(e) => setDraft((d) => ({ ...d, formacaoMinima: e.target.value }))} maxLength={200} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Desejável</label>
                <Input placeholder="Pós-Graduação Cursando" value={draft.formacaoDesejavel} onChange={(e) => setDraft((d) => ({ ...d, formacaoDesejavel: e.target.value }))} maxLength={200} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Área de Estudo</label>
                <Input placeholder="Tecnologia da Informação" value={draft.formacaoAreaEstudo} onChange={(e) => setDraft((d) => ({ ...d, formacaoAreaEstudo: e.target.value }))} maxLength={200} />
              </div>
            </div>
          </div>

          {/* ── Experiência ── */}
          <div className="pt-4 border-t border-border/40 space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Experiência</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Tempo Mínimo</label>
                <Input placeholder="1 ano" value={draft.experienciaTempoMinimo} onChange={(e) => setDraft((d) => ({ ...d, experienciaTempoMinimo: e.target.value }))} maxLength={80} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Tempo Desejável</label>
                <Input placeholder="Inferior a 2 anos" value={draft.experienciaTempoDesejavel} onChange={(e) => setDraft((d) => ({ ...d, experienciaTempoDesejavel: e.target.value }))} maxLength={80} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Especificação</label>
                <Input placeholder="Experiência na área ou função similar" value={draft.experienciaEspecificacao} onChange={(e) => setDraft((d) => ({ ...d, experienciaEspecificacao: e.target.value }))} maxLength={500} />
              </div>
            </div>
          </div>

          {/* ── Itens DNALIO (uma seção por categoria) ── */}
          <div className="pt-4 border-t border-border/40 space-y-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Itens DNALIO (consumidos pelo matching)</div>

            {ALL_CATEGORIAS.map((cat) => {
              const itensDaCat = draft.itens
                .map((it, globalIdx) => ({ it, globalIdx }))
                .filter(({ it }) => it.categoria === cat);
              const usaObrigatoria = CATEGORIAS_USAM_OBRIGATORIA.includes(cat);
              return (
                <div key={cat} className="rounded-md border border-border/40 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-sm font-semibold">{CATEGORIA_LABEL[cat]}</div>
                      <div className="text-xs text-muted-foreground">{CATEGORIA_HINT[cat]}</div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => addItem(cat)}>
                      <Plus className="size-3.5" /><span className="ml-1">Adicionar</span>
                    </Button>
                  </div>

                  {itensDaCat.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic py-2 px-1">Nenhum item nesta categoria.</div>
                  ) : (
                    <div className="space-y-2">
                      {itensDaCat.map(({ it, globalIdx }) => (
                        <div key={globalIdx} className="flex items-start gap-2 bg-muted/30 rounded p-2">
                          <Input
                            className="flex-1 h-8 text-sm"
                            placeholder="Texto do item"
                            value={it.texto}
                            onChange={(e) => updateItem(globalIdx, "texto", e.target.value)}
                            maxLength={500}
                          />
                          {(cat === "CompetenciaTecnica") && (
                            <Input
                              className="w-32 h-8 text-xs"
                              placeholder="Subcategoria"
                              title="ex.: Hardware, Software, Idioma, Segurança"
                              value={it.subcategoria}
                              onChange={(e) => updateItem(globalIdx, "subcategoria", e.target.value)}
                              maxLength={80}
                            />
                          )}
                          {(cat === "CompetenciaTecnica" || cat === "VivenciaEspecifica") && (
                            <Input
                              className="w-28 h-8 text-xs"
                              placeholder="Nível"
                              title="ex.: Básico, Intermediário, Avançado, Fluente"
                              value={it.nivelMinimo}
                              onChange={(e) => updateItem(globalIdx, "nivelMinimo", e.target.value)}
                              maxLength={40}
                            />
                          )}
                          {usaObrigatoria && (
                            <select
                              className="h-8 rounded border border-input bg-background px-2 text-xs"
                              value={it.isObrigatoria ? "obrig" : "desej"}
                              onChange={(e) => updateItem(globalIdx, "isObrigatoria", e.target.value === "obrig")}
                            >
                              <option value="obrig">Obrigatório</option>
                              <option value="desej">Desejável</option>
                            </select>
                          )}
                          <Button variant="ghost" size="icon-xs" onClick={() => removeItem(globalIdx)} title="Remover">
                            <X className="size-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Conteúdo HTML legado (apresentação pública) ── */}
          <details className="pt-4 border-t border-border/40">
            <summary className="cursor-pointer text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conteúdo HTML legado (apresentação pública na vaga)</summary>
            <div className="space-y-3 mt-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Responsabilidades (HTML)</label>
                <textarea className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs font-mono" value={draft.responsibilities} onChange={(e) => setDraft((d) => ({ ...d, responsibilities: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Requisitos (HTML)</label>
                <textarea className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs font-mono" value={draft.requirements} onChange={(e) => setDraft((d) => ({ ...d, requirements: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Diferenciais (HTML)</label>
                <textarea className="min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs font-mono" value={draft.niceToHave} onChange={(e) => setDraft((d) => ({ ...d, niceToHave: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Benefícios (HTML)</label>
                <textarea className="min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs font-mono" value={draft.benefits} onChange={(e) => setDraft((d) => ({ ...d, benefits: e.target.value }))} />
              </div>
            </div>
          </details>

          {/* ── Revisão e Aprovação ── */}
          <div className="pt-4 border-t border-border/40 space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Revisão e Aprovação</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Revisão nº</label>
                <Input placeholder="00" value={draft.revisaoNumero} onChange={(e) => setDraft((d) => ({ ...d, revisaoNumero: e.target.value }))} maxLength={10} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Data</label>
                <Input type="date" value={draft.revisaoData} onChange={(e) => setDraft((d) => ({ ...d, revisaoData: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Natureza</label>
                <Input placeholder="Descrição Inicial / Atualização" value={draft.revisaoNatureza} onChange={(e) => setDraft((d) => ({ ...d, revisaoNatureza: e.target.value }))} maxLength={200} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Gestor</label>
                <Input placeholder="Nome do gestor responsável" value={draft.gestorNome} onChange={(e) => setDraft((d) => ({ ...d, gestorNome: e.target.value }))} maxLength={200} />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">E-mail do gestor</label>
                <Input type="email" placeholder="gestor@empresa.com" value={draft.gestorEmail} onChange={(e) => setDraft((d) => ({ ...d, gestorEmail: e.target.value }))} maxLength={200} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Excluir a descrição <strong>&quot;{deleteTarget?.title}&quot;</strong>? Todos os itens DNALIO serão removidos junto. Vagas que apontam para esta descrição precisarão ser desvinculadas antes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={async () => {
              if (!deleteTarget) return;
              try {
                await fetchJson(`/api/descricoes-cargo/${deleteTarget.id}`, { method: "DELETE" });
                toast.success("Descrição removida");
                setDeleteTarget(null);
                await syncList();
              } catch (err) {
                const raw = err instanceof Error ? err.message : String(err);
                const bodyStart = raw.indexOf(": ");
                const body = bodyStart >= 0 ? raw.slice(bodyStart + 2) : raw;
                let friendly = raw;
                try {
                  const parsed = JSON.parse(body) as { message?: string };
                  if (parsed?.message) friendly = parsed.message;
                } catch { /* não JSON */ }
                toast.error(friendly, { duration: 8000 });
              }
            }}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
