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
    <div className="vaga-edit-font-2x space-y-6">
      <style>{`
        .vaga-edit-font-2x {
          font-size: 2rem;
          line-height: 2.5rem;
        }

        .vaga-edit-font-2x .text-\\[10px\\] {
          font-size: 20px !important;
          line-height: 1.5rem !important;
        }

        .vaga-edit-font-2x .text-\\[0\\.82rem\\] {
          font-size: 1.64rem !important;
          line-height: 2.1rem !important;
        }

        .vaga-edit-font-2x .text-xs {
          font-size: 1.5rem !important;
          line-height: 2rem !important;
        }

        .vaga-edit-font-2x .text-sm {
          font-size: 1.75rem !important;
          line-height: 2.25rem !important;
        }

        .vaga-edit-font-2x .text-base {
          font-size: 2rem !important;
          line-height: 2.5rem !important;
        }

        .vaga-edit-font-2x .text-lg {
          font-size: 2.25rem !important;
          line-height: 2.75rem !important;
        }

        .vaga-edit-font-2x .text-xl {
          font-size: 2.5rem !important;
          line-height: 3rem !important;
        }

        .vaga-edit-font-2x input:not([type="checkbox"]),
        .vaga-edit-font-2x select,
        .vaga-edit-font-2x textarea,
        .vaga-edit-font-2x button {
          font-size: 1.75rem !important;
          line-height: 2.25rem !important;
        }

        .vaga-edit-font-2x input:not([type="checkbox"]),
        .vaga-edit-font-2x select,
        .vaga-edit-font-2x button {
          min-height: 4rem;
        }

        .vaga-edit-font-2x textarea {
          min-height: 7rem;
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
