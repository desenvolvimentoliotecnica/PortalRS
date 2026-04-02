"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, TestTubeDiagonal } from "lucide-react";
import { toast } from "sonner";
import { getAccessToken } from "@/lib/session";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { env } from "@/lib/env";

/** Fetch direto sem o handler de 401 do apiFetch (owner acessando tenant) */
async function tenantFetch(path: string, tenantId: string, init?: RequestInit): Promise<Response> {
    const base = (env.API_BASE ?? "").trim();
    const url = base ? `${base.replace(/\/+$/, "")}${path}` : path;
    const token = getAccessToken();
    const headers = new Headers(init?.headers);
    headers.set("Accept", "application/json");
    headers.set("X-Tenant-Id", tenantId);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, { ...init, headers });
}

interface EmailConfig {
    smtpHost: string;
    smtpPort: number;
    smtpEnableSsl: boolean;
    smtpUserName: string;
    smtpHasPassword: boolean;
    smtpFromName: string;
    smtpFromAddress: string;
    imapHost: string;
    imapPort: number;
    imapEnableSsl: boolean;
    imapUserName: string;
    imapHasPassword: boolean;
}

export default function TabEmailConfig({ tenantId }: { tenantId: string }) {
    // Usa endpoint do tenant diretamente via tenantFetch (sem 401 redirect)

    const [cfg, setCfg] = useState<EmailConfig>({
        smtpHost: "", smtpPort: 587, smtpEnableSsl: true, smtpUserName: "", smtpHasPassword: false, smtpFromName: "", smtpFromAddress: "",
        imapHost: "", imapPort: 993, imapEnableSsl: true, imapUserName: "", imapHasPassword: false,
    });
    const [smtpPass, setSmtpPass] = useState("");
    const [imapPass, setImapPass] = useState("");
    const [testTo, setTestTo] = useState("");
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState("");

    useEffect(() => {
        tenantFetch("/api/email-config", tenantId)
            .then(async (res) => {
                if (res.ok) {
                    const d = await res.json() as Record<string, unknown>;
                    setCfg({
                        smtpHost: (d.smtpHost as string) ?? "",
                        smtpPort: (d.smtpPort as number) ?? 587,
                        smtpEnableSsl: (d.smtpEnableSsl as boolean) ?? true,
                        smtpUserName: (d.smtpUserName as string) ?? "",
                        smtpHasPassword: (d.smtpHasPassword as boolean) ?? false,
                        smtpFromName: (d.smtpFromName as string) ?? "",
                        smtpFromAddress: (d.smtpFromAddress as string) ?? "",
                        imapHost: (d.imapHost as string) ?? "",
                        imapPort: (d.imapPort as number) ?? 993,
                        imapEnableSsl: (d.imapEnableSsl as boolean) ?? true,
                        imapUserName: (d.imapUserName as string) ?? "",
                        imapHasPassword: (d.imapHasPassword as boolean) ?? false,
                    });
                    if (d.smtpFromAddress) setTestTo(d.smtpFromAddress as string);
                }
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [tenantId]);

    const buildPayload = () => ({
        provider: "smtp",
        smtpHost: cfg.smtpHost, smtpPort: cfg.smtpPort, smtpEnableSsl: cfg.smtpEnableSsl,
        smtpUserName: cfg.smtpUserName, smtpPassword: smtpPass || null,
        smtpFromName: cfg.smtpFromName, smtpFromAddress: cfg.smtpFromAddress,
        imapHost: cfg.imapHost, imapPort: cfg.imapPort, imapEnableSsl: cfg.imapEnableSsl,
        imapUserName: cfg.imapUserName, imapPassword: imapPass || null,
    });

    const handleSave = async () => {
        setBusy("save");
        try {
            const res = await tenantFetch("/api/email-config", tenantId, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildPayload()),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => null) as Record<string, string> | null;
                throw new Error(body?.message || body?.detail || `HTTP ${res.status}`);
            }
            const result = await res.json() as EmailConfig;
            setCfg(result);
            setSmtpPass(""); setImapPass("");
            toast.success("Configuração de email salva!");
        } catch { toast.error("Falha ao salvar."); }
        finally { setBusy(""); }
    };

    const handleTest = async (type: "smtp" | "imap") => {
        setBusy(type);
        try {
            const payload = { ...buildPayload(), testTo };
            const res = await tenantFetch(`/api/email-config/test-${type}`, tenantId, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                toast.success(`Teste ${type.toUpperCase()} OK — email enviado!`);
            } else {
                const body = await res.json().catch(() => null) as Record<string, string> | null;
                const detail = body?.message || body?.detail || body?.title || `HTTP ${res.status}`;
                toast.error(`Falha ${type.toUpperCase()}: ${detail}`);
            }
        } catch (e) {
            toast.error(`Erro ao testar ${type.toUpperCase()}: ${e instanceof Error ? e.message : "verifique a conexão"}`);
        }
        finally { setBusy(""); }
    };

    if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;

    return (
        <div className="space-y-5 max-w-2xl" autoCapitalize="off" data-form-type="other">
            <Card className="shadow-lt">
                <CardHeader><CardTitle className="text-base">SMTP (Envio)</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div><label className="text-sm font-medium mb-1.5 block">Host</label><Input value={cfg.smtpHost} onChange={(e) => setCfg((c) => ({ ...c, smtpHost: e.target.value }))} placeholder="smtp.example.com" /></div>
                        <div><label className="text-sm font-medium mb-1.5 block">Porta</label><Input type="number" value={cfg.smtpPort} onChange={(e) => setCfg((c) => ({ ...c, smtpPort: Number(e.target.value) || 587 }))} /></div>
                    </div>
                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="smtpSsl" checked={cfg.smtpEnableSsl} onChange={(e) => setCfg((c) => ({ ...c, smtpEnableSsl: e.target.checked }))} className="rounded" />
                        <label htmlFor="smtpSsl" className="text-sm">SSL/TLS</label>
                    </div>
                    <div><label className="text-sm font-medium mb-1.5 block">Usuário</label><Input value={cfg.smtpUserName} onChange={(e) => setCfg((c) => ({ ...c, smtpUserName: e.target.value }))} autoComplete="off" /></div>
                    <div>
                        <label className="text-sm font-medium mb-1.5 block">Senha</label>
                        <Input type="password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} placeholder="Nova senha (vazio = manter)" autoComplete="new-password" />
                        <p className="text-xs text-muted-foreground mt-1">{cfg.smtpHasPassword ? "✅ Senha configurada." : "⚠️ Sem senha."}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div><label className="text-sm font-medium mb-1.5 block">From Name</label><Input value={cfg.smtpFromName} onChange={(e) => setCfg((c) => ({ ...c, smtpFromName: e.target.value }))} /></div>
                        <div><label className="text-sm font-medium mb-1.5 block">From Address</label><Input value={cfg.smtpFromAddress} onChange={(e) => setCfg((c) => ({ ...c, smtpFromAddress: e.target.value }))} /></div>
                    </div>
                    <div className="border-t pt-3 mt-3">
                        <label className="text-sm font-medium mb-1.5 block">Testar envio para</label>
                        <div className="flex gap-2">
                            <Input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="email@test.com" className="flex-1" autoComplete="off" />
                            <Button variant="outline" size="sm" onClick={() => handleTest("smtp")} disabled={!!busy}>
                                {busy === "smtp" ? <Loader2 className="size-4 animate-spin mr-1" /> : <TestTubeDiagonal className="size-4 mr-1" />}
                                Testar SMTP
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-lt">
                <CardHeader><CardTitle className="text-base">IMAP (Recebimento)</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div><label className="text-sm font-medium mb-1.5 block">Host</label><Input value={cfg.imapHost} onChange={(e) => setCfg((c) => ({ ...c, imapHost: e.target.value }))} placeholder="imap.example.com" /></div>
                        <div><label className="text-sm font-medium mb-1.5 block">Porta</label><Input type="number" value={cfg.imapPort} onChange={(e) => setCfg((c) => ({ ...c, imapPort: Number(e.target.value) || 993 }))} /></div>
                    </div>
                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="imapSsl" checked={cfg.imapEnableSsl} onChange={(e) => setCfg((c) => ({ ...c, imapEnableSsl: e.target.checked }))} className="rounded" />
                        <label htmlFor="imapSsl" className="text-sm">SSL/TLS</label>
                    </div>
                    <div><label className="text-sm font-medium mb-1.5 block">Usuário</label><Input value={cfg.imapUserName} onChange={(e) => setCfg((c) => ({ ...c, imapUserName: e.target.value }))} /></div>
                    <div>
                        <label className="text-sm font-medium mb-1.5 block">Senha</label>
                        <Input type="password" value={imapPass} onChange={(e) => setImapPass(e.target.value)} placeholder="Nova senha (vazio = manter)" />
                        <p className="text-xs text-muted-foreground mt-1">{cfg.imapHasPassword ? "✅ Senha configurada." : "⚠️ Sem senha."}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleTest("imap")} disabled={!!busy}>
                        {busy === "imap" ? <Loader2 className="size-4 animate-spin mr-1" /> : <TestTubeDiagonal className="size-4 mr-1" />}
                        Testar IMAP
                    </Button>
                </CardContent>
            </Card>

            <Button onClick={handleSave} disabled={!!busy} className="bg-[rgb(var(--lt-brand))] text-white hover:bg-[rgb(var(--lt-brand))]/90">
                {busy === "save" ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Save className="size-4 mr-1.5" />}
                Salvar configuração
            </Button>
        </div>
    );
}
