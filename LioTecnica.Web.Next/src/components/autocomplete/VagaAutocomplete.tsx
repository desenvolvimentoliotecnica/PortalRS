"use client";

import React, { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

export interface VagaItem {
    id: string;
    label: string;
    code?: string | null;
}

interface VagaAutocompleteProps {
    value: string;
    onChange: (id: string) => void;
    items: VagaItem[];
    placeholder?: string;
    className?: string;
}

export function VagaAutocomplete({
    value,
    onChange,
    items,
    placeholder = "Buscar vaga...",
    className,
}: VagaAutocompleteProps) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selected = value ? (items.find((v) => v.id === value) ?? null) : null;

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
        ? items.filter((v) => {
              const q = query.toLowerCase();
              return (
                  v.label.toLowerCase().includes(q) ||
                  (v.code ?? "").toLowerCase().includes(q)
              );
          })
        : items;

    const handleSelect = (vaga: VagaItem) => {
        onChange(vaga.id);
        setQuery("");
        setOpen(false);
    };

    const handleClear = () => {
        onChange("");
        setQuery("");
        inputRef.current?.focus();
    };

    return (
        <div ref={containerRef} className={`relative ${className ?? ""}`}>
            {selected ? (
                <div className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm flex items-center gap-2">
                    <span className="truncate flex-1 text-sm">{selected.label}</span>
                    <button
                        type="button"
                        onClick={handleClear}
                        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        aria-label="Limpar vaga selecionada"
                    >
                        <X className="size-3.5" />
                    </button>
                </div>
            ) : (
                <Input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setOpen(true)}
                    placeholder={placeholder}
                    className="h-9"
                />
            )}

            {open && !selected && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-md border border-input bg-popover shadow-md">
                    {filtered.length > 0 ? (
                        <div className="max-h-60 overflow-y-auto">
                            {filtered.map((vaga) => (
                                <button
                                    key={vaga.id}
                                    type="button"
                                    onClick={() => handleSelect(vaga)}
                                    className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors border-b border-border/30 last:border-0"
                                >
                                    <span className="font-medium">{vaga.label}</span>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="p-3 text-sm text-muted-foreground text-center">
                            {items.length === 0 ? "Carregando vagas..." : "Nenhuma vaga encontrada"}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
