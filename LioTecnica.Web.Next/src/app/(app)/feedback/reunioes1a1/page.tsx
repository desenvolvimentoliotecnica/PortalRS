import { requireMe } from "@/server/bff/requireMe";
import Reunioes1a1Screen from "@/features/feedback/Reunioes1a1Screen";

export default async function Reunioes1a1Page() {
    await requireMe("/app/feedback/reunioes1a1");
    return <Reunioes1a1Screen />;
}
