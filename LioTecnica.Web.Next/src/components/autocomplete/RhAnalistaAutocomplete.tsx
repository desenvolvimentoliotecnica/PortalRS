"use client";

import React, { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Check, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";

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
    listMaxHeightClassName?: string;
}

function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export function RhAnalistaAutocomplete({
    value,
    onChange,
    defaultLabel,
    placeholder = "Buscar analista por nome ou e-mail…",
    disabled = false,
    listMaxHeightClassName = "max-h-40",
}: RhAnalistaAutocompleteProps) {
    const [query, setQuery] = useState("");
    const [allItems, setAllItems] = useState<RhAnalistaLookup[]>([]);
    const [loading, setLoading] = useState(false);
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

    const filtered = query.trim()
        ? allItems.filter((u) => {
            const q = query.toLowerCase();
            return (u.name?.toLowerCase().includes(q) ?? false) || (u.email?.toLowerCase().includes(q) ?? false);
        })
        : allItems;

    function handleSelect(item: RhAnalistaLookup) {
        if (disabled) return;
        onChange(item.id, item.name);
    }

    return (
        <div className="space-y-3">
            <div className="relative">
                <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={placeholder}
                    className="pr-10"
                    disabled={disabled}
                    aria-label="Buscar analista de RH"
                />
                {loading ? (
                    <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                ) : (
                    <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                )}
            </div>

            <div
                className={cn(
                    "overflow-y-auto rounded-lg border border-border/60 bg-background",
                    listMaxHeightClassName,
                )}
                role="listbox"
                aria-label="Analistas de RH disponíveis"
            >
                {loading && allItems.length === 0 ? (
                    <div className="px-3 py-6 text-center text-sm text-muted-foreground">Carregando…</div>
                ) : filtered.length > 0 ? (
                    filtered.map((item) => {
                        const selected = value === item.id;
                        const displayName = item.name || (selected ? defaultLabel?.name : undefined) || "(sem nome)";
                        const displayEmail = item.email || (selected ? defaultLabel?.email : undefined) || "";

                        return (
                            <button
                                key={item.id}
                                type="button"
                                role="option"
                                aria-selected={selected}
                                disabled={disabled}
                                onClick={() => handleSelect(item)}
                                className={cn(
                                    "flex w-full items-center gap-3 border-b border-border/40 px-3 py-2.5 text-left transition-colors last:border-b-0",
                                    "border-l-4",
                                    selected
                                        ? "border-l-primary bg-primary/10 hover:bg-primary/15"
                                        : "border-l-transparent hover:bg-muted/50",
                                    disabled && "cursor-not-allowed opacity-60",
                                )}
                            >
                                <div
                                    className={cn(
                                        "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                                        selected
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted text-muted-foreground",
                                    )}
                                    aria-hidden
                                >
                                    {initials(displayName)}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-medium">{displayName}</div>
                                    {displayEmail ? (
                                        <div className="truncate text-xs text-muted-foreground">{displayEmail}</div>
                                    ) : null}
                                </div>
                                <div
                                    className={cn(
                                        "flex size-5 shrink-0 items-center justify-center rounded-full border",
                                        selected
                                            ? "border-primary bg-primary text-primary-foreground"
                                            : "border-border bg-background",
                                    )}
                                    aria-hidden
                                >
                                    {selected ? <Check className="size-3" strokeWidth={3} /> : null}
                                </div>
                            </button>
                        );
                    })
                ) : (
                    <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                        {allItems.length === 0
                            ? "Nenhum analista de RH cadastrado neste tenant"
                            : "Nenhum resultado para a busca"}
                    </div>
                )}
            </div>
        </div>
    );
}
