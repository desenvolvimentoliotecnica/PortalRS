"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Download, FileText, Loader2, Package } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

type PacoteDoc = {
  id: string;
  tipo: string;
  tipoLabel: string;
  nomeArquivo: string;
  contentType: string;
  tamanhoBytes: number;
  status: string;
  observacaoRh?: string | null;
};

type PacoteDpPublic = {
  nome: string;
  cpf?: string | null;
  rg?: string | null;
  dataNascimento?: string | null;
  email?: string | null;
  celular?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
  vagaOuCargo?: string | null;
  dataPrevistaInicio?: string | null;
  salario?: number | null;
  bancoCodigo?: string | null;
  bancoNome?: string | null;
  agencia?: string | null;
  conta?: string | null;
  tipoConta?: string | null;
  pisPasep?: string | null;
  expiraEmUtc: string;
  documentos: PacoteDoc[];
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}

function formatMoney(value: number | null | undefined) {
  if (value == null) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[140px_1fr] sm:gap-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-900">{value || "—"}</dd>
    </div>
  );
}

type Props = { token: string };

export default function PacoteDpPublicScreen({ token }: Props) {
  const sp = useSearchParams();
  const tenantId = (sp.get("tenantId") || sp.get("tenant") || "").trim();

  const [data, setData] = useState<PacoteDpPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [zipLoading, setZipLoading] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId || !token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setExpired(false);
    try {
      const res = await apiFetch(
        `/api/public/pre-admissao/pacote-dp?token=${encodeURIComponent(token)}`,
        { headers: { "X-Tenant-Id": tenantId }, cache: "no-store" },
      );
      if (res.status === 410 || res.status === 404) {
        setExpired(true);
        setData(null);
        return;
      }
      if (!res.ok) {
        toast.error("Não foi possível carregar o pacote.");
        setExpired(true);
        return;
      }
      const json = (await res.json()) as PacoteDpPublic;
      setData(json);
    } catch {
      toast.error("Erro de conexão ao carregar o pacote.");
      setExpired(true);
    } finally {
      setLoading(false);
    }
  }, [tenantId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function downloadBlob(path: string, fallbackName: string) {
    if (!tenantId) return;
    const res = await apiFetch(path, {
      headers: { "X-Tenant-Id": tenantId },
      cache: "no-store",
    });
    if (res.status === 410) {
      setExpired(true);
      toast.error("Link expirado. Peça ao RH um novo envio.");
      return;
    }
    if (!res.ok) {
      toast.error("Falha ao baixar o arquivo.");
      return;
    }
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition") ?? "";
    const match = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(cd);
    const fileName = match ? decodeURIComponent(match[1].replace(/"/g, "")) : fallbackName;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleZip() {
    setZipLoading(true);
    try {
      await downloadBlob(
        `/api/public/pre-admissao/pacote-dp/zip?token=${encodeURIComponent(token)}`,
        "pacote-admissao.zip",
      );
    } finally {
      setZipLoading(false);
    }
  }

  if (!tenantId) {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900">
        Link inválido — falta o identificador da empresa (<code>?tenantId=...</code>).
      </section>
    );
  }

  if (loading) {
    return (
      <section className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600">
        <Loader2 className="size-4 animate-spin" /> Carregando pacote…
      </section>
    );
  }

  if (expired || !data) {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        <p className="font-semibold">Link inválido ou expirado</p>
        <p className="mt-1">Peça ao RH um novo envio do pacote de admissão.</p>
      </section>
    );
  }

  const enderecoCompleto = [data.endereco, data.cidade, data.uf, data.cep]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="min-h-screen bg-gradient-to-b from-teal-50 via-white to-slate-50 px-4 py-8 text-neutral-900">
      <article className="mx-auto max-w-3xl space-y-6">
        <header className="overflow-hidden rounded-2xl border border-teal-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-teal-800 to-teal-600 px-6 py-6 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-100">
              Departamento Pessoal
            </p>
            <h1 className="mt-2 text-2xl font-bold">{data.nome}</h1>
            <p className="mt-1 text-sm text-teal-50">
              Pacote de admissão para cadastro nos sistemas legados
            </p>
            <p className="mt-3 text-xs text-teal-100/90">
              Link válido até {formatDateTime(data.expiraEmUtc)}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <p className="text-sm text-slate-600">
              {data.documentos.length} documento{data.documentos.length === 1 ? "" : "s"} no pacote
            </p>
            <Button
              className="bg-teal-700 hover:bg-teal-800"
              onClick={() => void handleZip()}
              disabled={zipLoading || data.documentos.length === 0}
            >
              {zipLoading ? <Loader2 className="size-4 animate-spin" /> : <Package className="size-4" />}
              Baixar ZIP
            </Button>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Ficha do candidato</h2>
          <dl className="mt-4 space-y-3">
            <Row label="CPF" value={data.cpf} />
            <Row label="RG" value={data.rg} />
            <Row label="Nascimento" value={formatDate(data.dataNascimento)} />
            <Row label="E-mail" value={data.email} />
            <Row label="Celular" value={data.celular} />
            <Row label="Endereço" value={enderecoCompleto} />
            <Row label="Cargo / vaga" value={data.vagaOuCargo} />
            <Row label="Início previsto" value={formatDate(data.dataPrevistaInicio)} />
            <Row label="Salário" value={formatMoney(data.salario)} />
            <Row
              label="Banco"
              value={[data.bancoNome || data.bancoCodigo, data.agencia && `Ag ${data.agencia}`, data.conta && `Cc ${data.conta}`, data.tipoConta]
                .filter(Boolean)
                .join(" · ")}
            />
            <Row label="PIS/PASEP" value={data.pisPasep} />
          </dl>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Documentos</h2>
          {data.documentos.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nenhum documento enviado pelo candidato.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {data.documentos.map((doc) => (
                <li key={doc.id} className="flex flex-wrap items-center gap-3 py-3">
                  <FileText className="size-4 shrink-0 text-teal-700" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">{doc.tipoLabel}</p>
                    <p className="truncate text-xs text-slate-500">
                      {doc.nomeArquivo} · {formatBytes(doc.tamanhoBytes)} · {doc.status}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void downloadBlob(
                        `/api/public/pre-admissao/pacote-dp/documentos/${encodeURIComponent(doc.id)}?token=${encodeURIComponent(token)}`,
                        doc.nomeArquivo,
                      )
                    }
                  >
                    <Download className="size-3.5" /> Baixar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </article>
    </main>
  );
}
