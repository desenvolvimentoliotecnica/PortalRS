"use client";

import React, { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Loader2, X } from "lucide-react";

export interface FuncionarioLookup {
  id: string;
  nome: string;
  matricula?: string | null;
  email?: string | null;
}

interface Props {
  value: string | null;
  onSelect: (item: FuncionarioLookup | null) => void;
  placeholder?: string;
}

export function FuncionarioAutocomplete({
  value,
  onSelect,
  placeholder = "Digite nome ou matrícula...",
}: Props) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<FuncionarioLookup[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<FuncionarioLookup | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolve label when value provided externally
  useEffect(() => {
    if (!value || selected?.id === value) return;
    apiFetch(`/api/funcionarios/${value}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) setSelected({ id: d.id, nome: d.name ?? d.nome ?? "", matricula: d.matricula, email: d.email });
      })
      .catch(() => null);
  }, [value, selected?.id]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setItems([]); return; }
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ q: query, pageSize: "20" });
      apiFetch(`/api/funcionarios?${params}`)
        .then((r) => r.ok ? r.json() : { items: [] })
        .then((d) => {
          const raw: Record<string, unknown>[] = Array.isArray(d) ? d : (d?.items ?? []);
          setItems(raw.map((x) => ({
            id: String(x.id ?? ""),
            nome: String(x.name ?? x.nome ?? ""),
            matricula: x.matricula != null ? String(x.matricula) : null,
            email: x.email != null ? String(x.email) : null,
          })));
        })
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    }, 300);
  }, [query, open]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function handleSelect(item: FuncionarioLookup) {
    setSelected(item);
    setQuery("");
    setOpen(false);
    onSelect(item);
  }

  function handleClear() {
    setSelected(null);
    setQuery("");
    setItems([]);
    onSelect(null);
  }

  return (
    <div ref={containerRef} className="relative">
      {selected ? (
        <div className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <div className="font-medium">{selected.nome}</div>
            {selected.matricula && (
              <div className="text-xs text-muted-foreground font-mono">{selected.matricula}</div>
            )}
          </div>
          <button type="button" onClick={handleClear} className="text-muted-foreground hover:text-foreground ml-2">
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="pr-10"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
          )}
        </div>
      )}

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-md border border-input bg-popover shadow-md">
          {items.length > 0 ? (
            <div className="max-h-60 overflow-y-auto">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors border-b border-border/30 last:border-0"
                >
                  <div className="font-medium">{item.nome}</div>
                  {item.matricula && (
                    <div className="text-xs text-muted-foreground font-mono">{item.matricula}</div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="p-3 text-sm text-muted-foreground text-center">
              {loading ? "Buscando..." : query ? "Nenhum colaborador encontrado" : "Digite para buscar"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
