import { redirect } from "next/navigation";
import { requireMe } from "@/server/bff/requireMe";

export default async function DepartamentosPage() {
    await requireMe("/app/departamentos");
    // Departamentos is disabled in the Razor app — redirects to Áreas
    redirect("/areas");
}
