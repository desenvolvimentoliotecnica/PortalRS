"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Star } from "lucide-react";

const DEFAULT_CRITERIA = [
  { id: "tecnico", label: "Competência Técnica" },
  { id: "comunicacao", label: "Comunicação" },
  { id: "cultural", label: "Fit Cultural" },
  { id: "motivacao", label: "Motivação" },
] as const;

const VERDICTS = [
  { value: "forte_sim", label: "Forte Sim", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-300" },
  { value: "sim", label: "Sim", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-200" },
  { value: "neutro", label: "Neutro", cls: "bg-zinc-500/10 text-zinc-600 border-zinc-200" },
  { value: "nao", label: "Não", cls: "bg-red-500/10 text-red-600 border-red-200" },
  { value: "forte_nao", label: "Forte Não", cls: "bg-red-500/15 text-red-700 border-red-300" },
] as const;

export interface ScorecardData {
  candidatoId: string;
  fase: string;
  scores: Record<string, number>;
  verdict: string;
  notes: string;
}

export default function ScorecardDialog({
  open,
  onOpenChange,
  candidatoName,
  fase,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidatoName: string;
  fase: string;
  onSubmit: (data: Omit<ScorecardData, "candidatoId">) => void;
}) {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [verdict, setVerdict] = useState("");
  const [notes, setNotes] = useState("");

  function handleSubmit() {
    onSubmit({ fase, scores, verdict, notes });
    onOpenChange(false);
    setScores({});
    setVerdict("");
    setNotes("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Avaliação — {fase}</DialogTitle>
          <DialogDescription>Avalie {candidatoName} nesta etapa.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Criteria scores */}
          {DEFAULT_CRITERIA.map((c) => (
            <div key={c.id}>
              <div className="text-sm font-medium mb-1">{c.label}</div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setScores((s) => ({ ...s, [c.id]: n }))}
                    className="p-0.5"
                  >
                    <Star
                      className={`size-5 transition-colors ${
                        (scores[c.id] ?? 0) >= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Overall verdict */}
          <div>
            <div className="text-sm font-medium mb-2">Veredito geral</div>
            <div className="flex flex-wrap gap-2">
              {VERDICTS.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                    verdict === v.value ? v.cls + " ring-2 ring-offset-1 ring-primary/30" : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                  onClick={() => setVerdict(v.value)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <div className="text-sm font-medium mb-1">Observações</div>
            <textarea
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
              rows={3}
              placeholder="Pontos fortes, pontos de atenção..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!verdict}>
            Salvar Avaliação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
