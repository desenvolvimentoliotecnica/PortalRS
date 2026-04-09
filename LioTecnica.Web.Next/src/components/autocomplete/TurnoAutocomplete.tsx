"use client";

import React, { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Loader2, X } from "lucide-react";

export interface TurnoLookup {
  id: string;
  code: string;
  description: string;
}

interface TurnoAutocompleteProps {
  value: string | number | null;
  onChange: (code: string) => void;
  onSelectId?: (id: string) => void;
  onSelectItem?: (item: TurnoLookup) => void;
  defaultLabel?: { code: string; description: string };
  placeholder?: string;
}

export function TurnoAutocomplete({
  value,
  onChange,
  onSelectId,
  onSelectItem,
  defaultLabel,
  placeholder = "Buscar turno...",
}: TurnoAutocompleteProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<TurnoLookup[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<TurnoLookup | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (search.trim().length < 1) {
        setResults([]);
        return;
      }
      try {
        setLoading(true);
        const res = await apiFetch(`/api/turnos/lookup?search=${encodeURIComponent(search)}`);
        if (res.ok) {
          const data = await res.json();
          const raw = Array.isArray(data) ? data : [];
          const mapped: TurnoLookup[] = raw.map((x: Record<string, unknown>) => ({
            id: String(x.id ?? x.Id ?? ""),
            code: String(x.code ?? x.Code ?? ""),
            description: String(x.description ?? x.Description ?? ""),
          }));
          setResults(mapped);
          setOpen(true);
        }
      } catch (err) {
        console.error("Erro ao buscar turnos:", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (value && !selected) {
      const strValue = String(value);
      const found = results.find((c) => c.code === strValue || c.id === strValue);
      if (found) {
        setSelected(found);
      } else if (search === "" && defaultLabel) {
        setSelected({ id: "", code: defaultLabel.code, description: defaultLabel.description });
      } else if (search === "" && strValue) {
        setSelected({ id: "", code: strValue, description: `Turno ${strValue}` });
      }
    }
  }, [value, results, selected, search, defaultLabel]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (item: TurnoLookup) => {
    setSelected(item);
    onChange(item.code);
    onSelectId?.(item.id);
    onSelectItem?.(item);
    setSearch("");
    setResults([]);
    setOpen(false);
  };

  const handleClear = () => {
    setSelected(null);
    setSearch("");
    setResults([]);
    onChange("");
    onSelectId?.("");
    onSelectItem?.({ id: "", code: "", description: "" });
  };

  return (
    <div ref={containerRef} className="relative">
      {selected ? (
        <div className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <div className="font-medium">{selected.description}</div>
            <div className="text-xs text-muted-foreground font-mono">{selected.code}</div>
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
                <div className="font-medium">{item.description}</div>
                <div className="text-xs text-muted-foreground font-mono">{item.code}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {open && search.trim().length > 0 && results.length === 0 && !loading && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-md border border-input bg-popover p-3 shadow-md text-sm text-muted-foreground text-center">
          Nenhum turno encontrado
        </div>
      )}
    </div>
  );
}
