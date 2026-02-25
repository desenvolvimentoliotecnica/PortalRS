"use client";

import { useState } from "react";
import {
  Bell,
  Building2,
  ChevronDown,
  Globe,
  LogOut,
  Menu,
  TriangleAlert,
  User,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import type { BffNavItem } from "@/server/bff/navigation.schema";
import type { BffMe } from "@/server/bff/schema";

const BASE = "/app";

export default function TopbarClient({
  navItems,
  me,
}: {
  navItems: BffNavItem[];
  me: BffMe | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  /* ─── Actions ─── */

  async function logout() {
    setBusy(true);
    try {
      await fetch(`${BASE}/bff/auth/logout`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });
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
      const res = await fetch(`${BASE}/bff/auth/switch-tenant`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          tenantId: "owner",
          returnUrl: "/Owner/Tenants",
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        redirectUrl?: string;
        message?: string;
      } | null;
      if (!res.ok)
        throw new Error(json?.message || "Falha ao trocar tenant.");
      router.replace(json?.redirectUrl || "/Owner/Tenants");
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
      const res = await fetch(`${BASE}/api/owner/tenants/reset-dev`, {
        method: "POST",
        headers: { Accept: "application/json" },
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

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5 lg:px-6">
      {/* ─── Left side: hamburger + brand title ─── */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile hamburger */}
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
                  My profile
                </DropdownMenuItem>

                {/* Portal de Vagas */}
                <DropdownMenuItem asChild>
                  <a href="/PortalVagas" target="_blank" rel="noopener">
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

                {/* Language */}
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  Language
                </DropdownMenuLabel>
                <div className="px-2 pb-2">
                  <select
                    className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                    defaultValue="pt-BR"
                    onChange={(e) => {
                      const culture = e.target.value;
                      const form = document.createElement("form");
                      form.method = "POST";
                      form.action = "/Culture/Set";
                      const cultureInput = document.createElement("input");
                      cultureInput.type = "hidden";
                      cultureInput.name = "culture";
                      cultureInput.value = culture;
                      form.appendChild(cultureInput);
                      const returnInput = document.createElement("input");
                      returnInput.type = "hidden";
                      returnInput.name = "returnUrl";
                      returnInput.value = window.location.pathname;
                      form.appendChild(returnInput);
                      document.body.appendChild(form);
                      form.submit();
                    }}
                  >
                    <option value="pt-BR">Português (Brasil)</option>
                    <option value="en-US">English (US)</option>
                  </select>
                </div>

                <DropdownMenuSeparator />

                {/* Sign out */}
                <DropdownMenuItem
                  onClick={() => void logout()}
                  disabled={busy}
                  className="text-red-600 focus:text-red-700"
                >
                  <LogOut className="size-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </div>
  );
}
