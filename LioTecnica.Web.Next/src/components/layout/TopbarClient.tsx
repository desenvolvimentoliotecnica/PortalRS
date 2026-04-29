"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowRightLeft,
  Bell,
  Building2,
  ChevronDown,
  Globe,
  LogOut,
  Menu,
  Search,
  TriangleAlert,
  User,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { confirmDialog } from "@/lib/confirm-dialog";

import Sidebar from "@/components/layout/Sidebar";
import GlobalSearchDialog from "@/components/layout/GlobalSearchDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { BffMe } from "@/lib/schemas/bff";
import type { NavGrupoResponse } from "@/lib/schemas/navegacao";
import { apiFetch } from "@/lib/api";
import { ApiSwitchTenantResponseSchema } from "@/lib/schemas/api";
import { clearSession, getTenantId, setAccessToken, setTenantId } from "@/lib/session";

const RETIRED_NAVIGATION_PATHS = new Set(["/gestao/aprovacoes", "/gestao/solicitacoes"]);

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function isRetiredNavigationUrl(url: string | null): boolean {
  if (!url) return false;
  const normalized = url.replace(/^\/app(?=\/|$)/, "").split("?")[0].replace(/\/+$/, "").toLowerCase();
  return RETIRED_NAVIGATION_PATHS.has(normalized);
}

