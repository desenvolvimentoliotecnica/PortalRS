"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Save, TestTube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

/* ── Types ── */
interface EmailConfig {
    provider: string;
    smtpHost: string | null;
    smtpPort: number;
    smtpUserName: string | null;
    smtpPassword: string | null;
    smtpEnableSsl: boolean;
    smtpFromAddress: string | null;
    smtpFromName: string | null;
    imapHost: string | null;
    imapPort: number;
    imapUserName: string | null;
    imapPassword: string | null;
    imapEnableSsl: boolean;
    imapFolder?: string | null;
}

const EMPTY: EmailConfig = {
    provider: "smtp",
    smtpHost: "", smtpPort: 587, smtpUserName: "", smtpPassword: "", smtpEnableSsl: true,
    smtpFromAddress: "", smtpFromName: "",
    imapHost: "", imapPort: 993, imapUserName: "", imapPassword: "", imapEnableSsl: true, imapFolder: "INBOX",
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store", ...init });
    if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body as any)?.detail || (body as any)?.error || `HTTP ${res.status}`);
    }
    return res.json();
}

export default function AdminEmailConfigScreen() {
    const [config, setConfig] = useState<EmailConfig>(EMPTY);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testingSmtp, setTestingSmtp] = useState(false);
    const [testingImap, setTestingImap] = useState(false);

    const loadConfig = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchJson<EmailConfig>("/api/email-config");
            setConfig((prev) => ({ ...prev, ...data, smtpPassword: "", imapPassword: "" }));
        } catch {
            toast.error("Falha ao carregar configuração de email.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void loadConfig(); }, [loadConfig]);

    async function handleSave() {
        setSaving(true);
        try {
            const saved = await fetchJson<EmailConfig>("/api/email-config", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config),
            });
            setConfig(saved);
            toast.success("Configuração salva!");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha ao salvar.");
        } finally {
            setSaving(false);
        }
    }

    async function testSmtp() {
        setTestingSmtp(true);
        try {
            await fetchJson("/api/email-config/test-smtp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    smtpHost: config.smtpHost,
                    smtpPort: config.smtpPort,
                    smtpEnableSsl: config.smtpEnableSsl,
                    smtpUserName: config.smtpUserName,
                    smtpPassword: config.smtpPassword,
                    fromAddress: config.smtpFromAddress,
                    fromName: config.smtpFromName,
                }),
            });
            toast.success("SMTP OK! Conexão bem-sucedida.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha no teste SMTP.");
        } finally {
            setTestingSmtp(false);
        }
    }

    async function testImap() {
        setTestingImap(true);
        try {
            await fetchJson("/api/email-config/test-imap", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    imapHost: config.imapHost,
                    imapPort: config.imapPort,
                    imapEnableSsl: config.imapEnableSsl,
                    imapUserName: config.imapUserName,
                    imapPassword: config.imapPassword,
                }),
            });
            toast.success("IMAP OK! Conexão bem-sucedida.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha no teste IMAP.");
        } finally {
            setTestingImap(false);
        }
    }

    const upd = (key: keyof EmailConfig, value: string | number | boolean) =>
        setConfig(prev => ({ ...prev, [key]: value }));

    if (loading) return <div className="text-center text-muted-foreground py-8">Carregando configuração...</div>;

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Configuração de Email</h4>
                    <div className="text-muted-foreground text-sm">Configure SMTP (envio) e IMAP (recebimento).</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => void loadConfig()}><RefreshCw className="size-4" /></Button>
            </div>

            {/* SMTP */}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur space-y-3">
                <div className="font-semibold">SMTP (Envio)</div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Host</label><Input value={config.smtpHost ?? ""} onChange={e => upd("smtpHost", e.target.value)} placeholder="smtp.exemplo.com" /></div>
                    <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Porta</label><Input type="number" value={config.smtpPort} onChange={e => upd("smtpPort", parseInt(e.target.value) || 0)} /></div>
                    <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Usuário</label><Input value={config.smtpUserName ?? ""} onChange={e => upd("smtpUserName", e.target.value)} /></div>
                    <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Senha</label><Input type="password" value={config.smtpPassword ?? ""} onChange={e => upd("smtpPassword", e.target.value)} /></div>
                    <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Email Remetente</label><Input value={config.smtpFromAddress ?? ""} onChange={e => upd("smtpFromAddress", e.target.value)} /></div>
                    <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Nome Remetente</label><Input value={config.smtpFromName ?? ""} onChange={e => upd("smtpFromName", e.target.value)} /></div>
                </div>
                <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.smtpEnableSsl} onChange={e => upd("smtpEnableSsl", e.target.checked)} className="rounded border-input" /> Usar SSL</label>
                    <Button variant="outline" size="sm" onClick={() => void testSmtp()} disabled={testingSmtp}><TestTube className="size-4 mr-1" />{testingSmtp ? "Testando..." : "Testar SMTP"}</Button>
                </div>
            </div>

            {/* IMAP */}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur space-y-3">
                <div className="font-semibold">IMAP (Recebimento)</div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Host</label><Input value={config.imapHost ?? ""} onChange={e => upd("imapHost", e.target.value)} placeholder="imap.exemplo.com" /></div>
                    <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Porta</label><Input type="number" value={config.imapPort} onChange={e => upd("imapPort", parseInt(e.target.value) || 0)} /></div>
                    <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Usuário</label><Input value={config.imapUserName ?? ""} onChange={e => upd("imapUserName", e.target.value)} /></div>
                    <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Senha</label><Input type="password" value={config.imapPassword ?? ""} onChange={e => upd("imapPassword", e.target.value)} /></div>
                </div>
                <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.imapEnableSsl} onChange={e => upd("imapEnableSsl", e.target.checked)} className="rounded border-input" /> Usar SSL</label>
                    <Button variant="outline" size="sm" onClick={() => void testImap()} disabled={testingImap}><TestTube className="size-4 mr-1" />{testingImap ? "Testando..." : "Testar IMAP"}</Button>
                </div>
            </div>

            <div className="flex justify-end">
                <Button onClick={() => void handleSave()} disabled={saving} className="min-w-[150px]">
                    <Save className="size-4 mr-1" />{saving ? "Salvando..." : "Salvar Configuração"}
                </Button>
            </div>
        </section>
    );
}
