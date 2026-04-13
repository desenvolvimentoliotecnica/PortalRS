"use client";

import React, { useCallback, useEffect, useState } from "react";

/* ──────────────────────────── types ──────────────────────────── */

const DIAS = [
    { key: "seg", label: "Segunda" },
    { key: "ter", label: "Terça"   },
    { key: "qua", label: "Quarta"  },
    { key: "qui", label: "Quinta"  },
    { key: "sex", label: "Sexta"   },
    { key: "sab", label: "Sábado"  },
    { key: "dom", label: "Domingo" },
] as const;

const LINHAS = [
    { key: "entrada",    label: "Entrada"           },
    { key: "intInicio",  label: "Intervalo Início"  },
    { key: "intTermino", label: "Intervalo Término" },
    { key: "saida",      label: "Saída"             },
] as const;

type DiaKey   = typeof DIAS[number]["key"];
type LinhaKey = typeof LINHAS[number]["key"];
type GridRow  = Record<DiaKey, string>;
type Grid     = Record<LinhaKey, GridRow>;

interface HorarioData { escala: string; grid: Grid }
interface BulkTimes   { entrada: string; intInicio: string; intTermino: string; saida: string }

const WEEK:     DiaKey[] = ["seg", "ter", "qua", "qui", "sex"];
const WEEK_SAB: DiaKey[] = ["seg", "ter", "qua", "qui", "sex", "sab"];

function emptyRow(): GridRow {
    return { seg: "", ter: "", qua: "", qui: "", sex: "", sab: "", dom: "" };
}
function emptyGrid(): Grid {
    return { entrada: emptyRow(), intInicio: emptyRow(), intTermino: emptyRow(), saida: emptyRow() };
}
function emptyBulk(): BulkTimes {
    return { entrada: "", intInicio: "", intTermino: "", saida: "" };
}
function makeRow(dias: DiaKey[], v: string): GridRow {
    const r = emptyRow(); dias.forEach((d) => (r[d] = v)); return r;
}

/* ──────────────────────────── presets ──────────────────────────── */

interface PresetDef { grid: Grid; dias: DiaKey[]; bulk: BulkTimes }

function comercialGrid(dias: DiaKey[]): Grid {
    return {
        entrada:    makeRow(dias, "08:00"),
        intInicio:  makeRow(dias, "12:00"),
        intTermino: makeRow(dias, "13:00"),
        saida:      makeRow(dias, "18:00"),
    };
}

const COMERCIAL_BULK: BulkTimes = { entrada: "08:00", intInicio: "12:00", intTermino: "13:00", saida: "18:00" };

const PRESETS: Record<string, PresetDef> = {
    "2ª a 6ª": {
        grid: comercialGrid(WEEK),
        dias: WEEK,
        bulk: COMERCIAL_BULK,
    },
    "2ª a 6ª. Sábados alternados.": {
        grid: comercialGrid(WEEK_SAB),
        dias: WEEK_SAB,
        bulk: COMERCIAL_BULK,
    },
    "2ª a Sábado": {
        grid: comercialGrid(WEEK_SAB),
        dias: WEEK_SAB,
        bulk: COMERCIAL_BULK,
    },
    "2ª a 6ª. Com Plantão aos Sábados": {
        grid: {
            entrada:    { ...makeRow(WEEK, "08:00"), sab: "08:00", dom: "" },
            intInicio:  { ...makeRow(WEEK, "12:00"), sab: "",      dom: "" },
            intTermino: { ...makeRow(WEEK, "13:00"), sab: "",      dom: "" },
            saida:      { ...makeRow(WEEK, "18:00"), sab: "14:00", dom: "" },
        },
        dias: WEEK,
        bulk: COMERCIAL_BULK,
    },
    "6 x 1": {
        grid: comercialGrid(WEEK_SAB),
        dias: WEEK_SAB,
        bulk: COMERCIAL_BULK,
    },
    "5 x 2": {
        grid: comercialGrid(WEEK),
        dias: WEEK,
        bulk: COMERCIAL_BULK,
    },
};

/* ──────────────────────────── serialization ──────────────────────────── */

function parseValue(value: string): HorarioData {
    if (!value) return { escala: "", grid: emptyGrid() };
    try {
        const p = JSON.parse(value) as HorarioData;
        if (p?.grid) return p;
        return { escala: value, grid: emptyGrid() };
    } catch {
        return { escala: value, grid: emptyGrid() };
    }
}

function serializeValue(data: HorarioData): string {
    const hasGrid = Object.values(data.grid).some((row) =>
        Object.values(row).some((v) => v !== "")
    );
    if (!data.escala && !hasGrid) return "";
    return JSON.stringify(data);
}

/* ──────────────────────────── component ──────────────────────────── */

