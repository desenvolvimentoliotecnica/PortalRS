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
    /** Conteúdo extra no rodapé do modal (ex.: distribuir analista RH na tela de solicitações). */
    footerExtra?: React.ReactNode;
}

export default function SolicitacaoFormModal({ open, editId, onClose, onSaved, viewOnly, resubmitAfterSave, copySourceId, initialData, reloadNonce, footerExtra }: Props) {
    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent
                className="flex h-[95vh] max-h-[95vh] min-h-0 w-full flex-col gap-0 overflow-hidden p-6 sm:max-w-5xl"
                // Fechar só por Cancelar / X: não overlay, não Escape. Evita fechar quando toast/toaster rouba foco (validação).
                onPointerDownOutside={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
                onFocusOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
            >
                <DialogHeader className="shrink-0 space-y-0 pb-3 pr-8">
                    <DialogTitle className="text-base font-semibold">
                        {viewOnly ? "Visualizar Requisição de Pessoal" : copySourceId ? "Copiar Requisição de Pessoal" : editId ? "Editar Requisição de Pessoal" : "Requisição de Pessoal"}
                    </DialogTitle>
                </DialogHeader>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
                {footerExtra ? (
                    <div className="shrink-0 border-t border-border bg-background pt-3">
                        {footerExtra}
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}
