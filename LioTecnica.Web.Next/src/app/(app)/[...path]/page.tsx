import Link from "next/link";

import EmptyState from "@/components/feedback/EmptyState";
import { Button } from "@/components/ui/button";
import { requireMe } from "@/server/bff/requireMe";

export const dynamic = "force-static";

export default async function LegacyFallbackPage({
  params,
}: {
  params: { path: string[] };
}) {
  const path = Array.isArray(params.path) ? params.path : [];
  const nextPath = `/app/${path.join("/")}`;

  // Enforce auth for any internal route.
  await requireMe(nextPath);

  return (
    <EmptyState
      title="Rota ainda não migrada"
      description={`A rota /${path.join("/")} ainda não foi migrada para o Next.js.`}
      action={
        <Button asChild variant="outline">
          <Link href="/dashboard">Voltar ao dashboard</Link>
        </Button>
      }
    />
  );
}

