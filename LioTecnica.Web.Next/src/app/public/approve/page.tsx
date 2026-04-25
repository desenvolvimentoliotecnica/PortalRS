"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface MagicLinkSummary {
  solicitacaoId: string;
  tipoFluxoLabel: string;
  tituloSolicitacao: string;
  solicitanteNome: string;
  expirado: boolean;
  jaUtilizado: boolean;
}

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "summary"; data: MagicLinkSummary; action: "approve" | "reject" | null }
  | { kind: "confirming"; action: "approve" | "reject" }
  | { kind: "done"; action: "approve" | "reject" };

function PublicApproveContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const action = searchParams.get("action") as "approve" | "reject" | null;

  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    if (!token) {
      setState({ kind: "error", message: "Link inválido — token não encontrado." });
      return;
    }
    fetch(`/api/public/approve/${token}`)
      .then((r) => {
        if (!r.ok) throw new Error("Token inválido ou expirado.");
        return r.json() as Promise<MagicLinkSummary>;
      })
      .then((data) => setState({ kind: "summary", data, action }))
      .catch((e) => setState({ kind: "error", message: e.message }));
  }, [token, action]);

  const handleConfirm = async () => {
    if (state.kind !== "summary" || !token) return;
    const acaoCode = state.action === "approve" ? 1 : 2;
    setState({ kind: "confirming", action: state.action! });

    const res = await fetch(`/api/public/approve/${token}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: acaoCode, observacao: observacao || null }),
    });

    if (res.ok || res.status === 204) {
      setState({ kind: "done", action: state.action! });
    } else {
      const body = await res.json().catch(() => ({ message: "Erro desconhecido." }));
      setState({ kind: "error", message: body.message });
    }
  };

  if (state.kind === "loading") {
    return <Layout><p className="text-gray-500">Carregando...</p></Layout>;
  }

  if (state.kind === "error") {
    return (
      <Layout>
        <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-center">
          <p className="text-red-700 font-medium">{state.message}</p>
          <p className="text-sm text-gray-500 mt-2">
            Acesse o portal para gerenciar solicitações pendentes.
          </p>
        </div>
      </Layout>
    );
  }

  if (state.kind === "done") {
    const approved = state.action === "approve";
    return (
      <Layout>
        <div className={`rounded-lg border p-6 text-center ${approved ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
          <p className={`text-lg font-semibold ${approved ? "text-green-700" : "text-red-700"}`}>
            {approved ? "✅ Solicitação aprovada com sucesso!" : "❌ Solicitação reprovada."}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            O solicitante será notificado automaticamente.
          </p>
        </div>
      </Layout>
    );
  }

  if (state.kind === "confirming") {
    return <Layout><p className="text-gray-500">Processando...</p></Layout>;
  }

  // summary
  const { data } = state;

  if (data.expirado) {
    return (
      <Layout>
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-6 text-center">
          <p className="text-yellow-700 font-medium">⚠️ Este link expirou.</p>
          <p className="text-sm text-gray-500 mt-2">Acesse o portal para aprovar ou reprovar a solicitação.</p>
        </div>
      </Layout>
    );
  }

  if (data.jaUtilizado) {
    return (
      <Layout>
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-6 text-center">
          <p className="text-gray-700 font-medium">Este link já foi utilizado.</p>
        </div>
      </Layout>
    );
  }

  const isApprove = action === "approve";
  const actionLabel = isApprove ? "Aprovar" : "Reprovar";
  const actionColor = isApprove ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700";

  return (
    <Layout>
      <div className="space-y-4">
        <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-2">
          <p className="text-xs text-gray-400 uppercase tracking-wide">{data.tipoFluxoLabel}</p>
          <p className="text-lg font-semibold text-gray-900">{data.tituloSolicitacao}</p>
          <p className="text-sm text-gray-500">Solicitante: <span className="text-gray-700">{data.solicitanteNome}</span></p>
        </div>

        {!isApprove && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motivo da reprovação (opcional)</label>
            <textarea
              className="w-full rounded-md border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              rows={3}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Informe o motivo..."
            />
          </div>
        )}

        <button
          onClick={handleConfirm}
          className={`w-full rounded-lg py-3 px-6 text-white font-semibold text-sm transition ${actionColor}`}
        >
          {actionLabel} solicitação
        </button>

        <p className="text-center text-xs text-gray-400">
          Ação irreversível via este link. Para solicitar ajustes, acesse o portal.
        </p>
      </div>
    </Layout>
  );
}

export default function PublicApprovePage() {
  return (
    <Suspense fallback={<Layout><p className="text-gray-500">Carregando...</p></Layout>}>
      <PublicApproveContent />
    </Suspense>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-gray-800">Portal RH — Aprovação</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
