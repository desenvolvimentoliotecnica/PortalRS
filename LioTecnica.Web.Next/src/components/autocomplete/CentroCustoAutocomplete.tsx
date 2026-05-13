"use client";

import React, { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Loader2, X } from "lucide-react";

export interface CentroCustoLookup {
  id: string;
  code: string;
  description: string;
}

interface CentroCustoAutocompleteProps {
  value: string | number | null;
  onChange: (code: string) => void;
  onSelectId?: (id: string) => void;
  onSelectItem?: (item: CentroCustoLookup) => void;
  defaultLabel?: { code: string; description: string };
  placeholder?: string;
}

export function CentroCustoAutocomplete({
  value,
  onChange,
  onSelectId,
  onSelectItem,
  defaultLabel,
  placeholder = "Buscar centro de custo...",
}: CentroCustoAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [allItems, setAllItems] = useState<CentroCustoLookup[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<CentroCustoLookup | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);

  // Load all items once on mount
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    setLoading(true);
    apiFetch("/api/centros-custo/lookup")
      .then((res) => res.ok ? res.json() : [])
      .then((data) => {
        const raw = Array.isArray(data) ? data : [];
        setAllItems(raw.map((x: Record<string, unknown>) => ({
          id: String(x.id ?? x.Id ?? ""),
          code: String(x.code ?? x.Code ?? ""),
          description: String(x.description ?? x.Description ?? ""),
        })));
      })
      .catch(() => setAllItems([]))
      .finally(() => setLoading(false));
  }, []);

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
      setSelected({ id: "", code: strValue, description: `Centro ${strValue}` });
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

  const filtered = query.trim()
    ? allItems.filter((i) => {
        const q = query.toLowerCase();
        return i.description.toLowerCase().includes(q) || i.code.toLowerCase().includes(q);
      })
    : allItems;

  const handleSelect = (item: CentroCustoLookup) => {
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
        <div className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm flex items-center justify-between gap-2">
          <div
            className="min-w-0 flex-1 truncate font-medium"
            title={`${selected.code} : ${selected.description}`}
          >
            <span className="font-mono text-muted-foreground">{selected.code}</span>
            <span className="text-muted-foreground"> : </span>
            <span>{selected.description}</span>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
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
              {loading ? "Carregando..." : "Nenhum centro de custo encontrado"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
