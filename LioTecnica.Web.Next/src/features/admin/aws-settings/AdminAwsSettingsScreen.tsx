"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, CloudUpload, Loader2, RefreshCw, Save, TestTube, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

/* ── Types ── */

interface AwsSettingsView {
    accessKeyIdMasked: string | null;
    hasSecretAccessKey: boolean;
    region: string | null;
    bucketName: string | null;
    presignedUrlExpirationMinutes: number;
    isConfigured: boolean;
}

interface AwsSettingsForm {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    bucketName: string;
    presignedUrlExpirationMinutes: number;
}

const EMPTY: AwsSettingsForm = {
    accessKeyId: "",
    secretAccessKey: "",
    region: "us-east-2",
    bucketName: "",
    presignedUrlExpirationMinutes: 15,
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store", ...init });
    if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body as { message?: string })?.message ?? `HTTP ${res.status}`);
    }
    return res.json();
}

/* ── Component ── */

export default function AdminAwsSettingsScreen() {
    const [view, setView] = useState<AwsSettingsView | null>(null);
    const [form, setForm] = useState<AwsSettingsForm>(EMPTY);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchJson<AwsSettingsView>("/api/aws-settings");
            setView(data);
            setForm(prev => ({
                ...prev,
                region: data.region ?? "us-east-2",
                bucketName: data.bucketName ?? "",
                presignedUrlExpirationMinutes: data.presignedUrlExpirationMinutes,
            }));
        } catch {
            toast.error("Falha ao carregar configuração AWS.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    async function handleSave() {
        setSaving(true);
        try {
            const updated = await fetchJson<AwsSettingsView>("/api/aws-settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            setView(updated);
            setForm(prev => ({ ...prev, accessKeyId: "", secretAccessKey: "" }));
            toast.success("Configuração AWS salva!");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha ao salvar.");
        } finally {
            setSaving(false);
        }
    }

    async function handleTest() {
        setTesting(true);
        try {
            const result = await fetchJson<{ message: string }>("/api/aws-settings/testar", { method: "POST" });
            toast.success(result.message);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha no teste.");
        } finally {
            setTesting(false);
        }
    }

    const upd = (key: keyof AwsSettingsForm, value: string | number) =>
        setForm(prev => ({ ...prev, [key]: value }));

    if (loading) return (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="size-4 animate-spin" /> Carregando configuração...
        </div>
    );

    return (
        <section className="space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Armazenamento AWS S3</h4>
                    <div className="text-muted-foreground text-sm">
                        Configure o bucket S3 para armazenar documentos de admissão.
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => void load()}>
                    <RefreshCw className="size-4" />
                </Button>
            </div>

            {/* Status badge */}
            {view && (
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium w-fit ${
                    view.isConfigured
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : "bg-yellow-50 text-yellow-700 border border-yellow-200"
                }`}>
                    {view.isConfigured
                        ? <><CheckCircle2 className="size-4" /> Configurado — bucket: <span className="font-mono">{view.bucketName}</span></>
                        : <><XCircle className="size-4" /> Não configurado — documentos de admissão não funcionarão.</>
                    }
                </div>
            )}

            {/* Formulário */}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur space-y-4">
                <div className="flex items-center gap-2 font-semibold">
                    <CloudUpload className="size-4" /> Credenciais AWS
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                            Access Key ID
                            {view?.accessKeyIdMasked && (
                                <span className="ml-2 font-mono text-muted-foreground/60">{view.accessKeyIdMasked}</span>
                            )}
                        </label>
                        <Input
                            value={form.accessKeyId}
                            onChange={e => upd("accessKeyId", e.target.value)}
                            placeholder={view?.accessKeyIdMasked ? "Deixe em branco para manter" : "AKIA..."}
                            autoComplete="off"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                            Secret Access Key
                            {view?.hasSecretAccessKey && (
                                <span className="ml-2 text-muted-foreground/60">••••••••••••</span>
                            )}
                        </label>
                        <Input
                            type="password"
                            value={form.secretAccessKey}
                            onChange={e => upd("secretAccessKey", e.target.value)}
                            placeholder={view?.hasSecretAccessKey ? "Deixe em branco para manter" : "Informe o secret"}
                            autoComplete="new-password"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Região AWS</label>
                        <Input
                            value={form.region}
                            onChange={e => upd("region", e.target.value)}
                            placeholder="us-east-2"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Nome do Bucket</label>
                        <Input
                            value={form.bucketName}
                            onChange={e => upd("bucketName", e.target.value)}
                            placeholder="render-rh-qa-document"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                            Expiração de URLs (minutos)
                        </label>
                        <Input
                            type="number"
                            min={1}
                            max={720}
                            value={form.presignedUrlExpirationMinutes}
                            onChange={e => upd("presignedUrlExpirationMinutes", parseInt(e.target.value) || 15)}
                        />
                    </div>
                </div>

                <p className="text-xs text-muted-foreground">
                    As credenciais são criptografadas com AES-256 antes de serem salvas.
                    Campos em branco mantêm o valor anterior.
                </p>
            </div>

            {/* Ações */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                    variant="outline"
                    onClick={() => void handleTest()}
                    disabled={testing || !view?.isConfigured}
                >
                    {testing
                        ? <><Loader2 className="size-4 animate-spin mr-1" /> Testando...</>
                        : <><TestTube className="size-4 mr-1" /> Testar Conexão</>
                    }
                </Button>

                <Button onClick={() => void handleSave()} disabled={saving} className="min-w-[160px]">
                    {saving
                        ? <><Loader2 className="size-4 animate-spin mr-1" /> Salvando...</>
                        : <><Save className="size-4 mr-1" /> Salvar Configuração</>
                    }
                </Button>
            </div>
        </section>
    );
}