export function HorarioEditor({
    value,
    onChange,
    readonly = false,
}: {
    value: string;
    onChange?: (v: string) => void;
    readonly?: boolean;
}) {
    const [data, setData]         = useState<HorarioData>(() => parseValue(value));
    const [bulkDias, setBulkDias] = useState<DiaKey[]>(WEEK);
    const [bulk, setBulk]         = useState<BulkTimes>(emptyBulk);

    useEffect(() => { setData(parseValue(value)); }, [value]);

    const update = useCallback(
        (next: HorarioData) => { setData(next); onChange?.(serializeValue(next)); },
        [onChange]
    );

    /* selecionar preset */
    const handleEscala = (escala: string) => {
        const p = PRESETS[escala];
        if (p) {
            update({ escala, grid: p.grid });
            setBulkDias(p.dias);
            setBulk(p.bulk);
        } else {
            update({ ...data, escala });
        }
    };

    /* editar célula individual */
    const handleCell = (linha: LinhaKey, dia: DiaKey, v: string) =>
        update({ ...data, grid: { ...data.grid, [linha]: { ...data.grid[linha], [dia]: v } } });

    /* aplicar bulk nos dias marcados */
    const applyBulk = () => {
        if (bulkDias.length === 0) return;
        const newGrid: Grid = { ...data.grid };
        for (const l of LINHAS) {
            const newRow: GridRow = { ...newGrid[l.key] };
            for (const dia of bulkDias) newRow[dia] = bulk[l.key as keyof BulkTimes];
            newGrid[l.key] = newRow;
        }
        update({ ...data, grid: newGrid });
    };

    /* limpar coluna de um dia */
    const clearDay = (dia: DiaKey) => {
        const newGrid: Grid = { ...data.grid };
        for (const l of LINHAS) newGrid[l.key] = { ...newGrid[l.key], [dia]: "" };
        update({ ...data, grid: newGrid });
    };

    const toggleBulkDia = (dia: DiaKey) =>
        setBulkDias((prev) => prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]);

    const isDayFilled = (dia: DiaKey) =>
        LINHAS.some((l) => data.grid[l.key][dia] !== "");

    return (
        <div className="rounded-md border border-input overflow-hidden text-sm">

            {/* ── Escala ── */}
            <div className="flex items-center gap-3 px-3 py-2 bg-sky-50/70 border-b border-input">
                <span className="font-bold text-xs w-14 shrink-0">Escala</span>
                <select
                    className="flex-1 h-8 rounded border border-input bg-background px-2 text-sm"
                    value={data.escala}
                    onChange={(e) => handleEscala(e.target.value)}
                    disabled={readonly}
                >
                    <option value="">Selecionar</option>
                    {Object.keys(PRESETS).map((p) => (
                        <option key={p} value={p}>{p}</option>
                    ))}
                </select>
            </div>

            {/* ── Painel de aplicação em lote ── */}
            {!readonly && (
                <div className="px-3 py-2.5 bg-sky-50/40 border-b border-input space-y-2">
                    {/* seleção de dias */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] text-muted-foreground font-semibold w-14 shrink-0">Dias:</span>
                        {DIAS.map((d) => (
                            <button
                                key={d.key}
                                type="button"
                                onClick={() => toggleBulkDia(d.key)}
                                className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
                                    bulkDias.includes(d.key)
                                        ? "bg-sky-600 text-white border-sky-600"
                                        : "border-input hover:bg-muted text-muted-foreground"
                                }`}
                            >
                                {d.label.slice(0, 3)}
                                {isDayFilled(d.key) && !bulkDias.includes(d.key) && (
                                    <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-sky-400 align-middle" />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* horários + aplicar */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] text-muted-foreground font-semibold w-14 shrink-0">Horário:</span>
                        {[
                            { key: "entrada",    ph: "Entrada"   },
                            { key: "intInicio",  ph: "Int. Início" },
                            { key: "intTermino", ph: "Int. Término" },
                            { key: "saida",      ph: "Saída"     },
                        ].map(({ key, ph }, i) => (
                            <React.Fragment key={key}>
                                {i > 0 && <span className="text-muted-foreground text-xs">→</span>}
                                <div className="flex flex-col items-center gap-0.5">
                                    <span className="text-[10px] text-muted-foreground leading-none">{ph}</span>
                                    <input
                                        type="time"
                                        className="h-7 w-24 rounded border border-input bg-background px-1 text-xs text-center"
                                        value={bulk[key as keyof BulkTimes]}
                                        onChange={(e) => setBulk((b) => ({ ...b, [key]: e.target.value }))}
                                    />
                                </div>
                            </React.Fragment>
                        ))}
                        <button
                            type="button"
                            onClick={applyBulk}
                            disabled={bulkDias.length === 0}
                            className="ml-auto px-3 py-1.5 rounded text-xs font-semibold bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-40 transition-colors"
                        >
                            Aplicar
                        </button>
                    </div>
                </div>
            )}

            {/* ── Grade ── */}
            <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[580px]">
                    <thead>
                        <tr className="bg-sky-50/70">
                            <th className="w-32 border-r border-input py-1.5" />
                            {DIAS.map((d) => (
                                <th
                                    key={d.key}
                                    className="border-r border-input py-1 px-1 text-xs font-bold text-center last:border-r-0 group"
                                >
                                    <div className="flex items-center justify-center gap-1">
                                        <span>{d.label}</span>
                                        {!readonly && isDayFilled(d.key) && (
                                            <button
                                                type="button"
                                                onClick={() => clearDay(d.key)}
                                                title={`Limpar ${d.label}`}
                                                className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] leading-none"
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {LINHAS.map((linha, i) => (
                            <tr key={linha.key} className={i % 2 === 0 ? "bg-white" : "bg-sky-50/30"}>
                                <td className="border-r border-t border-input px-2 py-0.5 text-xs font-bold text-right w-32 whitespace-nowrap">
                                    {linha.label}
                                </td>
                                {DIAS.map((d) => (
                                    <td key={d.key} className="border-r border-t border-input last:border-r-0 p-0">
                                        <input
                                            type="time"
                                            className={`w-full text-center text-xs bg-transparent p-1 outline-none ${
                                                readonly
                                                    ? "text-muted-foreground cursor-not-allowed"
                                                    : "hover:bg-sky-50/60 focus:bg-sky-50"
                                            }`}
                                            value={data.grid[linha.key][d.key]}
                                            onChange={(e) => handleCell(linha.key, d.key, e.target.value)}
                                            disabled={readonly}
                                        />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
