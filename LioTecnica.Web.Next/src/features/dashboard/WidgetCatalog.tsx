"use client";

import { Button } from "@/components/ui/button";
import { WIDGET_CATALOG, type WidgetId } from "./dashboardLayout";

export function WidgetCatalog({
  open,
  onClose,
  visibleWidgets,
  onToggle,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  visibleWidgets: WidgetId[];
  onToggle: (id: WidgetId, visible: boolean) => void;
  onReset: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-stretch bg-black/40"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="ml-auto h-dvh w-full max-w-md bg-white p-4 shadow-2xl overflow-y-auto flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div>
            <div className="text-sm font-semibold">Widgets do Dashboard</div>
            <div className="text-muted-foreground text-sm">Mostre ou oculte seções</div>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Fechar
          </Button>
        </div>

        <div className="space-y-2 flex-1">
          {WIDGET_CATALOG.map((meta) => {
            const isVisible = visibleWidgets.includes(meta.id);
            return (
              <div
                key={meta.id}
                className="flex items-center justify-between rounded-lg border border-border/40 p-3"
              >
                <div className="min-w-0 mr-3">
                  <div className="text-sm font-medium">{meta.label}</div>
                  <div className="text-xs text-muted-foreground">{meta.description}</div>
                </div>
                {meta.removable ? (
                  <button
                    role="switch"
                    aria-checked={isVisible}
                    onClick={() => onToggle(meta.id, !isVisible)}
                    className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isVisible ? "bg-[rgb(var(--lt-primary))]" : "bg-muted"}`}
                  >
                    <span
                      className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${isVisible ? "translate-x-5" : "translate-x-0.5"}`}
                    />
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground shrink-0">Sempre visível</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              onReset();
              onClose();
            }}
          >
            Restaurar layout padrão
          </Button>
        </div>
      </div>
    </div>
  );
}
