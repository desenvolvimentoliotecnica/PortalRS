import PublicApprovePageClient from "./PublicApprovePageClient";

export function generateStaticParams() {
  return [{ token: "__" }];
}

export default function Page() {
  return <PublicApprovePageClient />;
}
