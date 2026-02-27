"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, TestTubeDiagonal } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getBackendUrl } from "@/lib/getBackendUrl";

const BASE = getBackendUrl();

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { credentials: "same-origin", ...init });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.status === 204 ? (null as T) : res.json();
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
    const apiBase = `${BASE}/Owner/Tenants/${encodeURIComponent(tenantId)}/Config/EmailConfig/_api`;

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
        fetchJson<EmailConfig>(`${apiBase}/config`)
            .then((d) => { if (d) setCfg(d); })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [apiBase]);

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
            const result = await fetchJson<EmailConfig>(`${apiBase}/config`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildPayload()),
            });
            if (result) setCfg(result);
            setSmtpPass(""); setImapPass("");
            toast.success("Configuração de email salva.");
        } catch { toast.error("Falha ao salvar."); }
        finally { setBusy(""); }
    };

    const handleTest = async (type: "smtp" | "imap") => {
        setBusy(type);
        try {
            const payload = { ...buildPayload(), testTo };
            const res = await fetch(`${apiBase}/test-${type}`, {
                method: "POST", credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (res.ok) toast.success(`Teste ${type.toUpperCase()} OK`);
            else toast.error(`Falha no teste ${type.toUpperCase()}.`);
        } catch { toast.error(`Erro ao testar ${type.toUpperCase()}.`); }
        finally { setBusy(""); }
    };

    if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;

    const Field = ({ label, value, onChange, type = "text", placeholder = "" }: { label: string; value: string | number; onChange: (v: string) => void; type?: string; placeholder?: string }) => (
        <div>
            <label className="text-sm font-medium mb-1.5 block">{label}</label>
            <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
        </div>
    );

    return (
        <div className="space-y-5 max-w-2xl">
            <Card className="shadow-lt">
                <CardHeader><CardTitle className="text-base">SMTP (Envio)</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Host" value={cfg.smtpHost} onChange={(v) => setCfg((c) => ({ ...c, smtpHost: v }))} placeholder="smtp.example.com" />
                        <Field label="Porta" value={cfg.smtpPort} onChange={(v) => setCfg((c) => ({ ...c, smtpPort: Number(v) || 587 }))} type="number" />
                    </div>
                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="smtpSsl" checked={cfg.smtpEnableSsl} onChange={(e) => setCfg((c) => ({ ...c, smtpEnableSsl: e.target.checked }))} className="rounded" />
                        <label htmlFor="smtpSsl" className="text-sm">SSL/TLS</label>
                    </div>
                    <Field label="Usuário" value={cfg.smtpUserName} onChange={(v) => setCfg((c) => ({ ...c, smtpUserName: v }))} />
                    <div>
                        <label className="text-sm font-medium mb-1.5 block">Senha</label>
                        <Input type="password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} placeholder="Nova senha (vazio = manter)" />
                        <p className="text-xs text-muted-foreground mt-1">{cfg.smtpHasPassword ? "✅ Senha configurada." : "⚠️ Sem senha."}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="From Name" value={cfg.smtpFromName} onChange={(v) => setCfg((c) => ({ ...c, smtpFromName: v }))} />
                        <Field label="From Address" value={cfg.smtpFromAddress} onChange={(v) => setCfg((c) => ({ ...c, smtpFromAddress: v }))} />
                    </div>
                    <div className="border-t pt-3 mt-3">
                        <label className="text-sm font-medium mb-1.5 block">Testar envio para</label>
                        <div className="flex gap-2">
                            <Input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="email@test.com" className="flex-1" />
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
                        <Field label="Host" value={cfg.imapHost} onChange={(v) => setCfg((c) => ({ ...c, imapHost: v }))} placeholder="imap.example.com" />
                        <Field label="Porta" value={cfg.imapPort} onChange={(v) => setCfg((c) => ({ ...c, imapPort: Number(v) || 993 }))} type="number" />
                    </div>
                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="imapSsl" checked={cfg.imapEnableSsl} onChange={(e) => setCfg((c) => ({ ...c, imapEnableSsl: e.target.checked }))} className="rounded" />
                        <label htmlFor="imapSsl" className="text-sm">SSL/TLS</label>
                    </div>
                    <Field label="Usuário" value={cfg.imapUserName} onChange={(v) => setCfg((c) => ({ ...c, imapUserName: v }))} />
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
