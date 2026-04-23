"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookTemplate,
  Mail,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Save,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  type CanalNotificacao,
  type EtapaMacroCandidatura,
  type NotificacaoTemplateItem,
  listarNotificacoesTemplates,
  resolveCanal,
  resolveEtapa,
  restaurarNotificacaoTemplateDefault,
  salvarNotificacaoTemplate,
} from "@/features/recrutamento/candidaturas/candidaturaApi";

// Etapa "Aplicada" não entra no editor — é o estado inicial e não dispara notificação.
const ETAPAS_EDITAVEIS: EtapaMacroCandidatura[] = [
  "EmTriagem",
  "Entrevista",
  "Teste",
  "Proposta",
  "Contratado",
  "Recusado",
  "Desistiu",
];

const CANAIS: CanalNotificacao[] = ["Email", "WhatsApp"];

const ETAPA_LABEL: Record<EtapaMacroCandidatura, string> = {
  Aplicada: "Aplicada",
  EmTriagem: "Em triagem",
  Entrevista: "Entrevista",
  Teste: "Teste",
  Proposta: "Proposta",
  Contratado: "Contratado",
  Recusado: "Recusado",
  Desistiu: "Desistiu",
};

const ETAPA_COLOR: Record<EtapaMacroCandidatura, string> = {
  Aplicada: "bg-sky-50 text-sky-800 border-sky-200",
  EmTriagem: "bg-indigo-50 text-indigo-800 border-indigo-200",
  Entrevista: "bg-violet-50 text-violet-800 border-violet-200",
  Teste: "bg-amber-50 text-amber-800 border-amber-200",
  Proposta: "bg-cyan-50 text-cyan-800 border-cyan-200",
  Contratado: "bg-emerald-50 text-emerald-800 border-emerald-200",
  Recusado: "bg-red-50 text-red-800 border-red-200",
  Desistiu: "bg-zinc-50 text-zinc-700 border-zinc-200",
};

function canalIcon(canal: CanalNotificacao) {
  return canal === "WhatsApp" ? (
    <MessageSquare className="h-4 w-4 text-emerald-600" />
  ) : (
    <Mail className="h-4 w-4 text-sky-600" />
  );
}

/** Chave para lookup em dict plano (etapa|canal). */
function cellKey(etapa: EtapaMacroCandidatura, canal: CanalNotificacao) {
  return `${etapa}|${canal}`;
}

type Draft = {
  assunto: string;
  corpo: string;
  usaDefault: boolean;
  atualizadoEmUtc: string | null;
  dirty: boolean;
  savingBusy: boolean;
  restoreBusy: boolean;
};

