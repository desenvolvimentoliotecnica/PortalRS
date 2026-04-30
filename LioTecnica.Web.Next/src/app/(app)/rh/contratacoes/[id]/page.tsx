import RhContratacaoDetailPageClient from "./RhContratacaoDetailPageClient";

/** Static export placeholder path; real IDs are resolved on the client. */
export function generateStaticParams() {
    return [{ id: "__" }];
}

export default function RhContratacaoDetailPage() {
    return <RhContratacaoDetailPageClient />;
}
