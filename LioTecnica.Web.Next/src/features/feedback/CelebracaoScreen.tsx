"use client";

import { useState, useEffect, useCallback } from "react";
import { Send, MessageCircle, Heart, RefreshCw, Filter, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
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
interface CelebComment {
    id: string;
    authorFullName: string;
    content: string;
    createdAtUtc: string;
    reactionCount: number;
    myReaction: boolean;
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

const MAX_CHARS = 4000;
type FeedFilter = "all" | "sent" | "received";

export default function CelebracaoScreen() {
    const [feed, setFeed] = useState<CelebrationPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [content, setContent] = useState("");
    const [posting, setPosting] = useState(false);
    const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);
    // Filters
    const [feedFilter, setFeedFilter] = useState<FeedFilter>("all");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    // Pagination
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    // Comments
    const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
    const [comments, setComments] = useState<Record<string, CelebComment[]>>({});
    const [commentText, setCommentText] = useState("");
    const [commentBusy, setCommentBusy] = useState(false);

    const loadFeed = useCallback(async (append = false, p = 1) => {
        append ? setLoadingMore(true) : setLoading(true);
        try {
            const qs = new URLSearchParams({ page: String(p), pageSize: "20" });
            if (feedFilter !== "all") qs.set("filter", feedFilter);
            if (dateFrom) qs.set("from", dateFrom);
            if (dateTo) qs.set("to", dateTo);
            const data = await fetchJson<CelebrationFeed>(`/api/feedback/celebrations/feed?${qs}`);
            const items = data.items ?? [];
            setFeed((prev) => append ? [...prev, ...items] : items);
            setHasMore(items.length >= 20);
            setPage(p);
        } catch (err) {
            console.error("Failed to load celebrations", err);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [feedFilter, dateFrom, dateTo]);

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

    async function toggleComments(postId: string) {
        if (expandedPostId === postId) { setExpandedPostId(null); return; }
        setExpandedPostId(postId);
        try {
            const data = await fetchJson<CelebComment[]>(`/api/feedback/celebrations/${postId}/comments`);
            setComments(prev => ({ ...prev, [postId]: data ?? [] }));
        } catch { setComments(prev => ({ ...prev, [postId]: [] })); }
    }

    async function postComment(postId: string) {
        if (!commentText.trim()) return;
        setCommentBusy(true);
        try {
            await fetchJson(`/api/feedback/celebrations/${postId}/comments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: commentText.trim() }),
            });
            setCommentText("");
            void toggleComments(postId); // reload
            setExpandedPostId(postId);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha ao comentar.");
        } finally { setCommentBusy(false); }
    }

    async function toggleReaction(postId: string, commentId: string) {
        try {
            await apiFetch(`/api/feedback/celebrations/${postId}/comments/${commentId}/reaction`, { method: "POST" });
            // Reload comments
            const data = await fetchJson<CelebComment[]>(`/api/feedback/celebrations/${postId}/comments`);
            setComments(prev => ({ ...prev, [postId]: data ?? [] }));
        } catch { /* silent */ }
    }

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Celebração 🎉</h4>
                    <div className="text-muted-foreground text-sm">Reconheça e celebre conquistas dos seus colegas.</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => void loadFeed()} disabled={loading}>
                    <RefreshCw className="size-4" />
                </Button>
            </div>

            {/* Post box */}
            <div className="rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur space-y-3">
                <div className="font-semibold text-sm">Nova publicação</div>
                <div className="text-muted-foreground text-xs">Digite @@ e o nome para marcar um colaborador.</div>
                <textarea
                    className="w-full rounded-lg border border-input bg-background p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                    rows={3}
                    maxLength={MAX_CHARS}
                    placeholder="O que você quer celebrar? Use @@nome para marcar colegas..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                />
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-xs">{content.length}/{MAX_CHARS}</span>
                    <Button size="sm" onClick={() => void handlePost()} disabled={posting || !content.trim()}>
                        {posting ? "Publicando..." : "Publicar"}
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="rounded-xl border border-border/40 bg-card/60 p-3 backdrop-blur">
                <div className="font-semibold text-sm mb-2">Filtros</div>
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex gap-1">
                        {(["all", "sent", "received"] as const).map((f) => (
                            <Button
                                key={f}
                                variant={feedFilter === f ? "default" : "outline"}
                                size="sm"
                                onClick={() => { setFeedFilter(f); void loadFeed(false, 1); }}
                            >
                                {f === "all" ? "Todas" : f === "sent" ? "Enviadas" : "Recebidas"}
                            </Button>
                        ))}
                    </div>
                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Data de início</label>
                        <Input type="date" className="h-9 w-36" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Data de fim</label>
                        <Input type="date" className="h-9 w-36" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                        <Button size="sm" onClick={() => void loadFeed(false, 1)}>
                            <Filter className="size-3.5 mr-1" />Filtrar
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); setFeedFilter("all"); }}>Limpar</Button>
                    </div>
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
                            {/* Comments section */}
                            <div className="mt-3 flex items-center gap-2 pt-2 border-t border-border/30">
                                <Button variant="outline" size="sm" onClick={() => void toggleComments(post.id)}>
                                    <MessageCircle className="size-4 mr-1" />
                                    {expandedPostId === post.id ? "Ocultar" : "Comentários"}
                                </Button>
                            </div>
                            {expandedPostId === post.id && (
                                <div className="mt-2 space-y-2">
                                    {(comments[post.id] ?? []).length === 0 ? (
                                        <div className="text-xs text-muted-foreground">Nenhum comentário ainda.</div>
                                    ) : (comments[post.id] ?? []).map(c => (
                                        <div key={c.id} className="flex items-start gap-2 text-sm">
                                            <div className="size-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                                                {c.authorFullName?.charAt(0) || "?"}
                                            </div>
                                            <div className="flex-1">
                                                <span className="font-semibold text-xs">{c.authorFullName}</span>
                                                <span className="text-xs text-muted-foreground ml-2">{fmtDate(c.createdAtUtc)}</span>
                                                <div className="text-sm">{c.content}</div>
                                            </div>
                                            <Button variant="outline" size="sm" onClick={() => void toggleReaction(post.id, c.id)}>
                                                <Heart className={`size-3 ${c.myReaction ? "fill-red-500 text-red-500" : ""}`} />
                                            </Button>
                                            {c.reactionCount > 0 && <span className="text-xs text-muted-foreground">{c.reactionCount}</span>}
                                        </div>
                                    ))}
                                    <div className="flex gap-2 mt-1">
                                        <input
                                            className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-sm"
                                            placeholder="Escreva um comentário..."
                                            value={commentText}
                                            onChange={e => setCommentText(e.target.value)}
                                            onKeyDown={e => { if (e.key === "Enter") void postComment(post.id); }}
                                        />
                                        <Button size="sm" className="h-8" disabled={commentBusy || !commentText.trim()} onClick={() => void postComment(post.id)}>
                                            <Send className="size-3" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    {/* Load more button */}
                    {hasMore && (
                        <div className="text-center pt-2">
                            <Button variant="outline" size="sm" disabled={loadingMore} onClick={() => void loadFeed(true, page + 1)}>
                                <ChevronDown className="size-4 mr-1" />
                                {loadingMore ? "Carregando..." : "Carregar mais"}
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
