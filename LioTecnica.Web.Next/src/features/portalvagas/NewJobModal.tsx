"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";

type CentroCustoLookup = { id: string; code: string; description: string; displayLabel?: string };
type EnumOption = { code: string; text: string };
type EnumMap = Record<string, EnumOption[]>;

function ccLabel(c: CentroCustoLookup): string {
  return c.displayLabel ?? (c.code ? `${c.code} — ${c.description}` : c.description);
}

function parseMoneyBR(val: string): number | null {
  if (!val || typeof val !== "string") return null;
  const cleaned = val.replace(/\D/g, "");
  if (!cleaned) return null;
  const n = parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : null;
}

function formatMoneyInput(val: string): string {
  const cleaned = (val || "").replace(/\D/g, "");
  if (!cleaned) return "";
  const n = parseInt(cleaned, 10);
  if (!Number.isFinite(n)) return val;
  return n.toLocaleString("pt-BR");
}

interface NewJobModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function NewJobModal({ open, onClose, onSaved }: NewJobModalProps) {
  const [alert, setAlert] = useState("");
  const [loading, setLoading] = useState(false);
  const [centrosCusto, setCentrosCusto] = useState<CentroCustoLookup[]>([]);
  const [enums, setEnums] = useState<EnumMap>({});
  const [ufs, setUfs] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);

  const [form, setForm] = useState({
    titulo: "",
    centroCustoId: "",
    status: "Aberta",
    modalidade: "",
    senioridade: "",
    tipoContratacao: "",
    quantidadeVagas: 1,
    matchMinimo: 60,
    visibilidade: "Externa",
    uf: "",
    cidade: "",
    salarioMinimo: "",
    salarioMaximo: "",
    descricaoPublica: "",
    tagsKeywords: "",
    tagsStack: "",
    tagsResponsabilidades: "",
    confidencial: false,
    urgente: false,
    canalSite: true,
    canalLinkedIn: false,
    canalIndicacao: false,
    canalPortais: false,
  });

  const getOpts = useCallback((key: string) => (Array.isArray(enums[key]) ? enums[key]! : []), [enums]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    Promise.all([
      apiFetch("/api/centros-custo/lookup", { cache: "no-store" }).then((r) => r.json()),
      apiFetch("/api/lookup/enums", { cache: "no-store" }).then((r) => r.json()),
      apiFetch("/PortalVagas/Locations/Ufs", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([cc, e, u]) => {
        if (!alive) return;
        setCentrosCusto(Array.isArray(cc) ? cc : []);
        setEnums(e || {});
        const ufList = (Array.isArray(u) ? u : []).map((x: unknown) => String(x).trim().toUpperCase()).filter(Boolean).sort((a: string, b: string) => a.localeCompare(b, "pt-BR"));
        setUfs(ufList);
      })
      .catch(() => {
        if (alive) toast.error("Falha ao carregar dados.");
      });
    return () => { alive = false; };
  }, [open]);

  useEffect(() => {
    if (!form.uf) {
      setCities([]);
      return;
    }
    setLoadingCities(true);
    apiFetch(`/PortalVagas/Locations/Ufs/${encodeURIComponent(form.uf)}/Cities`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        setCities(Array.isArray(data) ? data : []);
      })
      .catch(() => setCities([]))
      .finally(() => setLoadingCities(false));
  }, [form.uf]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAlert("");
    if (!form.titulo.trim()) {
      setAlert("Informe o título.");
      return;
    }
    if (!form.centroCustoId) {
      setAlert("Selecione o centro de custo.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        titulo: form.titulo.trim(),
        centroCustoId: form.centroCustoId,
        status: form.status || "Aberta",
        codigo: null,
        areaTime: null,
        modalidade: form.modalidade || null,
        senioridade: form.senioridade || null,
        quantidadeVagas: form.quantidadeVagas || 1,
        tipoContratacao: form.tipoContratacao || null,
        matchMinimoPercentual: form.matchMinimo ?? 0,
        weights: null,
        descricaoInterna: null,
        codigoInterno: null,
        codigoCbo: null,
        motivoAbertura: null,
        orcamentoAprovado: null,
        gestorRequisitante: null,
        recrutadorResponsavel: null,
        prioridade: null,
        resumoPitch: null,
        tagsResponsabilidadesRaw: form.tagsResponsabilidades || null,
        tagsKeywordsRaw: form.tagsKeywords || null,
        confidencial: form.confidencial,
        urgente: form.urgente,
        aceitaPcd: false,
        generoPreferencia: null,
        vagaAfirmativa: false,
        linguagemInclusiva: false,
        publicoAfirmativo: null,
        observacoesPcd: null,
        projetoNome: null,
        projetoClienteAreaImpactada: null,
        projetoPrazoPrevisto: null,
        projetoDescricao: null,
        regime: null,
        cargaSemanalHoras: null,
        escala: null,
        horaEntrada: null,
        horaSaida: null,
        intervalo: null,
        cep: null,
        logradouro: null,
        numero: null,
        bairro: null,
        cidade: form.cidade || null,
        uf: form.uf || null,
        politicaTrabalho: null,
        observacoesDeslocamento: null,
        moeda: null,
        salarioMinimo: parseMoneyBR(form.salarioMinimo),
        salarioMaximo: parseMoneyBR(form.salarioMaximo),
        periodicidade: null,
        bonusTipo: null,
        bonusPercentual: null,
        observacoesRemuneracao: null,
        escolaridade: null,
        formacaoArea: null,
        experienciaMinimaAnos: null,
        tagsStackRaw: form.tagsStack || null,
        tagsIdiomasRaw: null,
        diferenciais: null,
        observacoesProcesso: null,
        visibilidade: form.visibilidade || null,
        dataInicio: null,
        dataEncerramento: null,
        canalLinkedIn: form.canalLinkedIn,
        canalSiteCarreiras: form.canalSite,
        canalIndicacao: form.canalIndicacao,
        canalPortaisEmprego: form.canalPortais,
        descricaoPublica: form.descricaoPublica || null,
        lgpdSolicitarConsentimentoExplicito: false,
        lgpdCompartilharCurriculoInternamente: false,
        lgpdRetencaoAtiva: false,
        lgpdRetencaoMeses: null,
        exigeCnh: false,
        disponibilidadeParaViagens: false,
        checagemAntecedentes: false,
        beneficios: [],
        requisitos: [],
        etapas: [],
        perguntasTriagem: [],
      };

      const res = await apiFetch("/api/vagas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAlert(data?.message || "Falha ao criar vaga.");
        toast.error(data?.message || "Falha ao criar vaga.");
        return;
      }
      toast.success("Vaga criada com sucesso.");
      onSaved();
      onClose();
      setForm({
        titulo: "",
        centroCustoId: "",
        status: "Aberta",
        modalidade: "",
        senioridade: "",
        tipoContratacao: "",
        quantidadeVagas: 1,
        matchMinimo: 60,
        visibilidade: "Externa",
        uf: "",
        cidade: "",
        salarioMinimo: "",
        salarioMaximo: "",
        descricaoPublica: "",
        tagsKeywords: "",
        tagsStack: "",
        tagsResponsabilidades: "",
        confidencial: false,
        urgente: false,
        canalSite: true,
        canalLinkedIn: false,
        canalIndicacao: false,
        canalPortais: false,
      });
    } catch {
      setAlert("Erro inesperado ao criar vaga.");
      toast.error("Erro ao criar vaga.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="newJobModalLabel">
      <div className="card-soft w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-2 p-4 border-b shrink-0">
          <div>
            <h2 id="newJobModalLabel" className="text-lg font-extrabold">Nova vaga</h2>
            <p className="text-sm text-muted-foreground">Preencha os dados principais para publicar a vaga.</p>
          </div>
          <Button variant="outline" size="sm" onClick={onClose} aria-label="Fechar">Fechar</Button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {alert ? <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{alert}</div> : null}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mini-title mb-1 block">Título *</label>
                <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} maxLength={160} required />
              </div>
              <div className="md:col-span-2">
                <label className="mini-title mb-1 block">Centro de Custo *</label>
                <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.centroCustoId} onChange={(e) => setForm((f) => ({ ...f, centroCustoId: e.target.value }))} required>
                  <option value="">Selecione</option>
                  {centrosCusto.map((c) => <option key={c.id} value={c.id}>{ccLabel(c)}</option>)}
                </select>
              </div>
              <div>
                <label className="mini-title mb-1 block">Status</label>
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                  {getOpts("vagaStatus").map((o) => <option key={o.code} value={o.code}>{o.text}</option>)}
                </select>
              </div>
              <div>
                <label className="mini-title mb-1 block">Modalidade</label>
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.modalidade} onChange={(e) => setForm((f) => ({ ...f, modalidade: e.target.value }))}>
                  <option value="">Selecione</option>
                  {getOpts("vagaModalidade").map((o) => <option key={o.code} value={o.code}>{o.text}</option>)}
                </select>
              </div>
              <div>
                <label className="mini-title mb-1 block">Senioridade</label>
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.senioridade} onChange={(e) => setForm((f) => ({ ...f, senioridade: e.target.value }))}>
                  <option value="">Selecione</option>
                  {getOpts("vagaSenioridade").map((o) => <option key={o.code} value={o.code}>{o.text}</option>)}
                </select>
              </div>
              <div>
                <label className="mini-title mb-1 block">Tipo de contratação</label>
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.tipoContratacao} onChange={(e) => setForm((f) => ({ ...f, tipoContratacao: e.target.value }))}>
                  <option value="">Selecione</option>
                  {getOpts("vagaTipoContratacao").map((o) => <option key={o.code} value={o.code}>{o.text}</option>)}
                </select>
              </div>
              <div>
                <label className="mini-title mb-1 block">Quantidade de vagas</label>
                <input type="number" className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" min={1} value={form.quantidadeVagas} onChange={(e) => setForm((f) => ({ ...f, quantidadeVagas: Math.max(1, Number(e.target.value) || 1) }))} />
              </div>
              <div>
                <label className="mini-title mb-1 block">Match mínimo (%)</label>
                <input type="number" className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" min={0} max={100} value={form.matchMinimo} onChange={(e) => setForm((f) => ({ ...f, matchMinimo: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }))} />
              </div>
              <div>
                <label className="mini-title mb-1 block">Visibilidade</label>
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.visibilidade} onChange={(e) => setForm((f) => ({ ...f, visibilidade: e.target.value }))}>
                  {getOpts("vagaPublicacaoVisibilidade").map((o) => <option key={o.code} value={o.code}>{o.text}</option>)}
                </select>
              </div>
              <div>
                <label className="mini-title mb-1 block">UF</label>
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.uf} onChange={(e) => setForm((f) => ({ ...f, uf: e.target.value, cidade: "" }))}>
                  <option value="">Selecione</option>
                  {ufs.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
              <div>
                <label className="mini-title mb-1 block">Cidade</label>
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.cidade} onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))} disabled={!form.uf || loadingCities}>
                  <option value="">{form.uf ? (loadingCities ? "Carregando..." : "Selecione") : "Selecione a UF primeiro"}</option>
                  {cities.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="mini-title mb-1 block">Salário mínimo (R$)</label>
                <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" type="text" inputMode="decimal" value={form.salarioMinimo} onChange={(e) => setForm((f) => ({ ...f, salarioMinimo: formatMoneyInput(e.target.value) }))} />
              </div>
              <div>
                <label className="mini-title mb-1 block">Salário máximo (R$)</label>
                <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" type="text" inputMode="decimal" value={form.salarioMaximo} onChange={(e) => setForm((f) => ({ ...f, salarioMaximo: formatMoneyInput(e.target.value) }))} />
              </div>
            </div>

            <div>
              <label className="mini-title mb-1 block">Descrição pública</label>
              <textarea className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" rows={4} value={form.descricaoPublica} onChange={(e) => setForm((f) => ({ ...f, descricaoPublica: e.target.value }))} />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="mini-title mb-1 block">Tags palavras-chave</label>
                <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={form.tagsKeywords} onChange={(e) => setForm((f) => ({ ...f, tagsKeywords: e.target.value }))} />
              </div>
              <div>
                <label className="mini-title mb-1 block">Tags stack</label>
                <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={form.tagsStack} onChange={(e) => setForm((f) => ({ ...f, tagsStack: e.target.value }))} />
              </div>
              <div>
                <label className="mini-title mb-1 block">Tags responsabilidades</label>
                <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={form.tagsResponsabilidades} onChange={(e) => setForm((f) => ({ ...f, tagsResponsabilidades: e.target.value }))} />
              </div>
            </div>

            <div className="rounded-lg border p-3 space-y-2">
              <div className="font-semibold">Opções</div>
              <div className="flex flex-wrap gap-4">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={form.confidencial} onChange={(e) => setForm((f) => ({ ...f, confidencial: e.target.checked }))} />
                  <span>Confidencial</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={form.urgente} onChange={(e) => setForm((f) => ({ ...f, urgente: e.target.checked }))} />
                  <span>Urgente</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={form.canalSite} onChange={(e) => setForm((f) => ({ ...f, canalSite: e.target.checked }))} />
                  <span>Publicar no site</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={form.canalLinkedIn} onChange={(e) => setForm((f) => ({ ...f, canalLinkedIn: e.target.checked }))} />
                  <span>LinkedIn</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={form.canalIndicacao} onChange={(e) => setForm((f) => ({ ...f, canalIndicacao: e.target.checked }))} />
                  <span>Indicação</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={form.canalPortais} onChange={(e) => setForm((f) => ({ ...f, canalPortais: e.target.checked }))} />
                  <span>Portais de emprego</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 p-4 border-t shrink-0">
            <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar vaga"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
