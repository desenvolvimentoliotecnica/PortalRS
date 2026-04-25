"use client";

import React, { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Loader2, X } from "lucide-react";

export interface UnidadeLotacaoLookup {
  id: string;
  code: string;
  description: string;
}

interface UnidadeLotacaoAutocompleteProps {
  value: string | number | null;
  onChange: (code: string) => void;
  onSelectId?: (id: string) => void;
  onSelectItem?: (item: UnidadeLotacaoLookup) => void;
  defaultLabel?: { code: string; description: string };
  placeholder?: string;
  excludeId?: string;
  /** Quando fornecido, usa esta lista em vez de buscar da API */
  items?: UnidadeLotacaoLookup[];
}

export function UnidadeLotacaoAutocomplete({
  value,
  onChange,
  onSelectId,
  onSelectItem,
  defaultLabel,
  placeholder = "Buscar unidade de lotação...",
  excludeId,
  items: itemsProp,
}: UnidadeLotacaoAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [fetchedItems, setFetchedItems] = useState<UnidadeLotacaoLookup[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<UnidadeLotacaoLookup | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);

  const allItems = itemsProp ?? fetchedItems;

  // Load from API only when no items prop is provided
  useEffect(() => {
    if (itemsProp !== undefined) return;
    if (loaded.current) return;
    loaded.current = true;
    setLoading(true);
    apiFetch("/api/unidades-lotacao/lookup")
      .then((res) => res.ok ? res.json() : [])
      .then((data) => {
        const raw = Array.isArray(data) ? data : [];
        const mapped = raw.map((x: Record<string, unknown>) => ({
          id: String(x.id ?? x.Id ?? ""),
          code: String(x.code ?? x.Code ?? ""),
          description: String(x.description ?? x.Description ?? ""),
        }));
        const seen = new Set<string>();
        setFetchedItems(mapped.filter((x) => {
          const key = x.code.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }));
      })
      .catch(() => setFetchedItems([]))
      .finally(() => setLoading(false));
  }, [itemsProp]);

  // Resolve selected item from value
  useEffect(() => {
    if (!value || selected) return;
    const strValue = String(value);
    const found = allItems.find((c) => c.code === strValue || c.id === strValue);
    if (found) {
      setSelected(found);
    } else if (defaultLabel) {
      setSelected({ id: "", code: defaultLabel.code, description: defaultLabel.description });
    } else if (strValue) {
      setSelected({ id: "", code: strValue, description: `Unidade ${strValue}` });
    }
  }, [value, allItems, selected, defaultLabel]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = (() => {
    const base = query.trim()
      ? allItems.filter((i) => {
          const q = query.toLowerCase();
          return i.description.toLowerCase().includes(q) || i.code.toLowerCase().includes(q);
        })
      : allItems;
    return excludeId ? base.filter((i) => i.id !== excludeId) : base;
  })();

  const handleSelect = (item: UnidadeLotacaoLookup) => {
    setSelected(item);
    onChange(item.code);
    onSelectId?.(item.id);
    onSelectItem?.(item);
    setQuery("");
    setOpen(false);
  };

  const handleClear = () => {
    setSelected(null);
    setQuery("");
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
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-md border border-input bg-popover p-0 shadow-md">
          {filtered.length > 0 ? (
            <div className="max-h-64 overflow-y-auto">
              {filtered.map((item) => (
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
          ) : (
            <div className="p-3 text-sm text-muted-foreground text-center">
              {loading ? "Carregando..." : "Nenhuma unidade encontrada"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
