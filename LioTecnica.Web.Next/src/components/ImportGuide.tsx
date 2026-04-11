"use client";

import { useState } from "react";
import { ChevronDown, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";

export interface ImportColumn {
  /** Nome canônico da coluna (cabeçalho do xlsx) */
  name: string;
  /** Descrição/exemplo exibido ao usuário */
  hint?: string;
  /** Se a coluna é obrigatória */
  required?: boolean;
}

interface ImportGuideProps {
  /** Nome da entidade, usado no nome do arquivo modelo: "Empresas" → "modelo_empresas.xlsx" */
  entity: string;
  columns: ImportColumn[];
}

export function ImportGuide({ entity, columns }: ImportGuideProps) {
  const [open, setOpen] = useState(false);

  function downloadTemplate() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([columns.map((c) => c.name)]);
    XLSX.utils.book_append_sheet(wb, ws, "Modelo");
    XLSX.writeFile(wb, `modelo_${entity.toLowerCase().replace(/\s+/g, "_")}.xlsx`);
  }

  return (
    <div className="rounded-md border border-border/60 bg-muted/30 text-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 text-left font-medium text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <span>Como preparar a planilha?</span>
        <ChevronDown className={`size-4 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-border/40 px-3 pb-3 pt-2 space-y-3">
          <p className="text-xs text-muted-foreground">
            Use uma planilha <strong>.xlsx</strong>, <strong>.xls</strong> ou <strong>.csv</strong> com os cabeçalhos abaixo na primeira linha. Códigos existentes são atualizados; novos são criados.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="text-left px-2 py-1 bg-muted rounded-tl-md rounded-bl-md font-semibold text-foreground">Coluna</th>
                  <th className="text-left px-2 py-1 bg-muted font-semibold text-foreground">Exemplo / Valores aceitos</th>
                  <th className="text-right px-2 py-1 bg-muted rounded-tr-md rounded-br-md font-semibold text-foreground">Req.</th>
                </tr>
              </thead>
              <tbody>
                {columns.map((col) => (
                  <tr key={col.name} className="border-b border-border/30 last:border-0">
                    <td className="px-2 py-1 font-mono text-foreground">{col.name}</td>
                    <td className="px-2 py-1 text-muted-foreground">{col.hint ?? "—"}</td>
                    <td className="px-2 py-1 text-right">{col.required ? <span className="text-destructive font-bold">*</span> : <span className="text-muted-foreground">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="size-3.5 mr-1" />
            Baixar modelo (.xlsx)
          </Button>
        </div>
      )}
    </div>
  );
}
