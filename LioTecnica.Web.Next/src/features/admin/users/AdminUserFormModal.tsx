"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";

/* ── Types ── */

interface LookupItem {
    id: string;
    name: string;
}

interface FuncionarioOption {
    id: string;
    nome: string;
    email: string;
    cargo: string | null;
    unidade: string | null;
}

interface UserDraft {
    fullName: string;
    email: string;
    password: string;
    isActive: boolean;
    roleId: string;
}

interface Props {
    open: boolean;
    editId: string | null;
    onClose: () => void;
    onSaved: () => void;
}

/* ── Helpers ── */

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, {
        ...init,
        headers: { Accept: "application/json", ...(init?.headers || {}) },
        cache: "no-store",
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    }
    if (res.status === 204) return null as T;
    return (await res.json()) as T;
}

const emptyUser: UserDraft = { fullName: "", email: "", password: "", isActive: true, roleId: "" };

/* ── FuncionarioAutocomplete — busca server-side ── */

function FuncionarioAutocomplete({
    value,
    onChange,
}: {
    value: FuncionarioOption | null;
    onChange: (v: FuncionarioOption | null) => void;
}) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [results, setResults] = useState<FuncionarioOption[]>([]);
    const [loading, setLoading] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const displayText = value ? `${value.nome}${value.email ? ` — ${value.email}` : ""}` : "";

    function search(q: string) {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(async () => {
            setLoading(true);
            try {
                type Res = { items: FuncionarioOption[] };
                const data = await fetchJson<Res>(
                    `/api/lookup/funcionarios?q=${encodeURIComponent(q)}&pageSize=20`,
                );
                setResults(data.items ?? []);
            } catch {
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 280);
    }

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div ref={containerRef} className="relative">
            <div className="flex gap-1">
                <input
                    className="h-9 flex-1 rounded-md border border-input px-3 text-sm bg-background"
                    placeholder="Buscar por nome, email, cargo, unidade..."
                    value={open ? query : displayText}
                    onFocus={() => { setOpen(true); setQuery(""); search(""); }}
                    onChange={(e) => { setQuery(e.target.value); search(e.target.value); }}
                />
                {value && (
                    <button
                        type="button"
                        onClick={() => { onChange(null); setQuery(""); setOpen(false); }}
                        className="px-2 text-muted-foreground hover:text-foreground text-xs"
                        tabIndex={-1}
                    >
                        ✕
                    </button>
                )}
            </div>
            {open && (
                <div className="absolute z-50 mt-1 w-full rounded-md border border-input bg-background shadow-lg max-h-60 overflow-y-auto">
                    {loading ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">Buscando...</div>
                    ) : results.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum resultado.</div>
                    ) : (
                        results.map((f) => (
                            <button
                                key={f.id}
                                type="button"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    onChange(f);
                                    setOpen(false);
                                    setQuery("");
                                }}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-muted flex flex-col gap-0.5 ${f.id === value?.id ? "bg-muted" : ""}`}
                            >
                                <span className="font-medium">{f.nome}</span>
                                <span className="text-xs text-muted-foreground">
                                    {[f.email, f.cargo, f.unidade].filter(Boolean).join(" · ")}
                                </span>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

/* ── Section divider ── */

function Section({ title }: { title: string }) {
    return (
        <div className="col-span-full">
            <div className="flex items-center gap-2 my-1">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</span>
                <div className="flex-1 border-t border-border" />
            </div>
        </div>
    );
}

/* ── Component ── */

export default function AdminUserFormModal({ open, editId, onClose, onSaved }: Props) {
    const [user, setUser] = useState<UserDraft>({ ...emptyUser });
    const [selectedFuncionario, setSelectedFuncionario] = useState<FuncionarioOption | null>(null);
    const [saving, setSaving] = useState(false);
    const [loadingEdit, setLoadingEdit] = useState(false);
    const [activeTab, setActiveTab] = useState("usuario");
    const [showPasswordField, setShowPasswordField] = useState(false);
    const [roles, setRoles] = useState<LookupItem[]>([]);

    const loadLookups = useCallback(async () => {
        type RoleRes = { id: string; name: string };
        const rolesRes = await fetchJson<RoleRes[]>("/api/roles").catch(() => []);
        setRoles(Array.isArray(rolesRes) ? rolesRes : []);
    }, []);

    useEffect(() => {
        if (!open) return;
        setActiveTab("usuario");
        setShowPasswordField(false);
        void loadLookups();

        if (editId) {
            setLoadingEdit(true);
            type UserDetail = {
                fullName: string;
                email: string;
                isActive: boolean;
                roles: { id: string; name: string }[];
                funcionario: { id: string; name: string; email: string } | null;
            };
            fetchJson<UserDetail>(`/api/users/${editId}`)
                .then((u) => {
                    setUser({
                        fullName: u.fullName,
                        email: u.email,
                        password: "",
                        isActive: u.isActive,
                        roleId: u.roles?.[0]?.id ?? "",
                    });
                    setSelectedFuncionario(
                        u.funcionario
                            ? { id: u.funcionario.id, nome: u.funcionario.name, email: u.funcionario.email, cargo: null, unidade: null }
                            : null,
                    );
                })
                .catch(() => toast.error("Falha ao carregar dados do usuário."))
                .finally(() => setLoadingEdit(false));
        } else {
            setUser({ ...emptyUser });
            setSelectedFuncionario(null);
        }
    }, [open, editId, loadLookups]);

    async function save() {
        if (!user.fullName.trim() || !user.email.trim()) {
            toast.error("Nome e email são obrigatórios.");
            return;
        }
        if (!editId && !user.password.trim()) {
            toast.error("A senha é obrigatória.");
            return;
        }
        if (!editId && user.password.length < 8) {
            toast.error("A senha deve ter no mínimo 8 caracteres.");
            return;
        }
        if (editId && showPasswordField && user.password && user.password.length < 8) {
            toast.error("A senha deve ter no mínimo 8 caracteres.");
            return;
        }

        setSaving(true);
        try {
            const roleIds = user.roleId ? [user.roleId] : [];

            if (editId) {
                await fetchJson(`/api/users/${editId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        fullName: user.fullName.trim(),
                        email: user.email.trim(),
                        isActive: user.isActive,
                        funcionarioId: selectedFuncionario?.id ?? null,
                    }),
                });
                await fetchJson(`/api/users/${editId}/roles`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ roleIds }),
                });
                if (showPasswordField && user.password.trim()) {
                    await fetchJson(`/api/users/${editId}/password`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ newPassword: user.password }),
                    });
                }
                toast.success("Usuário atualizado com sucesso!");
            } else {
                await fetchJson("/api/users", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        fullName: user.fullName.trim(),
                        email: user.email.trim(),
                        password: user.password,
                        isActive: user.isActive,
                        roleIds,
                        funcionarioId: selectedFuncionario?.id ?? null,
                    }),
                });
                toast.success("Usuário criado com sucesso!");
            }
            onSaved();
        } catch (e) {
            const raw = e instanceof Error ? e.message : "erro";
            const msg = raw.includes("PasswordRequiresNonAlphanumeric")
                ? "A senha deve conter ao menos um caractere especial (ex: @, #, !)."
                : raw.includes("PasswordTooShort")
                ? "A senha deve ter no mínimo 8 caracteres."
                : raw.includes("DuplicateUserName") || raw.includes("DuplicateEmail")
                ? "Já existe um usuário com este email."
                : `Falha ao salvar: ${raw}`;
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    }

    const L = "block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1";
    const S = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold">
                        {editId ? "Editar Usuário" : "Novo Usuário"}
                    </DialogTitle>
                </DialogHeader>

                {loadingEdit ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    </div>
                ) : (
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-1">
                        <TabsList className="mb-4">
                            <TabsTrigger value="usuario">Usuário</TabsTrigger>
                            <TabsTrigger value="colaborador">Colaborador</TabsTrigger>
                        </TabsList>

                        {/* ── Tab 1: Dados do Usuário ── */}
                        <TabsContent value="usuario">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                <Section title="Dados de Acesso" />

                                <div className="col-span-2">
                                    <label className={L}>Nome completo *</label>
                                    <Input
                                        value={user.fullName}
                                        onChange={(e) => setUser((d) => ({ ...d, fullName: e.target.value }))}
                                        placeholder="Nome completo"
                                    />
                                </div>

                                <div className="col-span-2">
                                    <label className={L}>Email *</label>
                                    <Input
                                        type="email"
                                        value={user.email}
                                        onChange={(e) => setUser((d) => ({ ...d, email: e.target.value }))}
                                        placeholder="email@exemplo.com"
                                    />
                                </div>

                                {!editId ? (
                                    <div className="col-span-2">
                                        <label className={L}>Senha *</label>
                                        <Input
                                            type="password"
                                            value={user.password}
                                            onChange={(e) => setUser((d) => ({ ...d, password: e.target.value }))}
                                            placeholder="Senha de acesso"
                                        />
                                        <p className="text-muted-foreground text-xs mt-1">
                                            Mínimo 8 caracteres, incluindo letras, números e ao menos um caractere especial (ex: @, #, !).
                                        </p>
                                    </div>
                                ) : (
                                    <div className="col-span-2">
                                        {!showPasswordField ? (
                                            <button
                                                type="button"
                                                onClick={() => setShowPasswordField(true)}
                                                className="text-xs text-primary hover:underline"
                                            >
                                                Alterar senha
                                            </button>
                                        ) : (
                                            <>
                                                <label className={L}>Nova senha</label>
                                                <Input
                                                    type="password"
                                                    value={user.password}
                                                    onChange={(e) => setUser((d) => ({ ...d, password: e.target.value }))}
                                                    placeholder="Nova senha"
                                                />
                                                <p className="text-muted-foreground text-xs mt-1">
                                                    Mínimo 8 caracteres, incluindo letras, números e ao menos um caractere especial (ex: @, #, !).
                                                </p>
                                            </>
                                        )}
                                    </div>
                                )}

                                <div>
                                    <label className={L}>Status</label>
                                    <select
                                        className={S}
                                        value={user.isActive ? "true" : "false"}
                                        onChange={(e) => setUser((d) => ({ ...d, isActive: e.target.value === "true" }))}
                                    >
                                        <option value="true">Ativo</option>
                                        <option value="false">Inativo</option>
                                    </select>
                                </div>

                                <div>
                                    <label className={L}>Perfil</label>
                                    <select
                                        className={S}
                                        value={user.roleId}
                                        onChange={(e) => setUser((d) => ({ ...d, roleId: e.target.value }))}
                                    >
                                        <option value="">— Selecione —</option>
                                        {roles.map((r) => (
                                            <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </TabsContent>

                        {/* ── Tab 2: Colaborador ── */}
                        <TabsContent value="colaborador">
                            <div className="space-y-3">
                                <Section title="Vínculo com Colaborador" />

                                <p className="text-xs text-muted-foreground">
                                    Busque e vincule um colaborador existente a este usuário.
                                </p>

                                <div>
                                    <label className={L}>Colaborador</label>
                                    <FuncionarioAutocomplete
                                        value={selectedFuncionario}
                                        onChange={setSelectedFuncionario}
                                    />
                                </div>

                                {selectedFuncionario && (
                                    <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm space-y-0.5">
                                        <div className="font-medium">{selectedFuncionario.nome}</div>
                                        {selectedFuncionario.email && (
                                            <div className="text-muted-foreground text-xs">{selectedFuncionario.email}</div>
                                        )}
                                        {(selectedFuncionario.cargo || selectedFuncionario.unidade) && (
                                            <div className="text-muted-foreground text-xs">
                                                {[selectedFuncionario.cargo, selectedFuncionario.unidade].filter(Boolean).join(" · ")}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                )}

                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={onClose} disabled={saving}>
                        Cancelar
                    </Button>
                    <Button onClick={() => void save()} disabled={saving || loadingEdit}>
                        {saving ? "Salvando…" : editId ? "Salvar alterações" : "Criar usuário"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
