"use client";

import React, { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Loader2, X } from "lucide-react";

export interface NivelCargoLookup {
  id: string;
  cdnNivCargo: number;
  nomReduz: string;
  nomComplet: string;
  displayLabel: string;
}

interface NivelCargoAutocompleteProps {
  value: string | null;
  onChange: (id: string) => void;
  onSelect?: (item: NivelCargoLookup) => void;
  defaultLabel?: string;
  placeholder?: string;
  required?: boolean;
}

export function NivelCargoAutocomplete({
  value,
  onChange,
  onSelect,
  defaultLabel,
  placeholder = "Digite código ou nome do nível...",
  required,
}: NivelCargoAutocompleteProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<NivelCargoLookup[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<NivelCargoLookup | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (search.trim().length < 1) {
        setResults([]);
        return;
      }
      try {
        setLoading(true);
        const res = await apiFetch(
          `/api/nivel-cargo/lookup?search=${encodeURIComponent(search)}`,
          { method: "GET" }
        );
        if (res.ok) {
          const data = await res.json();
          setResults(Array.isArray(data) ? data : []);
          setOpen(true);
        }
      } catch (err) {
        console.error("Erro ao buscar níveis de cargo:", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Preenche a seleção no modo edição (quando value vem de fora)
  useEffect(() => {
    if (value && !selected) {
      const found = results.find((r) => r.id === value);
      if (found) {
        setSelected(found);
      } else if (search === "" && defaultLabel) {
        setSelected({ id: value, cdnNivCargo: 0, nomReduz: "", nomComplet: defaultLabel, displayLabel: defaultLabel });
      }
    }
    if (!value) {
      setSelected(null);
    }
  }, [value, results, selected, search, defaultLabel]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (item: NivelCargoLookup) => {
    setSelected(item);
    onChange(item.id);
    onSelect?.(item);
    setSearch("");
    setResults([]);
    setOpen(false);
  };

  const handleClear = () => {
    setSelected(null);
    setSearch("");
    setResults([]);
    onChange("");
    onSelect?.({ id: "", cdnNivCargo: 0, nomReduz: "", nomComplet: "", displayLabel: "" });
  };

  return (
    <div ref={containerRef} className="relative">
      {selected ? (
        <div className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <div className="font-medium">{selected.nomComplet}</div>
            {selected.nomReduz && (
              <div className="text-xs text-muted-foreground font-mono">{selected.nomReduz}</div>
            )}
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="text-muted-foreground hover:text-foreground transition-colors ml-2"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => search.length > 0 && setOpen(true)}
            placeholder={placeholder}
            className="pr-10"
            required={required}
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
          )}
        </div>
      )}

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-md border border-input bg-popover p-0 shadow-md">
          <div className="max-h-64 overflow-y-auto">
            {results.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item)}
                className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors border-b border-border/30 last:border-0"
              >
                <div className="font-medium">{item.nomComplet}</div>
                <div className="text-xs text-muted-foreground font-mono">{item.nomReduz}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {open && search.trim().length > 0 && results.length === 0 && !loading && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-md border border-input bg-popover p-3 shadow-md text-sm text-muted-foreground text-center">
          Nenhum nível de cargo encontrado
        </div>
      )}
    </div>
  );
}
