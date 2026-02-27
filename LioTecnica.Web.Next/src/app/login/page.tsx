import LoginScreen from "@/features/auth/LoginScreen";

export const dynamic = "force-static";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnUrl?: string; error?: string; tenantId?: string }>;
}) {
  const { returnUrl, error, tenantId } = await searchParams;
  return <LoginScreen returnUrl={returnUrl} error={error} tenantId={tenantId} />;
}

