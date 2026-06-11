"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Save, TestTube2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";

type RmConfig = {
  sqlServer: string | null;
  sqlDatabase: string | null;
  sqlUserId: string | null;
  sqlPasswordConfigured: boolean;
  sqlEncrypt: boolean;
  sqlTrustServerCertificate: boolean;
  sqlConnectTimeoutSeconds: number;
  sqlApplicationIntent: string | null;
  mode: string;
  createEndpointUrl: string | null;
  getEndpointUrl: string | null;
  parecerEndpointUrl: string | null;
  requestTimeoutSeconds: number;
  restUsername: string | null;
  restPasswordConfigured: boolean;
  restBearerTokenConfigured: boolean;
  maxTentativas: number;
  createWorkerEnabled: boolean;
  createWorkerIntervalSeconds: number;
  createWorkerMaxPerTenant: number;
  codColRequisicaoDefault: number | null;
  codColRequisitanteDefault: number | null;
  codStatusInicial: number;
  codLocalDefault: number | null;
  codFilialDefault: number | null;
  diasPrevisaoPadrao: number;
  recCreatedBy: string;
  recModifiedBy: string;
  requisicoesVagaOrigemRm: boolean;
  importacaoAutomaticaAtiva: boolean;
  importacaoAutomaticaIntervaloMinutos: number;
  importacaoAutomaticaMaxPorExecucao: number;
  statusSyncEnabled: boolean;
  statusSyncIntervalMinutes: number;
  statusSyncMaxPerRun: number;
  syncUnits: boolean;
  syncUnitsExecute: boolean;
  syncVagas: boolean;
  syncVagasOnly: boolean;
  syncEmpresas: boolean;
  syncHierarquia: boolean;
  syncDesligamentos: boolean;
  syncCandidatosVagaDiagnostic: boolean;
  syncCandidatosVaga: boolean;
  syncCandidatosPerfilCv: boolean;
  useGestorHierarquiaPosicao: boolean;
  useHierarquiaOrganogramaPosicao: boolean;
  maxTalentosToSync: number | null;
  maxCandidatosToSync: number | null;
  maxPessoasToSync: number | null;
  maxFuncionariosToSync: number | null;
  syncOnlyEmail: string | null;
  vagaDefaultAreaCode: string | null;
  schema: string;
  areaTable: string;
  departamentoTable: string;
  funcaoTable: string;
  cargoTable: string;
  vagaTable: string;
  unidadeTable: string;
  funcionarioTable: string;
  pessoaTable: string;
  hierarquiaTable: string;
  hierarquiaColigadaExternaTable: string | null;
  desligamentoTable: string;
  aumentoQuadroTable: string;
  substituicaoTable: string;
  transferenciaPromocaoTable: string;
  gestoresRmUrlTemplate: string | null;
  gestoresRmUser: string | null;
  gestoresRmPasswordConfigured: boolean;
  gestoresRmDefaultCodColigada: number;
  gestoresRmDelayMsBetweenRequests: number;
};

type SecretState = {
  sqlPassword: string;
  restPassword: string;
  restBearerToken: string;
  gestoresRmPassword: string;
};