export default function NotificacoesTemplatesScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NotificacaoTemplateItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listarNotificacoesTemplates();
      setItems(data);
      const map: Record<string, Draft> = {};
      for (const it of data) {
        const etapa = resolveEtapa(it.etapa);
        const canal = resolveCanal(it.canal);
        map[cellKey(etapa, canal)] = {
          assunto: it.assunto ?? "",
          corpo: it.corpo,
          usaDefault: it.usaDefault,
          atualizadoEmUtc: it.atualizadoEmUtc,
          dirty: false,
          savingBusy: false,
          restoreBusy: false,
        };
      }
      setDrafts(map);
    } catch {
      toast.error("Falha ao carregar templates de notificação.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateDraft = (etapa: EtapaMacroCandidatura, canal: CanalNotificacao, patch: Partial<Draft>) => {
    setDrafts((prev) => {
      const key = cellKey(etapa, canal);
      const curr = prev[key];
      if (!curr) return prev;
      return { ...prev, [key]: { ...curr, ...patch, dirty: patch.dirty ?? true } };
    });
  };

  const saveCell = async (etapa: EtapaMacroCandidatura, canal: CanalNotificacao) => {
    const key = cellKey(etapa, canal);
    const draft = drafts[key];
    if (!draft) return;
    if (!draft.corpo.trim()) {
      toast.error("Corpo do template não pode ser vazio.");
      return;
    }
    updateDraft(etapa, canal, { savingBusy: true, dirty: draft.dirty });
    try {
      const saved = await salvarNotificacaoTemplate({
        etapa,
        canal,
        assunto: canal === "WhatsApp" ? null : draft.assunto?.trim() || null,
        corpo: draft.corpo.trim(),
      });
      setDrafts((prev) => ({
        ...prev,
        [key]: {
          assunto: saved.assunto ?? "",
          corpo: saved.corpo,
          usaDefault: saved.usaDefault,
          atualizadoEmUtc: saved.atualizadoEmUtc,
          dirty: false,
          savingBusy: false,
          restoreBusy: false,
        },
      }));
      if (saved.usaDefault) {
        toast.success("Template revertido para o padrão (conteúdo igual ao default).");
      } else {
        toast.success("Template salvo.");
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Falha ao salvar template.";
      toast.error(message);
      updateDraft(etapa, canal, { savingBusy: false });
    }
  };

  const restoreCell = async (etapa: EtapaMacroCandidatura, canal: CanalNotificacao) => {
    const key = cellKey(etapa, canal);
    const draft = drafts[key];
    if (!draft) return;
    updateDraft(etapa, canal, { restoreBusy: true, dirty: draft.dirty });
    try {
      await restaurarNotificacaoTemplateDefault(etapa, canal);
      // Recarregar só essa célula via reload completo (barato — 14 linhas).
      await load();
      toast.success("Template revertido ao padrão da plataforma.");
    } catch {
      toast.error("Falha ao restaurar template padrão.");
      updateDraft(etapa, canal, { restoreBusy: false });
    }
  };

  const dirtyCount = useMemo(
    () => Object.values(drafts).filter((d) => d.dirty).length,
    [drafts],
  );

  const overridesCount = useMemo(
    () => items.filter((i) => !i.usaDefault).length,
    [items],
  );

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookTemplate className="h-6 w-6 text-violet-600" />
          <div>
            <h1 className="text-2xl font-semibold">Templates de notificação</h1>
            <p className="text-sm text-zinc-600">
              Personalize os textos enviados por e-mail e WhatsApp quando uma candidatura muda de etapa.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Recarregar
        </Button>
      </header>

      <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-4 text-sm text-sky-900">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
          <div className="space-y-1">
            <p>
              Use os placeholders <code className="rounded bg-white px-1 py-0.5 font-mono text-xs">{"{candidatoNome}"}</code> e{" "}
              <code className="rounded bg-white px-1 py-0.5 font-mono text-xs">{"{vagaTitulo}"}</code> para
              personalizar a mensagem. O canal <strong>WhatsApp</strong> não possui assunto.
            </p>
            <p>
              {overridesCount > 0 ? (
                <>
                  <Badge variant="outline" className="border-violet-300 bg-violet-100 text-violet-800">
                    {overridesCount} customizações ativas
                  </Badge>
                  <span className="ml-2">
                    {14 - overridesCount} linhas usando padrão da plataforma.
                  </span>
                </>
              ) : (
                <span>Todas as 14 combinações estão usando o padrão da plataforma.</span>
              )}
              {dirtyCount > 0 && (
                <span className="ml-2 font-medium text-amber-700">
                  • {dirtyCount} alteração{dirtyCount > 1 ? "ões" : ""} não salva{dirtyCount > 1 ? "s" : ""}.
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {ETAPAS_EDITAVEIS.map((etapa) => (
          <section key={etapa} className="rounded-lg border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className={ETAPA_COLOR[etapa]}>
                  {ETAPA_LABEL[etapa]}
                </Badge>
                <span className="text-sm text-zinc-500">
                  Disparado quando a candidatura entra nesta etapa.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
              {CANAIS.map((canal) => {
                const key = cellKey(etapa, canal);
                const draft = drafts[key];
                if (!draft) return null;
                const isEmail = canal === "Email";
                return (
                  <div
                    key={canal}
                    className={`rounded-md border p-4 ${
                      draft.dirty
                        ? "border-amber-300 bg-amber-50/50"
                        : draft.usaDefault
                          ? "border-zinc-200 bg-zinc-50/40"
                          : "border-violet-200 bg-violet-50/30"
                    }`}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {canalIcon(canal)}
                        {canal}
                        {draft.usaDefault ? (
                          <Badge variant="outline" className="border-zinc-300 bg-white text-xs text-zinc-600">
                            Padrão
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-violet-300 bg-white text-xs text-violet-700">
                            Customizado
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {draft.atualizadoEmUtc
                          ? `Atualizado em ${new Date(draft.atualizadoEmUtc).toLocaleString("pt-BR")}`
                          : ""}
                      </div>
                    </div>

                    {isEmail && (
                      <div className="mb-2">
                        <label className="text-xs font-medium text-zinc-600">Assunto</label>
                        <Input
                          value={draft.assunto}
                          placeholder="Assunto do e-mail"
                          maxLength={240}
                          onChange={(e) => updateDraft(etapa, canal, { assunto: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                    )}

                    <div>
                      <label className="text-xs font-medium text-zinc-600">
                        {isEmail ? "Corpo do e-mail" : "Mensagem do WhatsApp"}
                      </label>
                      <textarea
                        value={draft.corpo}
                        rows={isEmail ? 8 : 6}
                        maxLength={4000}
                        placeholder={
                          isEmail
                            ? "Olá, {candidatoNome}!\nHouve uma atualização na sua candidatura para {vagaTitulo}."
                            : "Olá {candidatoNome}, novidade da vaga {vagaTitulo}."
                        }
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          updateDraft(etapa, canal, { corpo: e.target.value })
                        }
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <div className="mt-1 text-right text-xs text-zinc-400">
                        {draft.corpo.length}/4000
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => void saveCell(etapa, canal)}
                        disabled={draft.savingBusy || !draft.dirty}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        Salvar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void restoreCell(etapa, canal)}
                        disabled={draft.restoreBusy || draft.usaDefault}
                        title={draft.usaDefault ? "Já está usando o padrão" : "Restaurar padrão da plataforma"}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Restaurar padrão
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
