"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import VagaFormModal from "./VagaFormModal";

interface Props {
  editId?: string;
  defaultTab?: "processo";
}

/**
 * Tela full-page para criar/editar vaga.
 * Wrapper fino sobre VagaFormModal — renderiza como página ao invés de modal.
 * O VagaFormModal recebe open=true e nunca fecha por overlay.
 */
export default function VagaEditScreen({ editId, defaultTab }: Props) {
  const router = useRouter();

  function handleClose() {
    if (editId) {
      router.push(`/vagas/hub?id=${encodeURIComponent(editId)}`);
    } else {
      router.push("/vagas");
    }
  }

  function handleSaved(savedId?: string) {
    if (savedId) {
      router.push(`/vagas/hub?id=${encodeURIComponent(savedId)}`);
    } else if (editId) {
      router.push(`/vagas/hub?id=${encodeURIComponent(editId)}`);
    } else {
      router.push("/vagas");
    }
  }

  return (
    <div className="vaga-edit-font-135x space-y-6">
      <style>{`
        .vaga-edit-font-135x {
          font-size: 1.35rem;
          line-height: 1.85rem;
        }

        .vaga-edit-font-135x .text-\\[10px\\] {
          font-size: 13.5px !important;
          line-height: 1.15rem !important;
        }

        .vaga-edit-font-135x .text-\\[0\\.82rem\\] {
          font-size: 1.107rem !important;
          line-height: 1.45rem !important;
        }

        .vaga-edit-font-135x .text-xs {
          font-size: 1.0125rem !important;
          line-height: 1.45rem !important;
        }

        .vaga-edit-font-135x .text-sm {
          font-size: 1.18125rem !important;
          line-height: 1.55rem !important;
        }

        .vaga-edit-font-135x .text-base {
          font-size: 1.35rem !important;
          line-height: 1.85rem !important;
        }

        .vaga-edit-font-135x .text-lg {
          font-size: 1.51875rem !important;
          line-height: 2rem !important;
        }

        .vaga-edit-font-135x .text-xl {
          font-size: 1.6875rem !important;
          line-height: 2.2rem !important;
        }

        .vaga-edit-font-135x input:not([type="checkbox"]),
        .vaga-edit-font-135x select,
        .vaga-edit-font-135x textarea,
        .vaga-edit-font-135x button {
          font-size: 1.18125rem !important;
          line-height: 1.55rem !important;
        }

        .vaga-edit-font-135x input:not([type="checkbox"]),
        .vaga-edit-font-135x select,
        .vaga-edit-font-135x button {
          min-height: 3rem;
        }

        .vaga-edit-font-135x textarea {
          min-height: 5rem;
        }
      `}</style>
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={handleClose}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">{editId ? "Editar Vaga" : "Nova Vaga"}</h1>
          <p className="text-sm text-muted-foreground">
            {editId ? "Edite os dados da vaga e salve" : "Preencha os dados para criar uma nova vaga"}
          </p>
        </div>
      </div>

      {/* Form — reutiliza VagaFormModal em modo "embutido" */}
      <VagaFormModal
        open={true}
        editId={editId}
        defaultTab={defaultTab}
        onClose={handleClose}
        onSaved={handleSaved}
        embedded
      />
    </div>
  );
}
