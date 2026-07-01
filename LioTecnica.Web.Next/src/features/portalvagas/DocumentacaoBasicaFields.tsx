"use client";

import { validateCpf } from "@/lib/cpf";

export type DocumentacaoBasicaValues = {
  cpf: string;
  rg: string;
  dataNascimento: string;
  nomeMae: string;
  nomePai: string;
};

type Props = {
  values: DocumentacaoBasicaValues;
  onChange: (patch: Partial<DocumentacaoBasicaValues>) => void;
  inp?: string;
  lbl?: string;
};

const defaultInp =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20";
const defaultLbl = "block text-xs font-medium text-muted-foreground mb-1";

export function validateDocumentacaoBasica(values: DocumentacaoBasicaValues): string | null {
  if (!values.cpf.trim()) return "Informe o CPF.";
  if (!validateCpf(values.cpf)) return "CPF inválido.";
  if (!values.rg.trim()) return "Informe o RG.";
  if (!values.dataNascimento.trim()) return "Informe a data de nascimento.";
  if (!values.nomeMae.trim()) return "Informe o nome da mãe.";
  return null;
}

export default function DocumentacaoBasicaFields({
  values,
  onChange,
  inp = defaultInp,
  lbl = defaultLbl,
}: Props) {
  return (
    <>
      <div>
        <label className={lbl}>CPF *</label>
        <input
          className={inp}
          placeholder="000.000.000-00"
          value={values.cpf}
          onChange={(e) => onChange({ cpf: e.target.value })}
          maxLength={14}
        />
      </div>
      <div>
        <label className={lbl}>RG *</label>
        <input
          className={inp}
          placeholder="Número do RG"
          value={values.rg}
          onChange={(e) => onChange({ rg: e.target.value })}
          maxLength={20}
        />
      </div>
      <div>
        <label className={lbl}>Data de nascimento *</label>
        <input
          className={inp}
          type="date"
          value={values.dataNascimento}
          onChange={(e) => onChange({ dataNascimento: e.target.value })}
        />
      </div>
      <div>
        <label className={lbl}>Nome da mãe *</label>
        <input
          className={inp}
          value={values.nomeMae}
          onChange={(e) => onChange({ nomeMae: e.target.value })}
          maxLength={160}
        />
      </div>
      <div>
        <label className={lbl}>Nome do pai (opcional)</label>
        <input
          className={inp}
          value={values.nomePai}
          onChange={(e) => onChange({ nomePai: e.target.value })}
          maxLength={160}
        />
      </div>
    </>
  );
}