const DEFAULT_CONFIG: RmConfig = {
  sqlServer: "",
  sqlDatabase: "",
  sqlUserId: "",
  sqlPasswordConfigured: false,
  sqlEncrypt: true,
  sqlTrustServerCertificate: true,
  sqlConnectTimeoutSeconds: 15,
  sqlApplicationIntent: "ReadOnly",
  mode: "stub",
  createEndpointUrl: "",
  getEndpointUrl: "",
  parecerEndpointUrl: "",
  requestTimeoutSeconds: 60,
  restUsername: "",
  restPasswordConfigured: false,
  restBearerTokenConfigured: false,
  maxTentativas: 5,
  createWorkerEnabled: true,
  createWorkerIntervalSeconds: 30,
  createWorkerMaxPerTenant: 20,
  codColRequisicaoDefault: 1,
  codColRequisitanteDefault: null,
  codStatusInicial: 1,
  codLocalDefault: 1,
  codFilialDefault: null,
  diasPrevisaoPadrao: 5,
  recCreatedBy: "portal",
  recModifiedBy: "portal",
  requisicoesVagaOrigemRm: false,
  importacaoAutomaticaAtiva: false,
  importacaoAutomaticaIntervaloMinutos: 15,
  importacaoAutomaticaMaxPorExecucao: 50,
  statusSyncEnabled: false,
  statusSyncIntervalMinutes: 15,
  statusSyncMaxPerRun: 50,
  syncUnits: true,
  syncUnitsExecute: true,
  syncVagas: true,
  syncVagasOnly: false,
  syncEmpresas: true,
  syncHierarquia: true,
  syncDesligamentos: true,
  syncCandidatosVagaDiagnostic: true,
  syncCandidatosVaga: true,
  syncCandidatosPerfilCv: true,
  useGestorHierarquiaPosicao: true,
  useHierarquiaOrganogramaPosicao: true,
  maxTalentosToSync: null,
  maxCandidatosToSync: null,
  maxPessoasToSync: null,
  maxFuncionariosToSync: null,
  syncOnlyEmail: "",
  vagaDefaultAreaCode: "",
  schema: "dbo",
  areaTable: "BAREA",
  departamentoTable: "PSECAO",
  funcaoTable: "PFUNCAO",
  cargoTable: "PCARGO",
  vagaTable: "VRSVAGAS",
  unidadeTable: "GFILIAL",
  funcionarioTable: "PFUNC",
  pessoaTable: "PPESSOA",
  hierarquiaTable: "VHIERARQUIA",
  hierarquiaColigadaExternaTable: "VHIERARQUIACOLIGADAEXTERNA",
  desligamentoTable: "VREQDESLIGAMENTO",
  aumentoQuadroTable: "VREQAUMENTOQUADRO",
  substituicaoTable: "VREQSUBSTITUICAO",
  transferenciaPromocaoTable: "VREQTRANSFPROMOCAO",
  gestoresRmUrlTemplate: "",
  gestoresRmUser: "",
  gestoresRmPasswordConfigured: false,
  gestoresRmDefaultCodColigada: 1,
  gestoresRmDelayMsBetweenRequests: 250,
};

const EMPTY_SECRETS: SecretState = {
  sqlPassword: "",
  restPassword: "",
  restBearerToken: "",
  gestoresRmPassword: "",
};

