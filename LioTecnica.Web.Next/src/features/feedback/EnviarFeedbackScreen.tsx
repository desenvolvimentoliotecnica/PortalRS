"use client";

import { useState, useEffect } from "react";
import { Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface UserOption {
    userId: string;
    fullName: string;
    email: string;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store", ...init });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export default function EnviarFeedbackScreen() {
    const [users, setUsers] = useState<UserOption[]>([]);
    const [toUserId, setToUserId] = useState("");
    const [type, setType] = useState("positivo");
    const [content, setContent] = useState("");
    const [privateNotes, setPrivateNotes] = useState("");
    const [sending, setSending] = useState(false);

    useEffect(() => {
        fetchJson<UserOption[]>("/api/feedback/celebrations/mention-users?take=200")
            .then(setUsers)
            .catch(() => { });
    }, []);

    async function handleSend() {
        if (!toUserId) { toast.error("Selecione o destinatário."); return; }
        if (!content.trim()) { toast.error("Escreva o feedback."); return; }
        setSending(true);
        try {
            await fetchJson("/api/feedback/items", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    toUserId,
                    type,
                    content: content.trim(),
                    privateNotes: privateNotes.trim() || null,
                }),
            });
            toast.success("Feedback enviado com sucesso! ✅");
            setContent("");
            setPrivateNotes("");
            setToUserId("");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha ao enviar feedback.");
        } finally {
            setSending(false);
        }
    }

    return (
        <section className="space-y-4 max-w-2xl mx-auto">
            <div>
                <h4 className="text-lg font-bold">Enviar Feedback</h4>
                <div className="text-muted-foreground text-sm">Envie um feedback para um colega de equipe.</div>
            </div>

            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-6 backdrop-blur space-y-4">
                <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center gap-1"><Users className="size-4" /> Para quem?</label>
                    <select
                        className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                        value={toUserId}
                        onChange={(e) => setToUserId(e.target.value)}
                    >
                        <option value="">Selecione um colaborador...</option>
                        {users.map(u => (
                            <option key={u.userId} value={u.userId}>{u.fullName} ({u.email})</option>
                        ))}
                    </select>
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Tipo de feedback</label>
                    <div className="flex gap-2">
                        {["positivo", "construtivo", "reconhecimento"].map((t) => (
                            <Button
                                key={t}
                                variant={type === t ? "default" : "outline"}
                                size="sm"
                                onClick={() => setType(t)}
                            >
                                {t === "positivo" ? "👍 Positivo" : t === "construtivo" ? "💡 Construtivo" : "⭐ Reconhecimento"}
                            </Button>
                        ))}
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Mensagem</label>
                    <textarea
                        className="w-full rounded-lg border border-input bg-background p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                        rows={4}
                        placeholder="Escreva seu feedback..."
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Anotações privadas (opcional)</label>
                    <textarea
                        className="w-full rounded-lg border border-input bg-background p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                        rows={2}
                        placeholder="Suas anotações privadas..."
                        value={privateNotes}
                        onChange={(e) => setPrivateNotes(e.target.value)}
                    />
                </div>

                <Button onClick={() => void handleSend()} disabled={sending} className="w-full">
                    <Send className="size-4 mr-1" />
                    {sending ? "Enviando..." : "Enviar Feedback"}
                </Button>
            </div>
        </section>
    );
}
