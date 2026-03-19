"use client";

import { Clock } from "lucide-react";

export default function BatidaPontoScreen() {
    return (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center max-w-md mx-auto">
            <div className="rounded-full bg-muted/30 p-4">
                <Clock className="size-10 text-muted-foreground" />
            </div>
            <div>
                <h3 className="font-semibold text-base mb-1">Controle de Ponto</h3>
                <p className="text-sm text-muted-foreground">
                    Este módulo está em desenvolvimento e será disponibilizado em breve.
                </p>
            </div>
        </div>
    );
}