export default function TopbarClient({
  grupos,
  me,
}: {
  grupos: NavGrupoResponse[];
  me: BffMe | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [locale, setLocale] = useState("pt-BR");
  const [searchOpen, setSearchOpen] = useState(false);

  /* Centro de Notificações in-app — Entrega 1.9 */
  type NotificationListItem = {
    id: string;
    title: string;
    message: string;
    level: string;
    createdAtUtc: string;
    url: string | null;
    isRead: boolean;
  };
  const [notifications, setNotifications] = useState<NotificationListItem[]>([]);
  const [notifUnread, setNotifUnread] = useState(0);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await apiFetch("/api/notifications?take=10", { cache: "no-store" });
      if (!res || typeof res !== "object") return;
      const r = res as { unreadCount?: number; items?: NotificationListItem[] };
      setNotifUnread(r.unreadCount ?? 0);
      setNotifications(r.items ?? []);
    } catch {
      // Silencioso: o sino de notificações fica vazio se o endpoint falhar.
    }
  }, []);

  async function markNotifRead(id: string) {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: "POST" });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setNotifUnread(prev => Math.max(0, prev - 1));
    } catch { /* silencioso */ }
  }

  useEffect(() => {
    if (!me) return;
    void loadNotifications();
    // Poll a cada 60s — versão polling-only (sem SignalR client por simplicidade desta entrega).
    const intervalId = setInterval(loadNotifications, 60_000);
    return () => clearInterval(intervalId);
  }, [me, loadNotifications]);

  /* ─── Actions ─── */

  async function logout() {
    setBusy(true);
    try {
      try {
        await apiFetch("/api/auth/logout", { method: "POST" });
      } catch {
        // Backend pode não ter logout; continua com limpeza local
      }
      clearSession();
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("Falha ao sair.");
    } finally {
      setBusy(false);
    }
  }

  async function switchToOwner() {
    setBusy(true);
    try {
      const res = await apiFetch(`/api/me/switch-tenant`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          tenantId: "owner",
        }),
      });
      const json = await res.json().catch(() => null);
      const err = asRecord(json);
      const detail = typeof err?.detail === "string" ? err.detail : "";
      const message = typeof err?.message === "string" ? err.message : "";
      if (!res.ok) throw new Error(detail || message || "Falha ao trocar tenant.");

      const parsed = ApiSwitchTenantResponseSchema.safeParse(json);
      if (!parsed.success) throw new Error("Resposta inválida ao trocar tenant.");

      setAccessToken(parsed.data.accessToken);
      setTenantId(parsed.data.tenantId);

      // Full page reload so AuthProvider re-reads the new owner JWT and the
      // sidebar switches back to owner menu items. router.replace() is not
      // enough because the (app) layout stays mounted and useAuth won't re-run.
      window.location.replace("/app/Owner/Tenants");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Falha ao trocar tenant.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function resetDb() {
    const ok = await confirmDialog({
      title: "Resetar base de dados (DEV)",
      description: "Isso apaga todos os dados e recria o banco. Tem certeza?",
      confirmText: "Resetar",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/api/ops/reset-database`, {
        method: "POST",
        headers: { "content-type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ reset: true, clean: false, reseed: true }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Base de dados resetada com sucesso.");
      router.refresh();
    } catch {
      toast.error("Falha ao resetar base de dados.");
    } finally {
      setBusy(false);
    }
  }

  const isAuthed = !!me?.isAuthenticated;
  const isOwner = (me?.tenantId ?? "").toLowerCase() === "owner";
  const isInTenantContext =
    isAuthed &&
    !!me?.tenantId &&
    me.tenantId.toLowerCase() !== "owner" &&
    (me as Record<string, unknown>)?.roles?.toString().includes("Owner");

  const displayLabel = me?.email || me?.displayName || "—";

  useEffect(() => {
    setMounted(true);
    try {
      setLocale(localStorage.getItem("renderrh.locale") || "pt-BR");
    } catch {
      setLocale("pt-BR");
    }
  }, []);

  /* ─── Ctrl+K hotkey opens global search dialog ─── */
  useEffect(() => {
    function onHotkey(ev: KeyboardEvent) {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "k") {
        ev.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onHotkey);
    return () => window.removeEventListener("keydown", onHotkey);
  }, []);

  return (
    <>
      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />

      <div className="flex items-center justify-between gap-3 px-4 py-2.5 lg:px-6">
        {/* ─── Left side: hamburger + brand title ─── */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile hamburger — abre Sheet */}
          {mounted ? (
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  className="lg:hidden"
                  size="icon"
                  variant="ghost"
                >
                  <Menu aria-hidden className="size-5 text-lt-primary" />
                  <span className="sr-only">Abrir menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent className="p-0" side="left">
                <SheetHeader className="sr-only">
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <div className="from-lt-primary to-lt-brand h-dvh bg-gradient-to-b text-white">
                  <Sidebar grupos={grupos} />
                </div>
              </SheetContent>
            </Sheet>
          ) : (
            <Button className="lg:hidden" size="icon" variant="ghost" disabled>
              <Menu aria-hidden className="size-5 text-lt-primary" />
              <span className="sr-only">Abrir menu</span>
            </Button>
          )}

          {/* Brand title */}
          <span className="text-sm font-semibold text-lt-primary tracking-[0.18em] uppercase whitespace-nowrap hidden sm:inline">
            Render
          </span>
        </div>

        {/* ─── Center: global search trigger ─── */}
        <div className="min-w-0 flex-1 max-w-xl">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="relative flex items-center w-full h-9 rounded-md border border-lt-primary/20 bg-white/85 pl-9 pr-16 text-sm text-muted-foreground/60 outline-none transition-[color,box-shadow] hover:border-lt-primary/35 hover:bg-white/95 focus-visible:border-lt-primary/45 focus-visible:ring-2 focus-visible:ring-lt-primary/20 cursor-pointer"
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-lt-primary/60" />
            Buscar vagas, pessoas, candidatos...
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-lt-primary/25 px-1.5 py-0.5 text-[11px] leading-none text-lt-primary/70">
              Ctrl + K
            </span>
          </button>
        </div>

        {/* ─── Right side: notifications + user dropdown ─── */}
        <div className="flex items-center gap-1.5">
          {!isAuthed ? (
            <Button variant="ghost" asChild>
              <Link href="/login">Login</Link>
            </Button>
          ) : (
            <>
              {/* ── Notification bell (Entrega 1.9 — Centro de Notificações in-app) ── */}
              <DropdownMenu onOpenChange={(open) => { if (open) void loadNotifications(); }}>
                <DropdownMenuTrigger asChild>
                  <button
                    className="relative inline-flex items-center justify-center rounded-md p-2 text-lt-primary/70 hover:bg-lt-primary/5 hover:text-lt-primary transition-colors"
                    title="Notificações"
                  >
                    <Bell className="size-4" />
                    {(() => {
                      return notifUnread > 0 ? (
                        <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
                          {notifUnread > 99 ? "99+" : notifUnread}
                        </span>
                      ) : null;
                    })()}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[calc(100vw-2rem)] sm:w-96 max-h-[28rem] overflow-y-auto">
                  <div className="px-3 py-2 border-b sticky top-0 bg-popover">
                    <div className="font-semibold text-sm">Notificações</div>
                    <div className="text-xs text-muted-foreground">
                      {notifUnread > 0
                        ? `${notifUnread} não ${notifUnread === 1 ? "lida" : "lidas"}`
                        : "Sem novidades"}
                    </div>
                  </div>
                  {/* Lista de notificações reais (do /api/notifications) */}
                  {notifications.length === 0 ? (
                    <div className="py-6 px-3 text-sm text-muted-foreground text-center">
                      Sem notificações recentes.
                    </div>
                  ) : (
                    <div className="divide-y">
                      {notifications.map((n) => {
                        const levelColor =
                          n.level === "error" || n.level === "warning"
                            ? "bg-red-500"
                            : n.level === "success"
                              ? "bg-emerald-500"
                              : "bg-blue-500";
                        const ageMinutes = Math.max(
                          0,
                          Math.floor((Date.now() - new Date(n.createdAtUtc).getTime()) / 60000)
                        );
                        const ageLabel =
                          ageMinutes < 1 ? "agora" :
                          ageMinutes < 60 ? `${ageMinutes} min` :
                          ageMinutes < 1440 ? `${Math.floor(ageMinutes / 60)}h` :
                          `${Math.floor(ageMinutes / 1440)}d`;
                        const itemContent = (
                          <div className={`flex gap-2 p-3 ${n.isRead ? "opacity-70" : "bg-accent/30"}`}>
                            <span className={`mt-1.5 inline-block size-2 rounded-full shrink-0 ${levelColor}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline justify-between gap-2">
                                <p className={`text-sm truncate ${n.isRead ? "font-normal" : "font-semibold"}`}>
                                  {n.title}
                                </p>
                                <span className="text-[10px] text-muted-foreground shrink-0">{ageLabel}</span>
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                            </div>
                          </div>
                        );

                        const notificationUrl = isRetiredNavigationUrl(n.url) ? null : n.url;

                        return notificationUrl ? (
                          <Link
                            key={n.id}
                            href={notificationUrl}
                            onClick={() => { if (!n.isRead) void markNotifRead(n.id); }}
                            className="block hover:bg-accent/50 transition-colors"
                          >
                            {itemContent}
                          </Link>
                        ) : (
                          <button
                            key={n.id}
                            onClick={() => { if (!n.isRead) void markNotifRead(n.id); }}
                            className="block w-full text-left hover:bg-accent/50 transition-colors"
                          >
                            {itemContent}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="border-t p-2 sticky bottom-0 bg-popover">
                    <Button variant="ghost" size="sm" className="w-full" asChild>
                      <Link href="/notificacoes">Ver todas as notificações</Link>
                    </Button>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* ── Tenant badge ── */}
              {me?.tenantId && (
                <span
                  title={`Tenant: ${me.tenantId}`}
                  className={`hidden md:inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold tracking-wide select-none ${
                    isOwner
                      ? "border-amber-400/40 bg-amber-400/10 text-amber-700"
                      : "border-lt-primary/20 bg-lt-primary/5 text-lt-primary/70"
                  }`}
                >
                  <Building2 className="size-3 shrink-0" />
                  <span className="max-w-[120px] truncate">{me.tenantId}</span>
                </span>
              )}

              {/* ── User menu dropdown (mirrors Razor _TopbarUserMenu) ── */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="btn-ghost inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
                    disabled={busy}
                  >
                    <User className="size-3.5" />
                    <span className="hidden sm:inline">{displayLabel}</span>
                    <ChevronDown className="size-3 opacity-70" />
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-56">
                  {/* If owner browsing a tenant, show "Voltar à área Owner" */}
                  {isInTenantContext && (
                    <>
                      <DropdownMenuItem
                        onClick={() => void switchToOwner()}
                        disabled={busy}
                      >
                        <Building2 className="size-4 mr-2" />
                        Voltar à área Owner
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}

                  {/* My profile */}
                  <DropdownMenuItem asChild>
                    <Link href="/colaborador/perfil">
                      <User className="size-4 mr-2" />
                      Meu perfil
                    </Link>
                  </DropdownMenuItem>

                  {/* Portal de Vagas */}
                  <DropdownMenuItem asChild>
                    <Link
                      href={`/PortalVagas${getTenantId() ? `?tenantId=${encodeURIComponent(getTenantId()!)}` : ""}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Globe className="size-4 mr-2" />
                      Portal de Vagas
                    </Link>
                  </DropdownMenuItem>

                  {/* Integração TOTVS */}
                  <DropdownMenuItem asChild>
                    <Link href="/integracao-totvs">
                      <ArrowRightLeft className="size-4 mr-2" />
                      Integração TOTVS
                    </Link>
                  </DropdownMenuItem>

                  {/* Resetar base (DEV) */}
                  <DropdownMenuItem
                    onClick={() => void resetDb()}
                    disabled={busy}
                    className="text-amber-600 focus:text-amber-700"
                  >
                    <TriangleAlert className="size-4 mr-2" />
                    Resetar base (DEV)
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {/* Idioma */}
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                    Idioma
                  </DropdownMenuLabel>
                  <div className="px-2 pb-2">
                    <select
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                      value={locale}
                      disabled={!mounted}
                      onChange={(e) => {
                        const locale = e.target.value;
                        setLocale(locale);
                        try {
                          localStorage.setItem("renderrh.locale", locale);
                        } catch {
                          // ignore write errors
                        }
                        // Reload so the Accept-Language header picks up the new locale
                        window.location.reload();
                      }}
                    >
                      <option value="pt-BR">Português (Brasil)</option>
                      <option value="en-US">English (US)</option>
                    </select>
                  </div>

                  <DropdownMenuSeparator />

                  {/* Sair */}
                  <DropdownMenuItem
                    onClick={() => void logout()}
                    disabled={busy}
                    className="text-red-600 focus:text-red-700"
                  >
                    <LogOut className="size-4 mr-2" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>

      </div>
    </>
  );
}
