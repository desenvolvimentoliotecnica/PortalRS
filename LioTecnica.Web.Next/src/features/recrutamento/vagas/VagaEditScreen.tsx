"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import VagaFormModal from "./VagaFormModal";

interface Props {
  editId?: string;
}

/**
 * Tela full-page para criar/editar vaga.
 * Wrapper fino sobre VagaFormModal — renderiza como página ao invés de modal.
 * O VagaFormModal recebe open=true e nunca fecha por overlay.
 */
export default function VagaEditScreen({ editId }: Props) {
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
    <div className="space-y-4">
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
        onClose={handleClose}
        onSaved={handleSaved}
        embedded
      />
    </div>
  );
}
