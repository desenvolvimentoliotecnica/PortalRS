import { AuthGuard } from "@/hooks/useAuth";
import TenantDetailByParam from "./TenantDetailByParam";

export function generateStaticParams() {
  return [{ tenantId: "__" }];
}

export default function Page({ params }: { params: Promise<{ tenantId: string }> }) {
  return (
    <AuthGuard>
      <TenantDetailByParam params={params} />
    </AuthGuard>
  );
}
