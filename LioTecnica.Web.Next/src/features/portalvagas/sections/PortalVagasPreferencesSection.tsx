"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import type { PreferencesResponse } from "./types";

const FIELDS: Array<[keyof PreferencesResponse, string]> = [
  ["cargoAlvo", "Cargo alvo"],
  ["senioridade", "Senioridade"],
  ["inicioDisponivel", "Início disponível"],
  ["resumo", "Resumo dos objetivos"],
  ["areasInteresse", "Áreas de interesse"],
  ["modeloTrabalho", "Modelo de trabalho"],
  ["jornada", "Jornada"],
  ["tipoContrato", "Tipo de contrato"],
  ["viagens", "Viagens"],
  ["mudanca", "Mudança de cidade"],
  ["cidadePreferida", "Cidade preferida"],
  ["distanciaMaxKm", "Distância máxima (km)"],
  ["obsDeslocamento", "Observações deslocamento"],
  ["pretensaoSalarial", "Pretensão salarial"],
  ["pretensaoNegociavel", "Pretensão negociável"],
  ["beneficiosDesejados", "Benefícios desejados"],
  ["naoAbreMaoDe", "Não abre mão de"],
];

export default function PortalVagasPreferencesSection() {
  const [data, setData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/PortalVagas/Preferences", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as PreferencesResponse | null;
      if (!res.ok || !json) throw new Error();
      const obj: Record<string, string> = {};
      for (const [k, _] of FIELDS) {
        const v = (json as Record<string, unknown>)[k];
        obj[k] = v != null ? String(v) : "";
      }
      setData(obj);
    } catch {
      toast.error("Falha ao carregar preferências.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    try {
      const payload: Record<string, string | null> = {};
      for (const [k] of FIELDS) {
        const v = (data[k] ?? "").trim();
        payload[k] = v || null;
      }
      const res = await apiFetch("/PortalVagas/Preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      toast.success("Preferências salvas.");
      void load();
    } catch {
      toast.error("Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-muted-foreground text-sm">Carregando preferências...</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {FIELDS.map(([key, label]) => (
          <div key={key} className={key === "resumo" || key === "naoAbreMaoDe" ? "md:col-span-2" : ""}>
            <label className="text-xs text-muted-foreground">{label}</label>
            {key === "resumo" || key === "naoAbreMaoDe" ? (
              <textarea className="form-control" rows={2} value={data[key] ?? ""} onChange={(e) => setData((d) => ({ ...d, [key]: e.target.value }))} />
            ) : (
              <input className="form-control" value={data[key] ?? ""} onChange={(e) => setData((d) => ({ ...d, [key]: e.target.value }))} />
            )}
          </div>
        ))}
      </div>
      <button className="btn-brand" type="button" disabled={saving} onClick={() => void save()}>
        {saving ? "Salvando..." : "Salvar preferências"}
      </button>
    </div>
  );
}
