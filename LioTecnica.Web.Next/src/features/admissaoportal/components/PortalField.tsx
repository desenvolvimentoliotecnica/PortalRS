"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const UF_OPTIONS = [
    { value: "AC", label: "AC" }, { value: "AL", label: "AL" }, { value: "AP", label: "AP" },
    { value: "AM", label: "AM" }, { value: "BA", label: "BA" }, { value: "CE", label: "CE" },
    { value: "DF", label: "DF" }, { value: "ES", label: "ES" }, { value: "GO", label: "GO" },
    { value: "MA", label: "MA" }, { value: "MT", label: "MT" }, { value: "MS", label: "MS" },
    { value: "MG", label: "MG" }, { value: "PA", label: "PA" }, { value: "PB", label: "PB" },
    { value: "PR", label: "PR" }, { value: "PE", label: "PE" }, { value: "PI", label: "PI" },
    { value: "RJ", label: "RJ" }, { value: "RN", label: "RN" }, { value: "RS", label: "RS" },
    { value: "RO", label: "RO" }, { value: "RR", label: "RR" }, { value: "SC", label: "SC" },
    { value: "SP", label: "SP" }, { value: "SE", label: "SE" }, { value: "TO", label: "TO" },
];

export const ESTADO_CIVIL_OPTIONS = [
    { value: 0, label: "Não informado" }, { value: 1, label: "Solteiro(a)" },
    { value: 2, label: "Casado(a)" }, { value: 3, label: "Divorciado(a)" },
    { value: 4, label: "Viúvo(a)" }, { value: 5, label: "União Estável" }, { value: 6, label: "Separado(a)" },
];

export const TIPO_CONTA_OPTIONS = [
    { value: 0, label: "Conta Corrente" }, { value: 1, label: "Conta Poupança" }, { value: 2, label: "Conta Salário" },
];

export const BANKS = [
    { code: "001", name: "Banco do Brasil" }, { code: "033", name: "Santander" },
    { code: "104", name: "Caixa Econômica Federal" }, { code: "237", name: "Bradesco" },
    { code: "260", name: "Nubank" }, { code: "341", name: "Itaú Unibanco" },
    { code: "336", name: "C6 Bank" }, { code: "748", name: "Sicredi" }, { code: "756", name: "Sicoob" },
];

const selectCls = "flex h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm";

interface FieldProps {
    label: string;
    children: React.ReactNode;
    className?: string;
}

export function PortalField({ label, children, className }: FieldProps) {
    return (
        <div className={cn("min-w-0", className)}>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
            {children}
        </div>
    );
}

interface TextFieldProps {
    label: string;
    value?: string | null;
    onChange: (v: string) => void;
    disabled?: boolean;
    type?: string;
    placeholder?: string;
    className?: string;
}

export function PortalTextField({ label, value, onChange, disabled, type, placeholder, className }: TextFieldProps) {
    return (
        <PortalField label={label} className={className}>
            <Input
                type={type}
                value={value ?? ""}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                placeholder={placeholder}
                className="h-11 rounded-lg border-slate-200"
            />
        </PortalField>
    );
}

interface SelectFieldProps {
    label: string;
    value?: number | string | null;
    onChange: (v: string) => void;
    options: { value: number | string; label: string }[];
    disabled?: boolean;
    className?: string;
}

export function PortalSelectField({ label, value, onChange, options, disabled, className }: SelectFieldProps) {
    return (
        <PortalField label={label} className={className}>
            <select
                className={selectCls}
                value={value ?? ""}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
            >
                {options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                ))}
            </select>
        </PortalField>
    );
}

export function PortalInfoBox({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-3 rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-sm text-[#1e40af]">
            {children}
        </div>
    );
}

export function PortalSectionTitle({ children }: { children: React.ReactNode }) {
    return <h3 className="text-base font-semibold text-slate-900">{children}</h3>;
}
