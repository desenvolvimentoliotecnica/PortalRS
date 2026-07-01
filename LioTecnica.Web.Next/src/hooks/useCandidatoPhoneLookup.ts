"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export type CandidatoPhone = {
  celular: string | null;
  fone: string | null;
};

function pickString(record: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function toPhoneEntry(value: unknown): CandidatoPhone | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = pickString(record, "id", "Id");
  if (!id) return null;
  return {
    celular: pickString(record, "celular", "Celular"),
    fone: pickString(record, "fone", "Fone", "telefone", "Telefone"),
  };
}

function extractItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const items = (payload as { items?: unknown }).items;
    if (Array.isArray(items)) return items;
  }
  return [];
}

/** Mapa candidatoId → telefones, carregado uma vez da listagem de candidatos. */
export function useCandidatoPhoneLookup(enabled = true) {
  const [map, setMap] = useState<Map<string, CandidatoPhone>>(new Map());

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await apiFetch("/api/candidatos?pageSize=5000");
        if (!res.ok || cancelled) return;
        const payload = await res.json();
        const next = new Map<string, CandidatoPhone>();
        for (const item of extractItems(payload)) {
          const record = item as Record<string, unknown>;
          const id = pickString(record, "id", "Id");
          const phone = toPhoneEntry(item);
          if (id && phone) next.set(id, phone);
        }
        if (!cancelled) setMap(next);
      } catch {
        /* lookup opcional — botão fica desabilitado sem telefone */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const getPhone = useCallback(
    (candidatoId?: string | null): CandidatoPhone => {
      if (!candidatoId) return { celular: null, fone: null };
      return map.get(candidatoId) ?? { celular: null, fone: null };
    },
    [map],
  );

  return { getPhone };
}
