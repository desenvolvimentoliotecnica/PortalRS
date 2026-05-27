import PublicInterviewPageClient from "./PublicInterviewPageClient";

export function generateStaticParams() {
  return [{ token: "__" }];
}

export default function PublicInterviewPage() {
  return <PublicInterviewPageClient />;
}
