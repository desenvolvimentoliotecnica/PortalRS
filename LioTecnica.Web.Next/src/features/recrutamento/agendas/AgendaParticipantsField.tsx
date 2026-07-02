"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";

export type AgendaParticipant = {
  funcionarioId: string;
  nome: string;
  email: string;
};

type FuncionarioLookupItem = {
  id?: string;
  nome?: string;
  email?: string | null;
  cargo?: string | null;
};

type Props = {
  value: AgendaParticipant[];
  onChange: (participants: AgendaParticipant[]) => void;
  disabled?: boolean;
  maxParticipants?: number;
};

const DEFAULT_MAX = 20;

async function fetchFuncionarios(q: string): Promise<FuncionarioLookupItem[]> {
  const params = new URLSearchParams({
    onlyActive: "true",
    pageSize: "20",
  });
  if (q.trim()) params.set("q", q.trim());

  const res = await apiFetch(`/api/lookup/funcionarios?${params.toString()}`);
  if (!res.ok) return [];

  const data = (await res.json()) as { items?: FuncionarioLookupItem[] };
  return data.items ?? [];
}

export function AgendaParticipantsField({
  value,
  onChange,
  disabled = false,
  maxParticipants = DEFAULT_MAX,
}: Props) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<FuncionarioLookupItem[]>([]);
  const [loading, setLoading] = useState(false);
  const searchGen = useRef(0);

  const selectedIds = useMemo(
    () => new Set(value.map((item) => item.funcionarioId)),
    [value],
  );

  useEffect(() => {
    if (!open) return;

    const query = search.trim();
    const gen = ++searchGen.current;
    const timer = window.setTimeout(() => {
      setLoading(true);
      fetchFuncionarios(query)
        .then((items) => {
          if (searchGen.current !== gen) return;
          setOptions(items);
        })
        .catch(() => {
          if (searchGen.current !== gen) return;
          setOptions([]);
        })
        .finally(() => {
          if (searchGen.current === gen) setLoading(false);
        });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [open, search]);

  const filteredOptions = useMemo(
    () =>
      options.filter((item) => {
        const id = String(item.id ?? "");
        const email = item.email?.trim();
        return id && email && !selectedIds.has(id);
      }),
    [options, selectedIds],
  );

  function addParticipant(item: FuncionarioLookupItem) {
    const id = String(item.id ?? "");
    const email = item.email?.trim();
    const nome = String(item.nome ?? "").trim();
    if (!id || !email || !nome) return;
    if (value.length >= maxParticipants) return;
    if (selectedIds.has(id)) return;

    onChange([...value, { funcionarioId: id, nome, email }]);
    setSearch("");
    setOpen(false);
  }

  function removeParticipant(funcionarioId: string) {
    onChange(value.filter((item) => item.funcionarioId !== funcionarioId));
  }

  return (
    <div className="min-w-0">
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Participantes
      </label>

      <div className="relative">
        <Input
          value={search}
          disabled={disabled || value.length >= maxParticipants}
          placeholder={
            value.length >= maxParticipants
              ? `Limite de ${maxParticipants} participantes atingido`
              : "Busque funcionário por nome ou e-mail"
          }
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
        />

        {open && !disabled && value.length < maxParticipants && (
          <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover py-1 text-sm shadow-md">
            {loading ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">Buscando…</div>
            ) : filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                {search.trim() ? "Nenhum funcionário encontrado." : "Digite para buscar funcionários."}
              </div>
            ) : (
              filteredOptions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="block w-full px-3 py-2 text-left hover:bg-accent"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addParticipant(item)}
                >
                  <span className="block font-medium text-foreground">{item.nome}</span>
                  <span className="block text-xs text-muted-foreground">
                    {item.email}
                    {item.cargo ? ` · ${item.cargo}` : ""}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        Convites serão enviados pelo Outlook para o e-mail corporativo.
      </p>

      {value.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {value.map((participant) => (
            <span
              key={participant.funcionarioId}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs"
            >
              <span className="truncate">
                {participant.nome}
                <span className="text-muted-foreground"> · {participant.email}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-5 shrink-0"
                disabled={disabled}
                onClick={() => removeParticipant(participant.funcionarioId)}
                aria-label={`Remover ${participant.nome}`}
              >
                <X className="size-3" />
              </Button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
