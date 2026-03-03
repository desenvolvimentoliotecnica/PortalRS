"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const STORAGE_KEY = "liotec_portal_rh_tests_v1";

type TestItem = {
  id: string;
  name: string;
  icon: string;
  desc: string;
  duration: string;
  status: string;
  lastDone: string | null;
  score: number | null;
};

const DEFAULT_TESTS: TestItem[] = [
  { id: "disc", name: "DISC", icon: "📊", desc: "Estilo comportamental (Dominância, Influência, Estabilidade e Conformidade).", duration: "10–12 min", status: "Não iniciado", lastDone: null, score: null },
  { id: "ocean", name: "Big Five", icon: "〰️", desc: "Traços de personalidade (OCEAN: Abertura, Conscienciosidade, Extroversão, Amabilidade, Neuroticismo).", duration: "12–15 min", status: "Não iniciado", lastDone: null, score: null },
  { id: "mbti", name: "MBTI", icon: "🧭", desc: "Preferências cognitivas e de interação (16 tipos).", duration: "10–14 min", status: "Não iniciado", lastDone: null, score: null },
  { id: "sjt", name: "SJT", icon: "👥", desc: "Situações do dia a dia e tomada de decisão no trabalho.", duration: "8–10 min", status: "Não iniciado", lastDone: null, score: null },
  { id: "logic", name: "Raciocínio", icon: "🧠", desc: "Raciocínio lógico e atenção a detalhes (curto).", duration: "6–8 min", status: "Não iniciado", lastDone: null, score: null },
];

function loadTests(): TestItem[] {
  if (typeof window === "undefined") return [...DEFAULT_TESTS];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_TESTS];
    const parsed = JSON.parse(raw) as TestItem[];
    if (!Array.isArray(parsed)) return [...DEFAULT_TESTS];
    const map = new Map(parsed.map((t) => [t.id, t]));
    return DEFAULT_TESTS.map((d) => ({ ...d, ...(map.get(d.id) || {}) }));
  } catch {
    return [...DEFAULT_TESTS];
  }
}

function saveTests(list: TestItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export default function PortalVagasTestsSection() {
  const [tests, setTests] = useState<TestItem[]>([]);

  const refresh = useCallback(() => {
    const list = loadTests();
    saveTests(list);
    setTests(list);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function simulateComplete(id: string) {
    const list = loadTests();
    const idx = list.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const now = new Date().toISOString();
    const score = 65 + Math.floor(Math.random() * 30);
    list[idx] = { ...list[idx], status: "Concluído", lastDone: now, score };
    saveTests(list);
    setTests(list);
    toast.success(`${list[idx].name} concluído. Resultado: ${score}%`);
  }

  function resetAll() {
    if (!confirm("Reiniciar todos os testes? Os resultados serão perdidos.")) return;
    saveTests(DEFAULT_TESTS.map((t) => ({ ...t, status: "Não iniciado", lastDone: null, score: null })));
    refresh();
    toast.success("Testes reiniciados.");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="mini-title">Testes de RH</h4>
          <p className="text-muted-foreground text-sm">Complete os testes para enriquecer seu perfil (MVP: resultados salvos neste navegador).</p>
        </div>
        <button className="btn-ghost text-sm" type="button" onClick={resetAll}>
          Reiniciar todos
        </button>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        <strong>Dica:</strong> você pode fazer 1 teste por vez. Neste MVP, use &quot;Simular conclusão&quot; para ver como os resultados aparecem. Em produção, os testes serão aplicados de forma completa.
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {tests.map((t) => (
          <div key={t.id} className="rounded-xl border border-border/60 bg-white/60 p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">{t.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{t.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    t.status === "Concluído" ? "bg-green-100 text-green-800" :
                    t.status === "Em andamento" ? "bg-blue-100 text-blue-800" :
                    "bg-slate-100 text-slate-600"
                  }`}>
                    {t.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{t.duration}</p>
                <p className="mt-2 text-sm text-muted-foreground">{t.desc}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Resultado: </span>
                    <span className="font-semibold">{t.score != null ? `${t.score}%` : "—"}</span>
                  </div>
                  {t.lastDone && (
                    <span className="text-xs text-muted-foreground">
                      Última vez: {new Date(t.lastDone).toLocaleString("pt-BR")}
                    </span>
                  )}
                </div>
                <div className="mt-3">
                  {t.status === "Não iniciado" || t.status === "Em andamento" ? (
                    <button className="btn-brand text-sm" type="button" onClick={() => simulateComplete(t.id)}>
                      Simular conclusão
                    </button>
                  ) : (
                    <button className="btn-ghost text-sm" type="button" onClick={() => simulateComplete(t.id)}>
                      Refazer
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border/40 bg-slate-50 p-3">
          <div className="font-semibold text-slate-700">O que isso melhora?</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Os testes ajudam a destacar seu estilo de trabalho, preferências e aderência cultural — facilitando a triagem e recomendações.
          </p>
        </div>
        <div className="rounded-xl border border-border/40 bg-white p-3">
          <div className="font-semibold text-slate-700">Privacidade</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Neste MVP, os resultados ficam somente no seu navegador. Em produção, você controla o compartilhamento (RH / somente match / oculto).
          </p>
        </div>
      </div>
    </div>
  );
}
