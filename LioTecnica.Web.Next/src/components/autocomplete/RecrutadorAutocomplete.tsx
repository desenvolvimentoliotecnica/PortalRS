"use client";

import React, { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Loader2, X, UserCheck } from "lucide-react";

/**
 * Autocomplete de usuários com role Recrutador. Usado pelo gerente/diretor de RH
 * para atribuir uma vaga ao analista responsável.
 *
 * Padrão derivado de CargoAutocomplete.tsx — fetch único de /api/lookup/users-recrutadores,
 * filtro local por nome/email, callbacks ao selecionar/limpar.
 *
 * (Feature "Atribuição de Vaga a Recrutador" — 2026-04-26.)
 */

export interface RecrutadorLookup {
  id: string;
  name: string;
  email: string;
}

interface RecrutadorAutocompleteProps {
  /** UserId do recrutador atualmente selecionado (Guid string). null = nenhum. */
  value: string | null;
  /** Callback quando seleciona/limpa. displayName é o nome (para sincronizar string display). */
  onChange: (userId: string | null, displayName: string | null) => void;
  /** Quando o item ainda não está na lista (ex.: banco sujo), mostra esse rótulo cosmético. */
  defaultLabel?: { name: string; email?: string };
  placeholder?: string;
  disabled?: boolean;
}

export function RecrutadorAutocomplete({
  value,
  onChange,
  defaultLabel,
  placeholder = "Buscar recrutador por nome ou email…",
  disabled = false,
}: RecrutadorAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [allItems, setAllItems] = useState<RecrutadorLookup[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<RecrutadorLookup | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);

  // Carrega lista uma vez no mount.
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    setLoading(true);
    apiFetch("/api/lookup/users-recrutadores")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setAllItems(Array.isArray(data) ? data : []))
      .catch(() => setAllItems([]))
      .finally(() => setLoading(false));
  }, []);

  // Resolve item selecionado a partir do value (Guid).
  useEffect(() => {
    if (!value) {
      if (selected) setSelected(null);
      return;
    }
    if (selected?.id === value) return;
    const found = allItems.find((u) => u.id === value);
    if (found) {
      setSelected(found);
    } else if (defaultLabel) {
      setSelected({ id: value, name: defaultLabel.name, email: defaultLabel.email ?? "" });
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
    ? allItems.filter((u) => {
        const q = query.toLowerCase();
        return (u.name?.toLowerCase().includes(q) ?? false) || (u.email?.toLowerCase().includes(q) ?? false);
      })
    : allItems;

  const handleSelect = (item: RecrutadorLookup) => {
    setSelected(item);
    onChange(item.id, item.name);
    setQuery("");
    setOpen(false);
  };

  const handleClear = () => {
    setSelected(null);
    setQuery("");
    onChange(null, null);
  };

  return (
    <div ref={containerRef} className="relative">
      {selected ? (
        <div className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <UserCheck className="size-4 text-muted-foreground shrink-0" />
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="font-medium truncate">{selected.name || "(sem nome)"}</div>
              {selected.email && (
                <div className="text-xs text-muted-foreground truncate">{selected.email}</div>
              )}
            </div>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="text-muted-foreground hover:text-foreground transition-colors ml-2 shrink-0"
              aria-label="Remover recrutador"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => !disabled && setOpen(true)}
            placeholder={placeholder}
            className="pr-10"
            disabled={disabled}
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
          )}
        </div>
      )}

      {open && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-md border border-input bg-popover p-0 shadow-md">
          {filtered.length > 0 ? (
            <div className="max-h-64 overflow-y-auto">
              {filtered.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleSelect(u)}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors border-b border-border/30 last:border-0"
                >
                  <div className="font-medium">{u.name || "(sem nome)"}</div>
                  {u.email && <div className="text-xs text-muted-foreground">{u.email}</div>}
                </button>
              ))}
            </div>
          ) : (
            <div className="p-3 text-sm text-muted-foreground text-center">
              {loading
                ? "Carregando…"
                : allItems.length === 0
                ? "Nenhum recrutador cadastrado neste tenant"
                : "Nenhum resultado para a busca"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
