"use client";

import { GripHorizontal, X } from "lucide-react";

export function WidgetShell({
  children,
  label,
  isEditMode,
  removable,
  onRemove,
}: {
  children: React.ReactNode;
  label: string;
  isEditMode: boolean;
  removable: boolean;
  onRemove?: () => void;
}) {
  function handleClickCapture(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest(".drag-handle") || target.closest(".react-resizable-handle")) return;
    e.preventDefault();
    e.stopPropagation();
  }

  return (
    <div className="relative h-full" onClickCapture={isEditMode ? handleClickCapture : undefined}>
      {isEditMode && (
        <div className="drag-handle absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 rounded-t-xl border-b border-primary/20 bg-primary/8 px-3 py-1.5 cursor-grab active:cursor-grabbing select-none">
          <div className="flex items-center gap-1.5 min-w-0">
            <GripHorizontal className="size-3.5 text-primary/60 shrink-0" />
            <span className="text-xs font-medium text-primary/80 truncate">{label}</span>
          </div>
          {removable && onRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              aria-label={`Remover ${label}`}
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      )}
      <div className={isEditMode ? "pt-8 h-full" : "h-full"}>{children}</div>
    </div>
  );
}
