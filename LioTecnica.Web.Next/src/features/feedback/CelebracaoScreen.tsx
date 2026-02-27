"use client";

import { useState, useEffect, useCallback } from "react";
import { Send, MessageCircle, Heart, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

/* ── Types ── */
interface CelebrationPost {
    id: string;
    content: string;
    authorFullName: string;
    createdAtUtc: string;
    mentions: { userId: string; fullName: string }[];
}
interface CelebrationFeed {
    items: CelebrationPost[];
    totalItems: number;
    page: number;
    pageSize: number;
}
interface MentionUser {
    userId: string;
    fullName: string;
    email: string;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store", ...init });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

function fmtDate(iso: string) {
    try { return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }); }
    catch { return iso; }
}

export default function CelebracaoScreen() {
    const [feed, setFeed] = useState<CelebrationPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [content, setContent] = useState("");
    const [posting, setPosting] = useState(false);
    const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);

    const loadFeed = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchJson<CelebrationFeed>("/api/feedback/celebrations/feed?page=1&pageSize=50");
            setFeed(data.items ?? []);
        } catch (err) {
            console.error("Failed to load celebrations", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void loadFeed(); }, [loadFeed]);
    useEffect(() => {
        fetchJson<MentionUser[]>("/api/feedback/celebrations/mention-users?take=50")
            .then(setMentionUsers)
            .catch(() => { });
    }, []);

    async function handlePost() {
        if (!content.trim()) { toast.error("Escreva algo para celebrar!"); return; }
        setPosting(true);
        try {
            // Extract mentions from @@name pattern
            const mentionedUserIds = mentionUsers
                .filter(u => content.includes(`@@${u.fullName}`) || content.includes(`@${u.fullName}`))
                .map(u => u.userId);

            await fetchJson("/api/feedback/celebrations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: content.trim(), mentionedUserIds }),
            });
            toast.success("Celebração publicada! 🎉");
            setContent("");
            void loadFeed();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha ao publicar.");
        } finally {
            setPosting(false);
        }
    }

    return (
        <section className="space-y-4 max-w-3xl mx-auto">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Celebração 🎉</h4>
                    <div className="text-muted-foreground text-sm">Reconheça e celebre conquistas dos seus colegas.</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => void loadFeed()} disabled={loading}>
                    <RefreshCw className="size-4" />
                </Button>
            </div>

            {/* Post box */}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur space-y-3">
                <textarea
                    className="w-full rounded-lg border border-input bg-background p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                    rows={3}
                    placeholder="O que você quer celebrar? Use @nome para marcar colegas..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                />
                <div className="flex justify-between items-center">
                    <div className="text-xs text-muted-foreground">
                        {mentionUsers.length > 0 && `${mentionUsers.length} colegas disponíveis para menção`}
                    </div>
                    <Button onClick={() => void handlePost()} disabled={posting || !content.trim()}>
                        <Send className="size-4 mr-1" />
                        {posting ? "Publicando..." : "Publicar"}
                    </Button>
                </div>
            </div>

            {/* Feed */}
            {loading ? (
                <div className="text-center text-muted-foreground py-8">Carregando feed...</div>
            ) : feed.length === 0 ? (
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-8 backdrop-blur text-center text-muted-foreground">
                    Nenhuma celebração ainda. Seja o primeiro a celebrar! 🎊
                </div>
            ) : (
                <div className="space-y-3">
                    {feed.map((post) => (
                        <div key={post.id} className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                                        {post.authorFullName?.charAt(0) || "?"}
                                    </div>
                                    <div>
                                        <div className="font-semibold text-sm">{post.authorFullName}</div>
                                        <div className="text-xs text-muted-foreground">{fmtDate(post.createdAtUtc)}</div>
                                    </div>
                                </div>
                            </div>
                            <div className="text-sm whitespace-pre-wrap">{post.content}</div>
                            {post.mentions?.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                    {post.mentions.map((m) => (
                                        <span key={m.userId} className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                            @{m.fullName}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
