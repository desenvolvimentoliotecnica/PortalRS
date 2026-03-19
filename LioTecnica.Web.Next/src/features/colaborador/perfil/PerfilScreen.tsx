"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { User, Save, Phone, Mail, Building2, Briefcase, MapPin, Camera, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API = "/api/colaborador/perfil";

interface Perfil {
    funcionarioId: string;
    nome: string;
    email: string;
    telefone: string | null;
    areaName: string | null;
    unitName: string | null;
    jobPositionName: string | null;
    avatarUrl: string | null;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { ...init, headers: { Accept: "application/json", ...(init?.headers || {}) }, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
}

export default function PerfilScreen() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [perfil, setPerfil] = useState<Perfil | null>(null);
    const [nome, setNome] = useState("");
    const [telefone, setTelefone] = useState("");
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [avatarVersion, setAvatarVersion] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const load = useCallback(async () => {
        const p = await fetchJson<Perfil>(API);
        setPerfil(p);
        setNome(p.nome);
        setTelefone(p.telefone || "");
    }, []);

    useEffect(() => {
        setLoading(true);
        load().catch(() => toast.error("Falha ao carregar perfil.")).finally(() => setLoading(false));
    }, [load]);

    async function handleSave() {
        setSaving(true);
        try {
            const updated = await fetchJson<Perfil>(API, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nome, telefone: telefone || null }),
            });
            setPerfil(updated);
            toast.success("Perfil atualizado!");
        } catch {
            toast.error("Falha ao salvar.");
        } finally {
            setSaving(false);
        }
    }

    async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate
        const allowed = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
        const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
        if (!allowed.includes(ext)) {
            toast.error(`Extensão '${ext}' não permitida. Use: ${allowed.join(", ")}`);
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error("Imagem muito grande. Máximo 5MB.");
            return;
        }

        // Preview
        const reader = new FileReader();
        reader.onload = () => setAvatarPreview(reader.result as string);
        reader.readAsDataURL(file);

        // Upload
        setUploadingAvatar(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await apiFetch(`${API}/avatar`, { method: "POST", body: formData, cache: "no-store" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error((err as Record<string, string>)?.message || "Falha no upload.");
            }
            const data = await res.json() as { avatarUrl: string };
            setPerfil(p => p ? { ...p, avatarUrl: data.avatarUrl } : p);
            setAvatarVersion(v => v + 1);
            setAvatarPreview(null);
            toast.success("Foto atualizada!");
        } catch (err) {
            setAvatarPreview(null);
            toast.error(err instanceof Error ? err.message : "Falha ao enviar foto.");
        } finally {
            setUploadingAvatar(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }

    async function handleDeleteAvatar() {
        setUploadingAvatar(true);
        try {
            const res = await apiFetch(`${API}/avatar`, { method: "DELETE", cache: "no-store" });
            if (!res.ok) throw new Error();
            setPerfil(p => p ? { ...p, avatarUrl: null } : p);
            setAvatarPreview(null);
            toast.success("Foto removida.");
        } catch {
            toast.error("Falha ao remover foto.");
        } finally {
            setUploadingAvatar(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="border-lt-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
            </div>
        );
    }

    const avatarSrc = avatarPreview || (perfil?.avatarUrl ? `${perfil.avatarUrl}?v=${avatarVersion}` : null);

    return (
        <section className="space-y-4 max-w-2xl">
            <div>
                <h4 className="text-lg font-bold">Meu Perfil</h4>
                <div className="text-muted-foreground text-sm">Atualize seus dados pessoais</div>
            </div>

            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-6 backdrop-blur">
                <div className="flex items-center gap-4 mb-6">
                    {/* ── Avatar with upload ── */}
                    <div className="relative group">
                        <div
                            className="flex items-center justify-center size-20 rounded-full bg-gradient-to-br from-violet-500/20 to-indigo-500/20 overflow-hidden cursor-pointer ring-2 ring-transparent hover:ring-violet-400/50 transition-all"
                            onClick={() => !uploadingAvatar && fileInputRef.current?.click()}
                        >
                            {avatarSrc ? (
                                <img
                                    src={avatarSrc}
                                    alt="Avatar"
                                    className="size-full object-cover"
                                />
                            ) : (
                                <User className="size-10 text-violet-600" />
                            )}

                            {/* Hover overlay */}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                {uploadingAvatar ? (
                                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                ) : (
                                    <Camera className="size-5 text-white" />
                                )}
                            </div>
                        </div>

                        {/* Delete button */}
                        {perfil?.avatarUrl && !uploadingAvatar && (
                            <button
                                type="button"
                                onClick={handleDeleteAvatar}
                                className="absolute -bottom-1 -right-1 flex items-center justify-center size-6 rounded-full bg-red-500 hover:bg-red-600 text-white shadow transition-colors"
                                title="Remover foto"
                            >
                                <Trash2 className="size-3" />
                            </button>
                        )}

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            className="hidden"
                            onChange={handleAvatarUpload}
                        />
                    </div>

                    <div>
                        <div className="font-semibold text-lg">{perfil?.nome || "—"}</div>
                        <div className="text-sm text-muted-foreground">{perfil?.email || "—"}</div>
                        <div className="text-xs text-muted-foreground/60 mt-0.5">
                            Clique na foto para alterar
                        </div>
                    </div>
                </div>

                {/* ── Read-only info ── */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="flex items-center gap-2 text-sm">
                        <Building2 className="size-4 text-muted-foreground" />
                        <div>
                            <div className="text-xs text-muted-foreground uppercase">Área</div>
                            <div>{perfil?.areaName || "—"}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <MapPin className="size-4 text-muted-foreground" />
                        <div>
                            <div className="text-xs text-muted-foreground uppercase">Unidade</div>
                            <div>{perfil?.unitName || "—"}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <Briefcase className="size-4 text-muted-foreground" />
                        <div>
                            <div className="text-xs text-muted-foreground uppercase">Cargo</div>
                            <div>{perfil?.jobPositionName || "—"}</div>
                        </div>
                    </div>
                </div>

                <div className="border-t border-border/40 pt-4 space-y-4">
                    <div className="text-sm font-semibold">Dados editáveis</div>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs text-muted-foreground uppercase mb-1 block">
                                <User className="inline size-3 mr-1" /> Nome completo
                            </label>
                            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground uppercase mb-1 block">
                                <Phone className="inline size-3 mr-1" /> Telefone
                            </label>
                            <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground uppercase mb-1 block">
                                <Mail className="inline size-3 mr-1" /> E-mail
                            </label>
                            <Input value={perfil?.email || ""} disabled className="opacity-60" />
                            <div className="text-xs text-muted-foreground mt-1">E-mail não pode ser alterado.</div>
                        </div>
                    </div>
                    <Button disabled={saving || !nome.trim()} onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">
                        <Save className="size-4" /> {saving ? "Salvando…" : "Salvar alterações"}
                    </Button>
                </div>
            </div>
        </section>
    );
}
