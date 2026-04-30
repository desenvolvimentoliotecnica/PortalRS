"use client";

import React from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import SolicitacaoForm, { type SolicitacaoDraft, type SolicitacaoFormProps } from "./SolicitacaoForm";

export type { SolicitacaoDraft };

interface Props extends Omit<SolicitacaoFormProps, "active" | "onCancel" | "onSuccess"> {
    open: boolean;
    onClose: () => void;
    onSaved: () => void;
}

export default function SolicitacaoFormModal({ open, editId, onClose, onSaved, viewOnly, resubmitAfterSave, copySourceId, initialData, reloadNonce }: Props) {
    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold">
                        {viewOnly ? "Visualizar Requisição de Pessoal" : copySourceId ? "Copiar Requisição de Pessoal" : editId ? "Editar Requisição de Pessoal" : "Requisição de Pessoal"}
                    </DialogTitle>
                </DialogHeader>
                <div className="min-h-0 flex-1 overflow-y-auto">
                    <SolicitacaoForm
                        active={open}
                        editId={editId}
                        onCancel={onClose}
                        onSuccess={onSaved}
                        viewOnly={viewOnly}
                        resubmitAfterSave={resubmitAfterSave}
                        copySourceId={copySourceId}
                        initialData={initialData}
                        reloadNonce={reloadNonce}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
