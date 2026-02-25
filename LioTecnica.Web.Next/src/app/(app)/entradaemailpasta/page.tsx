import { headers } from "next/headers";

import { requireMe } from "@/server/bff/requireMe";
import { legacyAbsoluteUrl } from "@/server/legacy/urls";
import EntradaEmailPastaScreen from "@/features/recrutamento/entradaemailpasta/EntradaEmailPastaScreen";

export default async function EntradaEmailPastaPage() {
  const me = await requireMe("/app/entradaemailpasta");
  const h = await headers();
  const cookie = h.get("cookie") ?? "";

  const [vRes, iRes] = await Promise.all([
    fetch(await legacyAbsoluteUrl("/EntradaEmailPasta/_api/vagas"), { headers: { cookie }, cache: "no-store" }),
    fetch(await legacyAbsoluteUrl("/EntradaEmailPasta/_api/inbox"), { headers: { cookie }, cache: "no-store" }),
  ]);

  const initialVagas = vRes.ok ? ((await vRes.json()) as unknown) : [];
  const initialInbox = iRes.ok ? ((await iRes.json()) as unknown) : [];

  return (
    <EntradaEmailPastaScreen
      tenantId={me.tenantId}
      initialVagas={initialVagas}
      initialInbox={initialInbox}
    />
  );
}

