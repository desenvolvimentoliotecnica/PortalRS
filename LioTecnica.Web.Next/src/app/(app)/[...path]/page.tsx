import Link from "next/link";

import EmptyState from "@/components/feedback/EmptyState";
import { Button } from "@/components/ui/button";

export function generateStaticParams() {
  return [{ path: ["legacy"] }];
}

export default async function LegacyFallbackPage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path: pathParam } = await params;
  const path = Array.isArray(pathParam) ? pathParam : [];
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

