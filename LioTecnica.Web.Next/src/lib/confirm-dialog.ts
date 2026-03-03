"use client";

export type ConfirmDialogOptions = {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

type NormalizedConfirmDialogOptions = Required<ConfirmDialogOptions>;
type ConfirmDialogHandler = (options: NormalizedConfirmDialogOptions) => Promise<boolean>;

let currentHandler: ConfirmDialogHandler | null = null;

export function setConfirmDialogHandler(handler: ConfirmDialogHandler | null) {
  currentHandler = handler;
}

function normalizeOptions(options: string | ConfirmDialogOptions): NormalizedConfirmDialogOptions {
  if (typeof options === "string") {
    return {
      title: "Confirmar ação",
      description: options,
      confirmText: "Confirmar",
      cancelText: "Cancelar",
      destructive: false,
    };
  }

  return {
    title: options.title?.trim() || "Confirmar ação",
    description: options.description?.trim() || "",
    confirmText: options.confirmText?.trim() || "Confirmar",
    cancelText: options.cancelText?.trim() || "Cancelar",
    destructive: Boolean(options.destructive),
  };
}

export async function confirmDialog(options: string | ConfirmDialogOptions): Promise<boolean> {
  const normalized = normalizeOptions(options);

  if (currentHandler) return currentHandler(normalized);

  if (typeof window !== "undefined") {
    const text = normalized.description || normalized.title;
    return window.confirm(text);
  }

  return true;
}