export default function ConfiguracaoRmScreen() {
  const [config, setConfig] = useState<RmConfig>(DEFAULT_CONFIG);
  const [secrets, setSecrets] = useState<SecretState>(EMPTY_SECRETS);
  const [gestoresTestChapa, setGestoresTestChapa] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/integracao-totvs/configuracao-rm", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setConfig({ ...DEFAULT_CONFIG, ...((await res.json()) as RmConfig) });
      setSecrets(EMPTY_SECRETS);
    } catch {
      toast.error("Falha ao carregar configuração RM.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setField = <K extends keyof RmConfig>(key: K, value: RmConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiFetch("/api/integracao-totvs/configuracao-rm", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...config,
          sqlPassword: secrets.sqlPassword.trim() || null,
          restPassword: secrets.restPassword.trim() || null,
          restBearerToken: secrets.restBearerToken.trim() || null,
          gestoresRmPassword: secrets.gestoresRmPassword.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
        throw new Error((body as { message?: string }).message ?? `HTTP ${res.status}`);
      }
      setConfig({ ...DEFAULT_CONFIG, ...((await res.json()) as RmConfig) });
      setSecrets(EMPTY_SECRETS);
      toast.success("Configuração RM salva no banco.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar configuração RM.");
    } finally {
      setSaving(false);
    }
  };

  const runTest = async (kind: "sql" | "rest") => {
    setTesting(kind);
    try {
      const url = kind === "sql" ? "/api/integracao-totvs/configuracao-rm/testar-sql" : "/api/integracao-totvs/configuracao-rm/testar-rest-get";
      const res = await apiFetch(url, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; status?: number };
      if (body.ok) toast.success(body.message ?? "Teste concluído com sucesso.");
      else toast.error(body.message ?? `Teste falhou${body.status ? ` (${body.status})` : ""}.`);
    } finally {
      setTesting(null);
    }
  };

  const runGestoresTest = async () => {
    if (!gestoresTestChapa.trim()) {
      toast.error("Informe uma CHAPA para testar gestores RM.");
      return;
    }

    setTesting("gestores");
    try {
      const qs = new URLSearchParams({
        chapa: gestoresTestChapa.trim(),
        codColigada: String(config.gestoresRmDefaultCodColigada || 1),
      });
      const res = await apiFetch(`/api/integracao-totvs/configuracao-rm/testar-gestores?${qs.toString()}`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; status?: number; preview?: string | null };
      if (body.ok) toast.success(body.message ?? "Consulta de gestores RM realizada com sucesso.");
      else toast.error(body.message ?? `Teste de gestores falhou${body.status ? ` (${body.status})` : ""}.`);
    } finally {
      setTesting(null);
    }
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configuração RM</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Centralize conexão SQL, endpoints, credenciais, schema e parâmetros de sincronização TOTVS RM.
          </p>
        </div>
        <Button onClick={() => void save()} disabled={loading || saving} className="gap-2">
          <Save className="size-4" />
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </header>

      <Tabs defaultValue="sql" className="space-y-4">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="sql">Conexão SQL</TabsTrigger>
          <TabsTrigger value="rest">Endpoints REST</TabsTrigger>
          <TabsTrigger value="sync">Importação e worker</TabsTrigger>
          <TabsTrigger value="schema">Schema RM</TabsTrigger>
          <TabsTrigger value="gestores">Gestores RM</TabsTrigger>
        </TabsList>

        <TabsContent value="sql">
          <Card title="SQL Server RM" desc="Usado para relatórios e extrações read-only do worker.">
            <div className="grid gap-4 md:grid-cols-3">
              <TextField label="Servidor" value={config.sqlServer} onChange={(v) => setField("sqlServer", v)} placeholder="172.19.30.3" />
              <TextField label="Database" value={config.sqlDatabase} onChange={(v) => setField("sqlDatabase", v)} placeholder="CORPORERM" />
              <TextField label="Usuário" value={config.sqlUserId} onChange={(v) => setField("sqlUserId", v)} placeholder="rm_readonly" />
              <SecretField
                label={`Senha SQL${config.sqlPasswordConfigured ? " (configurada)" : ""}`}
                value={secrets.sqlPassword}
                onChange={(v) => setSecrets((p) => ({ ...p, sqlPassword: v }))}
              />
              <NumberField label="Timeout (s)" value={config.sqlConnectTimeoutSeconds} onChange={(v) => setField("sqlConnectTimeoutSeconds", v)} />
              <TextField label="ApplicationIntent" value={config.sqlApplicationIntent} onChange={(v) => setField("sqlApplicationIntent", v)} />
              <CheckField label="Encrypt" checked={config.sqlEncrypt} onChange={(v) => setField("sqlEncrypt", v)} />
              <CheckField label="TrustServerCertificate" checked={config.sqlTrustServerCertificate} onChange={(v) => setField("sqlTrustServerCertificate", v)} />
              <div className="flex items-end">
                <Button type="button" variant="outline" className="gap-2" disabled={testing === "sql"} onClick={() => void runTest("sql")}>
                  <TestTube2 className="size-4" />
                  Testar SQL
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="rest">
          <Card title="Endpoints REST RM" desc="Usado para criar, consultar status e ler pareceres de requisições RM.">
            <div className="grid gap-4">
              <TextField label="Endpoint POST de criação" value={config.createEndpointUrl} onChange={(v) => setField("createEndpointUrl", v)} />
              <TextField label="Endpoint GET de consulta" value={config.getEndpointUrl} onChange={(v) => setField("getEndpointUrl", v)} />
              <TextField label="Endpoint GET de pareceres" value={config.parecerEndpointUrl} onChange={(v) => setField("parecerEndpointUrl", v)} />
              <div className="grid gap-4 md:grid-cols-4">
                <TextField label="Modo" value={config.mode} onChange={(v) => setField("mode", v)} placeholder="stub | rest | disabled" />
                <TextField label="Usuário REST" value={config.restUsername} onChange={(v) => setField("restUsername", v)} />
                <SecretField
                  label={`Senha REST${config.restPasswordConfigured ? " (configurada)" : ""}`}
                  value={secrets.restPassword}
                  onChange={(v) => setSecrets((p) => ({ ...p, restPassword: v }))}
                />
                <SecretField
                  label={`Bearer token${config.restBearerTokenConfigured ? " (configurado)" : ""}`}
                  value={secrets.restBearerToken}
                  onChange={(v) => setSecrets((p) => ({ ...p, restBearerToken: v }))}
                />
                <NumberField label="Timeout REST (s)" value={config.requestTimeoutSeconds} onChange={(v) => setField("requestTimeoutSeconds", v)} />
                <NumberField label="Máx. tentativas" value={config.maxTentativas} onChange={(v) => setField("maxTentativas", v)} />
                <NumberField label="CODSTATUS inicial" value={config.codStatusInicial} onChange={(v) => setField("codStatusInicial", v)} />
                <div className="flex items-end">
                  <Button type="button" variant="outline" className="gap-2" disabled={testing === "rest"} onClick={() => void runTest("rest")}>
                    <TestTube2 className="size-4" />
                    Testar GET
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="sync">
          <Card title="Importação e worker" desc="Controla ciclos automáticos e entidades sincronizadas.">
            <div className="grid gap-4 md:grid-cols-4">
              <CheckField label="Requisições vêm do RM" checked={config.requisicoesVagaOrigemRm} onChange={(v) => setField("requisicoesVagaOrigemRm", v)} />
              <CheckField label="Importação automática" checked={config.importacaoAutomaticaAtiva} onChange={(v) => setField("importacaoAutomaticaAtiva", v)} />
              <CheckField label="Worker criação ativo" checked={config.createWorkerEnabled} onChange={(v) => setField("createWorkerEnabled", v)} />
              <CheckField label="Sync CODSTATUS ativo" checked={config.statusSyncEnabled} onChange={(v) => setField("statusSyncEnabled", v)} />
              <NumberField label="Intervalo importação (min)" value={config.importacaoAutomaticaIntervaloMinutos} onChange={(v) => setField("importacaoAutomaticaIntervaloMinutos", v)} />
              <NumberField label="Máx. importação" value={config.importacaoAutomaticaMaxPorExecucao} onChange={(v) => setField("importacaoAutomaticaMaxPorExecucao", v)} />
              <NumberField label="Intervalo criação (s)" value={config.createWorkerIntervalSeconds} onChange={(v) => setField("createWorkerIntervalSeconds", v)} />
              <NumberField label="Máx. criação/tenant" value={config.createWorkerMaxPerTenant} onChange={(v) => setField("createWorkerMaxPerTenant", v)} />
              {(["syncUnits", "syncVagas", "syncEmpresas", "syncHierarquia", "syncDesligamentos", "syncCandidatosVaga", "syncCandidatosPerfilCv"] as const).map((key) => (
                <CheckField key={key} label={key} checked={config[key]} onChange={(v) => setField(key, v)} />
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="schema">
          <Card title="Schema, tabelas e views RM" desc="Nomes usados pelo worker ao consultar o banco RM.">
            <div className="grid gap-4 md:grid-cols-3">
              {([
                "schema",
                "areaTable",
                "departamentoTable",
                "funcaoTable",
                "cargoTable",
                "vagaTable",
                "unidadeTable",
                "funcionarioTable",
                "pessoaTable",
                "hierarquiaTable",
                "hierarquiaColigadaExternaTable",
                "desligamentoTable",
                "aumentoQuadroTable",
                "substituicaoTable",
                "transferenciaPromocaoTable",
              ] as const).map((key) => (
                <TextField key={key} label={key} value={config[key]} onChange={(v) => setField(key, v)} />
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="gestores">
          <Card title="Gestores RM" desc="Consulta TOTVS usada para complementar gestores por matrícula/coligada.">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-3">
                <TextField label="URL template gestores RM" value={config.gestoresRmUrlTemplate} onChange={(v) => setField("gestoresRmUrlTemplate", v)} />
              </div>
              <TextField label="Usuário" value={config.gestoresRmUser} onChange={(v) => setField("gestoresRmUser", v)} />
              <SecretField
                label={`Senha${config.gestoresRmPasswordConfigured ? " (configurada)" : ""}`}
                value={secrets.gestoresRmPassword}
                onChange={(v) => setSecrets((p) => ({ ...p, gestoresRmPassword: v }))}
              />
              <NumberField label="Coligada default" value={config.gestoresRmDefaultCodColigada} onChange={(v) => setField("gestoresRmDefaultCodColigada", v)} />
              <NumberField label="Delay entre requests (ms)" value={config.gestoresRmDelayMsBetweenRequests} onChange={(v) => setField("gestoresRmDelayMsBetweenRequests", v)} />
              <TextField label="CHAPA para teste" value={gestoresTestChapa} onChange={setGestoresTestChapa} placeholder="Ex.: 000123" />
              <div className="flex items-end">
                <Button type="button" variant="outline" className="gap-2" disabled={testing === "gestores"} onClick={() => void runGestoresTest()}>
                  <TestTube2 className="size-4" />
                  Testar gestores
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}

function Card({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      </div>
      {children}
    </section>
  );
}

function TextField({ label, value, onChange, placeholder }: { label: string; value?: string | null; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function SecretField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type="password" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Preencha apenas para alterar" />
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value?: number | null; onChange: (value: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type="number" value={value ?? ""} onChange={(e) => onChange(Number(e.target.value || 0))} />
    </div>
  );
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
