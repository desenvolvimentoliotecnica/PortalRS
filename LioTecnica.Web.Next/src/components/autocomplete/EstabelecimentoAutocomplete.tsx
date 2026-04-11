"use client";

import React, { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Loader2, X } from "lucide-react";

export interface EstabelecimentoLookup {
  id: string;
  code: string;
  name: string;
}

interface EstabelecimentoAutocompleteProps {
  value: string | null;
  onChange: (id: string | null) => void;
  empresaId?: string | null;
  defaultLabel?: { code: string; name: string };
  placeholder?: string;
}

export function EstabelecimentoAutocomplete({
  value,
  onChange,
  empresaId,
  defaultLabel,
  placeholder = "Selecione o estabelecimento...",
}: EstabelecimentoAutocompleteProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<EstabelecimentoLookup[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<EstabelecimentoLookup | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Clear selection when empresaId changes
  useEffect(() => {
    setSelected(null);
    onChange(null);
    setSearch("");
    setResults([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (search.trim().length < 1) { setResults([]); return; }
      try {
        setLoading(true);
        const params = new URLSearchParams({ search });
        if (empresaId) params.set("empresaId", empresaId);
        const res = await apiFetch(`/api/units/lookup?${params.toString()}`);
        if (res.ok) { const data = await res.json(); setResults(Array.isArray(data) ? data : []); setOpen(true); }
      } catch (err) { console.error("Erro ao buscar estabelecimentos:", err); setResults([]); }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, empresaId]);

  useEffect(() => {
    if (!value) { setSelected(null); return; }
    if (selected?.id === value) return;
    if (defaultLabel) {
      setSelected({ id: value, code: defaultLabel.code, name: defaultLabel.name });
    }
  }, [value, defaultLabel, selected?.id]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) { if (!containerRef.current?.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (item: EstabelecimentoLookup) => {
    setSelected(item);
    onChange(item.id);
    setSearch("");
    setResults([]);
    setOpen(false);
  };

  const handleClear = () => {
    setSelected(null);
    setSearch("");
    setResults([]);
    onChange(null);
  };

  return (
    <div ref={containerRef} className="relative">
      {selected ? (
        <div className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <div className="font-medium">{selected.name}</div>
            <div className="text-xs text-muted-foreground font-mono">{selected.code}</div>
          </div>
          <button type="button" onClick={handleClear} className="text-muted-foreground hover:text-foreground transition-colors ml-2"><X className="size-4" /></button>
        </div>
      ) : (
        <div className="relative">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} onFocus={() => search.length > 0 && setOpen(true)} placeholder={placeholder} className="pr-10" />
          {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />}
        </div>
      )}

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-md border border-input bg-popover p-0 shadow-md">
          <div className="max-h-64 overflow-y-auto">
            {results.map((item) => (
              <button key={item.id} type="button" onClick={() => handleSelect(item)} className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors border-b border-border/30 last:border-0">
                <div className="font-medium">{item.name}</div>
                <div className="text-xs text-muted-foreground font-mono">{item.code}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {open && search.trim().length > 0 && results.length === 0 && !loading && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-md border border-input bg-popover p-3 shadow-md text-sm text-muted-foreground text-center">
          Nenhum estabelecimento encontrado
        </div>
      )}
    </div>
  );
}
