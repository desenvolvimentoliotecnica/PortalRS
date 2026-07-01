"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, PlayCircle, Save } from "lucide-react";

interface GraphCalendarConfigView {
    enabled: boolean;
    tenantId: string | null;
    clientId: string | null;
    hasClientSecret: boolean;
    userPrincipalName: string | null;
}

interface GraphCalendarEventDto {
    id: string;
    subject: string;
    start: string;
    end: string;
    isAllDay: boolean;
    location: string | null;
    source: string;
}

interface GraphCalendarTestResponse {
    success: boolean;
    message: string;
    events: GraphCalendarEventDto[];
}

function mapConfig(raw: Record<string, unknown>): GraphCalendarConfigView {
    return {
        enabled: raw.enabled === true,
        tenantId: typeof raw.tenantId === "string" ? raw.tenantId : null,
        clientId: typeof raw.clientId === "string" ? raw.clientId : null,
        hasClientSecret: raw.hasClientSecret === true,
        userPrincipalName: typeof raw.userPrincipalName === "string" ? raw.userPrincipalName : null,
    };
}

function formatEventWhen(start: string, end: string) {
    const s = new Date(start);
    const e = new Date(end);
    if (Number.isNaN(s.getTime())) return "—";
    const date = s.toLocaleDateString("pt-BR");
    const startTime = s.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const endTime = Number.isNaN(e.getTime())
        ? ""
        : e.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return endTime ? `${date} ${startTime} – ${endTime}` : `${date} ${startTime}`;
}

