"use client";

import React, { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Loader2, UserCheck, X } from "lucide-react";

export interface RhAnalistaLookup {
    id: string;
    name: string;
    email: string;
}

interface RhAnalistaAutocompleteProps {
    value: string | null;
    onChange: (userId: string | null, displayName: string | null) => void;
    defaultLabel?: { name: string; email?: string };
    placeholder?: string;
    disabled?: boolean;
}

export function RhAnalistaAutocomplete({
    value,
    onChange,
    defaultLabel,
    placeholder = "Buscar analista de RH por nome ou email…",
    disabled = false,
}: RhAnalistaAutocompleteProps) {
    const [query, setQuery] = useState("");
    const [allItems, setAllItems] = useState<RhAnalistaLookup[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState<RhAnalistaLookup | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const loaded = useRef(false);

    useEffect(() => {
        if (loaded.current) return;
        loaded.current = true;
        setLoading(true);
        apiFetch("/api/lookup/users-analistas-rh")
            .then((res) => (res.ok ? res.json() : []))
            .then((data) => setAllItems(Array.isArray(data) ? data : []))
            .catch(() => setAllItems([]))
            .finally(() => setLoading(false));
    }, []);

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

    function handleSelect(item: RhAnalistaLookup) {
        setSelected(item);
        onChange(item.id, item.name);
        setQuery("");
        setOpen(false);
    }

    function handleClear() {
        setSelected(null);
        setQuery("");
        onChange(null, null);
    }

    return (
        <div ref={containerRef} className="relative">
            {selected ? (
                <div className="flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                        <UserCheck className="size-4 shrink-0 text-muted-foreground" />
                        <div className="flex min-w-0 flex-col gap-0.5">
                            <div className="truncate font-medium">{selected.name || "(sem nome)"}</div>
                            {selected.email && (
                                <div className="truncate text-xs text-muted-foreground">{selected.email}</div>
                            )}
                        </div>
                    </div>
                    {!disabled && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="ml-2 shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                            aria-label="Remover analista de RH"
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
                        <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                    )}
                </div>
            )}

            {open && !disabled && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-input bg-popover p-0 shadow-md">
                    {filtered.length > 0 ? (
                        <div className="max-h-64 overflow-y-auto">
                            {filtered.map((u) => (
                                <button
                                    key={u.id}
                                    type="button"
                                    onClick={() => handleSelect(u)}
                                    className="w-full border-b border-border/30 px-3 py-2 text-left text-sm transition-colors last:border-0 hover:bg-accent hover:text-accent-foreground"
                                >
                                    <div className="font-medium">{u.name || "(sem nome)"}</div>
                                    {u.email && <div className="text-xs text-muted-foreground">{u.email}</div>}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="p-3 text-center text-sm text-muted-foreground">
                            {loading
                                ? "Carregando…"
                                : allItems.length === 0
                                    ? "Nenhum analista de RH cadastrado neste tenant"
                                    : "Nenhum resultado para a busca"}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
