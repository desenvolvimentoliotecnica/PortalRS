import PublicInterviewScreen from "@/features/recrutamento/entrevistas-publicas/PublicInterviewScreen";

export default async function PublicInterviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicInterviewScreen token={token} />;
}
