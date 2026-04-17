import ExitInterviewPageClient from "./ExitInterviewPageClient";

export function generateStaticParams() {
  return [{ token: "__" }];
}

export default function Page() {
  return <ExitInterviewPageClient />;
}
