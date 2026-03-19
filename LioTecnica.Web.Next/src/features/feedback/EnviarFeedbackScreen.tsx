"use client";

import { useState, useEffect } from "react";
import { Send, Users, Star, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface UserOption { userId: string; fullName: string; email: string; }

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store", ...init });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

/* ── Star rating selector ── */
function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
                <button
                    key={n}
                    type="button"
                    className="p-0.5 transition-transform hover:scale-110"
                    onClick={() => onChange(value === n ? 0 : n)}
                >
                    <Star
                        className={`size-6 ${n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40 hover:text-amber-300"}`}
                    />
                </button>
            ))}
        </div>
    );
}

/* ── Templates ── */
const TEMPLATES: { value: string; label: string; body: string }[] = [
    { value: "", label: "Nenhum modelo", body: "" },
    { value: "parar-continuar-comecar", label: "Modelo: Parar / Continuar / Começar", body: "🛑 Parar:\n\n✅ Continuar:\n\n🚀 Começar:\n" },
    { value: "sci", label: "Modelo: SCI — Situação/Comportamento/Impacto", body: "📌 Situação:\n\n🔍 Comportamento:\n\n💡 Impacto:\n" },
    { value: "cnv", label: "Modelo: Comunicação Não Violenta", body: "👁 Observação:\n\n❤️ Sentimento:\n\n🎯 Necessidade:\n\n🤝 Pedido:\n" },
    { value: "1on1", label: "Modelo: 1 on 1", body: "📋 Tópicos discutidos:\n\n✅ Ações combinadas:\n\n📅 Próximos passos:\n" },
    { value: "otimas-ideias", label: "Modelo: Ótimas Ideias", body: "💡 Ideia:\n\n🎯 Impacto esperado:\n\n🚀 Como implementar:\n" },
    { value: "boa-reuniao", label: "Modelo: Boa Reunião", body: "📌 O que discutimos:\n\n✅ O que decidimos:\n\n📅 Próximas ações:\n" },
    { value: "presencial", label: "Feedback presencial", body: "Este feedback foi dado em uma conversa presencial.\n\nResumo:\n" },
];

const MAX_CHARS = 4000;

