"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface PerguntaDto {
  id: string;
  ordem: number;
  texto: string;
  tipoResposta: "Texto" | "Escala" | "MultiplaEscolha";
  opcoes: string[] | null;
  obrigatoria: boolean;
}

interface EntrevistaSaidaFormulario {
  entrevistaId: string;
  funcionarioNome: string;
  expirado: boolean;
  jaPreenchido: boolean;
  perguntas: PerguntaDto[];
}

interface RespostaDto {
  perguntaId: string;
  valorTexto: string | null;
  valorEscala: number | null;
  valorOpcao: string | null;
}

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "expired" }
  | { kind: "already_done" }
  | { kind: "form"; data: EntrevistaSaidaFormulario }
  | { kind: "submitting" }
  | { kind: "done" };

export default function ExitInterviewPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [respostas, setRespostas] = useState<Record<string, RespostaDto>>({});
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch(`/api/public/exit-interview/${token}`)
      .then((r) => {
        if (r.status === 404) throw new Error("Link inválido ou não encontrado.");
        if (!r.ok) throw new Error("Erro ao carregar formulário.");
        return r.json() as Promise<EntrevistaSaidaFormulario>;
      })
      .then((data) => {
        if (data.expirado) { setState({ kind: "expired" }); return; }
        if (data.jaPreenchido) { setState({ kind: "already_done" }); return; }

        // Initialize empty answers
        const initial: Record<string, RespostaDto> = {};
        for (const p of data.perguntas) {
          initial[p.id] = { perguntaId: p.id, valorTexto: null, valorEscala: null, valorOpcao: null };
        }
        setRespostas(initial);
        setState({ kind: "form", data });
      })
      .catch((e) => setState({ kind: "error", message: e.message }));
  }, [token]);

  const updateResposta = (perguntaId: string, patch: Partial<Omit<RespostaDto, "perguntaId">>) => {
    setRespostas((prev) => ({ ...prev, [perguntaId]: { ...prev[perguntaId], ...patch } }));
    setValidationErrors((prev) => { const s = new Set(prev); s.delete(perguntaId); return s; });
  };

  const handleSubmit = async () => {
    if (state.kind !== "form") return;

    // Validate required fields
    const errors = new Set<string>();
    for (const p of state.data.perguntas) {
      if (!p.obrigatoria) continue;
      const r = respostas[p.id];
      const filled =
        (p.tipoResposta === "Texto" && r?.valorTexto?.trim()) ||
        (p.tipoResposta === "Escala" && r?.valorEscala != null) ||
        (p.tipoResposta === "MultiplaEscolha" && r?.valorOpcao);
      if (!filled) errors.add(p.id);
    }

    if (errors.size > 0) {
      setValidationErrors(errors);
      return;
    }

    setState({ kind: "submitting" });

    const res = await fetch(`/api/public/exit-interview/${token}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ respostas: Object.values(respostas) }),
    });

    if (res.ok || res.status === 204) {
      setState({ kind: "done" });
    } else {
      const body = await res.json().catch(() => ({ message: "Erro ao enviar respostas." }));
      if (res.status === 409) {
        setState({ kind: "already_done" });
      } else {
        setState({ kind: "error", message: body.message ?? "Erro ao enviar respostas." });
      }
    }
  };

  if (state.kind === "loading") {
    return <Layout><p className="text-gray-500 text-center">Carregando formulário...</p></Layout>;
  }

  if (state.kind === "error") {
    return (
      <Layout>
        <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-center">
          <p className="text-red-700 font-medium">{state.message}</p>
          <p className="text-sm text-gray-500 mt-2">Se o problema persistir, entre em contato com o RH.</p>
        </div>
      </Layout>
    );
  }

  if (state.kind === "expired") {
    return (
      <Layout>
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-6 text-center">
          <p className="text-2xl mb-2">⏰</p>
          <p className="text-yellow-700 font-semibold">Este link expirou.</p>
          <p className="text-sm text-gray-500 mt-2">
            O prazo para responder a entrevista de saída encerrou.
            Entre em contato com o RH se precisar de mais informações.
          </p>
        </div>
      </Layout>
    );
  }

  if (state.kind === "already_done") {
    return (
      <Layout>
        <div className="rounded-lg bg-green-50 border border-green-200 p-6 text-center">
          <p className="text-2xl mb-2">✅</p>
          <p className="text-green-700 font-semibold">Formulário já preenchido.</p>
          <p className="text-sm text-gray-500 mt-2">
            Suas respostas já foram registradas. Obrigado pela sua participação!
          </p>
        </div>
      </Layout>
    );
  }

  if (state.kind === "submitting") {
    return <Layout><p className="text-gray-500 text-center">Enviando respostas...</p></Layout>;
  }

  if (state.kind === "done") {
    return (
      <Layout>
        <div className="rounded-lg bg-green-50 border border-green-200 p-8 text-center space-y-3">
          <p className="text-3xl">🙏</p>
          <p className="text-green-700 font-semibold text-lg">Obrigado pelo seu feedback!</p>
          <p className="text-sm text-gray-500">
            Suas respostas são confidenciais e nos ajudam a melhorar continuamente.
            Desejamos muito sucesso nessa nova fase da sua carreira!
          </p>
        </div>
      </Layout>
    );
  }

  // form state
  const { data } = state;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="text-center space-y-1">
          <p className="text-sm text-gray-500">Olá, <span className="font-medium text-gray-700">{data.funcionarioNome}</span>!</p>
          <p className="text-sm text-gray-500">
            Suas respostas são confidenciais e muito importantes para nós.
          </p>
        </div>

        <div className="space-y-5">
          {data.perguntas.map((pergunta, idx) => (
            <QuestionCard
              key={pergunta.id}
              pergunta={pergunta}
              index={idx}
              resposta={respostas[pergunta.id]}
              hasError={validationErrors.has(pergunta.id)}
              onChange={(patch) => updateResposta(pergunta.id, patch)}
            />
          ))}
        </div>

        <button
          onClick={handleSubmit}
          className="w-full rounded-lg py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition"
        >
          Enviar respostas
        </button>

        {validationErrors.size > 0 && (
          <p className="text-center text-sm text-red-600">
            Preencha todas as perguntas obrigatórias antes de enviar.
          </p>
        )}

        <p className="text-center text-xs text-gray-400">
          Este link é válido por 30 dias a partir do envio. Suas respostas são confidenciais.
        </p>
      </div>
    </Layout>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface QuestionCardProps {
  pergunta: PerguntaDto;
  index: number;
  resposta: RespostaDto;
  hasError: boolean;
  onChange: (patch: Partial<Omit<RespostaDto, "perguntaId">>) => void;
}

function QuestionCard({ pergunta, index, resposta, hasError, onChange }: QuestionCardProps) {
  return (
    <div className={`rounded-lg border bg-white p-5 space-y-3 ${hasError ? "border-red-400" : "border-gray-200"}`}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-xs font-medium text-gray-400 shrink-0">{index + 1}.</span>
        <p className="text-sm font-medium text-gray-800">
          {pergunta.texto}
          {pergunta.obrigatoria && <span className="text-red-500 ml-1">*</span>}
        </p>
      </div>

      {pergunta.tipoResposta === "Texto" && (
        <textarea
          className="w-full rounded-md border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          rows={3}
          value={resposta?.valorTexto ?? ""}
          onChange={(e) => onChange({ valorTexto: e.target.value || null })}
          placeholder="Sua resposta..."
        />
      )}

      {pergunta.tipoResposta === "Escala" && (
        <ScaleInput
          value={resposta?.valorEscala ?? null}
          onChange={(v) => onChange({ valorEscala: v })}
        />
      )}

      {pergunta.tipoResposta === "MultiplaEscolha" && pergunta.opcoes && (
        <div className="space-y-2">
          {pergunta.opcoes.map((opcao) => (
            <label key={opcao} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="radio"
                name={pergunta.id}
                value={opcao}
                checked={resposta?.valorOpcao === opcao}
                onChange={() => onChange({ valorOpcao: opcao })}
                className="h-4 w-4 accent-blue-600"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">{opcao}</span>
            </label>
          ))}
        </div>
      )}

      {hasError && (
        <p className="text-xs text-red-600">Esta pergunta é obrigatória.</p>
      )}
    </div>
  );
}

function ScaleInput({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const labels: Record<number, string> = { 1: "Muito ruim", 5: "Neutro", 10: "Excelente" };

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5 flex-wrap">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`h-9 w-9 rounded-md text-sm font-medium border transition
              ${value === n
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-600"
              }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        {[1, 5, 10].map((n) => (
          <span key={n}>{n} — {labels[n]}</span>
        ))}
      </div>
    </div>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center p-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-gray-800">Entrevista de Saída</h1>
          <p className="text-sm text-gray-400 mt-1">Portal RH</p>
        </div>
        {children}
      </div>
    </div>
  );
}
