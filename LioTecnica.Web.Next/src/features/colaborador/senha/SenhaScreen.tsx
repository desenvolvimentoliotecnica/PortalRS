"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Lock, Eye, EyeOff } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API = "/api/colaborador/senha";

export default function SenhaScreen() {
    const [senhaAtual, setSenhaAtual] = useState("");
    const [novaSenha, setNovaSenha] = useState("");
    const [confirmar, setConfirmar] = useState("");
    const [saving, setSaving] = useState(false);
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!senhaAtual || !novaSenha) { toast.error("Preencha todos os campos."); return; }
        if (novaSenha !== confirmar) { toast.error("A confirmação não confere."); return; }
        if (novaSenha.length < 6) { toast.error("A nova senha deve ter no mínimo 6 caracteres."); return; }

        setSaving(true);
        try {
            const res = await apiFetch(API, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ senhaAtual, novaSenha }),
            });
            if (res.ok) {
                toast.success("Senha alterada com sucesso!");
                setSenhaAtual(""); setNovaSenha(""); setConfirmar("");
            } else {
                const data = await res.json().catch(() => ({ message: res.statusText }));
                toast.error(data.message || "Falha ao alterar senha.");
            }
        } catch {
            toast.error("Erro ao alterar senha.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className="space-y-4 max-w-md">
            <div>
                <h4 className="text-lg font-bold">Alterar Senha</h4>
                <div className="text-muted-foreground text-sm">Atualize a senha de acesso ao portal</div>
            </div>

            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-6 backdrop-blur">
                <div className="flex items-center gap-3 mb-6">
                    <div className="rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 p-3">
                        <Lock className="size-6 text-amber-600" />
                    </div>
                    <div>
                        <div className="font-semibold">Segurança da conta</div>
                        <div className="text-xs text-muted-foreground">Mínimo 6 caracteres</div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs text-muted-foreground uppercase mb-1 block">Senha atual</label>
                        <div className="relative">
                            <Input type={showCurrent ? "text" : "password"} value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} />
                            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowCurrent(!showCurrent)}>
                                {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground uppercase mb-1 block">Nova senha</label>
                        <div className="relative">
                            <Input type={showNew ? "text" : "password"} value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} />
                            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowNew(!showNew)}>
                                {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground uppercase mb-1 block">Confirmar nova senha</label>
                        <Input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
                        {confirmar && confirmar !== novaSenha && (
                            <div className="text-xs text-red-500 mt-1">As senhas não conferem.</div>
                        )}
                    </div>
                    <Button type="submit" disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-700">
                        <Lock className="size-4" /> {saving ? "Alterando…" : "Alterar senha"}
                    </Button>
                </form>
            </div>
        </section>
    );
}