export default function EnviarFeedbackScreen() {
    const [users, setUsers] = useState<UserOption[]>([]);
    const [toUserId, setToUserId] = useState("");
    const [content, setContent] = useState("");
    const [privateNotes, setPrivateNotes] = useState("");
    const [sending, setSending] = useState(false);
    const [isPresencial, setIsPresencial] = useState(false);
    const [template, setTemplate] = useState("");

    // Star ratings for company items
    const [starAlinhamento, setStarAlinhamento] = useState(0);
    const [starFoco, setStarFoco] = useState(0);

    useEffect(() => {
        fetchJson<UserOption[]>("/api/feedback/celebrations/mention-users?take=200")
            .then(setUsers)
            .catch(() => { });
    }, []);

    function handleTemplateChange(v: string) {
        setTemplate(v);
        const t = TEMPLATES.find((x) => x.value === v);
        if (t && t.body) setContent(t.body);
    }

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
                    type: "feedback",
                    content: content.trim(),
                    privateNotes: privateNotes.trim() || null,
                    isPresencial,
                    items: [
                        ...(starAlinhamento > 0 ? [{ name: "Alinhamento Cultural", rating: starAlinhamento }] : []),
                        ...(starFoco > 0 ? [{ name: "Foco no Cliente", rating: starFoco }] : []),
                    ],
                }),
            });
            toast.success("Feedback enviado com sucesso! ✅");
            setContent(""); setPrivateNotes(""); setToUserId("");
            setStarAlinhamento(0); setStarFoco(0); setIsPresencial(false); setTemplate("");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha ao enviar feedback.");
        } finally {
            setSending(false);
        }
    }

    return (
        <section className="space-y-4">
            <div>
                <h4 className="text-lg font-bold">Enviar Feedback</h4>
                <p className="text-muted-foreground text-sm">Selecione um colaborador para enviar um feedback sobre desempenho</p>
            </div>

            <div className="rounded-xl border border-border/40 bg-card/60 p-6 backdrop-blur space-y-5">
                {/* ── Colaborador ── */}
                <div className="space-y-1.5">
                    <label className="text-sm font-bold flex items-center gap-1"><Users className="size-4" /> Selecione um colaborador</label>
                    <select
                        className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                        value={toUserId}
                        onChange={(e) => setToUserId(e.target.value)}
                    >
                        <option value="">Selecione um colaborador</option>
                        {users.map((u, idx) => (
                            <option key={`${u.userId}-${idx}`} value={u.userId}>{u.fullName} ({u.email})</option>
                        ))}
                    </select>
                </div>

                {/* ── Itens da empresa (star ratings) ── */}
                <div className="space-y-2">
                    <label className="text-sm font-bold">Itens da empresa</label>
                    <p className="text-muted-foreground text-xs">Atribua um ou mais itens da empresa a esse feedback</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="rounded-lg border border-border/30 bg-muted/20 p-4 text-center space-y-2">
                            <div className="font-semibold text-sm">Alinhamento Cultural</div>
                            <div className="text-muted-foreground text-xs">Alinhamento com a cultura e valores da empresa</div>
                            <div className="flex justify-center"><StarRating value={starAlinhamento} onChange={setStarAlinhamento} /></div>
                        </div>
                        <div className="rounded-lg border border-border/30 bg-muted/20 p-4 text-center space-y-2">
                            <div className="font-semibold text-sm">Foco no Cliente</div>
                            <div className="text-muted-foreground text-xs">Esforço e foco em entregar sucesso aos clientes</div>
                            <div className="flex justify-center"><StarRating value={starFoco} onChange={setStarFoco} /></div>
                        </div>
                    </div>
                </div>

                {/* ── Template + conteúdo ── */}
                <div className="space-y-2">
                    <label className="text-sm font-bold flex items-center gap-1"><FileText className="size-4" /> Descreva seu feedback</label>
                    <select
                        className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                        value={template}
                        onChange={(e) => handleTemplateChange(e.target.value)}
                    >
                        {TEMPLATES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                    </select>
                    <textarea
                        className="w-full rounded-lg border border-input bg-background p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                        rows={8}
                        placeholder="Escreva seu feedback..."
                        maxLength={MAX_CHARS}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                    />
                    <div className="text-right text-xs text-muted-foreground">{content.length}/{MAX_CHARS}</div>
                </div>

                {/* ── Presencial ── */}
                <div className="space-y-1.5">
                    <label className="text-sm font-bold">Feedback presencial</label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            className="size-4 rounded border-input accent-primary"
                            checked={isPresencial}
                            onChange={(e) => setIsPresencial(e.target.checked)}
                        />
                        <span className="text-muted-foreground text-sm">Esse feedback foi dado presencialmente</span>
                    </label>
                </div>

                {/* ── Anotações privadas ── */}
                <div className="space-y-1.5">
                    <label className="text-sm font-bold">Anotações Internas</label>
                    <p className="text-muted-foreground text-xs">Essas anotações são suas. São privadas e aparecerão apenas para você.</p>
                    <textarea
                        className="w-full rounded-lg border border-input bg-background p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                        rows={4}
                        maxLength={MAX_CHARS}
                        placeholder="Suas anotações privadas..."
                        value={privateNotes}
                        onChange={(e) => setPrivateNotes(e.target.value)}
                    />
                </div>

                {/* ── Submit ── */}
                <div className="flex justify-end">
                    <Button onClick={() => void handleSend()} disabled={sending} className="px-6 py-2">
                        <Send className="size-4 mr-2" />
                        {sending ? "Enviando..." : "Enviar feedback"}
                    </Button>
                </div>
            </div>
        </section>
    );
}
