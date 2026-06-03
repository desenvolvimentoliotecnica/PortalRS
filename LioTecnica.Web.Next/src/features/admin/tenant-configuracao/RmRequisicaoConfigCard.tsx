"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ConfiguracaoRmRequisicaoDto {
    endpointUrl: string | null;
    getEndpointUrl: string | null;
    username: string | null;
    password: string | null;
}

export default function RmRequisicaoConfigCard() {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [canManage, setCanManage] = useState(true);
    const [endpointUrl, setEndpointUrl] = useState("");
    const [getEndpointUrl, setGetEndpointUrl] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    useEffect(() => {
        let cancelled = false;
        setLoading(true);

        (async () => {
            try {
                const res = await apiFetch("/api/integracao-totvs/configuracao-rm-requisicao");
                if (res.status === 403) {
                    if (!cancelled) setCanManage(false);
                    return;
                }
                if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);

                const json = await res.json() as ConfiguracaoRmRequisicaoDto;
                if (cancelled) return;

                setCanManage(true);
                setEndpointUrl(json.endpointUrl ?? "");
                setGetEndpointUrl(json.getEndpointUrl ?? "");
                setUsername(json.username ?? "");
                setPassword(json.password ?? "");
            } catch {
                if (!cancelled) toast.error("Falha ao carregar a configuração de integração RM.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, []);

    const saveConfig = useCallback(async () => {
        setSaving(true);
        try {
            const res = await apiFetch("/api/integracao-totvs/configuracao-rm-requisicao", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    endpointUrl: endpointUrl.trim() || null,
                    getEndpointUrl: getEndpointUrl.trim() || null,
                    username: username.trim() || null,
                    password: password.trim() || null,
                }),
            });

            if (res.status === 403)
                throw new Error("Somente administradores podem alterar essa configuração.");
            if (!res.ok) {
                const body = await res.json().catch(() => ({ message: `Erro HTTP ${res.status}` }));
                throw new Error((body as { message?: string }).message || `Erro HTTP ${res.status}`);
            }

            const json = await res.json() as ConfiguracaoRmRequisicaoDto;
            setEndpointUrl(json.endpointUrl ?? "");
            setGetEndpointUrl(json.getEndpointUrl ?? "");
            setUsername(json.username ?? "");
            setPassword(json.password ?? "");
            toast.success("Configuração de requisição RM salva.");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Falha ao salvar configuração RM.");
        } finally {
            setSaving(false);
        }
    }, [endpointUrl, getEndpointUrl, password, username]);

    if (!canManage) return null;

    return (
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-4">
            <div>
                <h3 className="text-sm font-semibold">Configuração da integração de requisições RM</h3>
                <p className="text-xs text-muted-foreground mt-1">
                    Informe as URLs de criação (POST) e consulta (GET) e as credenciais BasicAuth usadas pelo RM.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-3">
                    <Label htmlFor="tenant-rm-endpoint-url">Endpoint POST de criação</Label>
                    <Input
                        id="tenant-rm-endpoint-url"
                        value={endpointUrl}
                        onChange={(e) => setEndpointUrl(e.target.value)}
                        placeholder="http://localhost:8051/RMSRestDataServer/rest/RhuReqAumentoQuadroData"
                        disabled={loading || saving}
                    />
                </div>

                <div className="md:col-span-3">
                    <Label htmlFor="tenant-rm-get-endpoint-url">Endpoint GET de consulta</Label>
                    <Input
                        id="tenant-rm-get-endpoint-url"
                        value={getEndpointUrl}
                        onChange={(e) => setGetEndpointUrl(e.target.value)}
                        placeholder="http://172.19.30.37:8051/api/framework/v1/consultaSQLServer/RealizaConsulta/KNG.V.003/0/V/?parameters=COLIGADA={COLIGADA};IDREQ={IDREQ}"
                        disabled={loading || saving}
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                        Use <code>{`{COLIGADA}`}</code> e <code>{`{IDREQ}`}</code> como variáveis, ou cole a URL TOTVS com <code>COLIGADA=1;IDREQ=1</code>; o portal troca esses valores ao consultar o status.
                    </p>
                </div>

                <div>
                    <Label htmlFor="tenant-rm-username">Usuário</Label>
                    <Input
                        id="tenant-rm-username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="usuario.rm"
                        disabled={loading || saving}
                    />
                </div>

                <div>
                    <Label htmlFor="tenant-rm-password">Senha</Label>
                    <Input
                        id="tenant-rm-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Senha BasicAuth"
                        disabled={loading || saving}
                    />
                </div>

                <div className="flex items-end">
                    <Button
                        onClick={() => void saveConfig()}
                        disabled={loading || saving}
                        className="w-full"
                    >
                        {saving ? "Salvando..." : "Salvar configuração"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