export default function MicrosoftGraphCalendarConfigCard() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [canManage, setCanManage] = useState(true);

    const [enabled, setEnabled] = useState(false);
    const [tenantId, setTenantId] = useState("");
    const [clientId, setClientId] = useState("");
    const [clientSecret, setClientSecret] = useState("");
    const [hasClientSecret, setHasClientSecret] = useState(false);
    const [userPrincipalName, setUserPrincipalName] = useState("");
    const [testMessage, setTestMessage] = useState<string | null>(null);
    const [testEvents, setTestEvents] = useState<GraphCalendarEventDto[]>([]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiFetch("/api/tenant-configuracao/microsoft-graph-calendar");
            if (res.status === 403) {
                setCanManage(false);
                return;
            }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const json = mapConfig((await res.json()) as Record<string, unknown>);
            setEnabled(json.enabled);
            setTenantId(json.tenantId ?? "");
            setClientId(json.clientId ?? "");
            setHasClientSecret(json.hasClientSecret);
            setUserPrincipalName(json.userPrincipalName ?? "");
            setClientSecret("");
        } catch {
            toast.error("Falha ao carregar configuração do Microsoft Graph.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    async function saveConfig() {
        setSaving(true);
        try {
            const body: Record<string, unknown> = {
                enabled,
                tenantId: tenantId.trim() || null,
                clientId: clientId.trim() || null,
                userPrincipalName: userPrincipalName.trim() || null,
            };
            if (clientSecret.trim()) body.clientSecret = clientSecret.trim();

            const res = await apiFetch("/api/tenant-configuracao/microsoft-graph-calendar", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (res.status === 403) throw new Error("Somente administradores podem alterar essa configuração.");
            if (!res.ok) {
                const err = await res.json().catch(() => null);
                throw new Error((err as { message?: string })?.message ?? `HTTP ${res.status}`);
            }

            const json = mapConfig((await res.json()) as Record<string, unknown>);
            setEnabled(json.enabled);
            setTenantId(json.tenantId ?? "");
            setClientId(json.clientId ?? "");
            setHasClientSecret(json.hasClientSecret);
            setUserPrincipalName(json.userPrincipalName ?? "");
            setClientSecret("");
            toast.success("Configuração do Microsoft Graph salva.");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Falha ao salvar configuração.");
        } finally {
            setSaving(false);
        }
    }

    async function testConnection() {
        setTesting(true);
        setTestMessage(null);
        setTestEvents([]);
        try {
            const res = await apiFetch("/api/tenant-configuracao/microsoft-graph-calendar/test", {
                method: "POST",
            });
            if (res.status === 403) throw new Error("Somente administradores podem testar a integração.");
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const json = (await res.json()) as GraphCalendarTestResponse;
            setTestMessage(json.message);
            setTestEvents(Array.isArray(json.events) ? json.events : []);

            if (json.success) toast.success("Conexão com Microsoft Graph OK.");
            else toast.error(json.message || "Falha ao conectar com Microsoft Graph.");
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Falha ao testar conexão.";
            setTestMessage(msg);
            toast.error(msg);
        } finally {
            setTesting(false);
        }
    }

    if (!canManage) return null;

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Calendar className="size-4 text-muted-foreground" />
                <h2 className="text-base font-semibold">Microsoft Graph — Agenda (Outlook)</h2>
            </div>

            <div className="rounded-xl border border-border/40 bg-card p-6 space-y-5 max-w-2xl">
                <p className="text-xs text-muted-foreground">
                    Integração para exibir eventos do calendário Outlook na agenda do portal.
                    O app no Azure AD precisa da permissão de aplicativo <strong>Calendars.Read</strong> com consentimento do administrador.
                </p>

                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => setEnabled(e.target.checked)}
                        disabled={loading || saving}
                        className="rounded border-input"
                    />
                    Habilitar exibição de eventos do Outlook na agenda
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="graph-tenant-id">Tenant ID (Locatário)</Label>
                        <Input
                            id="graph-tenant-id"
                            value={tenantId}
                            onChange={(e) => setTenantId(e.target.value)}
                            placeholder="b95b38fc-0302-4cf4-8c95-d45754f48411"
                            disabled={loading || saving}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="graph-client-id">Client ID (Aplicativo)</Label>
                        <Input
                            id="graph-client-id"
                            value={clientId}
                            onChange={(e) => setClientId(e.target.value)}
                            placeholder="3e73d586-06c1-455c-86a7-07c2a89c383d"
                            disabled={loading || saving}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="graph-client-secret">Client Secret</Label>
                        <Input
                            id="graph-client-secret"
                            type="password"
                            value={clientSecret}
                            onChange={(e) => setClientSecret(e.target.value)}
                            placeholder={
                                hasClientSecret
                                    ? "••••••••  (já configurado — deixe vazio para manter)"
                                    : "Cole o valor do secret gerado no Azure"
                            }
                            disabled={loading || saving}
                        />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="graph-user-upn">User Principal Name (UPN)</Label>
                        <Input
                            id="graph-user-upn"
                            value={userPrincipalName}
                            onChange={(e) => setUserPrincipalName(e.target.value)}
                            placeholder="usuario@empresa.com"
                            disabled={loading || saving}
                        />
                        <p className="text-[11px] text-muted-foreground">
                            E-mail/UPN do usuário no Azure AD cujo calendário será lido.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Button onClick={() => void saveConfig()} disabled={loading || saving}>
                        <Save className="size-4 mr-1.5" />
                        {saving ? "Salvando…" : "Salvar"}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => void testConnection()}
                        disabled={loading || saving || testing}
                    >
                        <PlayCircle className="size-4 mr-1.5" />
                        {testing ? "Testando…" : "Testar leitura da agenda"}
                    </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                    Salve as credenciais antes de testar. O teste usa os valores gravados no banco do tenant.
                </p>

                {testMessage && (
                    <div
                        className={`rounded-lg border p-3 text-sm ${
                            testEvents.length > 0
                                ? "border-emerald-500/30 bg-emerald-500/5"
                                : "border-amber-500/30 bg-amber-500/5"
                        }`}
                    >
                        <p className="font-medium">{testMessage}</p>
                        {testEvents.length > 0 && (
                            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                                {testEvents.slice(0, 8).map((ev) => (
                                    <li key={ev.id}>
                                        <span className="text-foreground">{ev.subject}</span>
                                        {" — "}
                                        {formatEventWhen(ev.start, ev.end)}
                                        {ev.location ? ` · ${ev.location}` : ""}
                                    </li>
                                ))}
                                {testEvents.length > 8 && (
                                    <li>… e mais {testEvents.length - 8} evento(s).</li>
                                )}
                            </ul>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
