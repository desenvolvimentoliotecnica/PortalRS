"use client";

import { Mail, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhatsAppContactButton } from "@/components/contact/WhatsAppContactButton";
import { useCandidatoPhoneLookup } from "@/hooks/useCandidatoPhoneLookup";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import type { TopMatchRow } from "../dashboardTypes";

function BadgeEtapa({ etapa }: { etapa: string }) {
  const e = (etapa || "").toLowerCase();
  const color =
    e.includes("reprov")
      ? "bg-red-500/15 text-red-700"
      : e.includes("aprov")
        ? "bg-emerald-500/15 text-emerald-700"
        : e.includes("entrev")
          ? "bg-amber-500/15 text-amber-700"
          : e.includes("triag")
            ? "bg-blue-500/15 text-blue-700"
            : "bg-zinc-400/15 text-zinc-600";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}>
      {etapa}
    </span>
  );
}

function OriginBadge({ origem }: { origem: string }) {
  const raw = (origem || "").trim();
  const lower = raw.toLowerCase();
  const Icon = lower === "email" ? Mail : Folder;
  const label = raw || "-";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-slate-100 text-slate-600">
      <Icon className="size-3" />
      {label}
    </span>
  );
}

function goToVagaDetail(vagaId: string) {
  if (!vagaId) return;
  const url = new URL(`/app/vagas`, window.location.origin);
  url.searchParams.set("vagaId", vagaId);
  url.searchParams.set("open", "detail");
  window.location.href = url.toString();
}

function goToCreateVaga() {
  const url = new URL(`/app/vagas`, window.location.origin);
  url.searchParams.set("open", "create");
  window.location.href = url.toString();
}

export function TopMatchesWidget({ topMatches }: { topMatches: TopMatchRow[] }) {
  const { getPhone } = useCandidatoPhoneLookup(topMatches.length > 0);

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/50 bg-card shadow-sm p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <div className="text-sm font-semibold">Melhores matches</div>
          <div className="text-muted-foreground text-xs">Top 15 por score</div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            Exportar
          </Button>
          <Button size="sm" onClick={() => goToCreateVaga()}>
            Nova vaga
          </Button>
        </div>
      </div>

      <div className="overflow-auto flex-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead style={{ minWidth: 220 }}>Vaga</TableHead>
              <TableHead style={{ minWidth: 200 }}>Candidato</TableHead>
              <TableHead style={{ minWidth: 170 }}>Origem</TableHead>
              <TableHead style={{ minWidth: 240 }}>Match</TableHead>
              <TableHead style={{ minWidth: 170 }}>Etapa</TableHead>
              <TableHead className="text-right" style={{ minWidth: 150 }}>
                Ações
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topMatches.length ? (
              topMatches.map((x) => (
                <TableRow key={`${x.vagaId}|${x.candidatoId}`}>
                  <TableCell>
                    <div className="font-medium text-sm">{x.vagaTitulo || "-"}</div>
                    <div className="text-muted-foreground text-xs">Código: {x.vagaCodigo || "-"}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{x.candidatoNome || "-"}</div>
                    <div className="mt-1">
                      <WhatsAppContactButton
                        size="xs"
                        celular={getPhone(x.candidatoId).celular}
                        fone={getPhone(x.candidatoId).fone}
                        candidatoNome={x.candidatoNome}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <OriginBadge origem={x.origem || "-"} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-black/10 overflow-hidden">
                        <div
                          className="h-full bg-[rgb(var(--lt-primary))]"
                          style={{ width: `${x.matchScore}%` }}
                        />
                      </div>
                      <div className="font-bold tabular-nums font-mono w-[52px] text-right">
                        {x.matchScore}%
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <BadgeEtapa etapa={x.etapa || "Triagem"} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToVagaDetail(x.vagaId)}
                    >
                      Ver vaga
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhum registro atende o filtro atual.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
