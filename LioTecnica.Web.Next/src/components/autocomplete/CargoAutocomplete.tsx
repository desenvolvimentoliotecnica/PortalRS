"use client";

import React, { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Loader2, X } from "lucide-react";

export interface CargoLookup {
  id: string;
  code: string;
  name: string;
  areaId?: string;
  areaName?: string;
  seniority?: string;
}

interface CargoAutocompleteProps {
  value: string | number | null;
  onChange: (code: string) => void;
  onSelectId?: (id: string) => void;
  onSelect?: (item: CargoLookup) => void;
  defaultCargoLabel?: { code: string; name: string };
  placeholder?: string;
}

export function CargoAutocomplete({
  value,
  onChange,
  onSelectId,
  onSelect,
  defaultCargoLabel,
  placeholder = "Digite código ou nome do cargo...",
}: CargoAutocompleteProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<CargoLookup[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedCargo, setSelectedCargo] = useState<CargoLookup | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Buscar cargos quando o search mudar
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (search.trim().length < 1) {
        setResults([]);
        return;
      }

      try {
        setLoading(true);
        const res = await apiFetch(`/api/job-positions/lookup?search=${encodeURIComponent(search)}`, {
          method: "GET",
        });

        if (res.ok) {
          const data = await res.json();
          setResults(Array.isArray(data) ? data : []);
          setOpen(true);
        }
      } catch (err) {
        console.error("Erro ao buscar cargos:", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  // Carregar cargo selecionado quando value mudar (modo edição)
  useEffect(() => {
    if (value && !selectedCargo) {
      const strValue = String(value);
      const cargo = results.find(c => c.code === strValue || c.id === strValue);
      if (cargo) {
        setSelectedCargo(cargo);
      } else if (search === "" && defaultCargoLabel) {
        setSelectedCargo({
          id: "",
          code: defaultCargoLabel.code,
          name: defaultCargoLabel.name,
        });
      }
    }
  }, [value, results, selectedCargo, search, defaultCargoLabel]);

  // Fechar dropdown quando clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (cargo: CargoLookup) => {
    setSelectedCargo(cargo);
    onChange(cargo.code);
    onSelectId?.(cargo.id);
    onSelect?.(cargo);
    setSearch("");
    setResults([]);
    setOpen(false);
  };

  const handleClear = () => {
    setSelectedCargo(null);
    setSearch("");
    setResults([]);
    onChange("");
    onSelectId?.("");
    onSelect?.({ id: "", code: "", name: "" });
  };

  return (
    <div ref={containerRef} className="relative">
      {selectedCargo ? (
        <div className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <div className="font-medium">{selectedCargo.name}</div>
            <div className="text-xs text-muted-foreground font-mono">{selectedCargo.code}</div>
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
            {results.map((cargo) => (
              <button
                key={cargo.id}
                type="button"
                onClick={() => handleSelect(cargo)}
                className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors border-b border-border/30 last:border-0"
              >
                <div className="font-medium">{cargo.name}</div>
                <div className="text-xs text-muted-foreground">
                  <span className="font-mono">{cargo.code}</span>
                  {cargo.areaName && <span className="ml-2">· {cargo.areaName}</span>}
                  {cargo.seniority && <span className="ml-2">· {cargo.seniority}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {open && search.trim().length > 0 && results.length === 0 && !loading && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-md border border-input bg-popover p-3 shadow-md text-sm text-muted-foreground text-center">
          Nenhum cargo encontrado
        </div>
      )}
    </div>
  );
}
