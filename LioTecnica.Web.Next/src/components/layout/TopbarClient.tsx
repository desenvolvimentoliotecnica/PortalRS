"use client";

import { useEffect, useRef, useState } from "react";
import {
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
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import Sidebar from "@/components/layout/Sidebar";
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
import type { BffNavItem } from "@/lib/schemas/bff";
import type { BffMe } from "@/lib/schemas/bff";
import { apiFetch } from "@/lib/api";
import { ApiSwitchTenantResponseSchema } from "@/lib/schemas/api";
import { clearSession, setAccessToken, setTenantId } from "@/lib/session";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function isLikelySearchInput(el: HTMLInputElement): boolean {
  const placeholder = (el.placeholder ?? "").trim().toLowerCase();
  const idOrName = `${el.id} ${el.name}`.toLowerCase();
  const marker = `${idOrName} ${placeholder} ${el.getAttribute("aria-label") ?? ""}`.toLowerCase();
  const looksLikeFreeTextFilter =
    (placeholder.includes(",") || placeholder.includes(" ou ")) &&
    (placeholder.includes("nome") ||
      placeholder.includes("email") ||
      placeholder.includes("codigo") ||
      placeholder.includes("código") ||
      placeholder.includes("rota") ||
      placeholder.includes("assunto") ||
      placeholder.includes("arquivo") ||
      placeholder.includes("vaga"));

  return (
    el.type === "search" ||
    marker.includes("search") ||
    marker.includes("buscar") ||
    marker.includes("filtrar") ||
    marker.includes("pesquisar") ||
    marker.includes("fsearch") ||
    marker.includes("gsearch") ||
    idOrName.split(/\s+/).includes("q") ||
    looksLikeFreeTextFilter
  );
}

function setNativeInputValue(el: HTMLInputElement, next: string) {
  const proto = Object.getPrototypeOf(el) as HTMLInputElement;
  const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
  const setter = descriptor?.set;
  if (setter) setter.call(el, next);
  else el.value = next;
}

function collectSearchInputs() {
  return Array.from(document.querySelectorAll("main input"))
    .filter((node): node is HTMLInputElement => node instanceof HTMLInputElement)
    .filter((el) => !el.dataset.topbarGlobalSearch)
    .filter((el) => !el.disabled && !el.readOnly && el.type !== "hidden")
    .filter(isLikelySearchInput);
}

function resolveScreenSearchTarget(): HTMLInputElement | null {
  const marked = document.querySelector("main input[data-global-search-target='true']");
  if (marked instanceof HTMLInputElement) return marked;

  const byId = document.querySelector("main input#fSearch");
  if (byId instanceof HTMLInputElement) return byId;

  const byCommonName = document.querySelector("main input[name='q'], main input#q");
  if (byCommonName instanceof HTMLInputElement) return byCommonName;

  const candidates = collectSearchInputs();
  if (candidates.length === 1) return candidates[0]!;
  return candidates[0] ?? null;
}

function pushGlobalSearchToCurrentScreen(nextQuery: string) {
  const target = resolveScreenSearchTarget();
  if (!target) return;
  if (target.value === nextQuery) return;
  setNativeInputValue(target, nextQuery);
  target.dispatchEvent(new Event("input", { bubbles: true }));
}

function readScreenSearchFromTarget() {
  const target = resolveScreenSearchTarget();
  return target?.value ?? "";
}

export default function TopbarClient({
  navItems,
  me,
}: {
  navItems: BffNavItem[];
  me: BffMe | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const globalSearchInputRef = useRef<HTMLInputElement | null>(null);
  const syncingSearchRef = useRef(false);

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

      router.replace("/Owner/Tenants");
      router.refresh();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Falha ao trocar tenant.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function resetDb() {
    const ok = confirm(
      "⚠️ Resetar base de dados (DEV)?\n\nIsso apaga todos os dados e recria o banco. Tem certeza?",
    );
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

  const displayLabel = isOwner ? "Owner" : me?.tenantId ?? "—";

  useEffect(() => {
    function onHotkey(ev: KeyboardEvent) {
      const target = ev.target as HTMLElement | null;
      const tag = (target?.tagName || "").toLowerCase();
      const isTypingField =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        !!target?.closest("[contenteditable='true']");
      if (isTypingField) return;

      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "k") {
        ev.preventDefault();
        globalSearchInputRef.current?.focus();
        globalSearchInputRef.current?.select();
      }
    }
    window.addEventListener("keydown", onHotkey);
    return () => window.removeEventListener("keydown", onHotkey);
  }, []);

  useEffect(() => {
    // Mantém comportamento do legado: busca global é contextual por tela.
    setGlobalSearchQuery(readScreenSearchFromTarget());
  }, [pathname]);

  useEffect(() => {
    syncingSearchRef.current = true;
    pushGlobalSearchToCurrentScreen(globalSearchQuery);
    queueMicrotask(() => {
      syncingSearchRef.current = false;
    });
  }, [globalSearchQuery]);

  useEffect(() => {
    function onDocumentInput(ev: Event) {
      if (syncingSearchRef.current) return;
      const source = ev.target;
      if (!(source instanceof HTMLInputElement)) return;
      const target = resolveScreenSearchTarget();
      if (!target || source !== target) return;
      const next = source.value ?? "";
      setGlobalSearchQuery((prev) => (prev === next ? prev : next));
    }
    document.addEventListener("input", onDocumentInput, true);
    return () => {
      document.removeEventListener("input", onDocumentInput, true);
    };
  }, [pathname]);

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 lg:px-6">
      {/* ─── Left side: hamburger + brand title ─── */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile hamburger — abre Sheet */}
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
              <Sidebar items={navItems} />
            </div>
          </SheetContent>
        </Sheet>

        {/* Brand title — matches Razor "Devcraft Studio • Portal RH" */}
        <span className="text-sm font-semibold text-lt-primary tracking-wide whitespace-nowrap hidden sm:inline">
          Devcraft Studio • Portal RH
        </span>
      </div>

      {/* ─── Center: global search (legacy behavior) ─── */}
      <div className="min-w-0 flex-1 max-w-xl">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-lt-primary/60" />
          <input
            ref={globalSearchInputRef}
            data-topbar-global-search="true"
            value={globalSearchQuery}
            onChange={(e) => setGlobalSearchQuery(e.target.value)}
            placeholder="Buscar..."
            className="h-9 w-full rounded-md border border-lt-primary/20 bg-white/85 pl-9 pr-16 text-sm outline-none transition-[color,box-shadow] focus-visible:border-lt-primary/45 focus-visible:ring-2 focus-visible:ring-lt-primary/20"
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-lt-primary/25 px-1.5 py-0.5 text-[11px] leading-none text-lt-primary/70">
            Ctrl + K
          </span>
        </div>
      </div>

      {/* ─── Right side: notifications + user dropdown ─── */}
      <div className="flex items-center gap-1.5">
        {!isAuthed ? (
          <Button variant="ghost" asChild>
            <Link href="/login">Login</Link>
          </Button>
        ) : (
          <>
            {/* ── Notification bell ── */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="relative inline-flex items-center justify-center rounded-md p-2 text-lt-primary/70 hover:bg-lt-primary/5 hover:text-lt-primary transition-colors"
                  title="Notificações"
                >
                  <Bell className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="px-3 py-2 border-b">
                  <div className="font-semibold text-sm">Notificações</div>
                  <div className="text-xs text-muted-foreground">Últimas atualizações</div>
                </div>
                <div className="py-3 px-3 text-sm text-muted-foreground text-center">
                  Sem notificações recentes.
                </div>
                <div className="border-t p-2">
                  <Button variant="ghost" size="sm" className="w-full" asChild>
                    <Link href="/notificacoes">Ver todas</Link>
                  </Button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

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
                <DropdownMenuItem disabled>
                  <User className="size-4 mr-2" />
                  Meu perfil
                </DropdownMenuItem>

                {/* Portal de Vagas */}
                <DropdownMenuItem asChild>
                  <a href={`${process.env.NEXT_PUBLIC_PORTAL_ORIGIN || ""}/PortalVagas`} target="_blank" rel="noopener">
                    <Globe className="size-4 mr-2" />
                    Portal de Vagas
                  </a>
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
                    defaultValue={typeof window !== "undefined" ? localStorage.getItem("renderrh.locale") || "pt-BR" : "pt-BR"}
                    onChange={(e) => {
                      const locale = e.target.value;
                      localStorage.setItem("renderrh.locale", locale);
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
  );
}
