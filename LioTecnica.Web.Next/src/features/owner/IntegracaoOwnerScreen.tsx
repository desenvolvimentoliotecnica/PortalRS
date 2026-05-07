"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import IntegracaoOutboundTab from "./IntegracaoOutboundTab";
import IntegracaoGestorHierarchyTab from "./IntegracaoGestorHierarchyTab";
import SyncRmOwnerTab from "./SyncRmOwnerTab";

export default function IntegracaoOwnerScreen() {
    return (
        <section className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Integração TOTVS — Owner</h1>
                <p className="text-muted-foreground text-sm mt-0.5">
                    Visão cross-tenant: integrações outbound (Portal → TOTVS) e sincronização inbound (RM → Portal)
                </p>
            </div>

            <Tabs defaultValue="outbound">
                <TabsList>
                    <TabsTrigger value="outbound">Integrações TOTVS</TabsTrigger>
                    <TabsTrigger value="sync-rm">Sincronização RM</TabsTrigger>
                    <TabsTrigger value="gestor-rm">Gestores RM (consulta)</TabsTrigger>
                </TabsList>
                <TabsContent value="outbound">
                    <IntegracaoOutboundTab />
                </TabsContent>
                <TabsContent value="sync-rm">
                    <SyncRmOwnerTab />
                </TabsContent>
                <TabsContent value="gestor-rm">
                    <IntegracaoGestorHierarchyTab />
                </TabsContent>
            </Tabs>
        </section>
    );
}
